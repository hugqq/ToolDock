import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { emitTo, listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ExternalLink, File, Folder, RefreshCw, Search, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isLatestRequest, moveSelection, rankToolMatches } from "../lib/commandPalette";
import { TOOLS } from "../tools/registry";
import type { FileSearchResponse, FileSearchResult, ToolSearchCandidate } from "../types/search";

const EVERYTHING_DOWNLOAD_URL = "https://www.voidtools.com/downloads/";
const PALETTE_WIDTH = 720;
const PALETTE_COLLAPSED_HEIGHT = 64;
const PALETTE_EXPANDED_HEIGHT = 520;
type PaletteItem =
  | { type: "tool"; value: ToolSearchCandidate }
  | { type: "file"; value: FileSearchResult };

export default function CommandPalette() {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequest = useRef(0);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileSearchResult[]>([]);
  const [provider, setProvider] = useState<FileSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [openError, setOpenError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const expanded = Boolean(query.trim());

  const candidates = useMemo<ToolSearchCandidate[]>(
    () => TOOLS.map((tool) => ({
      id: tool.id,
      route: tool.route,
      name: t(tool.nameKey),
      description: t(tool.descriptionKey),
    })),
    [t],
  );
  const tools = useMemo(() => rankToolMatches(candidates, query, 6), [candidates, query]);
  const items = useMemo<PaletteItem[]>(
    () => [
      ...tools.map((value) => ({ type: "tool" as const, value })),
      ...files.map((value) => ({ type: "file" as const, value })),
    ],
    [files, tools],
  );

  const refreshStatus = async () => {
    try {
      const status = await invoke<FileSearchResponse>("get_file_search_status");
      setProvider(status);
      return status;
    } catch {
      const fallback: FileSearchResponse = { provider: "unsupported", available: false, results: [], errorCode: "provider_unavailable" };
      setProvider(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    void refreshStatus();
    const unlisten = listen("command-palette-focus", () => {
      setQuery("");
      setFiles([]);
      setSelected(0);
      setOpenError("");
      inputRef.current?.focus();
      void refreshStatus();
    });
    queueMicrotask(() => inputRef.current?.focus());
    return () => {
      unlisten.then((dispose) => dispose());
    };
  }, []);

  useEffect(() => {
    const height = expanded
      ? PALETTE_EXPANDED_HEIGHT
      : PALETTE_COLLAPSED_HEIGHT;
    void getCurrentWindow().setSize(new LogicalSize(PALETTE_WIDTH, height));
  }, [expanded]);

  useEffect(() => {
    setSelected(0);
    setOpenError("");
    const trimmed = query.trim();
    if (!trimmed) {
      activeRequest.current += 1;
      setFiles([]);
      setLoading(false);
      return;
    }

    const requestId = ++activeRequest.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await invoke<FileSearchResponse>("search_local_files", { query: trimmed, limit: 30 });
        if (!isLatestRequest(requestId, activeRequest.current)) return;
        setProvider(response);
        setFiles(response.results);
      } catch {
        if (!isLatestRequest(requestId, activeRequest.current)) return;
        setFiles([]);
        setProvider((current) => ({
          provider: current?.provider ?? "unsupported",
          available: false,
          results: [],
          errorCode: "query_failed",
        }));
      } finally {
        if (isLatestRequest(requestId, activeRequest.current)) setLoading(false);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [query, retryToken]);

  const choose = async (item: PaletteItem | undefined) => {
    if (!item) return;
    setOpenError("");
    if (item.type === "tool") {
      const main = await WebviewWindow.getByLabel("main");
      await main?.show();
      await main?.unminimize();
      await main?.setFocus();
      await emitTo("main", "navigate-to-tool", item.value.route);
      await getCurrentWindow().hide();
      return;
    }
    try {
      await invoke("open_search_result", { path: item.value.path });
      await getCurrentWindow().hide();
    } catch {
      setOpenError(t("command_palette.missing_result"));
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((index) => moveSelection(index, event.key === "ArrowDown" ? 1 : -1, items.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      void choose(items[selected]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      void getCurrentWindow().hide();
    }
  };

  const fileOffset = tools.length;
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-(--card-bg) text-(--text-main)">
      <div className="flex items-center gap-3 border-b border-(--border-color) px-5 py-4">
        <Search size={21} className="text-primary" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("command_palette.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-(--text-muted)"
        />
        <kbd className="rounded border border-(--border-color) px-2 py-1 text-xs text-(--text-muted)">Esc</kbd>
      </div>

      {expanded && (
        <>
          <div className="flex-1 overflow-auto py-2">
        {tools.length > 0 && (
          <ResultGroup title={t("command_palette.tools")}>
            {tools.map((tool, index) => (
              <ResultRow key={tool.id} selected={selected === index} icon={<Wrench size={18} />} title={tool.name} subtitle={tool.description} onClick={() => void choose({ type: "tool", value: tool })} />
            ))}
          </ResultGroup>
        )}
        {query.trim() && (
          <ResultGroup title={t("command_palette.files")} loading={loading}>
            {files.map((file, index) => (
              <ResultRow key={file.path} selected={selected === fileOffset + index} icon={<FileResultIcon file={file} />} title={file.name} subtitle={file.path} onClick={() => void choose({ type: "file", value: file })} />
            ))}
            {!loading && provider?.available && !provider.errorCode && files.length === 0 && <Message>{t("command_palette.no_files")}</Message>}
            {!loading && provider?.errorCode === "query_failed" && (
              <div className="mx-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p>{t("command_palette.query_failed")}</p>
                <button className="mt-2 flex items-center gap-1 text-primary" onClick={() => setRetryToken((value) => value + 1)}><RefreshCw size={14} />{t("command_palette.retry")}</button>
              </div>
            )}
            {!provider?.available && provider?.errorCode !== "query_failed" && (
              <div className="mx-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p>{provider?.provider === "everything" ? t("command_palette.everything_unavailable") : provider?.provider === "spotlight" ? t("command_palette.spotlight_unavailable") : t("command_palette.unsupported")}</p>
                <div className="mt-2 flex gap-2">
                  {provider?.provider === "everything" && <button className="flex items-center gap-1 text-primary" onClick={() => void openUrl(EVERYTHING_DOWNLOAD_URL)}><ExternalLink size={14} />{t("command_palette.download_everything")}</button>}
                  <button className="flex items-center gap-1 text-primary" onClick={() => { void refreshStatus(); setRetryToken((value) => value + 1); }}><RefreshCw size={14} />{t("command_palette.retry")}</button>
                </div>
              </div>
            )}
          </ResultGroup>
        )}
            {openError && <div className="mx-4 mt-2 text-sm text-red-500">{openError}</div>}
          </div>
          <div className="flex justify-between border-t border-(--border-color) px-5 py-2 text-xs text-(--text-muted)">
            <span>↑↓ {t("command_palette.navigate")}</span><span>Enter {t("command_palette.open")}</span>
          </div>
        </>
      )}
    </div>
  );
}

function ResultGroup({ title, loading, children }: { title: string; loading?: boolean; children: React.ReactNode }) {
  return <section className="mb-2"><h2 className="flex items-center gap-2 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{title}{loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />}</h2>{children}</section>;
}

function FileResultIcon({ file }: { file: FileSearchResult }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [file.iconDataUrl]);

  if (file.kind === "directory") return <Folder size={18} />;
  if (!file.iconDataUrl || imageFailed) return <File size={18} />;

  return (
    <img
      src={file.iconDataUrl}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="h-[18px] w-[18px] object-contain"
      onError={() => setImageFailed(true)}
    />
  );
}

function ResultRow({ selected, icon, title, subtitle, onClick }: { selected: boolean; icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return <button className={`mx-2 flex w-[calc(100%_-_1rem)] items-center gap-3 rounded-lg px-3 py-2 text-left ${selected ? "bg-primary/15 text-primary" : "hover:bg-(--bg-main)"}`} onMouseDown={(event) => event.preventDefault()} onClick={onClick}><span className="shrink-0">{icon}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{title}</span><span className="block truncate text-xs text-(--text-muted)">{subtitle}</span></span></button>;
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-5 text-center text-sm text-(--text-muted)">{children}</div>;
}

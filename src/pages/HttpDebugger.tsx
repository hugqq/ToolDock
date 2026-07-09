import { Button } from "@mui/material";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { invoke } from "@tauri-apps/api/core";
import { ToolLayout } from "../components/layout/ToolLayout";
import {
  createMultipartField,
  generateCurl,
  normalizeHttpRequest,
  validateHttpDraft,
} from "../lib/httpDebugger";
import type {
  HttpDebugRequest,
  HttpDebugResponse,
  HttpDraftErrors,
  HttpHistoryEntry,
  SendHttpResult,
} from "../types/httpDebugger";
import { HistoryPanel } from "./http-debugger/HistoryPanel";
import { RequestEditor } from "./http-debugger/RequestEditor";
import { ResponseViewer } from "./http-debugger/ResponseViewer";

const row = () => ({ id: crypto.randomUUID(), enabled: true, key: "", value: "" });
const initialRequest = (): HttpDebugRequest => ({
  method: "GET",
  url: "",
  query: [row()],
  headers: [row()],
  bodyMode: "none",
  bodyText: "",
  formFields: [row()],
  multipartFields: [createMultipartField()],
  timeoutMs: 30_000,
});

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return String(error);
}

export default function HttpDebugger() {
  const { t } = useTranslation();
  const [request, setRequest] = useState<HttpDebugRequest>(initialRequest);
  const [response, setResponse] = useState<HttpDebugResponse | null>(null);
  const [history, setHistory] = useState<HttpHistoryEntry[]>([]);
  const [errors, setErrors] = useState<HttpDraftErrors>({});
  const [sending, setSending] = useState(false);

  const loadHistory = async () => {
    try { setHistory(await invoke<HttpHistoryEntry[]>("list_http_history")); } catch { /* request sending still works */ }
  };
  useEffect(() => { void loadHistory(); }, []);

  const send = async () => {
    const nextErrors = validateHttpDraft(request);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSending(true);
    try {
      const result = await invoke<SendHttpResult>("send_http_request", { request });
      setResponse(result.response);
      if (!result.historySaved) toast.error(t("tools.http_debugger.history_save_failed"));
      await loadHistory();
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
      const detail = code === "FILE_READ_FAILED"
        ? t("tools.http_debugger.errors.file_read_failed")
        : errorMessage(error);
      toast.error(t("tools.http_debugger.request_failed", { error: detail }));
    } finally {
      setSending(false);
    }
  };

  const copyCurl = async () => {
    try {
      const platform = navigator.userAgent.includes("Windows") ? "windows" : "macos";
      await navigator.clipboard.writeText(generateCurl(request, platform));
      toast.success(t("tools.http_debugger.curl_copied"));
    } catch {
      toast.error(t("tools.http_debugger.errors.invalid_url"));
    }
  };

  const deleteHistory = async (id: string) => {
    await invoke("delete_http_history", { id });
    setHistory((items) => items.filter((item) => item.id !== id));
  };
  const clearHistory = async () => {
    if (!window.confirm(t("tools.http_debugger.clear_confirm"))) return;
    await invoke("clear_http_history");
    setHistory([]);
  };

  return (
    <ToolLayout
      title={t("tools.http_debugger.name")}
      status={sending ? t("tools.http_debugger.sending") : t("common.ready")}
      actions={<Button size="small" variant="outlined" startIcon={<Copy size={15} />} onClick={copyCurl}>{t("tools.http_debugger.copy_curl")}</Button>}
    >
      <div className="grid min-h-[680px] flex-1 grid-cols-1 gap-4 xl:grid-cols-[250px_minmax(420px,1fr)_minmax(360px,1fr)]">
        <HistoryPanel entries={history} onRestore={(entry) => { setRequest(normalizeHttpRequest(entry.request)); setErrors({}); }} onDelete={deleteHistory} onClear={clearHistory} />
        <RequestEditor request={request} errors={errors} sending={sending} onChange={setRequest} onSend={send} />
        <ResponseViewer response={response} />
      </div>
    </ToolLayout>
  );
}

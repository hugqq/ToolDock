import { IconButton } from "@mui/material";
import { RotateCcw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HttpHistoryEntry } from "../../types/httpDebugger";

interface Props {
  entries: HttpHistoryEntry[];
  onRestore: (entry: HttpHistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ entries, onRestore, onDelete, onClear }: Props) {
  const { t } = useTranslation();
  return (
    <aside className="flex min-h-0 flex-col rounded-xl border border-(--border-color) bg-(--card-bg)">
      <div className="flex items-center justify-between border-b border-(--border-color) p-3">
        <strong className="text-sm">{t("tools.http_debugger.history")}</strong>
        <button className="text-xs text-red-500 disabled:opacity-40" disabled={!entries.length} onClick={onClear}>
          {t("tools.http_debugger.clear")}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {!entries.length && <div className="p-4 text-sm text-(--text-muted)">{t("tools.http_debugger.no_history")}</div>}
        {entries.map((entry) => (
          <div key={entry.id} className="border-b border-(--border-color) p-3 hover:bg-(--bg-main)">
            <button className="block w-full text-left" onClick={() => onRestore(entry)}>
              <div className="flex gap-2 text-sm"><strong>{entry.request.method}</strong><span className="truncate">{entry.request.url}</span></div>
              <div className="mt-1 text-xs text-(--text-muted)">{entry.responseStatus} · {entry.durationMs} ms · {new Date(entry.createdAt).toLocaleString()}</div>
            </button>
            <div className="mt-1 flex justify-end">
              <IconButton size="small" title={t("tools.http_debugger.restore")} onClick={() => onRestore(entry)}><RotateCcw size={14} /></IconButton>
              <IconButton size="small" title={t("common.delete")} onClick={() => onDelete(entry.id)}><Trash2 size={14} /></IconButton>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

import React from "react";
import { X, Folder, Copy } from "lucide-react";
import { Candidate } from "../types";
import { useTranslation } from "react-i18next";
import { invokeWrapper } from "../api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  candidates: Candidate[];
  loading?: boolean;
}

export const CandidateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  candidates,
  loading = false,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const openInExplorer = async (path?: string) => {
    if (!path) return;
    try {
      await invokeWrapper("reveal_in_explorer", { path });
    } catch (e) {
      console.error(e);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("copy failed", e);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card-bg)] rounded-2xl w-[640px] max-w-[95vw] shadow-2xl border border-[var(--border-color)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-[var(--text-main)]">
              {t("tools.hotkey_query.candidates.title")}
            </h3>
          </div>
          <button
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6">
          {loading ? (
            <p className="text-[15px] leading-relaxed text-[var(--text-muted)]">
              {t("common.loading")}
            </p>
          ) : candidates.length === 0 ? (
            <p className="text-[15px] leading-relaxed text-[var(--text-muted)]">
              {t("tools.hotkey_query.candidates.empty")}
            </p>
          ) : (
            <div className="space-y-3">
              {candidates.map((c) => (
                <div key={c.pid} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-[var(--text-main)]">
                      {c.name || c.exe_path || t("tools.hotkey_query.unknown")}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {c.window_title && (
                        <span className="mr-3">{c.window_title}</span>
                      )}
                      <span className="mr-3">PID: {c.pid}</span>
                      {c.exe_path && (
                        <span className="truncate">{c.exe_path}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.exe_path && (
                      <button
                        className="px-3 py-1 rounded-xl bg-[var(--bg-main)] text-sm text-[var(--text-muted)] hover:bg-[var(--border-color)]"
                        onClick={() => openInExplorer(c.exe_path!)}
                      >
                        <Folder size={14} />
                      </button>
                    )}
                    <button
                      className="px-3 py-1 rounded-xl bg-[var(--bg-main)] text-sm text-[var(--text-muted)] hover:bg-[var(--border-color)]"
                      onClick={() => copyText(String(c.pid))}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-black/[0.02] dark:bg-white/[0.02] flex justify-end gap-3 border-t border-[var(--border-color)]">
          <button
            className="px-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm font-medium hover:bg-[var(--border-color)]"
            onClick={onClose}
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CandidateModal;

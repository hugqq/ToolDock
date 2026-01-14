import React from "react";
import { X, Download, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  json?: string;
}

export const DiagnosticModal: React.FC<Props> = ({ isOpen, onClose, json }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const copyText = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("copy failed", e);
    }
  };

  const download = (text?: string) => {
    if (!text) return;
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagnostic.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card-bg)] rounded-2xl w-[800px] max-w-[95vw] max-h-[80vh] overflow-auto shadow-2xl border border-[var(--border-color)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-[var(--text-main)]">
              {t("tools.hotkey_query.diagnostic.title")}
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
          <div className="mb-3 flex justify-end gap-2">
            <button
              className="px-3 py-1 rounded-xl bg-[var(--bg-main)] text-sm text-[var(--text-muted)] hover:bg-[var(--border-color)]"
              onClick={() => copyText(json)}
            >
              <Copy size={14} /> {t("tools.hotkey_query.diagnostic.copy")}
            </button>
            <button
              className="px-3 py-1 rounded-xl bg-[var(--bg-main)] text-sm text-[var(--text-muted)] hover:bg-[var(--border-color)]"
              onClick={() => download(json)}
            >
              <Download size={14} />{" "}
              {t("tools.hotkey_query.diagnostic.download")}
            </button>
          </div>
          <pre className="bg-[var(--bg-main)] rounded p-4 text-xs whitespace-pre-wrap">
            {json}
          </pre>
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

export default DiagnosticModal;

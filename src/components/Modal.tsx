/**
 * 通用弹窗组件
 * 支持确认、警告、错误等类型，适配黑白主题
 */
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, XCircle, X, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: "info" | "warning" | "error" | "danger" | "success";
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  message,
  type = "info",
  confirmText,
  cancelText,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "warning":
        return <AlertTriangle size={24} className="text-amber-500" />;
      case "error":
      case "danger":
        return <XCircle size={24} className="text-red-500" />;
      case "success":
        return <CheckCircle2 size={24} className="text-green-500" />;
      default:
        return <Info size={24} className="text-blue-500" />;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card-bg)] rounded-2xl w-[420px] max-w-[90vw] shadow-2xl border border-[var(--border-color)] overflow-hidden animate-in slide-in-from-bottom-4 duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getIcon()}
            <h3 className="text-lg font-bold text-[var(--text-main)]">
              {title}
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
          <p className="text-[15px] leading-relaxed text-[var(--text-muted)]">
            {message}
          </p>
        </div>
        <div className="px-6 py-4 bg-black/[0.02] dark:bg-white/[0.02] flex justify-end gap-3 border-t border-[var(--border-color)]">
          <button
            className="px-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm font-medium hover:bg-[var(--border-color)] transition-colors"
            onClick={onClose}
          >
            {cancelText || t("common.cancel")}
          </button>
          <button
            className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-all shadow-lg ${
              type === "danger" || type === "error"
                ? "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                : type === "success"
                ? "bg-green-500 hover:bg-green-600 shadow-green-500/20"
                : type === "warning"
                ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                : "bg-primary hover:bg-primary-hover shadow-primary/20"
            }`}
            onClick={onConfirm}
          >
            {confirmText || t("common.confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

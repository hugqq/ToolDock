import React from "react";
import { ChevronLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface ToolLayoutProps {
  title: string;
  children: React.ReactNode;
  description?: string;
  status?: string;
  progress?: number;
  onCancel?: () => void;
  actions?: React.ReactNode;
}

export const ToolLayout: React.FC<ToolLayoutProps> = ({
  title,
  description,
  children,
  status,
  progress,
  onCancel,
  actions,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const displayStatus = status || t("common.ready");

  return (
    <div className="flex flex-col h-full bg-(--bg-main)">
      <header className="h-16 px-4 sm:px-6 flex items-center justify-between border-b border-(--border-color) bg-(--card-bg)">
        <div className="flex items-center gap-4">
          <button
            className="p-2 rounded-lg hover:bg-(--bg-main) text-(--text-muted) hover:text-(--text-main) transition-colors"
            onClick={() => navigate("/")}
            title={t("common.back")}
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-(--text-main)">{title}</h2>
            {description && (
              <p className="text-sm text-(--text-muted) mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>

      <main className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 md:p-8 overflow-y-auto">
        {children}
      </main>

      <footer className="h-10 px-4 sm:px-6 flex items-center justify-between border-t border-(--border-color) bg-(--card-bg) text-xs text-(--text-muted) shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
          <span className="truncate">{displayStatus}</span>
        </div>
        {progress !== undefined && (
          <div className="flex items-center gap-2 sm:gap-4 ml-2 sm:ml-4">
            <div className="flex items-center gap-2">
              <div className="w-20 sm:w-32 h-1.5 bg-(--bg-main) rounded-full overflow-hidden border border-(--border-color)">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="font-mono w-8 text-right">
                {Math.round(progress)}%
              </span>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex items-center gap-1 px-2 py-1 hover:bg-red-500/10 text-red-500 rounded-md transition-all font-medium border border-transparent hover:border-red-500/20"
                title={t("common.cancel")}
              >
                <X size={14} />
                <span>{t("common.stop")}</span>
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
};

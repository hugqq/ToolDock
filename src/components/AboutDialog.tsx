import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X, Github, ExternalLink } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import logo from "../assets/logo.svg";

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [version, setVersion] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    let isActive = true;

    getVersion()
      .then((appVersion) => {
        if (isActive) setVersion(appVersion);
      })
      .catch(() => {
        if (isActive) setVersion(null);
      });

    return () => {
      isActive = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleLinkClick = async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    try {
      await openUrl(url);
    } catch (err) {
      console.error("Failed to open URL:", err);
    }
  };

  const dependencies = [
    {
      name: "Tauri",
      description: t("about.deps.tauri_desc"),
      url: "https://tauri.app/",
    },
    {
      name: "React",
      description: t("about.deps.react_desc"),
      url: "https://react.dev/",
    },
    {
      name: "MUI (Material-UI)",
      description: t("about.deps.mui_desc"),
      url: "https://mui.com/",
    },
    {
      name: "Rust",
      description: t("about.deps.rust_desc"),
      url: "https://www.rust-lang.org/",
    },
    {
      name: "TypeScript",
      description: t("about.deps.ts_desc"),
      url: "https://www.typescriptlang.org/",
    },
    {
      name: "Vite",
      description: t("about.deps.vite_desc"),
      url: "https://vitejs.dev/",
    },
    {
      name: "Zustand",
      description: t("about.deps.zustand_desc"),
      url: "https://github.com/pmndrs/zustand",
    },
    {
      name: "i18next",
      description: t("about.deps.i18n_desc"),
      url: "https://www.i18next.com/",
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-99999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-(--card-bg) rounded-xl shadow-2xl w-[90vw] max-w-3xl max-h-[85vh] flex flex-col border border-(--border-color) relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--border-color)">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img src={logo} alt="ToolDock Logo" className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-(--text-main)">
                {t("about.title")}
              </h2>
              <p className="text-sm text-(--text-muted)">
                v{version ?? "--"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-(--bg-main) transition-colors"
            title={t("common.close")}
          >
            <X size={20} className="text-(--text-muted)" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Project Description */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-(--text-main) mb-2">
              {t("about.description_title")}
            </h3>
            <p className="text-(--text-muted) leading-relaxed">
              {t("about.description")}
            </p>
          </div>

          {/* GitHub Link */}
          <div className="mb-6">
            <button
              onClick={(e) =>
                handleLinkClick(e, "https://github.com/hugqq/ToolDock")
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-(--bg-main) hover:bg-primary hover:text-white transition-all duration-200 text-(--text-main) font-medium cursor-pointer"
            >
              <Github size={18} />
              <span>{t("about.view_source")}</span>
              <ExternalLink size={14} />
            </button>
          </div>

          {/* Features */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-(--text-main) mb-3">
              {t("about.features_title")}
            </h3>
            <ul className="space-y-2">
              {[
                t("about.features.native"),
                t("about.features.type_safe"),
                t("about.features.modular"),
                t("about.features.i18n"),
                t("about.features.theme"),
              ].map((feature, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-(--text-muted)"
                >
                  <span className="text-primary mt-1">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Open Source Dependencies */}
          <div>
            <h3 className="text-lg font-semibold text-(--text-main) mb-3">
              {t("about.dependencies_title")}
            </h3>
            <div className="grid gap-3">
              {dependencies.map((dep, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-(--bg-main) border border-(--border-color) hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-(--text-main) mb-1">
                        {dep.name}
                      </h4>
                      <p className="text-sm text-(--text-muted)">
                        {dep.description}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleLinkClick(e, dep.url)}
                      className="shrink-0 p-1.5 rounded hover:bg-(--bg-main)/50 transition-colors cursor-pointer"
                      title={t("about.visit_website")}
                    >
                      <ExternalLink size={16} className="text-(--text-muted)" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* License */}
          <div className="mt-6 pt-6 border-t border-(--border-color)">
            <p className="text-sm text-(--text-muted) text-center">
              {t("about.license")}
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

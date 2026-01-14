import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Task } from "../../types/notepad";

interface TaskPreviewProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
}

export const TaskPreview: React.FC<TaskPreviewProps> = ({
  isOpen,
  task,
  onClose,
}) => {
  const { t } = useTranslation();
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-(--card-bg) w-full max-w-3xl rounded-xl border border-(--border-color) shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-(--border-color)">
            <h3 className="text-lg font-semibold text-(--text-main)">
              {task.title}
            </h3>
            <button
              onClick={onClose}
              className="text-(--text-secondary) hover:text-(--text-main)"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4">
            {/* Markdown Content */}
            {task.content && (
              <div className="text-(--text-main) space-y-2">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="text-2xl font-bold mb-3 mt-4 text-(--text-main)">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-xl font-bold mb-2 mt-3 text-(--text-main)">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-lg font-bold mb-2 mt-2 text-(--text-main)">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 text-(--text-main) leading-relaxed">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-2 space-y-1 text-(--text-main)">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-2 space-y-1 text-(--text-main)">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-(--text-main)">{children}</li>
                    ),
                    code: ({ className, children }) => {
                      const isInline = !className;
                      return isInline ? (
                        <code className="bg-(--bg-secondary) px-1.5 py-0.5 rounded text-sm font-mono text-(--primary-color)">
                          {children}
                        </code>
                      ) : (
                        <code className="block bg-(--bg-secondary) p-3 rounded-lg text-sm font-mono overflow-x-auto text-(--text-main)">
                          {children}
                        </code>
                      );
                    },
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-(--primary-color) pl-4 italic text-(--text-secondary) my-2">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-(--primary-color) hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {task.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Images */}
            {task.images && task.images.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-(--text-main)">
                  {t("tools.notepad.images") || "Images"}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {task.images.map((path, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-lg overflow-hidden border border-(--border-color) cursor-pointer hover:border-(--primary-color) transition-colors"
                      onClick={() => setViewingImage(path)}
                    >
                      <img
                        src={convertFileSrc(path)}
                        alt={`attachment-${idx}`}
                        className="w-16 h-16 object-cover bg-(--bg-main) hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Eye
                          size={16}
                          className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!task.content &&
              (!task.images || task.images.length === 0) && (
                <div className="text-(--text-secondary) italic">
                  {t("common.no_results")}
                </div>
              )}
          </div>

          <div className="p-4 border-t border-(--border-color) flex justify-end bg-(--bg-secondary)/50">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-(--primary-color) text-white hover:bg-(--primary-hover)"
            >
              {t("common.close")}
            </button>
          </div>
        </div>
      </div>

      {/* Image Viewer Modal - Local to preview for now unless we want global */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={convertFileSrc(viewingImage)}
              alt="preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

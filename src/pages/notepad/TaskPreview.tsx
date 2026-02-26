import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Eye, FileText, File, FileImage, FileVideo, FileAudio, FileCode, FileArchive, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { Task } from "../../types/notepad";

interface TaskPreviewProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
}

// Get file extension from path
const getFileExtension = (path: string): string => {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

// Get file name from path
const getFileName = (path: string): string => {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
};

// Get appropriate icon for file type
const getFileIcon = (path: string) => {
  const ext = getFileExtension(path);
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"];
  const videoExts = ["mp4", "avi", "mov", "mkv", "webm", "flv"];
  const audioExts = ["mp3", "wav", "ogg", "flac", "aac", "m4a"];
  const codeExts = ["js", "ts", "jsx", "tsx", "py", "java", "cpp", "c", "h", "css", "html", "json", "xml", "yaml", "yml"];
  const archiveExts = ["zip", "rar", "7z", "tar", "gz", "bz2"];
  const docExts = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md"];

  if (imageExts.includes(ext)) return FileImage;
  if (videoExts.includes(ext)) return FileVideo;
  if (audioExts.includes(ext)) return FileAudio;
  if (codeExts.includes(ext)) return FileCode;
  if (archiveExts.includes(ext)) return FileArchive;
  if (docExts.includes(ext)) return FileText;
  return File;
};

// Check if file is previewable image
const isPreviewableImage = (path: string): boolean => {
  const ext = getFileExtension(path);
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
};

export const TaskPreview: React.FC<TaskPreviewProps> = ({
  isOpen,
  task,
  onClose,
}) => {
  const { t } = useTranslation();
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const handleOpenFile = async (path: string) => {
    try {
      await openPath(path);
    } catch (error) {
      console.error("Failed to open file:", error);
    }
  };

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

            {/* Attachments */}
            {task.attachments && task.attachments.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-(--text-main)">
                  {t("tools.notepad.attachments") || "Attachments"}
                </h4>
                <div className="space-y-2">
                  {task.attachments.map((path, idx) => {
                    const FileIcon = getFileIcon(path);
                    const fileName = getFileName(path);
                    const isImage = isPreviewableImage(path);

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg border border-(--border-color) bg-(--bg-secondary) hover:border-(--primary-color) transition-colors group"
                      >
                        {/* Thumbnail for images */}
                        {isImage ? (
                          <div
                            className="w-12 h-12 rounded overflow-hidden shrink-0 cursor-pointer"
                            onClick={() => setViewingImage(path)}
                          >
                            <img
                              src={convertFileSrc(path)}
                              alt={fileName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded bg-(--bg-main) flex items-center justify-center shrink-0">
                            <FileIcon size={24} className="text-(--text-secondary)" />
                          </div>
                        )}

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-(--text-main) text-sm font-medium truncate">
                            {fileName}
                          </p>
                          <p className="text-(--text-secondary) text-xs uppercase">
                            {getFileExtension(path) || "File"}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {isImage && (
                            <button
                              onClick={() => setViewingImage(path)}
                              className="p-2 rounded-lg hover:bg-(--bg-hover) text-(--text-secondary) hover:text-(--primary-color) transition-colors"
                              title={t("common.preview") || "Preview"}
                            >
                              <Eye size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenFile(path)}
                            className="p-2 rounded-lg hover:bg-(--bg-hover) text-(--text-secondary) hover:text-(--primary-color) transition-colors"
                            title={t("common.open") || "Open"}
                          >
                            <ExternalLink size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {!task.content &&
              (!task.images || task.images.length === 0) &&
              (!task.attachments || task.attachments.length === 0) && (
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

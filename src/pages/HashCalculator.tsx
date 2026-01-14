/**
 * 查找重复文件工具页面
 * 职责：选择文件夹，扫描并查找重复文件，支持删除、预览等操作
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Copy,
  Trash2,
  File as FileIcon,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import { InstructionsCard } from "../components/shared/InstructionsCard";
import { ScanProgress } from "../components/shared/ScanProgress";
import { toast } from "react-hot-toast";
import { useTauriEvent } from "../hooks/useTauriEvent";

interface DuplicateFile {
  path: string;
  size: number;
  hash: string;
}

interface DuplicateGroup {
  hash: string;
  size: number;
  count: number;
  files: DuplicateFile[];
}

interface ScanProgress {
  scanned_files: number;
  total_files: number;
  percentage: number;
  current_file: string;
}

const HashCalculator: React.FC = () => {
  const { t } = useTranslation();
  const [results, setResults] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [toastId, setToastId] = useState<string | null>(null);

  // 监听扫描进度事件
  useTauriEvent("duplicate-scan-progress", (event: any) => {
    const data = event.payload as ScanProgress;
    console.log("Progress event received:", data);
    setProgress(data);
  });

  // 监听扫描完成事件
  useTauriEvent("duplicate-scan-complete", (event: any) => {
    const { duplicates } = event.payload;
    console.log("Scan complete, found duplicates:", duplicates);
    setResults(duplicates);
    if (toastId) toast.dismiss(toastId);
    setToastId(null);
    setProgress(null);
    setLoading(false);

    const duplicateCount = duplicates.reduce(
      (sum: number, group: DuplicateGroup) => sum + group.count - 1,
      0
    );
    toast.success(
      t("tools.hash_calculator.scan_complete", {
        count: duplicateCount,
      })
    );
  });

  // 监听扫描错误事件
  useTauriEvent("duplicate-scan-error", (event: any) => {
    const { error } = event.payload;
    console.error("Scan error:", error);
    if (toastId) toast.dismiss(toastId);
    setToastId(null);
    setProgress(null);
    setLoading(false);
    toast.error(`${t("common.error")}: ${error}`);
  });

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
      });

      if (selected && !Array.isArray(selected)) {
        setLoading(true);
        setProgress(null);
        setResults([]);

        // 显示扫描开始的 Toast
        const id = toast.loading(t("tools.hash_calculator.scanning_start"));
        setToastId(id);

        try {
          const response: any = await invoke("find_duplicate_files", {
            path: selected,
          });

          console.log("Scan started response:", response);

          if (!response.ok) {
            toast.error(
              `${t("common.error")}: ${
                response.error?.message || "Unknown error"
              }`
            );
            setLoading(false);
            if (id) toast.dismiss(id);
            setToastId(null);
          }
        } catch (error) {
          console.error("Error invoking command:", error);
          setLoading(false);
          if (id) toast.dismiss(id);
          setToastId(null);
          toast.error(`${t("common.error")}: ${error}`);
        }
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
      if (toastId) toast.dismiss(toastId);
      setToastId(null);
      setProgress(null);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("common.copy_success"));
  };

  const clearResults = () => {
    setResults([]);
  };

  const getTotalDuplicateSize = (): number => {
    return results.reduce((total, group) => {
      return total + (group.count - 1) * group.size;
    }, 0);
  };

  return (
    <ToolLayout title={t("tools.hash_calculator.name")}>
      <div className="space-y-6">
        {/* 使用说明卡片 */}
        <InstructionsCard
          title={t("tools.hash_calculator.instructions.title")}
          color="blue"
          steps={[
            {
              title: t("tools.hash_calculator.instructions.step1_title"),
              description: t("tools.hash_calculator.instructions.step1_desc"),
            },
            {
              title: t("tools.hash_calculator.instructions.step2_title"),
              description: t("tools.hash_calculator.instructions.step2_desc"),
            },
            {
              title: t("tools.hash_calculator.instructions.step3_title"),
              description: t("tools.hash_calculator.instructions.step3_desc"),
            },
            {
              title: t("tools.hash_calculator.instructions.step4_title"),
              description: t("tools.hash_calculator.instructions.step4_desc"),
            },
          ]}
        />

        {/* 操作栏卡片 */}
        <div className="p-6 rounded-2xl border border-(--border-color) bg-(--card-bg) shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSelectFolder}
              disabled={loading}
              className="bg-primary hover:bg-primary-hover shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4 mr-2" />
              )}
              {t("tools.hash_calculator.select_folder")}
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={clearResults}
              disabled={results.length === 0}
              className="shadow-sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("common.clear")}
            </Button>
          </div>
          {results.length > 0 && (
            <div className="flex gap-4">
              <div className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-bold">
                {results.length} {t("tools.hash_calculator.duplicate_groups")}
              </div>
              {getTotalDuplicateSize() > 0 && (
                <div className="px-4 py-2 rounded-full bg-red-500/10 text-red-500 text-sm font-bold">
                  {t("tools.hash_calculator.total_size")}:{" "}
                  {formatSize(getTotalDuplicateSize())}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 扫描进度条 */}
        <ScanProgress
          progress={progress}
          loading={loading}
          title={t("tools.hash_calculator.scanning_start")}
          descriptionFormatter={(scanned, currentFile) =>
            t("tools.hash_calculator.scanning_progress", {
              count: scanned,
              file: currentFile.split(/[\\/]/).pop() || currentFile,
            })
          }
        />

        {/* 结果列表 */}
        <div className="space-y-4">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 border border-dashed rounded-2xl border-(--border-color) bg-(--card-bg) shadow-sm">
              <FolderOpen className="w-16 h-16 text-(--text-muted) mb-4 opacity-20" />
              <p className="text-(--text-muted) font-medium">
                {t("tools.hash_calculator.empty_state")}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {results.map((group, groupIndex) => (
                <div
                  key={groupIndex}
                  className="p-5 rounded-2xl border border-(--border-color) bg-(--card-bg) shadow-sm overflow-hidden"
                >
                  {/* 组头部 */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-(--border-color)/50">
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-sm font-bold">
                        {group.count} {t("tools.hash_calculator.copies")}
                      </div>
                      <div className="text-sm text-(--text-muted)">
                        {t("tools.hash_calculator.file_size")}:{" "}
                        {formatSize(group.size)} ×{group.count}
                      </div>
                      <div className="text-xs font-mono text-(--text-muted) bg-(--bg-main)/50 px-2 py-1 rounded">
                        {group.hash.substring(0, 16)}...
                      </div>
                    </div>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() =>
                        copyToClipboard(
                          group.files.map((f) => f.path).join("\n")
                        )
                      }
                      className="h-8 p-2"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* 文件列表 */}
                  <div className="space-y-2">
                    {group.files.map((file, fileIndex) => (
                      <div
                        key={fileIndex}
                        className="flex items-center gap-3 p-3 rounded-lg bg-(--bg-main)/50 border border-(--border-color)/50 group/file hover:bg-(--bg-main) transition-colors"
                      >
                        <FileIcon className="w-4 h-4 text-(--text-muted) shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-mono text-sm truncate"
                            title={file.path}
                          >
                            {file.path}
                          </div>
                        </div>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => copyToClipboard(file.path)}
                          className="h-8 w-8 p-0 opacity-0 group-hover/file:opacity-100 transition-opacity"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
};

export default HashCalculator;

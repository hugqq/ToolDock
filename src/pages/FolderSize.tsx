/**
 * 文件夹大小分析工具页面
 * 职责：扫描指定文件夹，计算各子文件夹和文件的大小，展示可视化图表，支持打开、复制路径、删除等操作
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteItem,
  FolderInfo,
  formatSize,
  scanFolderSize,
  stopScan,
} from "../api/file";
import { useModal } from "../components/ModalContext";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import { InstructionsDialog } from "../components/shared/InstructionsDialog";
import { ScanProgress } from "../components/shared/ScanProgress";
import { useTauriEvent } from "../hooks/useTauriEvent";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import {
  ArrowUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  File,
  Files,
  FolderOpen,
  HardDrive,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface ScanProgressData {
  scanned_files: number;
  total_files: number;
  percentage: number;
  current_file: string;
}

const FolderSize: React.FC = () => {
  const { t } = useTranslation();
  const { confirm } = useModal();
  const [path, setPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [statusText, setStatusText] = useState(t("common.ready"));
  const [results, setResults] = useState<FolderInfo[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgressData | null>(
    null
  );
  const scanCache = useRef<Map<string, FolderInfo[]>>(new Map());
  const [sortConfig, setSortConfig] = useState<{
    key: keyof FolderInfo;
    direction: "asc" | "desc";
  }>({ key: "size", direction: "desc" });

  // 监听扫描进度事件
  useTauriEvent("scan-progress", (event) => {
    const { current, total, folder_name } = event.payload;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    setScanProgress({
      scanned_files: current,
      total_files: total,
      percentage,
      current_file: folder_name,
    });
  });

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FolderInfo | null;
  } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, item: FolderInfo) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
    });
  };

  const handleBrowse = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      setPath(selected);
    }
  };

  const handleGoUp = () => {
    if (!path) return;
    // Remove trailing slash if exists
    const cleanPath = path.replace(/[\\/]+$/, "");
    const lastSlashIndex = Math.max(
      cleanPath.lastIndexOf("\\"),
      cleanPath.lastIndexOf("/")
    );

    if (lastSlashIndex !== -1) {
      let parentPath = cleanPath.substring(0, lastSlashIndex);
      // If it's a drive root like "C:", add a backslash
      if (parentPath.endsWith(":") && parentPath.length === 2) {
        parentPath += "\\";
      }
      setPath(parentPath);
      startScan(parentPath);
    }
  };

  const handleScan = async () => {
    startScan(path);
  };

  const handleStop = async () => {
    await stopScan();
    setScanning(false);
    setScanProgress(null);
    setStatusText(t("common.ready"));
  };

  const startScan = async (scanPath: string) => {
    if (!scanPath) return;

    // 检查缓存
    const cachedData = scanCache.current.get(scanPath);
    if (cachedData) {
      setResults(cachedData);
    } else {
      setResults([]);
    }

    setScanning(true);
    setScanProgress(null);
    setStatusText(t("tools.folder_size.scanning"));

    const response = await scanFolderSize(scanPath);
    if (response.ok) {
      setResults(response.data);
      // 更新缓存
      scanCache.current.set(scanPath, response.data);
      setStatusText(
        `${t("common.success")} | ${t("tools.folder_size.item_count")}: ${
          response.data.length
        }`
      );
    } else {
      setStatusText(`${t("common.error")}: ${response.message}`);
    }
    setScanning(false);
    setScanProgress(null);
  };

  const handleItemDoubleClick = (item: FolderInfo) => {
    if (item.is_dir) {
      setPath(item.path);
      startScan(item.path);
    } else {
      openFolder(item.path);
    }
  };

  const handleClear = () => {
    setResults([]);
    setPath("");
    setScanProgress(null);
    setStatusText(t("common.ready"));
  };

  const sortedResults = useMemo(() => {
    const sorted = [...results];
    sorted.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    return sorted;
  }, [results, sortConfig]);

  const totalSize = useMemo(
    () => results.reduce((acc, curr) => acc + curr.size, 0),
    [results]
  );

  const instructionSteps = [
    {
      title: t("tools.folder_size.instructions.step1_title"),
      description: t("tools.folder_size.instructions.step1_desc"),
    },
    {
      title: t("tools.folder_size.instructions.step2_title"),
      description: t("tools.folder_size.instructions.step2_desc"),
    },
    {
      title: t("tools.folder_size.instructions.step3_title"),
      description: t("tools.folder_size.instructions.step3_desc"),
    },
    {
      title: t("tools.folder_size.instructions.step4_title"),
      description: t("tools.folder_size.instructions.step4_desc"),
    },
  ];

  const largestItem = useMemo(
    () =>
      results.length > 0
        ? results.reduce((prev, curr) => (prev.size > curr.size ? prev : curr))
        : null,
    [results]
  );

  const handleSort = (key: keyof FolderInfo) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const openFolder = async (folderPath: string) => {
    try {
      await openPath(folderPath);
    } catch (err) {
      console.error("Failed to open folder:", err);
      setStatusText(`${t("common.error")}: ${err}`);
    }
  };

  const revealFolder = async (folderPath: string) => {
    try {
      await revealItemInDir(folderPath);
    } catch (err) {
      console.error("Failed to reveal folder:", err);
      setStatusText(`${t("common.error")}: ${err}`);
    }
  };

  const copyPath = (folderPath: string) => {
    navigator.clipboard.writeText(folderPath);
  };

  const handleDelete = async (item: FolderInfo) => {
    const confirmed = await confirm({
      title: t("tools.folder_size.delete_item"),
      message: t("tools.folder_size.delete_confirm"),
      type: "warning",
    });

    if (confirmed) {
      setStatusText(
        `${t("common.status")}: ${t("tools.folder_size.deleting")}`
      );
      const response = await deleteItem(item.path);
      if (response.ok) {
        setResults((prev) => {
          const filtered = prev.filter((i) => i.path !== item.path);
          // 同步更新缓存
          scanCache.current.set(path, filtered);
          return filtered;
        });
        setStatusText(t("common.success"));
      } else {
        setStatusText(`${t("common.error")}: ${response.message}`);
      }
    }
  };

  // const COLORS = [
  //   "#3b82f6",
  //   "#10b981",
  //   "#f59e0b",
  //   "#ef4444",
  //   "#8b5cf6",
  //   "#ec4899",
  //   "#06b6d4",
  //   "#f97316",
  // ];

  return (
    <ToolLayout title={t("tools.folder_size.name")} status={statusText}>
      <div className="space-y-6">
        <div className="bg-(--card-bg) p-4 sm:p-6 rounded-2xl border border-(--border-color) shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-bold text-(--text-main)">
                {t("tools.folder_size.col_path")}
              </label>
              <InstructionsDialog
                title={t("tools.folder_size.instructions.title")}
                steps={instructionSteps}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative group">
                <input
                  type="text"
                  placeholder={t("tools.folder_size.path_placeholder")}
                  className="w-full !pl-4 !pr-10 py-2.5 bg-(--bg-main) border border-(--border-color) rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                />
                {scanning && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw
                      size={16}
                      className="animate-spin text-primary"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3">
                <Button
                  variant="outlined"
                  onClick={handleGoUp}
                  disabled={scanning || !path}
                  title={t("tools.folder_size.go_up")}
                  className="px-4 py-2.5 rounded-xl"
                >
                  <ArrowUp size={18} />
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleBrowse}
                  disabled={scanning}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl"
                >
                  <FolderOpen size={18} />
                  <span className="hidden sm:inline">
                    {t("tools.folder_size.browse")}
                  </span>
                  <span className="sm:hidden">{t("common.open")}</span>
                </Button>
                <Button
                  variant="contained"
                  onClick={scanning ? handleStop : handleScan}
                  disabled={!path}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-primary/20"
                >
                  {scanning ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>{t("common.stop")}</span>
                    </>
                  ) : (
                    <>
                      <BarChart3 size={18} />
                      <span>{t("tools.folder_size.scan")}</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleClear}
                  disabled={scanning}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 border-red-500/20 hover:border-red-500/50"
                >
                  <Trash2 size={18} />
                  <span>{t("tools.folder_size.clear_cache")}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 扫描进度组件 */}
        <ScanProgress
          progress={scanProgress}
          loading={scanning}
          title={t("tools.folder_size.scanning")}
          descriptionFormatter={(_scanned, currentFile) => {
            // 显示相对于根路径的递归路径，突出显示当前项
            let relativePath = currentFile;
            if (path && currentFile.startsWith(path)) {
              relativePath = currentFile
                .substring(path.length)
                .replace(/^[\\/]+/, "");
            }

            // 分离路径和文件名，让当前项更明显
            const parts = relativePath.split(/[\\/]/);
            const currentItem = parts[parts.length - 1] || relativePath;
            const parentPath = parts.slice(0, -1).join(" › ");

            if (parentPath) {
              return `${parentPath} › ${currentItem}`;
            }
            return currentItem || t("tools.folder_size.scanning_root");
          }}
        />

        {results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-(--card-bg) p-4 rounded-2xl border border-(--border-color) shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <HardDrive size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-(--text-muted) font-medium">
                  {t("tools.folder_size.total_size")}
                </span>
                <span className="text-lg font-bold text-(--text-main)">
                  {formatSize(totalSize)}
                </span>
              </div>
            </div>
            <div className="bg-(--card-bg) p-4 rounded-2xl border border-(--border-color) shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Files size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-(--text-muted) font-medium">
                  {t("tools.folder_size.item_count")}
                </span>
                <span className="text-lg font-bold text-(--text-main)">
                  {results.length}
                </span>
              </div>
            </div>
            <div className="bg-(--card-bg) p-4 rounded-2xl border border-(--border-color) shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <FolderOpen size={24} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-(--text-muted) font-medium">
                  {t("tools.folder_size.largest_item")}
                </span>
                <span
                  className="text-lg font-bold text-(--text-main) truncate"
                  title={largestItem?.name}
                >
                  {largestItem?.name || "-"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-(--card-bg) rounded-2xl border border-(--border-color) shadow-sm overflow-hidden flex flex-col">
          {results.length > 0 ? (
            <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-(--border-color)">
              <table className="w-full border-collapse text-left min-w-[600px]">
                <thead className="sticky top-0 bg-(--card-bg) z-10 border-b border-(--border-color)">
                  <tr>
                    <th
                      className="px-4 py-3 text-xs font-bold text-(--text-muted) uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        {t("tools.folder_size.col_name")}
                        {sortConfig.key === "name" &&
                          (sortConfig.direction === "asc" ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-xs font-bold text-(--text-muted) uppercase tracking-wider cursor-pointer hover:text-primary transition-colors text-right"
                      onClick={() => handleSort("size")}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        {t("tools.folder_size.col_size")}
                        {sortConfig.key === "size" &&
                          (sortConfig.direction === "asc" ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          ))}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-(--text-muted) uppercase tracking-wider text-right w-[200px]">
                      {t("common.progress")}
                    </th>
                    <th className="px-4 py-3 text-xs font-bold text-(--text-muted) uppercase tracking-wider text-center w-[100px]">
                      {t("tools.folder_size.col_actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border-color)">
                  {sortedResults.map((item) => (
                    <tr
                      key={item.path}
                      className="hover:bg-(--bg-main) transition-colors group cursor-default"
                      onDoubleClick={() => handleItemDoubleClick(item)}
                      onContextMenu={(e) => handleContextMenu(e, item)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.is_dir ? (
                            <FolderOpen
                              size={18}
                              className="text-amber-500 shrink-0"
                            />
                          ) : (
                            <File
                              size={18}
                              className="text-slate-400 shrink-0"
                            />
                          )}
                          <span
                            className="text-sm font-medium text-(--text-main) truncate max-w-[300px]"
                            title={item.path}
                          >
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-mono font-bold text-(--text-main)">
                          {formatSize(item.size)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-(--bg-main) rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-500"
                              style={{
                                width: `${
                                  totalSize > 0
                                    ? Math.min(
                                        (item.size / totalSize) * 100,
                                        100
                                      ).toFixed(2)
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-(--text-muted) w-10 text-right">
                            {totalSize > 0
                              ? Math.min(
                                  (item.size / totalSize) * 100,
                                  100
                                ).toFixed(1)
                              : 0}
                            %
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => openFolder(item.path)}
                            className="p-1.5 text-(--text-muted) hover:text-primary hover:bg-primary/10 rounded-lg transition-all h-auto"
                            title={t("tools.folder_size.open_in_explorer")}
                          >
                            <ExternalLink size={14} />
                          </Button>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => copyPath(item.path)}
                            className="p-1.5 text-(--text-muted) hover:text-primary hover:bg-primary/10 rounded-lg transition-all h-auto"
                            title={t("tools.folder_size.copy_path")}
                          >
                            <Copy size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-(--bg-main) flex items-center justify-center mb-6">
                <BarChart3 size={40} className="text-primary/40" />
              </div>
              <h3 className="text-lg font-bold text-(--text-main) mb-2">
                {t("common.ready")}
              </h3>
              <p className="text-sm text-(--text-muted) max-w-xs">
                {scanning
                  ? t("tools.folder_size.scanning")
                  : t("tools.folder_size.ready_desc")}
              </p>
            </div>
          )}
        </div>

        {contextMenu && (
          <div
            className="fixed w-[240px] bg-(--card-bg) border border-(--border-color) rounded-xl shadow-xl p-1.5 z-[1000] animate-in fade-in zoom-in duration-150"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
            }}
          >
            <Button
              variant="text"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-(--text-main) hover:bg-primary/10 hover:text-primary rounded-lg transition-colors justify-start h-auto"
              onClick={() =>
                contextMenu.item && openFolder(contextMenu.item.path)
              }
            >
              <ExternalLink size={16} />
              <span>{t("tools.folder_size.open_in_explorer")}</span>
            </Button>
            <Button
              variant="text"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-(--text-main) hover:bg-primary/10 hover:text-primary rounded-lg transition-colors justify-start h-auto"
              onClick={() =>
                contextMenu.item && revealFolder(contextMenu.item.path)
              }
            >
              <FolderOpen size={16} />
              <span>{t("tools.folder_size.reveal_in_explorer")}</span>
            </Button>
            <Button
              variant="text"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-(--text-main) hover:bg-primary/10 hover:text-primary rounded-lg transition-colors justify-start h-auto"
              onClick={() =>
                contextMenu.item && copyPath(contextMenu.item.path)
              }
            >
              <Copy size={16} />
              <span>{t("tools.folder_size.copy_path")}</span>
            </Button>
            <div className="h-px bg-(--border-color) my-1.5 mx-1" />
            <Button
              variant="text"
              color="error"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium hover:bg-red-500/10 rounded-lg transition-colors justify-start h-auto"
              onClick={() => {
                if (contextMenu.item) {
                  handleDelete(contextMenu.item);
                }
              }}
            >
              <Trash2 size={16} />
              <span>{t("tools.folder_size.delete_item")}</span>
            </Button>
          </div>
        )}
      </div>

    </ToolLayout>
  );
};

export default FolderSize;

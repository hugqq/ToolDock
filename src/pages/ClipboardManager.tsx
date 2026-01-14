/**
 * 剪贴板管理器页面
 * 职责：展示剪贴板历史记录，支持搜索、复制、删除和图片预览
 */

import { listen } from "@tauri-apps/api/event";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useModal } from "../components/ModalContext";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Tooltip, Switch, Button, Input } from "../components/mui";
// replaced by mui wrapper
// replaced by mui wrapper
import { useSettingsStore } from "../stores/useSettingsStore";
import { invokeWrapper } from "../api";

interface ClipboardItem {
  id: string;
  content_type: "Text" | "Image";
  content: string;
  timestamp: number;
  preview?: string;
}

const ClipboardImage = ({ path }: { path: string }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    const loadImage = async () => {
      try {
        console.log("Loading image from path:", path);
        const data = await readFile(path);
        console.log("Image data read, size:", data.length);
        const blob = new Blob([data], { type: "image/png" });
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch (error) {
        console.error("Failed to load image from path:", path, error);
      }
    };
    loadImage();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!src) {
    return (
      <div className="w-full h-48 bg-(--card-bg) animate-pulse rounded-xl border border-(--border-color) flex items-center justify-center">
        <ImageIcon className="text-(--text-muted) opacity-20" size={32} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Clipboard"
      className="max-h-64 rounded-xl border border-(--border-color) object-contain bg-white/5 shadow-sm"
    />
  );
};

export default function ClipboardManager() {
  const { t } = useTranslation();
  const { confirm } = useModal();
  const {
    clipboardEnabled,
    setClipboardEnabled,
    clipboardPrefix,
    setClipboardPrefix,
    clipboardSuffix,
    setClipboardSuffix,
  } = useSettingsStore();
  const [history, setHistory] = useState<ClipboardItem[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>(
    new Date().toISOString().split("T")[0]
  ); // 默认当天

  const fetchHistory = async () => {
    try {
      const res = await invokeWrapper<ClipboardItem[]>("get_clipboard_history");
      if (res.ok) {
        setHistory(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch clipboard history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    const unlisten = listen("clipboard://changed", () => {
      fetchHistory();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleToggleEnabled = (enabled: boolean) => {
    setClipboardEnabled(enabled);
  };

  const handleSaveConfig = async () => {
    try {
      await invokeWrapper("set_clipboard_config", {
        prefix: clipboardPrefix,
        suffix: clipboardSuffix,
      });
      toast.success(t("common.success"));
    } catch (error) {
      console.error("Failed to save config:", error);
      toast.error(t("common.error"));
    }
  };

  const filteredHistory = useMemo(() => {
    let result = history;

    // 时间筛选
    if (dateFilter) {
      const filterTime = new Date(dateFilter).getTime() / 1000;
      const nextDayTime = filterTime + 86400;
      result = result.filter(
        (item) => item.timestamp >= filterTime && item.timestamp < nextDayTime
      );
    }

    // 搜索筛选
    if (searchText) {
      const lowerSearch = searchText.toLowerCase();
      result = result.filter(
        (item) =>
          item.content_type === "Text" &&
          item.content.toLowerCase().includes(lowerSearch)
      );
    }

    return result;
  }, [history, searchText, dateFilter]);

  const handleCopy = async (item: ClipboardItem) => {
    try {
      await invokeWrapper("copy_clipboard_item", {
        id: item.id,
        prefix: clipboardPrefix || null,
        suffix: clipboardSuffix || null,
      });
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleOpenInExplorer = async (path: string) => {
    try {
      await invokeWrapper("reveal_in_explorer", { path });
    } catch (error) {
      console.error("Failed to reveal in explorer:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invokeWrapper("delete_clipboard_item", { id });
      fetchHistory();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: t("tools.clipboard_manager.clear_history"),
      message: t("tools.clipboard_manager.clear_confirm"),
      type: "danger",
    });

    if (ok) {
      try {
        await invokeWrapper("clear_clipboard_history");
        fetchHistory();
      } catch (error) {
        console.error("Failed to clear history:", error);
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <ToolLayout title={t("tools.clipboard_manager.name")}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 max-w-2xl">
            <div className="flex items-center px-4 py-2 bg-(--bg-main) border border-(--border-color) rounded-xl mr-2">
              <Switch
                checked={clipboardEnabled}
                onChange={(_, checked) => handleToggleEnabled(checked)}
                label={t("tools.clipboard_manager.enable_monitoring")}
              />
            </div>

            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)"
                size={18}
              />
              <input
                type="text"
                placeholder={t("tools.clipboard_manager.search_placeholder")}
                className="w-full pl-10 pr-4 py-2 bg-(--bg-main) border border-(--border-color) rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="relative flex items-center gap-2 px-3 py-2 bg-(--bg-main) border border-(--border-color) rounded-xl">
              <Calendar size={16} className="text-(--text-muted)" />
              <input
                type="date"
                className="bg-transparent text-sm focus:outline-none text-(--text-main) [color-scheme:light] dark:[color-scheme:dark]"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
              {dateFilter && (
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setDateFilter("")}
                  className="h-auto p-0 text-primary hover:underline ml-1"
                >
                  {t("common.clear")}
                </Button>
              )}
            </div>
          </div>

          <Button
            onClick={handleClear}
            color="error" variant="contained"
            className="flex items-center gap-2"
          >
            <Trash2 size={16} />
            {t("tools.clipboard_manager.clear_history")}
          </Button>
        </div>

        <div className="flex items-center gap-4 p-4 bg-(--bg-main) border border-(--border-color) rounded-2xl">
          <div className="flex-1 flex items-center gap-3">
            <span className="text-sm font-medium text-(--text-muted) whitespace-nowrap">
              {t("tools.clipboard_manager.prefix")}:
            </span>
            <Input
              size="small"
              placeholder={t("tools.clipboard_manager.prefix_placeholder")}
              value={clipboardPrefix}
              onChange={(e) => setClipboardPrefix(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex-1 flex items-center gap-3">
            <span className="text-sm font-medium text-(--text-muted) whitespace-nowrap">
              {t("tools.clipboard_manager.suffix")}:
            </span>
            <Input
              size="small"
              placeholder={t("tools.clipboard_manager.suffix_placeholder")}
              value={clipboardSuffix}
              onChange={(e) => setClipboardSuffix(e.target.value)}
              className="flex-1"
            />
          </div>
          <Button onClick={handleSaveConfig} variant="contained" size="small">
            {t("common.save")}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-(--text-muted)">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-(--text-muted) opacity-50">
              <Clock size={48} className="mb-4" />
              <p>{t("tools.clipboard_manager.empty_state")}</p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="group p-5 bg-(--card-bg) border border-(--border-color) rounded-2xl hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 text-xs text-(--text-muted)">
                      <div
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${
                          item.content_type === "Text"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-green-50 text-green-600"
                        }`}
                      >
                        {item.content_type === "Text" ? (
                          <FileText size={12} />
                        ) : (
                          <ImageIcon size={12} />
                        )}
                        <span className="font-medium">
                          {item.content_type === "Text"
                            ? t("tools.clipboard_manager.type_text")
                            : t("tools.clipboard_manager.type_image")}
                        </span>
                      </div>
                      <span>{formatDate(item.timestamp)}</span>
                    </div>

                    {item.content_type === "Text" ? (
                      <pre className="text-sm text-(--text-main) whitespace-pre-wrap break-all font-sans line-clamp-6 leading-relaxed">
                        {item.content}
                      </pre>
                    ) : (
                      <div className="relative group/img inline-block">
                        <ClipboardImage path={item.content} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip content={t("common.copy")}>
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => handleCopy(item)}
                        className="p-2.5 h-auto"
                      >
                        <Copy size={20} />
                      </Button>
                    </Tooltip>
                    {item.content_type === "Image" && (
                      <Tooltip
                        content={t("tools.clipboard_manager.open_in_explorer")}
                      >
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => handleOpenInExplorer(item.content)}
                          className="p-2.5 h-auto"
                        >
                          <ExternalLink size={20} />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip content={t("common.delete")}>
                      <Button
                        color="error" variant="contained"
                        size="small"
                        onClick={() => handleDelete(item.id)}
                        className="p-2.5 h-auto"
                      >
                        <Trash2 size={20} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ToolLayout>
  );
}


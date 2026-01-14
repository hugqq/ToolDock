import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FileEdit,
  Plus,
  Trash2,
  Play,
  Eye,
  Settings2,
  FolderPlus,
  Info,
  MousePointerClick,
  Keyboard,
  History,
  RotateCcw,
  Clock,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileType,
  Folder,
  FolderTree,
  CaseSensitive,
  Hash,
  Shuffle,
  Calendar,
  Copy,
} from "lucide-react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import { Select } from "../components/mui";
import { toast } from "react-hot-toast";

interface RenameRule {
  prefix: string;
  suffix: string;
  search: string;
  replace: string;
  use_regex: boolean;
  case_sensitive: boolean;
  auto_increment: boolean;
  sequence_start: number;
  sequence_step: number;
  sequence_padding: number;
  // 高级选项
  apply_to: "both" | "name_only" | "extension_only";
  include_files: boolean;
  include_folders: boolean;
  include_subfolders: boolean;
  text_formatting:
    | "none"
    | "lowercase"
    | "uppercase"
    | "titlecase"
    | "capitalize";
  enumerate_items: boolean;
  random_string: boolean;
  use_datetime: boolean;
}

interface RenamePreview {
  old_path: string;
  new_name: string;
}

interface RenameHistoryItem {
  current_path: string;
  original_name: string;
  timestamp: number;
}

const BatchRenamer: React.FC = () => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<string[]>([]);
  const [previews, setPreviews] = useState<RenamePreview[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set()
  );
  const lastSelectedIndex = useRef<number | null>(null);
  const [historyRecords, setHistoryRecords] = useState<RenameHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRegexHelp, setShowRegexHelp] = useState(false);
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [rule, setRule] = useState<RenameRule>({
    prefix: "",
    suffix: "",
    search: "(.*)",
    replace: "",
    use_regex: true,
    case_sensitive: true,
    auto_increment: false,
    sequence_start: 1,
    sequence_step: 0,
    sequence_padding: 1,
    // 高级选项默认值
    apply_to: "name_only",
    include_files: true,
    include_folders: true,
    include_subfolders: true,
    text_formatting: "none",
    enumerate_items: false,
    random_string: false,
    use_datetime: false,
  });

  const handleAddFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
      });
      if (selected && Array.isArray(selected)) {
        setFiles((prev) => [...new Set([...prev, ...selected])]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddFolders = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: true,
      });
      if (selected && Array.isArray(selected)) {
        setFiles((prev) => [...new Set([...prev, ...selected])]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const updatePreview = async () => {
    if (files.length === 0) {
      setPreviews([]);
      return;
    }
    try {
      const response: any = await invoke("preview_batch_rename", {
        paths: files,
        rule: {
          ...rule,
          sequence_start: Number(rule.sequence_start),
          sequence_step: Number(rule.sequence_step),
          sequence_padding: Number(rule.sequence_padding),
        },
      });
      if (response.ok) {
        setPreviews(response.data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    updatePreview();
  }, [files, rule]);

  // 自动检测替换内容并启用相应的变量开关
  useEffect(() => {
    const content = rule.replace;
    const updates: Partial<RenameRule> = {};

    // 检测随机字符串变量
    const hasRandomString =
      content.includes("${rstring") || content.includes("${ruuid");
    if (hasRandomString !== rule.random_string) {
      updates.random_string = hasRandomString;
    }

    // 检测计数器变量（检测特定关键词或空的${}）
    const hasCounter =
      content.includes("${}") ||
      content.includes("start=") ||
      content.includes("increment=") ||
      content.includes("padding=");
    if (hasCounter !== rule.enumerate_items) {
      updates.enumerate_items = hasCounter;
    }

    // 检测日期时间变量
    const hasDateTime =
      content.includes("$Y") ||
      content.includes("$M") ||
      content.includes("$D") ||
      content.includes("$h") ||
      content.includes("$m") ||
      content.includes("$s");
    if (hasDateTime !== rule.use_datetime) {
      updates.use_datetime = hasDateTime;
    }

    // 只在需要更新时才更新状态，避免无限循环
    if (Object.keys(updates).length > 0) {
      setRule((prev) => ({ ...prev, ...updates }));
    }
  }, [rule.replace]);

  // 获取历史记录
  const fetchHistory = async () => {
    try {
      const response: any = await invoke("get_rename_history");
      if (response.ok) {
        setHistoryRecords(response.data || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // 组件挂载时获取历史记录
  useEffect(() => {
    fetchHistory();
  }, []);

  // 还原单个文件
  const handleRevertSingle = async (currentPath: string) => {
    try {
      const response: any = await invoke("revert_single_rename", {
        currentPath,
      });
      if (response.ok) {
        toast.success(t("tools.batch_renamer.history.revert_success"));
        fetchHistory();
      } else {
        const errorKey = response.error?.code || "UNKNOWN_ERROR";
        toast.error(t(`tools.batch_renamer.history.errors.${errorKey}`));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("tools.batch_renamer.history.revert_failed"));
    }
  };

  // 还原所有历史记录
  const handleRevertAll = async () => {
    if (historyRecords.length === 0) return;
    try {
      const paths = historyRecords.map((r) => r.current_path);
      const response: any = await invoke("revert_batch_rename", { paths });
      if (response.ok) {
        toast.success(t("tools.batch_renamer.history.revert_all_success"));
        fetchHistory();
      } else {
        toast.error(
          `${t("tools.batch_renamer.history.revert_failed")}: ${
            response.error?.message
          }`
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(t("tools.batch_renamer.history.revert_failed"));
    }
  };

  // 清除历史记录
  const handleClearHistory = async () => {
    try {
      const response: any = await invoke("clear_rename_history");
      if (response.ok) {
        setHistoryRecords([]);
        toast.success(t("tools.batch_renamer.history.clear_success"));
      }
    } catch (error) {
      console.error(error);
    }
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Regex Help Modal
  const RegexHelpModal: React.FC = () => {
    if (!showRegexHelp) return null;
    return createPortal(
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-1100"
        onClick={() => setShowRegexHelp(false)}
      >
        <div
          className="bg-(--card-bg) rounded-2xl w-190 max-w-[95vw] shadow-2xl border border-(--border-color) overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="text-blue-500" />
              <h3 className="text-lg font-bold text-(--text-main)">
                {t("tools.batch_renamer.regex_help.title")}
              </h3>
            </div>
            <Button
              variant="text"
              size="small"
              className="p-1.5 rounded-lg text-(--text-muted) hover:text-(--text-main) hover:bg-black/5 dark:hover:bg-white/5 transition-colors h-auto"
              onClick={() => setShowRegexHelp(false)}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </div>
          <div className="px-6 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <div className="text-sm font-semibold mb-2">
                {t("tools.batch_renamer.regex_help.basic.title")}
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-(--text-muted) text-xs">
                      <th className="px-3 py-2 text-left">
                        {t("tools.batch_renamer.regex_help.basic.col_pattern")}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {t("tools.batch_renamer.regex_help.basic.col_desc")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--border-color)">
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>^</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "^";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t("tools.batch_renamer.regex_help.basic.anchor_start")}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>$</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "$";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t("tools.batch_renamer.regex_help.basic.anchor_end")}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>.*</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = ".*";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t("tools.batch_renamer.regex_help.basic.any_text")}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>^test</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "^test";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.basic.example_start_test"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>bar$</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "bar$";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.basic.example_end_bar"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>^test.*bar$</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "^test.*bar$";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.basic.example_test_bar"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>.+?(?=bar)</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = ".+?(?=bar)";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.basic.example_until_bar"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>first[\\s\\S]*end</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "first[\\s\\S]*end";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.basic.example_between"
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">
                {t("tools.batch_renamer.regex_help.variables.title")}
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-(--text-muted) text-xs">
                      <th className="px-3 py-2 text-left">
                        {t(
                          "tools.batch_renamer.regex_help.variables.col_search"
                        )}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {t(
                          "tools.batch_renamer.regex_help.variables.col_replace"
                        )}
                      </th>
                      <th className="px-3 py-2 text-left">
                        {t("tools.batch_renamer.regex_help.variables.col_desc")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--border-color)">
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>(.*).png</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "(.*).png";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        <span>test_${`{1}`}.png</span>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.variables.add_prefix"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>(.*).png</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "(.*).png";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        <span>${`{1}`}_test.png</span>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.variables.add_suffix"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>(.*)</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "(.*)";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        <span>${`{1}`}.txt</span>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.variables.append_ext"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>(^\\w+\\.$)\\|(^\\w+$)</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "(^\\w+\\.$)\\|(^\\w+$)";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        <span>${`{2}`}.txt</span>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.variables.cond_append"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>(\\d\\d)-(\\d\\d)-(\\d\\d\\d\\d)</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "(\\d\\d)-(\\d\\d)-(\\d\\d\\d\\d)";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        <span>
                          ${`{3}`}-${`{2}`}-${`{1}`}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.variables.reorder_date"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>{"^(.{n})(.*) 或 (.*)(.{n})$"}</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "^(.{n})(.*) 或 (.*)(.{n})$";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        <span>
                          ${`{1}`}test${`{2}`}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.variables.insert_at_n"
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>{"^.{n} 或 .{n}$"}</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern"
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => {
                            const val = "^.{n} 或 .{n}$";
                            navigator.clipboard?.writeText(val);
                            setRule({ ...rule, search: val });
                            toast.success(
                              t("tools.batch_renamer.regex_help.copy.copied")
                            );
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          "tools.batch_renamer.regex_help.variables.no_replace"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {t("tools.batch_renamer.regex_help.variables.truncate")}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-black/2 dark:bg-white/2 flex justify-end gap-3 border-t border-(--border-color)">
            <Button variant="text" onClick={() => setShowRegexHelp(false)}>
              {t("common.close")}
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // 变量选择器模态框
  const VariablePickerModal: React.FC = () => {
    const [activeTab, setActiveTab] = useState<
      "counter" | "random" | "datetime"
    >("counter");
    const [counterConfig, setCounterConfig] = useState({
      start: 0,
      increment: 1,
      padding: 3,
    });
    const [randomLength, setRandomLength] = useState(8);

    const insertVariable = (variable: string) => {
      const input = replaceInputRef.current;
      if (!input) return;

      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const currentValue = rule.replace;
      const newValue =
        currentValue.substring(0, start) +
        variable +
        currentValue.substring(end);

      // 自动启用相应的变量开关（检测整个替换内容，支持混合使用）
      const updates: Partial<RenameRule> = {
        replace: newValue,
        enumerate_items: false,
        random_string: false,
        use_datetime: false,
      };

      // 检测整个替换内容中的所有变量类型
      // 随机字符串变量
      if (newValue.includes("${rstring") || newValue.includes("${ruuid")) {
        updates.random_string = true;
      }

      // 计数器变量（排除随机字符串）
      if (newValue.includes("${") && !updates.random_string) {
        updates.enumerate_items = true;
      }

      // 日期时间变量
      if (
        newValue.includes("$Y") ||
        newValue.includes("$M") ||
        newValue.includes("$D") ||
        newValue.includes("$h") ||
        newValue.includes("$m") ||
        newValue.includes("$s")
      ) {
        updates.use_datetime = true;
      }

      setRule({ ...rule, ...updates });

      // 关闭模态框
      setShowVariablePicker(false);

      // 聚焦回输入框并设置光标位置
      setTimeout(() => {
        input.focus();
        const newPos = start + variable.length;
        input.setSelectionRange(newPos, newPos);
      }, 100);
    };

    if (!showVariablePicker) return null;

    return createPortal(
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-1100"
        onClick={() => setShowVariablePicker(false)}
      >
        <div
          className="bg-(--card-bg) rounded-2xl w-200 max-w-[95vw] shadow-2xl border border-(--border-color) overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-(--border-color)">
            <div className="flex items-center gap-3">
              <Hash className="text-blue-500" />
              <h3 className="text-lg font-bold text-(--text-main)">
                {t("tools.batch_renamer.variable_picker.title")}
              </h3>
            </div>
            <Button
              variant="text"
              size="small"
              className="p-1.5 rounded-lg text-(--text-muted) hover:text-(--text-main) hover:bg-black/5 dark:hover:bg-white/5 transition-colors h-auto"
              onClick={() => setShowVariablePicker(false)}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          </div>

          {/* 标签页 */}
          <div className="flex border-b border-(--border-color)">
            <Button
              variant="text"
              size="small"
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors rounded-none h-auto ${
                activeTab === "counter"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-500/5"
                  : "text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-main)/50"
              }`}
              onClick={() => setActiveTab("counter")}
            >
              <div className="flex items-center justify-center gap-2">
                <Hash className="w-4 h-4" />
                {t("tools.batch_renamer.variable_picker.tab_counter")}
              </div>
            </Button>
            <Button
              variant="text"
              size="small"
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors rounded-none h-auto ${
                activeTab === "random"
                  ? "text-purple-600 border-b-2 border-purple-600 bg-purple-500/5"
                  : "text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-main)/50"
              }`}
              onClick={() => setActiveTab("random")}
            >
              <div className="flex items-center justify-center gap-2">
                <Shuffle className="w-4 h-4" />
                {t("tools.batch_renamer.variable_picker.tab_random")}
              </div>
            </Button>
            <Button
              variant="text"
              size="small"
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors rounded-none h-auto ${
                activeTab === "datetime"
                  ? "text-orange-600 border-b-2 border-orange-600 bg-orange-500/5"
                  : "text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-main)/50"
              }`}
              onClick={() => setActiveTab("datetime")}
            >
              <div className="flex items-center justify-center gap-2">
                <Calendar className="w-4 h-4" />
                {t("tools.batch_renamer.variable_picker.tab_datetime")}
              </div>
            </Button>
          </div>

          <div className="px-8 py-6 max-h-[65vh] overflow-y-auto">
            {/* 计数器标签页 */}
            {activeTab === "counter" && (
              <div className="space-y-6">
                <p className="text-sm text-(--text-muted) leading-relaxed">
                  {t("tools.batch_renamer.variable_picker.counter_desc")}
                </p>

                {/* 配置区域 */}
                <div className="p-5 rounded-xl bg-(--bg-main)/50 border border-(--border-color) space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-(--text-muted) block mb-2">
                        {t("tools.batch_renamer.variable_picker.start_value")}
                      </label>
                      <p className="text-[10px] text-(--text-muted) mb-2 leading-relaxed opacity-80 h-8 line-clamp-2">
                        {t(
                          "tools.batch_renamer.variable_picker.start_value_desc"
                        )}
                      </p>
                      <input
                        type="number"
                        className="w-full px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) text-sm"
                        value={counterConfig.start}
                        onChange={(e) =>
                          setCounterConfig({
                            ...counterConfig,
                            start: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-(--text-muted) block mb-2">
                        {t("tools.batch_renamer.variable_picker.increment")}
                      </label>
                      <p className="text-[10px] text-(--text-muted) mb-2 leading-relaxed opacity-80 h-8 line-clamp-2">
                        {t(
                          "tools.batch_renamer.variable_picker.increment_desc"
                        )}
                      </p>
                      <input
                        type="number"
                        className="w-full px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) text-sm"
                        value={counterConfig.increment}
                        onChange={(e) =>
                          setCounterConfig({
                            ...counterConfig,
                            increment: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-medium text-(--text-muted) block mb-2">
                        {t("tools.batch_renamer.variable_picker.padding")}
                      </label>
                      <p className="text-[10px] text-(--text-muted) mb-2 leading-relaxed opacity-80 h-8 line-clamp-2">
                        {t("tools.batch_renamer.variable_picker.padding_desc")}
                      </p>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        className="w-full px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) text-sm"
                        value={counterConfig.padding}
                        onChange={(e) =>
                          setCounterConfig({
                            ...counterConfig,
                            padding: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="text-xs text-(--text-muted) flex items-center gap-2 pt-2 border-t border-(--border-color)/50">
                    <span>
                      {t("tools.batch_renamer.variable_picker.preview")}:
                    </span>
                    <code className="px-2 py-1 rounded bg-(--bg-main) text-blue-600 font-mono">
                      {`${counterConfig.start}`.padStart(
                        counterConfig.padding,
                        "0"
                      )}
                      ,{" "}
                      {`${
                        counterConfig.start + counterConfig.increment
                      }`.padStart(counterConfig.padding, "0")}
                      ,{" "}
                      {`${
                        counterConfig.start + counterConfig.increment * 2
                      }`.padStart(counterConfig.padding, "0")}
                      ...
                    </code>
                  </div>
                </div>

                {/* 快捷按钮 */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-(--text-muted) uppercase tracking-wide">
                    {t("tools.batch_renamer.variable_picker.quick_insert")}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left group h-auto block"
                      onClick={() => insertVariable("${}")}
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-blue-600 font-bold whitespace-nowrap">
                          ${"{}"}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              "tools.batch_renamer.variable_picker.simple_counter"
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              "tools.batch_renamer.variable_picker.simple_counter_desc"
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-blue-500 flex-shrink-0" />
                      </div>
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left group h-auto block"
                      onClick={() =>
                        insertVariable(
                          `\${start=${counterConfig.start};increment=${counterConfig.increment};padding=${counterConfig.padding}}`
                        )
                      }
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-xs font-mono text-blue-600 font-bold whitespace-nowrap">
                          ${`{start=${counterConfig.start}...}`}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              "tools.batch_renamer.variable_picker.custom_counter"
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              "tools.batch_renamer.variable_picker.custom_counter_desc"
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-blue-500 flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 随机字符串标签页 */}
            {activeTab === "random" && (
              <div className="space-y-6">
                <p className="text-sm text-(--text-muted) leading-relaxed">
                  {t("tools.batch_renamer.variable_picker.random_desc")}
                </p>

                {/* 长度配置 */}
                <div className="p-5 rounded-xl bg-(--bg-main)/50 border border-(--border-color)">
                  <label className="text-xs font-medium text-(--text-muted) block mb-2">
                    {t("tools.batch_renamer.variable_picker.string_length")}
                  </label>
                  <p className="text-[10px] text-(--text-muted) mb-3 leading-relaxed opacity-80">
                    {t(
                      "tools.batch_renamer.variable_picker.string_length_desc"
                    )}
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    className="w-32 px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) text-sm"
                    value={randomLength}
                    onChange={(e) =>
                      setRandomLength(parseInt(e.target.value) || 8)
                    }
                  />
                </div>

                {/* 随机字符串选项 */}
                <div>
                  <div className="text-sm font-semibold mb-3 text-(--text-main)">
                    {t(
                      "tools.batch_renamer.variable_picker.random_string_types"
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group h-auto block"
                      onClick={() =>
                        insertVariable(`\${rstringalnum=${randomLength}}`)
                      }
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-purple-600 font-bold whitespace-nowrap">
                          ${`{rstringalnum=${randomLength}}`}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              "tools.batch_renamer.variable_picker.alphanumeric"
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              "tools.batch_renamer.variable_picker.alphanumeric_desc"
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-purple-500 flex-shrink-0" />
                      </div>
                    </Button>

                    <Button
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group h-auto block"
                      onClick={() =>
                        insertVariable(`\${rstringalpha=${randomLength}}`)
                      }
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-purple-600 font-bold whitespace-nowrap">
                          ${`{rstringalpha=${randomLength}}`}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              "tools.batch_renamer.variable_picker.alphabetic"
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80 mb-1">
                            {t(
                              "tools.batch_renamer.variable_picker.alphabetic_desc"
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-purple-500 flex-shrink-0" />
                      </div>
                    </Button>

                    <Button
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group h-auto block"
                      onClick={() =>
                        insertVariable(`\${rstringdigit=${randomLength}}`)
                      }
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-purple-600 font-bold whitespace-nowrap">
                          ${`{rstringdigit=${randomLength}}`}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t("tools.batch_renamer.variable_picker.numeric")}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80 mb-1">
                            {t(
                              "tools.batch_renamer.variable_picker.numeric_desc"
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-purple-500 flex-shrink-0" />
                      </div>
                    </Button>

                    <Button
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group h-auto block"
                      onClick={() => insertVariable("${ruuidv4}")}
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-purple-600 font-bold whitespace-nowrap">
                          ${"{ruuidv4}"}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t("tools.batch_renamer.variable_picker.uuid")}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t("tools.batch_renamer.variable_picker.uuid_desc")}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-purple-500 flex-shrink-0" />
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 日期时间标签页 */}
            {activeTab === "datetime" && (
              <div className="space-y-6">
                <p className="text-sm text-(--text-muted) leading-relaxed">
                  {t("tools.batch_renamer.variable_picker.datetime_desc")}
                </p>

                {/* 年份 */}
                <div>
                  <div className="text-sm font-semibold mb-3 text-(--text-main) flex items-center gap-2">
                    {t("tools.batch_renamer.variable_picker.year")}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { var: "$YYYY", desc: "year_full", example: "2024" },
                      { var: "$YY", desc: "year_short", example: "24" },
                      { var: "$Y", desc: "year_single", example: "4" },
                    ].map((item) => (
                      <Button
                        key={item.var}
                        variant="text"
                        size="small"
                        className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                        onClick={() => insertVariable(item.var)}
                      >
                        <div className="flex items-start gap-3">
                          <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                            {item.var}
                          </code>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-(--text-main) font-medium mb-1">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}`
                              )}
                            </div>
                            <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}_desc`
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 月份 */}
                <div>
                  <div className="text-sm font-semibold mb-2 text-(--text-main)">
                    {t("tools.batch_renamer.variable_picker.month")}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { var: "$MMMM", desc: "month_full", example: "December" },
                      { var: "$MMM", desc: "month_short", example: "Dec" },
                      { var: "$MM", desc: "month_padded", example: "12" },
                      { var: "$M", desc: "month_number", example: "12" },
                    ].map((item) => (
                      <Button
                        key={item.var}
                        variant="text"
                        size="small"
                        className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                        onClick={() => insertVariable(item.var)}
                      >
                        <div className="flex items-start gap-3">
                          <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                            {item.var}
                          </code>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-(--text-main) font-medium mb-1">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}`
                              )}
                            </div>
                            <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}_desc`
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 星期 */}
                <div>
                  <div className="text-sm font-semibold mb-2 text-(--text-main)">
                    {t("tools.batch_renamer.variable_picker.weekday")}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      {
                        var: "$DDDD",
                        desc: "weekday_full",
                        example: "Wednesday",
                      },
                      { var: "$DDD", desc: "weekday_short", example: "Wed" },
                    ].map((item) => (
                      <Button
                        key={item.var}
                        variant="text"
                        size="small"
                        className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                        onClick={() => insertVariable(item.var)}
                      >
                        <div className="flex items-start gap-3">
                          <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                            {item.var}
                          </code>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-(--text-main) font-medium mb-1">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}`
                              )}
                            </div>
                            <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}_desc`
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 日期 */}
                <div>
                  <div className="text-sm font-semibold mb-2 text-(--text-main)">
                    {t("tools.batch_renamer.variable_picker.day")}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { var: "$DD", desc: "day_padded", example: "25" },
                      { var: "$D", desc: "day_number", example: "25" },
                    ].map((item) => (
                      <Button
                        key={item.var}
                        variant="text"
                        size="small"
                        className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                        onClick={() => insertVariable(item.var)}
                      >
                        <div className="flex items-start gap-3">
                          <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                            {item.var}
                          </code>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-(--text-main) font-medium mb-1">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}`
                              )}
                            </div>
                            <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}_desc`
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 时间 */}
                <div>
                  <div className="text-sm font-semibold mb-2 text-(--text-main)">
                    {t("tools.batch_renamer.variable_picker.time")}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { var: "$hh", desc: "hour_padded", example: "09" },
                      { var: "$mm", desc: "minute_padded", example: "05" },
                      { var: "$ss", desc: "second_padded", example: "03" },
                      { var: "$h", desc: "hour_number", example: "9" },
                      { var: "$m", desc: "minute_number", example: "5" },
                      { var: "$s", desc: "second_number", example: "3" },
                    ].map((item) => (
                      <Button
                        key={item.var}
                        variant="text"
                        size="small"
                        className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                        onClick={() => insertVariable(item.var)}
                      >
                        <div className="flex items-start gap-3">
                          <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                            {item.var}
                          </code>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-(--text-main) font-medium mb-1">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}`
                              )}
                            </div>
                            <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}_desc`
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 毫秒 */}
                <div>
                  <div className="text-sm font-semibold mb-2 text-(--text-main)">
                    {t("tools.batch_renamer.variable_picker.millisecond")}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { var: "$fff", desc: "ms_three", example: "123" },
                      { var: "$ff", desc: "ms_two", example: "12" },
                      { var: "$f", desc: "ms_one", example: "1" },
                    ].map((item) => (
                      <Button
                        key={item.var}
                        variant="text"
                        size="small"
                        className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                        onClick={() => insertVariable(item.var)}
                      >
                        <div className="flex items-start gap-3">
                          <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                            {item.var}
                          </code>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-(--text-main) font-medium mb-1">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}`
                              )}
                            </div>
                            <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}_desc`
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 常用组合 */}
                <div>
                  <div className="text-sm font-semibold mb-2 text-(--text-main)">
                    {t(
                      "tools.batch_renamer.variable_picker.common_combinations"
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      {
                        var: "$YYYY$MM$DD",
                        desc: "date_basic",
                        example: "20241225",
                      },
                      {
                        var: "$YYYY-$MM-$DD",
                        desc: "date_dashed",
                        example: "2024-12-25",
                      },
                      {
                        var: "$YYYY$MM$DD_$hh$mm$ss",
                        desc: "datetime_full",
                        example: "20241225_143022",
                      },
                    ].map((item) => (
                      <Button
                        key={item.var}
                        variant="text"
                        size="small"
                        className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                        onClick={() => insertVariable(item.var)}
                      >
                        <div className="flex items-start gap-3">
                          <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                            {item.var}
                          </code>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-(--text-main) font-medium mb-1">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}`
                              )}
                            </div>
                            <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                              {t(
                                `tools.batch_renamer.variable_picker.${item.desc}_desc`
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-black/2 dark:bg-white/2 flex justify-end border-t border-(--border-color)">
            <Button
              variant="text"
              size="small"
              className="px-4 py-2 bg-(--bg-main) border border-(--border-color) rounded-xl text-sm font-medium hover:bg-(--border-color) transition-colors h-auto"
              onClick={() => setShowVariablePicker(false)}
            >
              {t("common.close")}
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  // 全选快捷键监听
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        if (files.length > 0) {
          setSelectedIndices(new Set(files.map((_, i) => i)));
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [files]);

  const handleRename = async () => {
    if (previews.length === 0) return;
    try {
      const response: any = await invoke("execute_batch_rename", {
        renames: previews,
      });
      if (response.ok) {
        toast.success(t("tools.batch_renamer.rename_success"));
        setFiles([]);
        setPreviews([]);
        setSelectedIndices(new Set());
        // 刷新历史记录
        fetchHistory();
      } else {
        toast.error(
          `${t("tools.batch_renamer.rename_failed")}: ${response.error.message}`
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(t("tools.batch_renamer.rename_failed"));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      // 重新调整索引（因为数组变短了）
      const adjusted = new Set<number>();
      next.forEach((i) => {
        if (i > index) adjusted.add(i - 1);
        else adjusted.add(i);
      });
      return adjusted;
    });
  };

  const removeSelected = () => {
    if (selectedIndices.size === 0) return;
    const sortedIndices = Array.from(selectedIndices).sort((a, b) => b - a);
    setFiles((prev) => {
      const next = [...prev];
      sortedIndices.forEach((index) => next.splice(index, 1));
      return next;
    });
    setSelectedIndices(new Set());
    lastSelectedIndex.current = null;
  };

  const handleRowClick = (e: React.MouseEvent, index: number) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl + Click: 切换选中
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    } else if (e.shiftKey && lastSelectedIndex.current !== null) {
      // Shift + Click: 范围选中
      const start = Math.min(lastSelectedIndex.current, index);
      const end = Math.max(lastSelectedIndex.current, index);
      const range = new Set<number>();
      for (let i = start; i <= end; i++) {
        range.add(i);
      }
      setSelectedIndices((prev) => new Set([...prev, ...range]));
    } else {
      // 普通点击: 单选
      setSelectedIndices(new Set([index]));
    }
    lastSelectedIndex.current = index;
  };

  return (
    <ToolLayout title={t("tools.batch_renamer.name")}>
      <div className="space-y-6">
        {/* 使用说明卡片 */}
        <div className="p-6 rounded-2xl border border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-green-600" />
            <div className="text-lg font-bold text-green-700">
              {t("tools.batch_renamer.instructions.title")}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-green-700">
                {t("tools.batch_renamer.instructions.step1_title")}
              </div>
              <div className="text-xs text-green-600/80 leading-relaxed">
                {t("tools.batch_renamer.instructions.step1_desc")}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-green-700">
                {t("tools.batch_renamer.instructions.step2_title")}
              </div>
              <div className="text-xs text-green-600/80 leading-relaxed">
                {t("tools.batch_renamer.instructions.step2_desc")}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-green-700">
                {t("tools.batch_renamer.instructions.step3_title")}
              </div>
              <div className="text-xs text-green-600/80 leading-relaxed">
                {t("tools.batch_renamer.instructions.step3_desc")}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-green-700">
                {t("tools.batch_renamer.instructions.step4_title")}
              </div>
              <div className="text-xs text-green-600/80 leading-relaxed">
                {t("tools.batch_renamer.instructions.step4_desc")}
              </div>
            </div>
          </div>
        </div>

        {/* 友好提示卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 flex items-start gap-3">
            <MousePointerClick className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-blue-600 mb-1">
                {t("tools.batch_renamer.tips.title")}
              </div>
              <div className="text-xs text-blue-500/80 leading-relaxed">
                {t("tools.batch_renamer.tips.multi_select")}
                <br />
                {t("tools.batch_renamer.tips.range_select")}
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 flex items-start gap-3">
            <Keyboard className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-purple-600 mb-1">
                {t("tools.batch_renamer.tips.shortcuts")}
              </div>
              <div className="text-xs text-purple-500/80 leading-relaxed">
                {t("tools.batch_renamer.tips.select_all")}
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-600 mb-1">
                {t("tools.batch_renamer.tips.warning")}
              </div>
              <div className="text-xs text-amber-500/80 leading-relaxed">
                {t("tools.batch_renamer.tips.warning_msg")}
              </div>
            </div>
          </div>
        </div>

        {/* 第一部分：规则配置卡片 */}
        <div className="p-6 rounded-2xl border border-(--border-color) bg-(--card-bg) shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg mb-4">
            <Settings2 className="w-5 h-5 text-blue-500" />
            {t("tools.batch_renamer.rules")}
          </div>

          {/* 操作按钮栏 - 移动到标题下方 */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-(--border-color) border-dashed">
            <div className="flex items-center gap-2">
              <Button onClick={handleAddFiles} className="shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                {t("tools.batch_renamer.add_files")}
              </Button>
              <Button onClick={handleAddFolders} className="shadow-sm">
                <FolderPlus className="w-4 h-4 mr-2" />
                {t("tools.batch_renamer.add_folders")}
              </Button>
              <Button
                color="error"
                variant="contained"
                onClick={() => {
                  setFiles([]);
                  setSelectedIndices(new Set());
                }}
                disabled={files.length === 0}
                className="shadow-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t("tools.batch_renamer.clear_list")}
              </Button>
            </div>
            <Button
              variant="contained"
              onClick={handleRename}
              disabled={previews.length === 0}
              className="bg-primary hover:bg-primary-hover shadow-sm"
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              {t("tools.batch_renamer.execute")}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 替换规则组 */}
            <div className="space-y-4">
              <div className="text-sm font-semibold text-(--text-muted) uppercase tracking-wider">
                {t("tools.batch_renamer.replace")}
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium ml-1">
                    {t("tools.batch_renamer.search_for")}
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    value={rule.search}
                    onChange={(e) =>
                      setRule({ ...rule, search: e.target.value })
                    }
                    placeholder="e.g. old_name"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium ml-1">
                    {t("tools.batch_renamer.replace_with")}
                  </label>
                  <div className="relative">
                    <input
                      ref={replaceInputRef}
                      type="text"
                      className="w-full px-3 py-2 pr-10 rounded-lg bg-(--bg-main) border border-(--border-color) focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                      value={rule.replace}
                      onChange={(e) =>
                        setRule({ ...rule, replace: e.target.value })
                      }
                      placeholder="e.g. new_name"
                    />
                    <button
                      type="button"
                      title={t("tools.batch_renamer.insert_variable")}
                      onClick={() => setShowVariablePicker(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/10 transition-colors flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-(--border-color) text-blue-600 focus:ring-blue-500"
                      checked={rule.use_regex}
                      onChange={(e) =>
                        setRule({ ...rule, use_regex: e.target.checked })
                      }
                    />
                    <span className="group-hover:text-blue-500 transition-colors">
                      {t("tools.batch_renamer.use_regex")}
                    </span>
                    <button
                      type="button"
                      title={t("tools.batch_renamer.regex_help.open")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRegexHelp(true);
                      }}
                      className="ml-2 p-1 rounded-md text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/10 transition-colors flex items-center justify-center"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-(--border-color) text-blue-600 focus:ring-blue-500"
                      checked={rule.case_sensitive}
                      onChange={(e) =>
                        setRule({ ...rule, case_sensitive: e.target.checked })
                      }
                    />
                    <span className="group-hover:text-blue-500 transition-colors">
                      {t("tools.batch_renamer.case_sensitive")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-(--border-color) text-blue-600 focus:ring-blue-500"
                      checked={rule.auto_increment}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRule({
                          ...rule,
                          auto_increment: checked,
                          // 开启时如果步长为0则设为1，关闭时将步长设为0以取消编号效果
                          sequence_step: checked
                            ? rule.sequence_step === 0
                              ? 1
                              : rule.sequence_step
                            : 0,
                        });
                      }}
                    />
                    <span className="group-hover:text-blue-500 transition-colors font-bold text-blue-600">
                      {t("tools.batch_renamer.auto_increment")}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* 前后缀规则组 */}
            <div className="space-y-4">
              <div className="text-sm font-semibold text-(--text-muted) uppercase tracking-wider">
                {t("tools.batch_renamer.prefix")} /{" "}
                {t("tools.batch_renamer.suffix")}
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium ml-1">
                    {t("tools.batch_renamer.prefix")}
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    value={rule.prefix}
                    onChange={(e) =>
                      setRule({ ...rule, prefix: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium ml-1">
                    {t("tools.batch_renamer.suffix")}
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    value={rule.suffix}
                    onChange={(e) =>
                      setRule({ ...rule, suffix: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 高级选项折叠面板 */}
          <div className="mt-6 pt-6 border-t border-(--border-color) border-dashed">
            <div
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-(--text-muted)">
                <SlidersHorizontal className="w-4 h-4" />
                {t("tools.batch_renamer.advanced.title")}
              </div>
              <div className="flex items-center gap-2">
                {(rule.apply_to !== "name_only" ||
                  !rule.include_files ||
                  !rule.include_folders ||
                  rule.text_formatting !== "none" ||
                  rule.enumerate_items ||
                  rule.random_string ||
                  rule.use_datetime) && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                    {t("tools.batch_renamer.advanced.active")}
                  </span>
                )}
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 text-(--text-muted) group-hover:text-blue-500 transition-colors" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-(--text-muted) group-hover:text-blue-500 transition-colors" />
                )}
              </div>
            </div>

            {showAdvanced && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 应用对象 */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-(--text-muted) flex items-center gap-1.5">
                    <FileType className="w-3.5 h-3.5" />
                    {t("tools.batch_renamer.advanced.apply_to.title")}
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input
                        type="radio"
                        name="apply_to"
                        className="w-4 h-4 text-blue-600"
                        checked={rule.apply_to === "name_only"}
                        onChange={() =>
                          setRule({ ...rule, apply_to: "name_only" })
                        }
                      />
                      <span className="group-hover:text-blue-500 transition-colors">
                        {t("tools.batch_renamer.advanced.apply_to.name_only")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input
                        type="radio"
                        name="apply_to"
                        className="w-4 h-4 text-blue-600"
                        checked={rule.apply_to === "extension_only"}
                        onChange={() =>
                          setRule({ ...rule, apply_to: "extension_only" })
                        }
                      />
                      <span className="group-hover:text-blue-500 transition-colors">
                        {t(
                          "tools.batch_renamer.advanced.apply_to.extension_only"
                        )}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input
                        type="radio"
                        name="apply_to"
                        className="w-4 h-4 text-blue-600"
                        checked={rule.apply_to === "both"}
                        onChange={() => setRule({ ...rule, apply_to: "both" })}
                      />
                      <span className="group-hover:text-blue-500 transition-colors">
                        {t("tools.batch_renamer.advanced.apply_to.both")}
                      </span>
                    </label>
                  </div>
                </div>

                {/* 包含选项 */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-(--text-muted) flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5" />
                    {t("tools.batch_renamer.advanced.include.title")}
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-blue-600"
                        checked={rule.include_files}
                        onChange={(e) =>
                          setRule({ ...rule, include_files: e.target.checked })
                        }
                      />
                      <FileType className="w-3.5 h-3.5 text-(--text-muted)" />
                      <span className="group-hover:text-blue-500 transition-colors">
                        {t("tools.batch_renamer.advanced.include.files")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-blue-600"
                        checked={rule.include_folders}
                        onChange={(e) =>
                          setRule({
                            ...rule,
                            include_folders: e.target.checked,
                          })
                        }
                      />
                      <Folder className="w-3.5 h-3.5 text-(--text-muted)" />
                      <span className="group-hover:text-blue-500 transition-colors">
                        {t("tools.batch_renamer.advanced.include.folders")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer group">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-blue-600"
                        checked={rule.include_subfolders}
                        onChange={(e) =>
                          setRule({
                            ...rule,
                            include_subfolders: e.target.checked,
                          })
                        }
                      />
                      <FolderTree className="w-3.5 h-3.5 text-(--text-muted)" />
                      <span className="group-hover:text-blue-500 transition-colors">
                        {t("tools.batch_renamer.advanced.include.subfolders")}
                      </span>
                    </label>
                  </div>
                </div>

                {/* 文本格式 */}
                <div className="space-y-3">
                  <div className="text-xs font-medium text-(--text-muted) flex items-center gap-1.5">
                    <CaseSensitive className="w-3.5 h-3.5" />
                    {t("tools.batch_renamer.advanced.text_format.title")}
                  </div>
                  <Select
                    value={rule.text_formatting}
                    onChange={(val) =>
                      setRule({
                        ...rule,
                        text_formatting: val as RenameRule["text_formatting"],
                      })
                    }
                    options={[
                      {
                        key: "none",
                        labelKey:
                          "tools.batch_renamer.advanced.text_format.none",
                      },
                      {
                        key: "lowercase",
                        labelKey:
                          "tools.batch_renamer.advanced.text_format.lowercase",
                      },
                      {
                        key: "uppercase",
                        labelKey:
                          "tools.batch_renamer.advanced.text_format.uppercase",
                      },
                      {
                        key: "titlecase",
                        labelKey:
                          "tools.batch_renamer.advanced.text_format.titlecase",
                      },
                      {
                        key: "capitalize",
                        labelKey:
                          "tools.batch_renamer.advanced.text_format.capitalize",
                      },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 第二部分：预览列表卡片 */}
        <div className="rounded-2xl border border-(--border-color) bg-(--card-bg) shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-(--border-color) flex items-center justify-between bg-(--card-bg)">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 font-bold">
                <Eye className="w-5 h-5 text-blue-500" />
                {t("tools.batch_renamer.preview")}
              </div>
              {selectedIndices.size > 0 && (
                <Button
                  variant="text"
                  size="small"
                  onClick={removeSelected}
                  className="text-red-500 hover:bg-red-500/10 h-8 px-3 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {t("tools.batch_renamer.tips.remove_selected")} (
                  {selectedIndices.size})
                </Button>
              )}
            </div>
            <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-bold">
              {files.length} {t("common.items")}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse select-none">
              <thead>
                <tr className="bg-(--bg-main)/50">
                  <th className="px-6 py-3 font-semibold text-(--text-muted) border-b border-(--border-color)">
                    {t("tools.batch_renamer.col_old_name")}
                  </th>
                  <th className="px-6 py-3 font-semibold text-(--text-muted) border-b border-(--border-color)">
                    {t("tools.batch_renamer.col_new_name")}
                  </th>
                  <th className="px-6 py-3 w-16 border-b border-(--border-color)"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--border-color)">
                {previews.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-(--text-muted)">
                        <FileEdit className="w-12 h-12 mb-4 opacity-20" />
                        <p>{t("common.no_results")}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  previews.map((preview, index) => (
                    <tr
                      key={index}
                      onClick={(e) => handleRowClick(e, index)}
                      className={`transition-colors group cursor-pointer ${
                        selectedIndices.has(index)
                          ? "bg-blue-500/10 hover:bg-blue-500/15"
                          : "hover:bg-(--bg-main)/40"
                      }`}
                    >
                      <td className="px-6 py-4 max-w-md">
                        <div
                          className={`truncate ${
                            selectedIndices.has(index)
                              ? "text-blue-600 font-medium"
                              : "text-(--text-muted)"
                          }`}
                          title={preview.old_path}
                        >
                          {preview.old_path.split(/[\\/]/).pop()}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-md">
                        <div
                          className={`truncate font-medium ${
                            selectedIndices.has(index)
                              ? "text-blue-700"
                              : "text-blue-500"
                          }`}
                        >
                          {preview.new_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="text"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="p-2 rounded-lg text-(--text-muted) hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all h-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 第三部分：历史记录面板 */}
        <div className="rounded-2xl border border-(--border-color) bg-(--card-bg) shadow-sm overflow-hidden">
          <div
            className="px-6 py-4 border-b border-(--border-color) flex items-center justify-between bg-(--card-bg) cursor-pointer hover:bg-(--bg-main)/30 transition-colors"
            onClick={() => setShowHistory(!showHistory)}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 font-bold">
                <History className="w-5 h-5 text-purple-500" />
                {t("tools.batch_renamer.history.title")}
              </div>
              <div className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs font-bold">
                {historyRecords.length} {t("common.items")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {historyRecords.length > 0 && showHistory && (
                <>
                  <Button
                    variant="text"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRevertAll();
                    }}
                    className="text-purple-500 hover:bg-purple-500/10 h-8 px-3 text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    {t("tools.batch_renamer.history.revert_all")}
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearHistory();
                    }}
                    className="text-red-500 hover:bg-red-500/10 h-8 px-3 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {t("tools.batch_renamer.history.clear")}
                  </Button>
                </>
              )}
              <div
                className={`transform transition-transform ${
                  showHistory ? "rotate-180" : ""
                }`}
              >
                <svg
                  className="w-5 h-5 text-(--text-muted)"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {showHistory && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-(--bg-main)/50">
                    <th className="px-6 py-3 font-semibold text-(--text-muted) border-b border-(--border-color)">
                      {t("tools.batch_renamer.history.current_name")}
                    </th>
                    <th className="px-6 py-3 font-semibold text-(--text-muted) border-b border-(--border-color)">
                      {t("tools.batch_renamer.history.original_name")}
                    </th>
                    <th className="px-6 py-3 font-semibold text-(--text-muted) border-b border-(--border-color)">
                      {t("tools.batch_renamer.history.time")}
                    </th>
                    <th className="px-6 py-3 w-24 border-b border-(--border-color)"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border-color)">
                  {historyRecords.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-(--text-muted)">
                          <History className="w-10 h-10 mb-3 opacity-20" />
                          <p>{t("tools.batch_renamer.history.empty")}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    historyRecords.map((record, index) => (
                      <tr
                        key={index}
                        className="transition-colors group hover:bg-(--bg-main)/40"
                      >
                        <td className="px-6 py-3 max-w-xs">
                          <div
                            className="truncate text-purple-500 font-medium"
                            title={record.current_path}
                          >
                            {record.current_path.split(/[\\/]/).pop()}
                          </div>
                        </td>
                        <td className="px-6 py-3 max-w-xs">
                          <div
                            className="truncate text-(--text-muted)"
                            title={record.original_name}
                          >
                            {record.original_name}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-1.5 text-xs text-(--text-muted)">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTimestamp(record.timestamp)}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Button
                            variant="text"
                            size="small"
                            onClick={() =>
                              handleRevertSingle(record.current_path)
                            }
                            className="text-purple-500 hover:bg-purple-500/10 h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            {t("tools.batch_renamer.history.revert")}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <RegexHelpModal />
      <VariablePickerModal />
    </ToolLayout>
  );
};

export default BatchRenamer;

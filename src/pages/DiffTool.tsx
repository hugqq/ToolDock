import React, { useState } from "react";
import {
  GitCompare,
  Trash2,
  FileText,
  Columns2,
  Rows2,
  Copy,
  ArrowLeftRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import { toast } from "react-hot-toast";

interface DiffLine {
  tag: "insert" | "delete" | "equal";
  content: string;
  old_index: number | null;
  new_index: number | null;
}

interface DiffResult {
  lines: DiffLine[];
}

const DiffTool: React.FC = () => {
  const { t } = useTranslation();
  const [originalText, setOriginalText] = useState("");
  const [modifiedText, setModifiedText] = useState("");
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (!originalText && !modifiedText) return;
    setLoading(true);
    try {
      const response = await invoke<any>("diff_text", {
        oldText: originalText,
        newText: modifiedText,
      });
      if (response.ok) {
        setDiffResult(response.data);
      } else {
        toast.error(
          response.error?.message || t("tools.diff_tool.compare_failed")
        );
      }
    } catch (error) {
      console.error("Diff error:", error);
      toast.error(t("tools.diff_tool.compare_failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setOriginalText("");
    setModifiedText("");
    setDiffResult(null);
  };

  const handleSwap = () => {
    const temp = originalText;
    setOriginalText(modifiedText);
    setModifiedText(temp);
    if (diffResult) {
      handleCompare();
    }
  };

  const handleCopyModified = () => {
    navigator.clipboard.writeText(modifiedText);
    toast.success(t("common.copy_success") || "已复制到剪贴板");
  };

  const handleSelectFile = async (target: "original" | "modified") => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Text",
            extensions: [
              "txt",
              "md",
              "json",
              "js",
              "ts",
              "rs",
              "c",
              "cpp",
              "h",
              "py",
              "html",
              "css",
            ],
          },
        ],
      });
      if (selected && typeof selected === "string") {
        const content = await readTextFile(selected);
        if (target === "original") {
          setOriginalText(content);
        } else {
          setModifiedText(content);
        }
      }
    } catch (error) {
      toast.error(t("tools.diff_tool.read_file_failed"));
    }
  };

  const renderDiffLine = (
    line: DiffLine,
    key: string | number,
    mode: "left" | "right" | "unified"
  ) => {
    const bgColor =
      line.tag === "insert"
        ? "rgba(34, 197, 94, 0.1)" // green-500/10
        : line.tag === "delete"
        ? "rgba(239, 68, 68, 0.1)" // red-500/10
        : "transparent";

    const indicator =
      line.tag === "insert" ? "+" : line.tag === "delete" ? "-" : " ";
    const color =
      line.tag === "insert"
        ? "#22c55e" // green-500
        : line.tag === "delete"
        ? "#ef4444" // red-500
        : "var(--text-muted)";

    return (
      <div
        key={key}
        className="flex font-mono text-[13px] min-h-[1.5rem] whitespace-pre-wrap break-all leading-6 transition-colors hover:bg-primary/5"
        style={{ backgroundColor: bgColor }}
      >
        {(mode === "left" || mode === "unified") && (
          <div className="w-14 text-right pr-4 text-(--text-muted) select-none border-r border-(--border-color) shrink-0 bg-(--bg-main)/30">
            {line.old_index !== null ? line.old_index + 1 : ""}
          </div>
        )}
        {(mode === "right" || mode === "unified") && (
          <div className="w-14 text-right pr-4 text-(--text-muted) select-none border-r border-(--border-color) shrink-0 bg-(--bg-main)/30">
            {line.new_index !== null ? line.new_index + 1 : ""}
          </div>
        )}
        <div
          className="w-6 text-center font-bold select-none shrink-0 opacity-70"
          style={{ color }}
        >
          {indicator}
        </div>
        <div className="pl-2 flex-1 py-0.5">{line.content || " "}</div>
      </div>
    );
  };

  const renderSplitView = () => {
    if (!diffResult) return null;

    const rows: React.ReactNode[] = [];
    const lines = diffResult.lines;
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (line.tag === "equal") {
        rows.push(
          <div
            key={i}
            className="flex border-b border-(--border-color) min-h-[1.5rem]"
          >
            <div className="w-1/2 border-r border-(--border-color)">
              {renderDiffLine(line, `l-${i}`, "left")}
            </div>
            <div className="w-1/2">
              {renderDiffLine(line, `r-${i}`, "right")}
            </div>
          </div>
        );
        i++;
      } else if (line.tag === "delete") {
        if (i + 1 < lines.length && lines[i + 1].tag === "insert") {
          rows.push(
            <div
              key={i}
              className="flex border-b border-(--border-color) min-h-[1.5rem]"
            >
              <div className="w-1/2 border-r border-(--border-color)">
                {renderDiffLine(line, `l-${i}`, "left")}
              </div>
              <div className="w-1/2">
                {renderDiffLine(lines[i + 1], `r-${i + 1}`, "right")}
              </div>
            </div>
          );
          i += 2;
        } else {
          rows.push(
            <div
              key={i}
              className="flex border-b border-(--border-color) min-h-[1.5rem]"
            >
              <div className="w-1/2 border-r border-(--border-color)">
                {renderDiffLine(line, `l-${i}`, "left")}
              </div>
              <div className="w-1/2 bg-(--bg-main)/10" />
            </div>
          );
          i++;
        }
      } else if (line.tag === "insert") {
        rows.push(
          <div
            key={i}
            className="flex border-b border-(--border-color) min-h-[1.5rem]"
          >
            <div className="w-1/2 border-r border-(--border-color) bg-(--bg-main)/10" />
            <div className="w-1/2">
              {renderDiffLine(line, `r-${i}`, "right")}
            </div>
          </div>
        );
        i++;
      }
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex bg-(--bg-main)/50 border-b border-(--border-color) shrink-0">
          <div className="w-1/2 p-2 border-r border-(--border-color)">
            <span className="text-xs font-bold text-(--text-muted) uppercase tracking-wider">
              {t("tools.diff_tool.original")}
            </span>
          </div>
          <div className="w-1/2 p-2">
            <span className="text-xs font-bold text-(--text-muted) uppercase tracking-wider">
              {t("tools.diff_tool.modified")}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar bg-(--card-bg)">
          {rows}
        </div>
      </div>
    );
  };

  const renderUnifiedView = () => {
    if (!diffResult) return null;
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="p-2 bg-(--bg-main)/50 border-b border-(--border-color) shrink-0">
          <span className="text-xs font-bold text-(--text-muted) uppercase tracking-wider">
            {t("tools.diff_tool.unified_view")}
          </span>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar bg-(--card-bg)">
          {diffResult.lines.map((line, idx) =>
            renderDiffLine(line, idx, "unified")
          )}
        </div>
      </div>
    );
  };

  return (
    <ToolLayout
      title={t("tools.diff_tool.name")}
    >
      <div className="flex flex-col h-full gap-4 overflow-hidden">
        {/* 输入区域 */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-4 transition-all duration-300 ease-in-out ${
            diffResult ? "h-48" : "flex-1"
          }`}
        >
          {/* 原始文本 */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-(--text-main) flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                {t("tools.diff_tool.original")}
              </label>
              <Button
                variant="text"
                size="small"
                onClick={() => handleSelectFile("original")}
                className="text-xs"
              >
                {t("tools.diff_tool.select_file")}
              </Button>
            </div>
            <textarea
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder={t("tools.diff_tool.placeholder_original")}
              className="flex-1 w-full p-3 bg-(--card-bg) border border-(--border-color) rounded-xl text-[13px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all custom-scrollbar"
            />
          </div>

          {/* 修改后文本 */}
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-(--text-main) flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                {t("tools.diff_tool.modified")}
              </label>
              <Button
                variant="text"
                size="small"
                onClick={() => handleSelectFile("modified")}
                className="text-xs"
              >
                {t("tools.diff_tool.select_file")}
              </Button>
            </div>
            <textarea
              value={modifiedText}
              onChange={(e) => setModifiedText(e.target.value)}
              placeholder={t("tools.diff_tool.placeholder_modified")}
              className="flex-1 w-full p-3 bg-(--card-bg) border border-(--border-color) rounded-xl text-[13px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all custom-scrollbar"
            />
          </div>
        </div>

        {/* 控制栏 */}
        <div className="flex items-center justify-between gap-4 p-3 bg-(--card-bg) rounded-xl border border-(--border-color) shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCompare}
              disabled={loading || (!originalText && !modifiedText)}
              className="flex items-center gap-2"
            >
              <GitCompare size={18} />
              {t("tools.diff_tool.compare")}
            </Button>
            <Button
              variant="outlined"
              onClick={handleSwap}
              disabled={!originalText && !modifiedText}
              className="flex items-center gap-2"
            >
              <ArrowLeftRight size={18} />
              {t("common.swap") || "交换"}
            </Button>
            <Button
              variant="outlined"
              onClick={handleClear}
              className="flex items-center gap-2 text-red-500 hover:bg-red-500/10 border-red-500/20"
            >
              <Trash2 size={18} />
              {t("tools.diff_tool.clear")}
            </Button>
          </div>

          <div className="flex items-center gap-4">
            {diffResult && (
              <>
                <div className="flex items-center bg-(--bg-main)/50 rounded-lg p-1 border border-(--border-color)">
                  <button
                    onClick={() => setViewMode("split")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === "split"
                        ? "bg-primary text-white shadow-sm"
                        : "text-(--text-muted) hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <Columns2 size={14} />
                    {t("tools.diff_tool.split_view")}
                  </button>
                  <button
                    onClick={() => setViewMode("unified")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      viewMode === "unified"
                        ? "bg-primary text-white shadow-sm"
                        : "text-(--text-muted) hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <Rows2 size={14} />
                    {t("tools.diff_tool.unified_view")}
                  </button>
                </div>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCopyModified}
                  className="flex items-center gap-2"
                >
                  <Copy size={16} />
                  {t("tools.diff_tool.copy_modified")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 结果区域 */}
        {diffResult && (
          <div className="flex-1 flex flex-col min-h-0 bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden shadow-sm relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary/10 z-10" />
            {viewMode === "split" ? renderSplitView() : renderUnifiedView()}
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default DiffTool;


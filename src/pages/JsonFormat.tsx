/**
 * JSON格式化工具页面
 * 职责：格式化、压缩JSON，转换为XML，树状图查看，JSONPath搜索
 */
import { json } from "@codemirror/lang-json";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import CodeMirror from "@uiw/react-codemirror";
import {
  AlertCircle,
  Beaker,
  CheckCircle2,
  ChevronRight,
  Code,
  Copy,
  Download,
  FileCode,
  FoldVertical,
  ListTree,
  Minimize2,
  Search,
  Trash2,
  UnfoldVertical,
  WandSparkles,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../components/ThemeContext";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import { TIMING, UI } from "../constants";

const JsonTreeNode: React.FC<{
  label?: string;
  value: any;
  depth: number;
  expandTrigger?: number;
  collapseTrigger?: number;
  searchQuery?: string;
}> = ({ label, value, depth, expandTrigger, collapseTrigger, searchQuery }) => {
  const [isExpanded, setIsExpanded] = useState(depth < UI.JSON_TREE_DEFAULT_DEPTH);

  const isObject = typeof value === "object" && value !== null;
  const isArray = Array.isArray(value);

  // 搜索匹配逻辑
  const isMatch = (text: string) => {
    if (!searchQuery) return false;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const labelMatch = label ? isMatch(label) : false;
  const valueMatch = !isObject ? isMatch(String(value)) : false;

  useEffect(() => {
    if (expandTrigger) setIsExpanded(true);
  }, [expandTrigger]);

  useEffect(() => {
    if (collapseTrigger) setIsExpanded(false);
  }, [collapseTrigger]);

  // 如果子节点有匹配，自动展开
  useEffect(() => {
    if (searchQuery && isObject) {
      const hasMatchInChildren = (obj: any): boolean => {
        return Object.entries(obj).some(([k, v]) => {
          if (k.toLowerCase().includes(searchQuery.toLowerCase())) return true;
          if (typeof v === "object" && v !== null) return hasMatchInChildren(v);
          return String(v).toLowerCase().includes(searchQuery.toLowerCase());
        });
      };
      if (hasMatchInChildren(value)) {
        setIsExpanded(true);
      }
    }
  }, [searchQuery, value, isObject]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  if (!isObject) {
    return (
      <div
        className={`flex items-start py-0.5 rounded px-1 transition-colors group ${
          labelMatch || valueMatch ? "bg-yellow-500/20" : "hover:bg-primary/5"
        }`}
      >
        {label && (
          <span
            className={`mr-2 shrink-0 font-medium ${
              labelMatch ? "text-yellow-500 underline" : "text-primary"
            }`}
          >
            "{label}":
          </span>
        )}
        <span
          className={`${
            valueMatch ? "bg-yellow-500/40 text-black rounded px-0.5" : ""
          } ${
            typeof value === "string"
              ? "text-green-500 break-all"
              : typeof value === "number"
              ? "text-orange-500"
              : typeof value === "boolean"
              ? "text-purple-500"
              : "text-blue-500"
          }`}
        >
          {typeof value === "string" ? `"${value}"` : String(value)}
        </span>
      </div>
    );
  }

  const keys = Object.keys(value);
  const isEmpty = keys.length === 0;

  return (
    <div className="flex flex-col">
      <div
        className={`flex items-center py-0.5 rounded px-1 cursor-pointer transition-colors group ${
          labelMatch ? "bg-yellow-500/20" : "hover:bg-primary/5"
        }`}
        onClick={toggle}
      >
        <div className="w-4 h-4 flex items-center justify-center mr-1 shrink-0 text-(--text-muted) group-hover:text-primary">
          {!isEmpty && (
            <ChevronRight
              size={14}
              className={`transition-transform duration-200 ${
                isExpanded ? "rotate-90" : ""
              }`}
            />
          )}
        </div>
        {label && (
          <span
            className={`mr-2 shrink-0 font-medium ${
              labelMatch ? "text-yellow-500 underline" : "text-primary"
            }`}
          >
            "{label}":
          </span>
        )}
        <span className="text-(--text-muted) text-xs">
          {isArray ? `Array[${keys.length}]` : `Object {${keys.length}}`}
        </span>
      </div>
      {isExpanded && !isEmpty && (
        <div className="ml-4 border-l border-(--border-color) pl-2 my-0.5">
          {keys.map((key) => (
            <JsonTreeNode
              key={key}
              label={isArray ? undefined : key}
              value={value[key]}
              depth={depth + 1}
              expandTrigger={expandTrigger}
              collapseTrigger={collapseTrigger}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const JsonTreeView: React.FC<{
  data: any;
  expandTrigger?: number;
  collapseTrigger?: number;
  searchQuery?: string;
}> = ({ data, expandTrigger, collapseTrigger, searchQuery }) => {
  if (!data) return null;
  return (
    <div className="p-4 font-mono text-sm overflow-auto h-full custom-scrollbar bg-(--bg-main)">
      <JsonTreeNode
        value={data}
        depth={0}
        expandTrigger={expandTrigger}
        collapseTrigger={collapseTrigger}
        searchQuery={searchQuery}
      />
    </div>
  );
};

const JsonFormat: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [jsonObject, setJsonObject] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState(t("common.ready"));
  const [keepEscape, setKeepEscape] = useState(true);
  const [viewMode, setViewMode] = useState<"code" | "tree">("tree");
  const [expandTrigger, setExpandTrigger] = useState(0);
  const [collapseTrigger, setCollapseTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [jsonPathResult, setJsonPathResult] = useState<any>(null);

  // 自动格式化逻辑
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!input.trim()) {
        setJsonObject(null);
        setOutput("");
        setError(null);
        setStatusText(t("common.ready"));
        return;
      }

      try {
        let processedInput = input;
        if (!keepEscape) {
          // 处理转义字符：将 \" 替换为 " 等
          try {
            processedInput = input.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
          } catch (e) {
            console.error("Escape processing failed", e);
          }
        }

        const parsed = JSON.parse(processedInput);
        setJsonObject(parsed);
        setOutput(JSON.stringify(parsed, null, 2));
        setError(null);
        setStatusText(t("common.success"));
      } catch (e: any) {
        if (input.length > UI.MIN_INPUT_LENGTH_FOR_ERROR) {
          setError(`${t("tools.json_format.invalid")}: ${e.message}`);
          setStatusText(t("common.error"));
        }
        setJsonObject(null);
      }
    }, TIMING.DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [input, t, keepEscape]);

  // JSONPath 搜索逻辑
  useEffect(() => {
    if (searchQuery.startsWith("$") && jsonObject) {
      try {
        // 极简 JSONPath 实现: $.a.b[0].c
        const path = searchQuery.substring(2); // 去掉 $.
        if (!path) {
          setJsonPathResult(jsonObject);
          return;
        }

        const parts = path.split(/\.|\b(?=\[)/).filter(Boolean);
        let current = jsonObject;

        for (let part of parts) {
          if (part.startsWith("[")) {
            const index = parseInt(part.substring(1, part.length - 1));
            current = current[index];
          } else {
            current = current[part];
          }
          if (current === undefined) break;
        }

        setJsonPathResult(current !== undefined ? current : null);
      } catch (e) {
        setJsonPathResult(null);
      }
    } else {
      setJsonPathResult(null);
    }
  }, [searchQuery, jsonObject]);

  const handleBeautify = () => {
    try {
      if (!input.trim()) return;
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      setViewMode("code");
      setStatusText(t("common.success"));
    } catch (e: any) {
      setError(`${t("tools.json_format.invalid")}: ${e.message}`);
    }
  };

  const handleMinify = () => {
    try {
      if (!input.trim()) return;
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed));
      setViewMode("code");
      setStatusText(t("common.success"));
    } catch (e: any) {
      setError(`${t("tools.json_format.invalid")}: ${e.message}`);
    }
  };

  const handleToXml = () => {
    if (!jsonObject) return;
    try {
      const toXml = (v: any, name: string): string => {
        if (Array.isArray(v)) {
          return v.map((item) => toXml(item, name)).join("");
        }
        if (typeof v === "object" && v !== null) {
          const children = Object.entries(v)
            .map(([key, value]) => toXml(value, key))
            .join("");
          return `<${name}>${children}</${name}>`;
        }
        return `<${name}>${v}</${name}>`;
      };
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<root>${Object.entries(
        jsonObject
      )
        .map(([k, v]) => toXml(v, k))
        .join("")}</root>`;
      setOutput(xml);
      setViewMode("code");
      setStatusText(t("tools.json_format.to_xml_success"));
    } catch (e: any) {
      setError(`${t("tools.json_format.xml_failed")}: ${e.message}`);
    }
  };

  const handleSave = async () => {
    if (!output) return;
    try {
      const isXml = output.trim().startsWith("<?xml");
      const defaultFilename = isXml
        ? "formatted_data.xml"
        : "formatted_data.json";

      const path = await save({
        defaultPath: defaultFilename,
        filters: [
          {
            name: isXml ? "XML" : "JSON",
            extensions: [isXml ? "xml" : "json"],
          },
        ],
      });
      if (path) {
        await writeTextFile(path, output);
        setStatusText(t("common.success"));
      }
    } catch (e: any) {
      setError(`${t("tools.json_format.save_failed")}: ${e.message}`);
    }
  };

  const handleLoadExample = () => {
    const example = {
      project: "ToolDock",
      version: "1.0.0",
      active: true,
      author: {
        name: "hugqq",
        skills: ["Rust", "React", "TypeScript", "Tauri"],
      },
      test: '这是一个包含转义字符的字符串："Hello, World!" 和反斜杠 \\ 示例。',
      coding:
        "这是一个包含特殊字符的字符串：%20%3C%3E%23%25%7B%7D%7C%5C%5E~%5B%5D`",
    };
    setInput(JSON.stringify(example, null, 2));
    setStatusText(t("tools.json_format.load_example_success"));
  };

  const handleCopy = () => {
    if (output) {
      navigator.clipboard.writeText(output);
      setStatusText(t("common.copy") + " " + t("common.success"));
    }
  };

  const handleClear = () => {
    setInput("");
    setJsonObject(null);
    setOutput("");
    setError(null);
    setStatusText(t("tools.json_format.clear"));
  };

  const handleOutputChange = (value: string) => {
    setOutput(value);
    try {
      // 如果是有效的 JSON，同步回 input
      JSON.parse(value);
      setInput(value);
    } catch (e) {
      // 忽略无效 JSON 的同步
    }
  };

  return (
    <ToolLayout title={t("tools.json_format.name")} status={statusText}>
      <div className="bg-(--card-bg) p-4 rounded-2xl border border-(--border-color) shadow-sm mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* 搜索框 */}
          <div className="relative flex-1 max-w-md group">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted) group-focus-within:text-primary transition-colors pointer-events-none"
            />
            <input
              type="text"
              placeholder={t("common.search") + " (Key/Value or $.path)"}
              className="w-full bg-(--bg-main) border border-(--border-color) rounded-xl py-2 pl-10 pr-10 text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-(--text-muted) hover:text-primary p-1 rounded-full hover:bg-primary/10 transition-colors flex items-center justify-center"
                onClick={() => setSearchQuery("")}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="w-px h-6 bg-(--border-color) mx-1" />

          <Button
            variant="outlined"
            className="flex items-center gap-2 px-4 py-2.5 bg-(--bg-main) border border-(--border-color) rounded-xl text-sm font-medium hover:bg-(--border-color) transition-colors"
            onClick={handleLoadExample}
          >
            <Beaker size={18} />
            <span>{t("tools.json_format.example")}</span>
          </Button>
          <Button
            variant="outlined"
            className="flex items-center gap-2 px-4 py-2.5 bg-(--bg-main) border border-(--border-color) rounded-xl text-sm font-medium hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-colors"
            onClick={handleClear}
          >
            <Trash2 size={18} />
            <span>{t("tools.json_format.clear")}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-bold text-(--text-muted) uppercase tracking-wider h-8">
            <div className="flex items-center gap-2">
              <Code size={14} />
              <span>{t("tools.json_format.placeholder")}</span>
            </div>
          </div>
          <div className="flex-1 relative bg-(--card-bg) border border-(--border-color) rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="flex items-center px-4 py-2 border-b border-(--border-color) bg-(--card-bg)/50 backdrop-blur-sm h-10.25">
              <span className="text-[10px] font-bold text-(--text-muted) uppercase tracking-tighter">
                {t("tools.json_format.editor")}
              </span>
            </div>
            <CodeMirror
              value={input}
              height="100%"
              theme={theme === "dark" ? vscodeDark : vscodeLight}
              extensions={[json()]}
              onChange={(value) => setInput(value)}
              className="flex-1 overflow-auto custom-scrollbar"
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
              }}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-bold text-(--text-muted) uppercase tracking-wider h-8">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>{t("common.status")}</span>
            </div>
          </div>
          <div className="flex-1 relative bg-(--bg-main) border border-(--border-color) rounded-2xl overflow-hidden shadow-sm flex flex-col">
            {/* 内部工具栏 */}
            <div className="flex items-center justify-between px-2 py-2 border-b border-(--border-color) bg-(--card-bg)/50 backdrop-blur-sm h-10.25">
              <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto no-scrollbar mr-2">
                <Button
                  variant="text"
                  size="small"
                  sx={{ minWidth: 32, height: 32, p: 0 }}
                  className={`rounded-lg transition-colors shrink-0 ${
                    viewMode === "tree"
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-(--border-color) text-(--text-muted) hover:text-primary"
                  }`}
                  title={t("tools.json_format.tree_view")}
                  onClick={() =>
                    setViewMode(viewMode === "code" ? "tree" : "code")
                  }
                >
                  <ListTree size={16} />
                </Button>

                {viewMode === "tree" && (
                  <>
                    <Button
                      variant="text"
                      size="small"
                      sx={{ minWidth: 32, height: 32, p: 0 }}
                      className="hover:bg-(--border-color) rounded-lg transition-colors text-(--text-muted) hover:text-primary shrink-0"
                      title={t("common.expand")}
                      onClick={() => setExpandTrigger((prev) => prev + 1)}
                    >
                      <UnfoldVertical size={16} />
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      sx={{ minWidth: 32, height: 32, p: 0 }}
                      className="hover:bg-(--border-color) rounded-lg transition-colors text-(--text-muted) hover:text-primary shrink-0"
                      title={t("common.collapse")}
                      onClick={() => setCollapseTrigger((prev) => prev + 1)}
                    >
                      <FoldVertical size={16} />
                    </Button>
                  </>
                )}
                <div className="w-px h-4 bg-(--border-color) mx-0.5 shrink-0" />

                <Button
                  variant="text"
                  size="small"
                  sx={{ minWidth: 32, height: 32, p: 0 }}
                  className="hover:bg-(--border-color) rounded-lg transition-colors text-(--text-muted) hover:text-primary shrink-0"
                  title={t("common.save")}
                  onClick={handleSave}
                >
                  <Download size={16} />
                </Button>
                <Button
                  variant="text"
                  size="small"
                  sx={{ minWidth: 32, height: 32, p: 0 }}
                  className="hover:bg-(--border-color) rounded-lg transition-colors text-(--text-muted) hover:text-primary shrink-0"
                  title={t("common.copy")}
                  onClick={handleCopy}
                >
                  <Copy size={16} />
                </Button>

                <div className="w-px h-4 bg-(--border-color) mx-0.5 shrink-0" />
                <Button
                  variant="text"
                  size="small"
                  sx={{ minWidth: 32, height: 32, p: 0 }}
                  className="hover:bg-(--border-color) rounded-lg transition-colors text-(--text-muted) hover:text-primary shrink-0"
                  title={t("tools.json_format.to_xml")}
                  onClick={handleToXml}
                >
                  <FileCode size={16} />
                </Button>
                <Button
                  variant="text"
                  size="small"
                  sx={{ minWidth: 32, height: 32, p: 0 }}
                  className="hover:bg-(--border-color) rounded-lg transition-colors text-(--text-muted) hover:text-primary shrink-0"
                  title={t("tools.json_format.beautify")}
                  onClick={handleBeautify}
                >
                  <WandSparkles size={16} />
                </Button>
                <Button
                  variant="text"
                  size="small"
                  sx={{ minWidth: 32, height: 32, p: 0 }}
                  className="hover:bg-(--border-color) rounded-lg transition-colors text-(--text-muted) hover:text-primary shrink-0"
                  title={t("tools.json_format.minify")}
                  onClick={handleMinify}
                >
                  <Minimize2 size={16} />
                </Button>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={keepEscape}
                      onChange={(e) => setKeepEscape(e.target.checked)}
                    />
                    <div className="w-7 h-3.5 bg-(--border-color) rounded-full peer peer-checked:bg-primary/30 transition-colors"></div>
                    <div className="absolute left-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-3.5 peer-checked:bg-primary"></div>
                  </div>
                  <span className="text-[10px] font-bold text-(--text-muted) group-hover:text-primary transition-colors uppercase tracking-tighter">
                    {t("tools.json_format.keep_escape")}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {viewMode === "tree" && jsonObject ? (
                <JsonTreeView
                  data={jsonPathResult || jsonObject}
                  expandTrigger={expandTrigger}
                  collapseTrigger={collapseTrigger}
                  searchQuery={searchQuery.startsWith("$") ? "" : searchQuery}
                />
              ) : (
                <CodeMirror
                  value={output}
                  height="100%"
                  theme={theme === "dark" ? vscodeDark : vscodeLight}
                  extensions={[json()]}
                  onChange={handleOutputChange}
                  className="flex-1 overflow-auto custom-scrollbar"
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    highlightActiveLine: true,
                  }}
                />
              )}
            </div>
            {error && (
              <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm flex items-center gap-2 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                <AlertCircle size={16} className="shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default JsonFormat;

/**
 * 变量命名工具页面
 * 职责：提供 AI 变量命名功能，支持多种命名规范
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import { useSettingsStore } from "../stores/useSettingsStore";
import { invokeWrapper } from "../api";
import { InstructionsDialog } from "../components/shared/InstructionsDialog";
import {
  Search,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Keyboard,
  Type,
  Code,
  Variable,
  FunctionSquare,
  Cpu,
} from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Select } from "../components/mui";
import { Button } from "../components/mui";

interface NamingItem {
  label: string;
  value: string;
}

interface NamingResult {
  category: string;
  items: NamingItem[];
}

const LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Rust",
  "Go",
  "Python",
  "Java",
  "C++",
  "C#",
  "PHP",
  "Swift",
  "Kotlin",
  "Dart",
].map((l) => ({ key: l, label: l }));

const VariableNaming: React.FC = () => {
  const { t } = useTranslation();
  const { ai } = useSettingsStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<NamingResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>(
    ai?.activeProvider || "deepseek"
  );

  const aiProviders = Array.isArray(ai?.providers) ? ai!.providers : [];

  // 过滤出已配置 API Key 的服务商
  const availableProviders = aiProviders
    .filter((p) => p.apiKey.trim() !== "")
    .map((p) => ({ key: p.id, label: p.name }));

  const activeConfig =
    aiProviders.find((p) => p.id === selectedProvider) ?? aiProviders[0];

  const [language, setLanguage] = useState("General");
  const [customLanguage, setCustomLanguage] = useState("");

  const handleGenerate = async () => {
    if (!input.trim()) return;
    if (!activeConfig?.apiKey) {
      setError(t("tools.variable_naming.ai_config_error"));
      return;
    }
    if (!activeConfig?.model) {
      setError(t("tools.variable_naming.ai_model_error"));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let targetLanguage = language;
      if (language === "General") {
        targetLanguage = "";
      } else if (language === "custom") {
        targetLanguage = customLanguage;
      }

      const res = await invokeWrapper<NamingResult[]>(
        "generate_variable_names",
        {
          provider: selectedProvider,
          apiKey: activeConfig.apiKey,
          model: activeConfig.model,
          baseUrl: activeConfig.baseUrl,
          input: input,
          language: targetLanguage,
        }
      );

      if (res.ok) {
        setResults(res.data);
      } else {
        setError(res.message || t("common.error"));
      }
    } catch (err: any) {
      setError(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "common":
        return <Type size={18} className="text-blue-500" />;
      case "variable":
        return <Variable size={18} className="text-purple-500" />;
      case "method":
        return <FunctionSquare size={18} className="text-green-500" />;
      default:
        return <Code size={18} className="text-gray-500" />;
    }
  };

  const getCategoryTitle = (category: string) => {
    return t(`tools.variable_naming.categories.${category}`);
  };

  return (
    <ToolLayout title={t("tools.variable_naming.name")}>
      <div className="max-w-5xl mx-auto w-full space-y-6 pb-10">
        {/* 参数配置区域 */}
        <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm space-y-4">
          <div className="flex justify-end">
            <InstructionsDialog
              title={t("tools.variable_naming.instructions.title")}
              steps={[
                {
                  title: t("tools.variable_naming.instructions.step1_title"),
                  description: t(
                    "tools.variable_naming.instructions.step1_desc"
                  ),
                },
                {
                  title: t("tools.variable_naming.instructions.step2_title"),
                  description: t(
                    "tools.variable_naming.instructions.step2_desc"
                  ),
                },
                {
                  title: t("tools.variable_naming.instructions.step3_title"),
                  description: t(
                    "tools.variable_naming.instructions.step3_desc"
                  ),
                },
                {
                  title: t("tools.variable_naming.instructions.step4_title"),
                  description: t(
                    "tools.variable_naming.instructions.step4_desc"
                  ),
                },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 模型选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-(--text-muted) flex items-center gap-2">
                <Cpu size={16} />
                {t("tools.variable_naming.model_label")}
              </label>
              <Select
                value={availableProviders.length > 0 ? selectedProvider : ""}
                onChange={setSelectedProvider}
                options={availableProviders}
                placeholder={t("tools.variable_naming.no_model")}
              />
            </div>

            {/* 语言选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-(--text-muted) flex items-center gap-2">
                <Code size={16} />
                {t("tools.variable_naming.language_label")}
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={language}
                    onChange={setLanguage}
                    options={[
                      {
                        key: "General",
                        labelKey: "tools.variable_naming.general_language",
                      },
                      ...LANGUAGES,
                      {
                        key: "custom",
                        labelKey: "tools.variable_naming.custom_language",
                      },
                    ]}
                  />
                </div>
                {language === "custom" && (
                  <input
                    type="text"
                    className="flex-1 bg-(--bg-main) border border-(--border-color) rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                    placeholder={t(
                      "tools.variable_naming.language_placeholder"
                    )}
                  />
                )}
              </div>
            </div>
          </div>

          {/* 输入区域 */}
          <div className="flex gap-3 pt-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-(--text-muted)"
                size={20}
              />
              <input
                type="text"
                className="w-full bg-(--bg-main) border border-(--border-color) rounded-xl pl-12 pr-4 py-2 text-base focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                placeholder={t("tools.variable_naming.input_placeholder")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading || !input.trim()}
              variant="contained"
              className="px-8 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 active:scale-95 h-auto"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Keyboard size={20} />
              )}
              {loading
                ? t("tools.variable_naming.generating")
                : t("tools.variable_naming.generate")}
            </Button>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
        </div>

        {/* 结果展示 */}
        {results.length > 0 && (
          <div className="space-y-6">
            {results.map((category) => (
              <div
                key={category.category}
                className="bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden shadow-sm flex flex-col"
              >
                <div className="px-6 py-4 border-b border-(--border-color) bg-(--bg-main)/30 flex items-center gap-3">
                  {getCategoryIcon(category.category)}
                  <h2 className="font-bold text-(--text-main)">
                    {getCategoryTitle(category.category)}
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {category.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="group flex items-center justify-between p-3 rounded-xl bg-(--bg-main)/50 border border-transparent hover:border-blue-500/30 hover:bg-blue-500/5 transition-all cursor-pointer"
                        onClick={() => handleCopy(item.value)}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] text-(--text-muted) uppercase tracking-wider mb-0.5">
                            {item.label}
                          </span>
                          <span className="text-(--text-main) font-mono font-medium truncate">
                            {item.value}
                          </span>
                        </div>
                        <Button
                          variant="text"
                          size="small"
                          className={`p-2 rounded-lg transition-all h-auto ${
                            copiedValue === item.value
                              ? "bg-green-500/10 text-green-500"
                              : "text-(--text-muted) opacity-0 group-hover:opacity-100 hover:bg-blue-500/10 hover:text-blue-500"
                          }`}
                        >
                          {copiedValue === item.value ? (
                            <Check size={14} />
                          ) : (
                            <Copy size={14} />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 初始状态提示 */}
        {!loading && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-(--text-muted) opacity-50">
            <Code size={64} className="mb-4" />
            <p className="text-lg">{t("tools.variable_naming.description")}</p>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default VariableNaming;

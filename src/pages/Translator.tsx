/**
 * 翻译工具页面
 * 职责：提供输入、选择目标语言、可选 API Key 的翻译请求 UI，展示翻译结果和检测到的语言
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import {
  Languages,
  ArrowRightLeft,
  Copy,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/useSettingsStore";
import { Select, Switch } from "../components/mui";
import { Button } from "../components/mui";

const LANGS = [
  { key: "auto", labelKey: "languages.auto" },
  { key: "en", labelKey: "languages.en" },
  { key: "zh-CN", labelKey: "languages.zh-CN" },
  { key: "ja", labelKey: "languages.ja" },
  { key: "fr", labelKey: "languages.fr" },
  { key: "es", labelKey: "languages.es" },
  { key: "de", labelKey: "languages.de" },
  { key: "ru", labelKey: "languages.ru" },
  { key: "ko", labelKey: "languages.ko" },
  { key: "it", labelKey: "languages.it" },
];

const Translator: React.FC = () => {
  const { t } = useTranslation();
  const { translator } = useSettingsStore();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [source, setSource] = useState("auto");
  const [target, setTarget] = useState("zh-CN");
  const [engine, setEngine] = useState("google");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoCopy, setAutoCopy] = useState(true);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);

  // 获取当前引擎对应的 Key
  const currentApiKey = React.useMemo(() => {
    if (engine === "google") return translator.googleKey;
    if (engine === "deepl") return translator.deeplKey;
    if (engine === "deeplx") return translator.deeplxKey;
    if (engine === "baidu") return translator.baiduKey;
    if (engine === "youdao") return translator.youdaoKey;
    if (engine === "tencent") return translator.tencentKey;
    if (engine === "volcengine") return translator.volcengineKey;
    return "";
  }, [engine, translator]);

  // 检查引擎是否可用（是否配置了必要的 API Key）
  const isEngineAvailable = React.useCallback(
    (engineName: string) => {
      const keyMap: Record<string, string> = {
        google: translator.googleKey,
        deepl: translator.deeplKey,
        deeplx: translator.deeplxKey,
        baidu: translator.baiduKey,
        youdao: translator.youdaoKey,
        tencent: translator.tencentKey,
        volcengine: translator.volcengineKey,
      };

      // Google 免费版不需要 Key，其他引擎必须配置
      if (engineName === "google") {
        return true; // Google 始终可用（有免费版）
      }

      return keyMap[engineName]?.trim().length > 0;
    },
    [translator]
  );

  // 切换引擎时重置状态
  React.useEffect(() => {
    setError(null);
    setOutput("");
    setResponseTime(null);
  }, [engine]);

  const handleTranslate = async () => {
    if (!input.trim() || loading) return;
    setError(null);

    // 校验必填项
    const needsKey = [
      "deepl",
      "deeplx",
      "baidu",
      "youdao",
      "tencent",
      "volcengine",
    ].includes(engine);
    if (needsKey && !currentApiKey.trim()) {
      setError(t("tools.translator.error_no_api_key"));
      return;
    }

    setLoading(true);
    const startTime = performance.now();
    try {
      const res = (await invoke("translate_text", {
        text: input,
        target: target,
        source: source === "auto" ? null : source,
        engine: engine,
        apiKey: currentApiKey || null,
      })) as any;

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setResponseTime(duration);
      const translatedText = res.translated_text || "";
      setOutput(translatedText);
      setDetectedLang(res.detected_source_language || null);

      if (autoCopy && translatedText) {
        navigator.clipboard.writeText(translatedText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.toString());
      setResponseTime(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    if (source === "auto") return;
    const temp = source;
    setSource(target);
    setTarget(temp);
    setInput(output);
    setOutput(input);
  };

  const handleCopy = () => {
    if (output) {
      navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setInput("");
    setOutput("");
    setDetectedLang(null);
    setResponseTime(null);
  };

  return (
    <ToolLayout title={t("tools.translator.name")}>
      <div className="flex flex-col gap-6 h-full max-w-5xl mx-auto w-full">
        {/* 引擎与语言选择栏 */}
        <div className="flex flex-col gap-3 bg-(--card-bg) p-3 rounded-xl border border-(--border-color) shadow-sm">
          <div className="flex items-center justify-between gap-4 px-2 border-b border-(--border-color) pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-(--text-muted) uppercase tracking-wider">
                {t("tools.translator.engine")}:
              </span>
              <div className="flex bg-(--bg-main) p-1 rounded-lg gap-1 flex-wrap">
                {[
                  "google",
                  "youdao",
                  "baidu",
                  "tencent",
                  "volcengine",
                  "deepl",
                  "deeplx",
                ].map((e) => {
                  const available = isEngineAvailable(e);
                  return (
                    <Button
                      key={e}
                      onClick={() => available && setEngine(e)}
                      disabled={!available}
                      variant={engine === e ? "contained" : "text"}
                      size="small"
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all relative group h-auto ${
                        engine === e
                          ? "shadow-sm"
                          : available
                          ? "text-(--text-muted) hover:text-(--text-main) hover:bg-(--card-bg)"
                          : "text-(--text-muted) opacity-40 cursor-not-allowed"
                      }`}
                      title={
                        !available
                          ? t("tools.translator.engine_not_configured")
                          : undefined
                      }
                    >
                      {e.charAt(0).toUpperCase() + e.slice(1)}
                      {!available && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>

            <Switch
              label={t("tools.translator.auto_copy")}
              checked={autoCopy}
              onChange={(e) => setAutoCopy(e.target.checked)}
              size="small"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-full max-w-[200px]">
                <Select value={source} onChange={setSource} options={LANGS} />
              </div>
              {source === "auto" && detectedLang && (
                <span className="text-(--text-muted) text-xs whitespace-nowrap px-2 py-1 bg-(--bg-main) rounded-md border border-(--border-color)">
                  {t(`languages.${detectedLang}`)}
                </span>
              )}
            </div>

            <Button
              variant="text"
              size="small"
              onClick={handleSwap}
              disabled={source === "auto"}
              className={`p-2 rounded-full hover:bg-(--bg-main) transition-colors h-auto flex-none ${
                source === "auto"
                  ? "opacity-30 cursor-not-allowed"
                  : "text-(--text-muted) hover:text-(--text-main)"
              }`}
            >
              <ArrowRightLeft size={18} />
            </Button>

            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              <div className="w-full max-w-[200px]">
                <Select
                  value={target}
                  onChange={setTarget}
                  options={LANGS.filter((l) => l.key !== "auto")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 翻译区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
          {/* 输入框 */}
          <div className="flex flex-col bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden shadow-sm focus-within:border-blue-500/50 transition-colors">
            <textarea
              className="flex-1 p-4 bg-transparent border-none focus:ring-0 resize-none text-lg leading-relaxed outline-none"
              placeholder={t("tools.translator.placeholder_input")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="p-3 flex items-center justify-between border-t border-(--border-color) bg-(--bg-main)/30">
              <div className="flex items-center gap-1">
                <Button
                  variant="text"
                  size="small"
                  onClick={handleClear}
                  className="p-2 rounded-lg hover:bg-(--bg-main) text-(--text-muted) hover:text-red-500 transition-colors h-auto"
                  title={t("common.clear")}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
              <div className="text-xs text-(--text-muted)">
                {input.length} / 5000
              </div>
            </div>
          </div>

          {/* 输出框 */}
          <div className="flex flex-col bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden shadow-sm bg-blue-50/5 dark:bg-blue-900/5">
            <textarea
              className="flex-1 p-4 bg-transparent border-none focus:ring-0 resize-none text-lg leading-relaxed outline-none"
              readOnly
              placeholder={loading ? t("common.loading") : ""}
              value={output}
            />
            <div className="p-3 flex items-center justify-between border-t border-(--border-color) bg-(--bg-main)/30">
              <div className="flex items-center gap-2">
                <Button
                  variant="text"
                  size="small"
                  onClick={handleCopy}
                  disabled={!output}
                  className={`p-2 rounded-lg hover:bg-(--bg-main) transition-colors h-auto ${
                    copied
                      ? "text-green-500"
                      : "text-(--text-muted) hover:text-(--text-main)"
                  }`}
                  title={t("common.copy")}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </Button>
                {responseTime !== null && (
                  <span className="text-xs text-(--text-muted) flex items-center gap-1 px-2 py-1 bg-(--bg-main) rounded-md">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {responseTime < 1000
                      ? `${responseTime}ms`
                      : `${(responseTime / 1000).toFixed(2)}s`}
                  </span>
                )}
              </div>
              <Button
                onClick={handleTranslate}
                disabled={
                  loading ||
                  !input.trim() ||
                  ([
                    "deepl",
                    "deeplx",
                    "baidu",
                    "youdao",
                    "tencent",
                    "volcengine",
                  ].includes(engine) &&
                    !currentApiKey.trim())
                }
                variant="contained"
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-all shadow-sm active:scale-95 h-auto"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Languages size={18} />
                )}
                {t("tools.translator.translate")}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {error}
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default Translator;

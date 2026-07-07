/**
 * 翻译工具页面
 * 职责：提供输入、选择目标语言、可选 API Key 的翻译请求 UI，展示翻译结果和检测到的语言
 */
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import {
  Languages,
  ArrowRightLeft,
  Copy,
  Trash2,
  Check,
  Loader2,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { useSettingsStore } from "../stores/useSettingsStore";
import { Select, Switch } from "../components/mui";
import { Button } from "../components/mui";
import { OcrDetailResult } from "../types/ocr";
import { TranslatedImageEditor } from "../components/translator/TranslatedImageEditor";
import { toast } from "react-hot-toast";

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
  const { translator, ocr } = useSettingsStore();
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
  const [ocrResult, setOcrResult] = useState<OcrDetailResult | null>(null);
  const [ocrEngine, setOcrEngine] = useState("windows");
  const [ocrMode, setOcrMode] = useState("normal");
  const [translations, setTranslations] = useState<string[]>([]);
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  // 获取当前引擎对应的 Key
  const currentApiKey = React.useMemo(() => {
    if (engine === "google") return translator.googleKey;
    if (engine === "deepl") return translator.deeplKey;
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
    [translator],
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
    setOcrResult(null);
    setTranslations([]);
  };

  // 截图翻译功能
  const handleScreenshotTranslate = async () => {
    const appWindow = WebviewWindow.getCurrent();

    try {
      // 隐藏主窗口
      await appWindow.hide();

      let selector = await WebviewWindow.getByLabel("screenshot-selector");
      if (selector) {
        await selector.show();
        await selector.setFocus();
      } else {
        selector = new WebviewWindow("screenshot-selector", {
          url: "index.html#/screenshot-selector",
          title: "Screenshot Selector",
          maximized: true,
          decorations: false,
          transparent: true,
          alwaysOnTop: true,
          skipTaskbar: true,
          visible: false,
          resizable: false,
          shadow: false,
          focus: true,
        });

        await new Promise((resolve) => setTimeout(resolve, 200));
        await selector.show();
        await selector.setFocus();
      }

      // 轮询检查截图选择器是否隐藏
      const checkInterval = setInterval(async () => {
        try {
          const isVisible = await selector!.isVisible();
          if (!isVisible) {
            clearInterval(checkInterval);
            await appWindow.show();
            await appWindow.setFocus();
          }
        } catch (e) {
          clearInterval(checkInterval);
          await appWindow.show();
          await appWindow.setFocus();
        }
      }, 100);
    } catch (error) {
      console.error("Failed to open screenshot selector:", error);
      setError("无法启动截图工具");
      await appWindow.show();
      await appWindow.setFocus();
    }
  };

  // 监听截图事件
  useEffect(() => {
    const unlisten = listen("screenshot-captured", async (event: any) => {
      const { x, y, width, height } = event.payload;

      setLoading(true);
      setIsOcrLoading(true);
      setError(null);

      try {
        console.log("开始OCR识别...");

        // 添加超时保护 (60秒)
        const ocrPromise = invoke("run_ocr_detailed", {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
          engine: ocrEngine,
          mode: ocrMode,
          settings: {
            tencent_secret_id: ocr.tencentSecretId,
            tencent_secret_key: ocr.tencentSecretKey,
            tencent_region: ocr.tencentRegion,
            baidu_api_key: ocr.baiduApiKey,
            baidu_secret_key: ocr.baiduSecretKey,
          },
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("OCR识别超时(60秒)")), 60000),
        );

        const detailResponse: any = await Promise.race([
          ocrPromise,
          timeoutPromise,
        ]);

        console.log("OCR识别结果:", detailResponse);

        if (detailResponse.ok) {
          const result: OcrDetailResult = detailResponse.data;
          setOcrResult(result);

          // 提取所有文字显示在输入框
          const allText = result.text_boxes.map((box) => box.text).join(" ");
          setInput(allText);

          // 批量翻译所有文字框
          if (result.text_boxes.length > 0) {
            toast.success(
              `OCR识别成功! 找到 ${result.text_boxes.length} 个文字框,正在翻译...`,
            );

            try {
              // 批量翻译,每个翻译也添加超时
              const translationPromises = result.text_boxes.map((box) => {
                const translatePromise = invoke("translate_text", {
                  text: box.text,
                  target: target,
                  source: source === "auto" ? null : source,
                  engine: engine,
                  apiKey: currentApiKey || null,
                });

                const timeout = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error("翻译超时")), 30000),
                );

                return Promise.race([translatePromise, timeout]);
              });

              const translationResults = await Promise.all(translationPromises);
              const translatedTexts = translationResults.map(
                (res: any) => res.translated_text || "",
              );
              setTranslations(translatedTexts);

              toast.success(`翻译完成!`);
            } catch (err) {
              console.error("Translation failed:", err);
              toast.error(
                "翻译失败: " +
                  (err instanceof Error ? err.message : String(err)),
              );
              // 翻译失败也显示OCR结果
              setTranslations(result.text_boxes.map((box) => box.text));
            }
          } else {
            toast.error("未识别到文字");
          }
        } else {
          toast.error(detailResponse.error?.message || "OCR识别失败");
        }
      } catch (error) {
        console.error("Screenshot translate failed:", error);
        const errorMsg =
          error instanceof Error ? error.message : "截图翻译失败";
        toast.error(errorMsg);
        setError(errorMsg);
      } finally {
        setLoading(false);
        setIsOcrLoading(false);
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [ocrEngine, ocrMode, ocr, target, source, engine, currentApiKey]);

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

          {/* OCR引擎选择 */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-medium text-(--text-muted)">
              OCR引擎:
            </span>
            <div className="flex bg-(--bg-main) p-1 rounded-lg gap-1">
              {["windows", "tencent", "baidu"].map((e) => (
                <Button
                  key={e}
                  onClick={() => setOcrEngine(e)}
                  variant={ocrEngine === e ? "contained" : "text"}
                  size="small"
                  className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all h-auto ${
                    ocrEngine === e
                      ? "shadow-sm"
                      : "text-(--text-muted) hover:text-(--text-main) hover:bg-(--card-bg)"
                  }`}
                >
                  {e === "windows"
                    ? "Windows"
                    : e.charAt(0).toUpperCase() + e.slice(1)}
                </Button>
              ))}
            </div>

            {/* 提示信息 */}
            {ocrEngine === "windows" && (
              <span className="text-xs text-orange-500 flex items-center gap-1">
                <AlertTriangle size={12} />
                不推荐免费的Windows引擎
              </span>
            )}

            {/* OCR模式选择 - 仅腾讯云和百度支持 */}
            {(ocrEngine === "tencent" || ocrEngine === "baidu") && (
              <>
                <span className="text-xs text-(--text-muted)">模式:</span>
                <div className="flex bg-(--bg-main) p-1 rounded-lg gap-1">
                  {["normal", "accurate"].map((mode) => (
                    <Button
                      key={mode}
                      onClick={() => setOcrMode(mode)}
                      variant={ocrMode === mode ? "contained" : "text"}
                      size="small"
                      className={`px-2 py-0.5 text-xs font-medium rounded-md transition-all h-auto ${
                        ocrMode === mode
                          ? "shadow-sm"
                          : "text-(--text-muted) hover:text-(--text-main) hover:bg-(--card-bg)"
                      }`}
                    >
                      {mode === "normal" ? "普通" : "高精度"}
                    </Button>
                  ))}
                </div>
              </>
            )}

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
        </div>

        {/* Loading提示 */}
        {loading && isOcrLoading && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-600">
                正在处理...
              </div>
              <div className="text-xs text-(--text-muted)">
                OCR识别和翻译可能需要一些时间,请耐心等待
              </div>
            </div>
            <Button
              variant="outlined"
              size="small"
              onClick={handleClear}
              className="text-red-500 hover:bg-red-500/10 hover:border-red-500/20"
            >
              取消
            </Button>
          </div>
        )}

        {/* 翻译区域 */}
        {ocrResult && translations.length > 0 ? (
          // 截图翻译模式 - 显示翻译后的图片
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {/* 操作按钮栏 */}
            <div className="flex items-center justify-between p-3 bg-(--card-bg) rounded-xl border border-(--border-color)">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-(--text-muted) flex items-center gap-2">
                  <Camera size={16} />
                  截图翻译结果
                </span>
                <span className="text-xs text-(--text-muted) px-2 py-1 bg-(--bg-main) rounded-md">
                  {ocrResult.text_boxes.length} 个文字框
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleScreenshotTranslate}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg h-auto"
                >
                  <Camera size={14} />
                  <span className="text-xs">重新截图</span>
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClear}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 hover:border-red-500/20 h-auto"
                >
                  <Trash2 size={14} />
                  <span className="text-xs">清除</span>
                </Button>
              </div>
            </div>

            {/* 翻译图片和结果列表 */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* 左侧:翻译后的图片 */}
              <div className="flex flex-col gap-2 min-h-0">
                <h3 className="text-sm font-bold text-(--text-muted)">
                  翻译图片
                </h3>
                <div className="flex-1 min-h-0">
                  <TranslatedImageEditor
                    imageBase64={ocrResult.image_base64}
                    textBoxes={ocrResult.text_boxes}
                    translations={translations}
                    width={ocrResult.width}
                    height={ocrResult.height}
                  />
                </div>
              </div>

              {/* 右侧:翻译结果列表 */}
              <div className="flex flex-col gap-2 min-h-0">
                <h3 className="text-sm font-bold text-(--text-muted)">
                  翻译结果
                </h3>
                <div className="flex-1 min-h-0 overflow-auto custom-scrollbar space-y-2">
                  {ocrResult.text_boxes.map((box, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl border border-(--border-color) bg-(--card-bg) hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-primary">
                          #{index + 1}
                        </span>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              translations[index] || box.text,
                            );
                            toast.success("已复制");
                          }}
                          className="p-1.5 h-auto"
                        >
                          <Copy size={14} />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-(--text-muted) mb-1">
                            原文:
                          </div>
                          <div className="text-sm text-(--text-main)">
                            {box.text}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-(--text-muted) mb-1">
                            译文:
                          </div>
                          <div className="text-sm text-primary font-medium">
                            {translations[index] || box.text}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          // 普通翻译模式 - 显示文本框
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
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleScreenshotTranslate}
                    disabled={loading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-(--bg-main) transition-colors h-auto"
                    title="截图翻译"
                  >
                    <Camera size={16} />
                    <span className="text-xs">截图翻译</span>
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
        )}

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

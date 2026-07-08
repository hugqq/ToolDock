import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { Copy, Trash2, Loader2, MousePointer2, Image as ImageIcon } from "lucide-react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button, Select, Switch } from "../components/mui";
import { toast } from "react-hot-toast";
import { useSettingsStore } from "../stores/useSettingsStore";
import { OcrDetailResult } from "../types/ocr";
import { ImagePreview } from "../components/ocr/ImagePreview";
import { formatOcrText } from "../lib/ocrText";

const ScreenOcr: React.FC = () => {
  const { t } = useTranslation();
  const { ocr, setOcrEngine } = useSettingsStore();
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrDetailResult | null>(null);
  const [preserveLineBreaks, setPreserveLineBreaks] = useState(true);

  const ocrOptions = useMemo(() => {
    const options = [{ key: "windows", labelKey: "tools.ocr.engine_windows" }];

    if (ocr.tencentSecretId && ocr.tencentSecretKey) {
      options.push(
        { key: "tencent", labelKey: "tools.ocr.engine_tencent" },
        {
          key: "tencent_high_precision",
          labelKey: "tools.ocr.engine_tencent_high_precision",
        }
      );
    }

    if (ocr.baiduApiKey && ocr.baiduSecretKey) {
      options.push(
        { key: "baidu", labelKey: "tools.ocr.engine_baidu" },
        {
          key: "baidu_high_precision",
          labelKey: "tools.ocr.engine_baidu_high_precision",
        }
      );
    }

    return options;
  }, [
    ocr.tencentSecretId,
    ocr.tencentSecretKey,
    ocr.baiduApiKey,
    ocr.baiduSecretKey,
  ]);

  // 如果当前引擎不可用（密钥被清空），自动回退到 windows
  useEffect(() => {
    const isAvailable = ocrOptions.some((opt) => opt.key === ocr.engine);
    if (!isAvailable) {
      setOcrEngine("windows");
    }
  }, [ocrOptions, ocr.engine, setOcrEngine]);

  useEffect(() => {
    const unlisten = listen("screenshot-captured", async (event: any) => {
      const { x, y, width, height } = event.payload;

      setLoading(true);
      try {
        // 调用run_ocr_detailed获取详细结果
        const detailResponse: any = await invoke("run_ocr_detailed", {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(width),
          height: Math.round(height),
          engine: ocr.engine,
          settings: {
            tencent_secret_id: ocr.tencentSecretId,
            tencent_secret_key: ocr.tencentSecretKey,
            tencent_region: ocr.tencentRegion,
            baidu_api_key: ocr.baiduApiKey,
            baidu_secret_key: ocr.baiduSecretKey,
          },
        });

        console.log("OCR详细结果:", detailResponse);

        if (detailResponse.ok) {
          const result: OcrDetailResult = detailResponse.data;
          setOcrResult(result);

          // 提取所有文字用于文本显示
          setText(formatOcrText(result.text_boxes, preserveLineBreaks));

          if (result.text_boxes.length > 0) {
            toast.success(`识别成功! 找到 ${result.text_boxes.length} 个文字框`);
          } else {
            toast.error(t("tools.ocr.no_text"));
          }
        } else {
          toast.error(detailResponse.error?.message || t("tools.ocr.error_ocr"));
        }
      } catch (error) {
        console.error("OCR failed:", error);
        toast.error(t("tools.ocr.error_ocr"));
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [
    t,
    ocr.engine,
    ocr.tencentSecretId,
    ocr.tencentSecretKey,
    ocr.tencentRegion,
    ocr.baiduApiKey,
    ocr.baiduSecretKey,
    preserveLineBreaks,
  ]);

  useEffect(() => {
    if (ocrResult) {
      setText(formatOcrText(ocrResult.text_boxes, preserveLineBreaks));
    }
  }, [ocrResult, preserveLineBreaks]);

  const handleManualCapture = async () => {
    const appWindow = WebviewWindow.getCurrent();

    try {
      // 隐藏主窗口,避免遮挡截图区域
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
          visible: false, // 先创建,后显示
          resizable: false,
          shadow: false,
          focus: true,
        });

        // 等待窗口创建完成
        await new Promise((resolve) => setTimeout(resolve, 200));
        await selector.show();
        await selector.setFocus();
      }

      // 轮询检查截图选择器是否隐藏,隐藏后恢复主窗口
      const checkInterval = setInterval(async () => {
        try {
          const isVisible = await selector!.isVisible();
          if (!isVisible) {
            clearInterval(checkInterval);
            await appWindow.show();
            await appWindow.setFocus();
          }
        } catch (e) {
          // 窗口可能已销毁
          clearInterval(checkInterval);
          await appWindow.show();
          await appWindow.setFocus();
        }
      }, 100);

    } catch (error) {
      console.error("Failed to open screenshot selector:", error);
      toast.error("无法启动截图工具");
      // 出错时恢复显示主窗口
      await appWindow.show();
      await appWindow.setFocus();
    }
  };

  const handleCopy = () => {
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success(t("common.copy_success"));
    }
  };

  const handleClear = () => {
    setText("");
    setOcrResult(null);
  };

  return (
    <ToolLayout title={t("tools.ocr.name")}>
      <div className="flex-1 flex flex-col min-h-0 gap-4">
        {/* 操作栏 */}
        <div className="flex items-center justify-between p-4 rounded-2xl border border-(--border-color) bg-(--card-bg) shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="contained"
                onClick={handleManualCapture}
                disabled={loading}
                className="h-10 px-6"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <MousePointer2 className="w-4 h-4 mr-2" />
                )}
                {loading ? t("tools.ocr.recognizing") : t("tools.ocr.capture")}
              </Button>
            </div>

            <div className="h-8 w-[1px] bg-(--border-color)" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-(--text-muted) whitespace-nowrap">
                {t("tools.ocr.engine")}:
              </span>
              <Select
                value={ocr.engine}
                onChange={(val) => setOcrEngine(val as any)}
                className="min-w-[180px]"
                options={ocrOptions}
              />
            </div>

            <div className="h-8 w-[1px] bg-(--border-color)" />

            <Switch
              checked={preserveLineBreaks}
              onChange={(event) => setPreserveLineBreaks(event.target.checked)}
              label={t("tools.ocr.preserve_line_breaks")}
            />
          </div>

          {text && (
            <div className="flex items-center gap-2">
              <Button
                variant="outlined"
                onClick={handleCopy}
                className="h-10 px-4"
              >
                <Copy className="w-4 h-4 mr-2" />
                {t("common.copy")}
              </Button>
              <Button
                variant="outlined"
                onClick={handleClear}
                className="h-10 px-4 text-red-500 hover:bg-red-500/10 hover:border-red-500/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t("common.clear")}
              </Button>
            </div>
          )}
        </div>

        {/* 结果区域 */}
        {ocrResult ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
            {/* 图片预览 */}
            <div className="flex flex-col gap-2 min-h-0">
              <h3 className="text-sm font-bold text-(--text-muted) flex items-center gap-2">
                <ImageIcon size={14} />
                图片预览
              </h3>
              <div className="flex-1 min-h-0">
                <ImagePreview
                  imageBase64={ocrResult.image_base64}
                  textBoxes={ocrResult.text_boxes}
                  width={ocrResult.width}
                  height={ocrResult.height}
                />
              </div>
            </div>

            {/* 识别文本 */}
            <div className="flex flex-col gap-2 min-h-0">
              <h3 className="text-sm font-bold text-(--text-muted)">
                {t("tools.ocr.result")}
              </h3>
              <div className="flex-1 min-h-0 bg-(--card-bg) border border-(--border-color) rounded-xl shadow-sm overflow-hidden">
                <textarea
                  className="w-full h-full p-4 bg-transparent border-none outline-none resize-none whitespace-pre-wrap font-mono text-(--text-main) text-sm leading-relaxed custom-scrollbar"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        ) : text ? (
          <div className="flex-1 bg-(--card-bg) border border-(--border-color) rounded-2xl shadow-sm overflow-hidden flex flex-col relative">
            <textarea
              className="flex-1 w-full h-full p-6 bg-transparent border-none outline-none resize-none whitespace-pre-wrap font-mono text-(--text-main) text-sm leading-relaxed custom-scrollbar"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="flex-1 bg-(--card-bg) border border-(--border-color) rounded-2xl shadow-sm overflow-hidden flex flex-col relative">
            <div className="flex-1 flex flex-col items-center justify-center text-(--text-muted) gap-4">
              <div className="p-6 rounded-full bg-(--bg-main) opacity-20">
                <MousePointer2 className="w-16 h-16" />
              </div>
              <p className="text-lg font-medium">{t("tools.ocr.no_text")}</p>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default ScreenOcr;


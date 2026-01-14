import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { Camera, Copy, Trash2, Loader2, MousePointer2 } from "lucide-react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button, Select } from "../components/mui";
import { toast } from "react-hot-toast";
import { useSettingsStore } from "../stores/useSettingsStore";

const ScreenOcr: React.FC = () => {
  const { t } = useTranslation();
  const { ocr, setOcrEngine } = useSettingsStore();
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);

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
        const response: any = await invoke("run_ocr", {
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
        if (response.ok) {
          setText(response.data);
          if (response.data) {
            toast.success(t("common.success"));
          } else {
            toast.error(t("tools.ocr.no_text"));
          }
        } else {
          toast.error(response.error?.message || t("tools.ocr.error_ocr"));
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
  }, [t, ocr]);

  const handleCapture = async () => {
    setLoading(true);
    try {
      const response: any = await invoke("run_ocr", {
        x: null,
        y: null,
        width: null,
        height: null,
        engine: ocr.engine,
        settings: {
          tencent_secret_id: ocr.tencentSecretId,
          tencent_secret_key: ocr.tencentSecretKey,
          tencent_region: ocr.tencentRegion,
          baidu_api_key: ocr.baiduApiKey,
          baidu_secret_key: ocr.baiduSecretKey,
        },
      });
      if (response.ok) {
        setText(response.data);
        if (response.data) {
          toast.success(t("common.success"));
        } else {
          toast.error(t("tools.ocr.no_text"));
        }
      } else {
        toast.error(response.error?.message || t("tools.ocr.error_ocr"));
      }
    } catch (error) {
      console.error("OCR failed:", error);
      toast.error(t("tools.ocr.error_ocr"));
    } finally {
      setLoading(false);
    }
  };

  const handleManualCapture = async () => {
    try {
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
          visible: false, // 先创建，后显示
          resizable: false,
          shadow: false,
          focus: true,
        });

        // 等待窗口创建完成
        await new Promise((resolve) => setTimeout(resolve, 200));
        await selector.show();
        await selector.setFocus();
      }
    } catch (error) {
      console.error("Failed to open screenshot selector:", error);
      toast.error("无法启动截图工具");
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
  };

  return (
    <ToolLayout
      title={t("tools.ocr.name")}
      description={t("tools.ocr.description")}
    >
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
              <Button
                variant="outlined"
                onClick={handleCapture}
                disabled={loading}
                className="h-10 px-4"
                title={t("tools.ocr.capture_full")}
              >
                <Camera className="w-4 h-4 mr-2" />
                {t("tools.ocr.capture_full")}
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
        <div className="flex-1 bg-(--card-bg) border border-(--border-color) rounded-2xl shadow-sm overflow-hidden flex flex-col relative">
          {text ? (
            <textarea
              className="flex-1 w-full h-full p-6 bg-transparent border-none outline-none resize-none whitespace-pre-wrap font-mono text-(--text-main) text-sm leading-relaxed custom-scrollbar"
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-(--text-muted) gap-4">
              <div className="p-6 rounded-full bg-(--bg-main) opacity-20">
                <Camera className="w-16 h-16" />
              </div>
              <p className="text-lg font-medium">{t("tools.ocr.no_text")}</p>
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
};

export default ScreenOcr;


/**
 * 二维码生成/识别工具页面组件
 * 功能：生成二维码图片，从图片识别二维码内容
 */

import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Download, Upload, Copy } from "lucide-react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import jsQR from "jsqr";

type TabType = "generate" | "scan";
type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export default function QRCodeTool() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("generate");
  const [inputText, setInputText] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 二维码生成设置
  const [size, setSize] = useState(300);
  const [errorCorrectionLevel, setErrorCorrectionLevel] =
    useState<ErrorCorrectionLevel>("M");
  const [foregroundColor, setForegroundColor] = useState("#000000");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [margin, setMargin] = useState(4);

  // 生成二维码
  const handleGenerate = async () => {
    if (!inputText.trim()) {
      toast.error("输入不能为空");
      return;
    }

    try {
      const url = await QRCode.toDataURL(inputText, {
        width: size,
        margin: margin,
        errorCorrectionLevel: errorCorrectionLevel,
        color: {
          dark: foregroundColor,
          light: backgroundColor,
        },
      });
      setQrCodeUrl(url);
      toast.success(t("tools.qrcode_tool.generate_success"));
    } catch (error) {
      toast.error("生成失败");
    }
  };

  // 下载二维码
  const handleDownload = () => {
    if (!qrCodeUrl) {
      toast.error("请先生成二维码");
      return;
    }

    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `qrcode-${Date.now()}.png`;
    link.click();
    toast.success(t("tools.qrcode_tool.download_success"));
  };

  // 复制二维码图片
  const handleCopyImage = async () => {
    if (!qrCodeUrl) {
      toast.error("请先生成二维码");
      return;
    }

    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast.success(t("tools.qrcode_tool.copy_success"));
    } catch (error) {
      toast.error("复制失败");
    }
  };

  // 上传图片
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 处理文件上传
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  // 处理拖拽上传
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImage(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // 处理图片并识别二维码
  const processImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setUploadedImage(event.target?.result as string);
        scanQRCode(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 识别二维码
  const scanQRCode = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      setScanResult(code.data);
      toast.success(t("tools.qrcode_tool.scan_success"));
    } else {
      setScanResult("");
      toast.error(t("tools.qrcode_tool.no_qrcode"));
    }
  };

  // 复制识别结果
  const handleCopyResult = async () => {
    if (!scanResult) {
      toast.error("无识别结果");
      return;
    }
    try {
      await navigator.clipboard.writeText(scanResult);
      toast.success(t("tools.qrcode_tool.copy_success"));
    } catch (error) {
      toast.error("复制失败");
    }
  };

  return (
    <ToolLayout title={t("tools.qrcode_tool.name")}>
      {/* 标签页切换 */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant={activeTab === "generate" ? "contained" : "outlined"}
          size="small"
          className={`px-4 py-2 rounded-lg font-medium transition-all text-sm h-auto ${
            activeTab === "generate"
              ? "shadow-md"
              : "bg-(--card-bg) text-(--text-main) hover:bg-(--bg-secondary)"
          }`}
          onClick={() => setActiveTab("generate")}
        >
          {t("tools.qrcode_tool.tab_generate")}
        </Button>
        <Button
          variant={activeTab === "scan" ? "contained" : "outlined"}
          size="small"
          className={`px-4 py-2 rounded-lg font-medium transition-all text-sm h-auto ${
            activeTab === "scan"
              ? "shadow-md"
              : "bg-(--card-bg) text-(--text-main) hover:bg-(--bg-secondary)"
          }`}
          onClick={() => setActiveTab("scan")}
        >
          {t("tools.qrcode_tool.tab_scan")}
        </Button>
      </div>

      {/* 生成二维码 */}
      {activeTab === "generate" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：输入和设置 */}
          <div className="space-y-6">
            {/* 输入区域 */}
            <div>
              <label className="block text-sm font-medium text-(--text-main) mb-2">
                {t("tools.qrcode_tool.input_text")}
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t("tools.qrcode_tool.input_placeholder")}
                className="w-full h-32 p-4 bg-(--card-bg) border border-(--border-color) rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* 设置区域 */}
            <div className="p-4 bg-(--card-bg) rounded-xl border border-(--border-color) space-y-4">
              <h3 className="text-sm font-semibold text-(--text-main)">
                {t("tools.qrcode_tool.settings")}
              </h3>

              {/* 尺寸 */}
              <div>
                <label className="block text-sm text-(--text-main) mb-2">
                  {t("tools.qrcode_tool.size")}: {size}px
                </label>
                <input
                  type="range"
                  min="200"
                  max="800"
                  step="50"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* 容错等级 */}
              <div>
                <label className="block text-sm text-(--text-main) mb-2">
                  {t("tools.qrcode_tool.error_correction")}
                </label>
                <select
                  value={errorCorrectionLevel}
                  onChange={(e) =>
                    setErrorCorrectionLevel(
                      e.target.value as ErrorCorrectionLevel
                    )
                  }
                  className="w-full p-2 bg-(--bg-main) border border-(--border-color) rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="L">{t("tools.qrcode_tool.error_low")}</option>
                  <option value="M">
                    {t("tools.qrcode_tool.error_medium")}
                  </option>
                  <option value="Q">
                    {t("tools.qrcode_tool.error_quartile")}
                  </option>
                  <option value="H">{t("tools.qrcode_tool.error_high")}</option>
                </select>
              </div>

              {/* 颜色 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-(--text-main) mb-2">
                    {t("tools.qrcode_tool.foreground_color")}
                  </label>
                  <input
                    type="color"
                    value={foregroundColor}
                    onChange={(e) => setForegroundColor(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm text-(--text-main) mb-2">
                    {t("tools.qrcode_tool.background_color")}
                  </label>
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* 边距 */}
              <div>
                <label className="block text-sm text-(--text-main) mb-2">
                  {t("tools.qrcode_tool.margin")}: {margin}
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleGenerate}
                className="flex items-center gap-2"
              >
                {t("tools.qrcode_tool.generate")}
              </Button>
              <Button
                onClick={handleDownload}
                variant="outlined"
                className="flex items-center gap-2"
                disabled={!qrCodeUrl}
              >
                <Download size={16} />
                {t("tools.qrcode_tool.download")}
              </Button>
              <Button
                onClick={handleCopyImage}
                variant="outlined"
                className="flex items-center gap-2"
                disabled={!qrCodeUrl}
              >
                <Copy size={16} />
                {t("tools.qrcode_tool.copy_image")}
              </Button>
            </div>
          </div>

          {/* 右侧：预览 */}
          <div>
            <label className="block text-sm font-medium text-(--text-main) mb-2">
              预览
            </label>
            <div className="flex items-center justify-center p-8 bg-(--card-bg) border border-(--border-color) rounded-xl min-h-[400px]">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code" className="max-w-full" />
              ) : (
                <p className="text-(--text-muted) text-sm">
                  请输入内容并生成二维码
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 识别二维码 */}
      {activeTab === "scan" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：上传区域 */}
          <div>
            <label className="block text-sm font-medium text-(--text-main) mb-2">
              {t("tools.qrcode_tool.upload_image")}
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={handleUploadClick}
              className="flex flex-col items-center justify-center p-12 bg-(--card-bg) border-2 border-dashed border-(--border-color) rounded-xl cursor-pointer hover:border-blue-500 transition-colors min-h-[400px]"
            >
              {uploadedImage ? (
                <img
                  src={uploadedImage}
                  alt="Uploaded"
                  className="max-w-full max-h-[400px] object-contain"
                />
              ) : (
                <>
                  <Upload size={48} className="text-(--text-muted) mb-4" />
                  <p className="text-(--text-main) font-medium mb-2">
                    {t("tools.qrcode_tool.select_image")}
                  </p>
                  <p className="text-(--text-muted) text-sm">
                    {t("tools.qrcode_tool.drag_drop")}
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* 右侧：识别结果 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-(--text-main)">
                {t("tools.qrcode_tool.scan_result")}
              </label>
              <Button
                onClick={handleCopyResult}
                variant="outlined"
                size="small"
                className="flex items-center gap-2"
                disabled={!scanResult}
              >
                <Copy size={14} />
                复制
              </Button>
            </div>
            <textarea
              value={scanResult}
              readOnly
              placeholder="识别结果将显示在这里..."
              className="w-full h-[400px] p-4 bg-(--card-bg) border border-(--border-color) rounded-xl text-sm font-mono resize-none focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 隐藏的 canvas 用于图片处理 */}
      <canvas ref={canvasRef} className="hidden" />
    </ToolLayout>
  );
}


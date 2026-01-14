/**
 * 取色器工具页面
 * 职责：提供颜色选择、屏幕取色、格式转换及对比度检查功能
 */
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  History,
  Palette,
  Pipette,
  RefreshCw,
  Trash2,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";

// 颜色转换工具函数
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const getLuminance = (r: number, g: number, b: number) => {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

const getContrastRatio = (l1: number, l2: number) => {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// 常用配色数据
const COMMON_PALETTES = [
  {
    name: "primary",
    colors: ["#409EFF", "#67C23A", "#E6A23C", "#F56C6C", "#909399"],
  },
  {
    name: "material",
    colors: [
      "#F44336",
      "#E91E63",
      "#9C27B0",
      "#673AB7",
      "#3F51B5",
      "#2196F3",
      "#03A9F4",
      "#00BCD4",
      "#009688",
      "#4CAF50",
      "#8BC34A",
      "#CDDC39",
      "#FFEB3B",
      "#FFC107",
      "#FF9800",
      "#FF5722",
    ],
  },
  {
    name: "pastel",
    colors: ["#FFB7B2", "#FFDAC1", "#E2F0CB", "#B5EAD7", "#C7CEEA", "#F3D1F4"],
  },
  {
    name: "tailwind",
    colors: [
      "#ef4444",
      "#f97316",
      "#f59e0b",
      "#eab308",
      "#84cc16",
      "#22c55e",
      "#10b981",
      "#14b8a6",
      "#06b6d4",
      "#0ea5e9",
      "#3b82f6",
      "#6366f1",
      "#8b5cf6",
      "#a855f7",
      "#d946ef",
      "#ec4899",
      "#f43f5e",
    ],
  },
  {
    name: "flat_ui",
    colors: [
      "#1abc9c",
      "#2ecc71",
      "#3498db",
      "#9b59b6",
      "#34495e",
      "#16a085",
      "#27ae60",
      "#2980b9",
      "#8e44ad",
      "#2c3e50",
      "#f1c40f",
      "#e67e22",
      "#e74c3c",
      "#ecf0f1",
      "#95a5a6",
      "#f39c12",
      "#d35400",
      "#c0392b",
      "#bdc3c7",
      "#7f8c8d",
    ],
  },
  {
    name: "metro",
    colors: [
      "#a4c400",
      "#60a917",
      "#008a00",
      "#00aba9",
      "#1ba1e2",
      "#0050ef",
      "#6a00ff",
      "#aa00ff",
      "#f472d0",
      "#d80073",
      "#a20025",
      "#e51400",
      "#fa6800",
      "#f0a30a",
      "#e3c800",
      "#825a2c",
      "#6d8764",
      "#647687",
      "#76608a",
      "#87794e",
    ],
  },
  {
    name: "social",
    colors: [
      "#1877F2", // Facebook
      "#1DA1F2", // Twitter
      "#E60023", // Pinterest
      "#0077B5", // LinkedIn
      "#FF0000", // YouTube
      "#C13584", // Instagram
      "#00B900", // Line
      "#7289DA", // Discord
      "#FF4500", // Reddit
      "#000000", // TikTok
      "#25D366", // WhatsApp
      "#0088CC", // Telegram
    ],
  },
];

// 中国传统色数据
const TRADITIONAL_CHINESE_COLORS = [
  { name: "cinnabar", hex: "#FF461F" },
  { name: "rouge", hex: "#9D2933" },
  { name: "indigo", hex: "#426666" },
  { name: "lapis_lazuli", hex: "#2B5F75" },
  { name: "lotus_root", hex: "#EDC3AE" },
  { name: "mugwort_green", hex: "#A4E2C6" },
  { name: "concubine_red", hex: "#ED5736" },
  { name: "raven_blue", hex: "#424C50" },
  { name: "dark_blue", hex: "#3D3B4F" },
  { name: "crab_shell_cyan", hex: "#BBCDC5" },
  { name: "bamboo_green", hex: "#789262" },
  { name: "moon_white", hex: "#D6ECF0" },
  { name: "amber", hex: "#CA6924" },
  { name: "umbra", hex: "#4A4266" },
  { name: "verdant", hex: "#519A73" },
  { name: "ivory_white", hex: "#EEEAD9" },
  { name: "lotus_pink", hex: "#EDD1D8" },
  { name: "camel", hex: "#A88462" },
  { name: "pitch_black", hex: "#161823" },
  { name: "realgar", hex: "#E9DD34" },
  { name: "orpiment", hex: "#FFC64B" },
  { name: "indigo_blue", hex: "#1661AB" },
  { name: "scallion_green", hex: "#9ED048" },
  { name: "pomegranate_red", hex: "#F15B6C" },
  { name: "begonia_red", hex: "#FF7B9C" },
  { name: "apricot_yellow", hex: "#FFA631" },
  { name: "clove_purple", hex: "#A7535A" },
  { name: "sky_blue", hex: "#44CEF6" },
  { name: "silver_gray", hex: "#E0E0E0" },
  { name: "chestnut", hex: "#5E3D28" },
];

// Memoized 颜色按钮
const ColorButton = memo<{
  hex: string;
  onClick: (hex: string) => void;
  size?: "sm" | "md";
}>(({ hex, onClick, size = "md" }) => (
  <Button
    variant="text"
    onClick={() => onClick(hex)}
    className={`p-0 rounded-lg border border-(--border-color) shadow-sm hover:scale-110 transition-transform ${
      size === "sm" ? "w-6 h-6" : "aspect-square h-auto"
    }`}
    style={{ backgroundColor: hex }}
    title={hex}
  />
));
ColorButton.displayName = "ColorButton";

// Memoized 配色盘区域
const PaletteSection = memo<{
  palette: { name: string; colors: string[] };
  onColorSelect: (hex: string) => void;
  t: any;
}>(({ palette, onColorSelect, t }) => (
  <div className="flex flex-col gap-2">
    <span className="text-xs text-(--text-muted) font-medium">
      {t(`tools.color_picker.palette_types.${palette.name}`)}
    </span>
    <div className="flex flex-wrap gap-2">
      {palette.colors.map((c) => (
        <ColorButton key={c} hex={c} onClick={onColorSelect} size="sm" />
      ))}
    </div>
  </div>
));
PaletteSection.displayName = "PaletteSection";

// Memoized 传统色区域
const TraditionalColorItem = memo<{
  color: { name: string; hex: string };
  onColorSelect: (hex: string) => void;
  t: any;
}>(({ color, onColorSelect, t }) => (
  <Button
    variant="text"
    onClick={() => onColorSelect(color.hex)}
    className="flex flex-col items-center gap-1 group h-auto p-0"
  >
    <div
      className="w-full aspect-square rounded-lg border border-(--border-color) shadow-sm group-hover:scale-105 transition-transform"
      style={{ backgroundColor: color.hex }}
    />
    <span className="text-[9px] text-(--text-muted) truncate w-full text-center">
      {t(`tools.color_picker.chinese_colors.${color.name}`)}
    </span>
  </Button>
));
TraditionalColorItem.displayName = "TraditionalColorItem";

const ColorPicker: React.FC = () => {
  const { t } = useTranslation();
  const [color, setColor] = useState("#409EFF");
  const [history, setHistory] = useState<string[]>([]);
  const [statusText, setStatusText] = useState(t("common.ready"));
  const [hideOnPick, setHideOnPick] = useState(true);

  // 从本地存储加载设置
  useEffect(() => {
    const savedHistory = localStorage.getItem("color_picker_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }

    const savedHide = localStorage.getItem("color_picker_hide_on_pick");
    if (savedHide) {
      setHideOnPick(savedHide === "true");
    }
  }, []);

  // 保存历史记录
  const addToHistory = useCallback((newColor: string) => {
    setHistory((prev) => {
      const filtered = prev.filter((c) => c !== newColor);
      const updated = [newColor, ...filtered].slice(0, 12);
      localStorage.setItem("color_picker_history", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value.toUpperCase();
      setColor(newColor);
    },
    []
  );

  const handlePickScreen = async () => {
    const appWindow = getCurrentWindow();

    try {
      // 如果开启了隐藏窗口，则隐藏
      if (hideOnPick) {
        await appWindow.hide();
      }

      // 无论是否隐藏主窗口，都显示放大镜窗口
      const magnifier = await WebviewWindow.getByLabel("magnifier");
      if (magnifier) {
        await magnifier.show();
      }

      // 调用 Rust 命令，该命令会等待用户点击
      // 增加前端超时保护 (65秒，略长于后端的60秒)
      const pickPromise = invoke<string>("pick_screen_color");
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Pick timeout")), 65000)
      );

      const hexColor = await Promise.race([pickPromise, timeoutPromise]);

      setColor(hexColor);
      addToHistory(hexColor);
      setStatusText(t("common.success"));
    } catch (e: any) {
      console.error("Pick failed", e);
      setStatusText(typeof e === "string" ? e : e.message || "Pick failed");
    } finally {
      // 隐藏放大镜
      const magnifier = await WebviewWindow.getByLabel("magnifier");
      if (magnifier) {
        await magnifier.hide();
      }

      // 如果之前隐藏了主窗口，则恢复显示
      if (hideOnPick) {
        await appWindow.show();
        await appWindow.setFocus();
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatusText(t("common.copy") + " " + t("common.success"));
    setTimeout(() => setStatusText(t("common.ready")), 2000);
  };

  // 使用 useMemo 缓存颜色转换计算，避免频繁重新渲染
  const colorData = useMemo(() => {
    const rgb = hexToRgb(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    const contrastWithWhite = getContrastRatio(luminance, 1);
    const contrastWithBlack = getContrastRatio(luminance, 0);
    return { rgb, hsl, luminance, contrastWithWhite, contrastWithBlack };
  }, [color]);

  // 选择颜色的回调
  const handleSelectColor = useCallback(
    (newColor: string) => {
      setColor(newColor);
      addToHistory(newColor);
    },
    [addToHistory]
  );

  return (
    <ToolLayout title={t("tools.color_picker.name")} status={statusText}>
      <div className="flex flex-col gap-6 h-full overflow-auto custom-scrollbar pr-2">
        {/* 主选择区 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col items-center gap-6">
            <div
              className="w-full aspect-video rounded-xl shadow-inner border border-(--border-color) flex items-center justify-center relative overflow-hidden"
              style={{ backgroundColor: color }}
            >
              <span
                className="text-2xl font-bold font-mono drop-shadow-md"
                style={{ color: colorData.luminance > 0.5 ? "#000" : "#fff" }}
              >
                {color}
              </span>
            </div>

            <div className="flex items-center gap-4 w-full">
              <div className="relative flex-1 h-12">
                <input
                  type="color"
                  value={color}
                  onChange={handleColorChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-full h-full rounded-xl border border-(--border-color) bg-(--bg-main) flex items-center justify-center gap-2 pointer-events-none">
                  <Palette size={18} className="text-primary" />
                  <span className="text-sm font-medium">
                    {t("tools.color_picker.palette")}
                  </span>
                </div>
              </div>

              <Button
                onClick={handlePickScreen}
                className="h-12 px-6 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                <Pipette size={18} />
                <span>{t("tools.color_picker.pick_screen")}</span>
              </Button>
            </div>

            <div className="w-full flex justify-end">
              <label className="flex items-center gap-2 text-sm text-(--text-muted) cursor-pointer select-none hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={hideOnPick}
                  onChange={(e) => {
                    setHideOnPick(e.target.checked);
                    localStorage.setItem(
                      "color_picker_hide_on_pick",
                      String(e.target.checked)
                    );
                  }}
                  className="w-4 h-4 rounded border-(--border-color) text-primary focus:ring-primary bg-transparent"
                />
                {t("tools.color_picker.hide_on_pick")}
              </label>
            </div>
          </div>

          {/* 格式转换区 */}
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-bold text-(--text-muted) uppercase tracking-wider flex items-center gap-2">
              <RefreshCw size={14} />
              {t("tools.color_picker.format")}
            </h3>

            <div className="space-y-3">
              {[
                { label: "HEX", value: color, copy: color },
                {
                  label: "RGB",
                  value: `rgb(${colorData.rgb.r}, ${colorData.rgb.g}, ${colorData.rgb.b})`,
                  copy: `rgb(${colorData.rgb.r}, ${colorData.rgb.g}, ${colorData.rgb.b})`,
                },
                {
                  label: "HSL",
                  value: `hsl(${colorData.hsl.h}, ${colorData.hsl.s}%, ${colorData.hsl.l}%)`,
                  copy: `hsl(${colorData.hsl.h}, ${colorData.hsl.s}%, ${colorData.hsl.l}%)`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3 bg-(--bg-main) rounded-xl border border-(--border-color) group"
                >
                  <span className="w-12 text-xs font-bold text-(--text-muted)">
                    {item.label}
                  </span>
                  <span className="flex-1 font-mono text-sm truncate">
                    {item.value}
                  </span>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => copyToClipboard(item.copy)}
                    className="p-2 h-auto"
                  >
                    <Copy size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 对比度与历史记录 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 对比度检查 */}
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-bold text-(--text-muted) uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={14} />
              {t("tools.color_picker.contrast")}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-(--border-color) flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-(--text-muted)">
                    {t("tools.color_picker.on_white")}
                  </span>
                  <span className="text-sm font-bold">
                    {colorData.contrastWithWhite.toFixed(2)}:1
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-bold ${
                    colorData.contrastWithWhite >= 4.5
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {colorData.contrastWithWhite >= 4.5 ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <AlertCircle size={12} />
                  )}
                  {colorData.contrastWithWhite >= 4.5
                    ? t("tools.color_picker.contrast_pass")
                    : t("tools.color_picker.contrast_fail")}
                </div>
                <div
                  className="h-8 rounded-lg flex items-center justify-center text-sm font-medium border border-(--border-color)"
                  style={{ backgroundColor: "#fff", color: color }}
                >
                  {t("tools.color_picker.sample_text")}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-(--border-color) flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-(--text-muted)">
                    {t("tools.color_picker.on_black")}
                  </span>
                  <span className="text-sm font-bold">
                    {colorData.contrastWithBlack.toFixed(2)}:1
                  </span>
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-bold ${
                    colorData.contrastWithBlack >= 4.5
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {colorData.contrastWithBlack >= 4.5 ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <AlertCircle size={12} />
                  )}
                  {colorData.contrastWithBlack >= 4.5
                    ? t("tools.color_picker.contrast_pass")
                    : t("tools.color_picker.contrast_fail")}
                </div>
                <div
                  className="h-8 rounded-lg flex items-center justify-center text-sm font-medium border border-(--border-color)"
                  style={{ backgroundColor: "#000", color: color }}
                >
                  {t("tools.color_picker.sample_text")}
                </div>
              </div>
            </div>
          </div>

          {/* 历史记录 */}
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-(--text-muted) uppercase tracking-wider flex items-center gap-2">
                <History size={14} />
                {t("tools.color_picker.history")}
              </h3>
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem("color_picker_history");
                }}
                className="p-1.5 h-auto text-(--text-muted) hover:text-red-500"
              >
                <Trash2 size={14} />
              </Button>
            </div>

            <div className="grid grid-cols-6 gap-3">
              {history.map((h, i) => (
                <ColorButton
                  key={`${h}-${i}`}
                  hex={h}
                  onClick={setColor}
                  size="md"
                />
              ))}
              {history.length === 0 && (
                <div className="col-span-6 h-20 flex items-center justify-center text-xs text-(--text-muted) border-2 border-dashed border-(--border-color) rounded-xl">
                  {t("tools.color_picker.no_history")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 常用配色与中国传统色 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 常用配色 */}
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-bold text-(--text-muted) uppercase tracking-wider flex items-center gap-2">
              <Palette size={14} />
              {t("tools.color_picker.common_palettes")}
            </h3>
            <div className="flex flex-col gap-4">
              {COMMON_PALETTES.map((palette) => (
                <PaletteSection
                  key={palette.name}
                  palette={palette}
                  onColorSelect={handleSelectColor}
                  t={t}
                />
              ))}
            </div>
          </div>

          {/* 中国传统色 */}
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-bold text-(--text-muted) uppercase tracking-wider flex items-center gap-2">
              <Palette size={14} />
              {t("tools.color_picker.traditional_chinese_colors")}
            </h3>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {TRADITIONAL_CHINESE_COLORS.map((c) => (
                <TraditionalColorItem
                  key={c.hex}
                  color={c}
                  onColorSelect={handleSelectColor}
                  t={t}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default ColorPicker;

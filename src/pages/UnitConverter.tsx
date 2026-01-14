/**
 * 单位换算器页面
 * 职责：提供汇率、长度、重量、温度、进制等常用单位转换的 UI 交互
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import { Select, SelectOption } from "../components/mui";
import { ArrowRightLeft, Copy, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";

const CATEGORIES = [
  "currency",
  "length",
  "weight",
  "temperature",
  "base",
  "storage",
  "network_speed",
];

const UNITS = {
  length: ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"],
  weight: ["mg", "g", "kg", "t", "oz", "lb"],
  temperature: ["c", "f", "k"],
  base: ["2", "8", "10", "16"],
  currency: ["USD", "EUR", "CNY", "JPY", "GBP", "AUD", "CAD", "HKD"],
  storage: ["B", "KB", "MB", "GB", "TB"],
  network_speed: ["bps", "Kbps", "Mbps", "Gbps", "KB/s", "MB/s", "GB/s"],
};

export default function UnitConverter() {
  const { t } = useTranslation();
  const [category, setCategory] = useState("currency");
  const [inputValue, setInputValue] = useState("1");
  const [fromUnit, setFromUnit] = useState("USD");
  const [toUnit, setToUnit] = useState("CNY");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  useEffect(() => {
    const units = UNITS[category as keyof typeof UNITS];
    if (category === "currency") {
      setFromUnit("USD");
      setToUnit("CNY");
    } else {
      setFromUnit(units[0]);
      setToUnit(units[1] || units[0]);
    }
    setResult("");
  }, [category]);

  useEffect(() => {
    if (category === "currency") {
      setRates(null);
      fetchRates();
    }
  }, [category]);

  const fetchRates = async () => {
    // 始终使用 USD 作为 base，避免某些货币代码不被 API 支持
    if (category !== "currency") {
      return;
    }

    setLoading(true);
    try {
      const response: any = await invoke("get_exchange_rates", {
        base: "USD",
      });
      if (response.ok) {
        setRates(response.data.rates);
        setLastUpdate(response.data.date);
      } else {
        const errorMsg =
          response.error?.message || t("tools.unit_converter.fetch_failed");
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`${t("tools.unit_converter.fetch_failed")}: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!inputValue) {
      setResult("");
      return;
    }

    if (category === "currency") {
      if (rates && rates[fromUnit] && rates[toUnit]) {
        const val = parseFloat(inputValue);
        if (!isNaN(val)) {
          // 交叉汇率计算: fromUnit -> USD -> toUnit
          // 例如: CNY -> USD -> EUR = (1 / rate_CNY) * rate_EUR
          const result = (val / rates[fromUnit]) * rates[toUnit];
          setResult(result.toFixed(4));
        }
      } else {
        setResult("");
      }
      return;
    }

    try {
      const response: any = await invoke("convert_units", {
        request: {
          value: inputValue,
          from: fromUnit,
          to: toUnit,
          category,
        },
      });
      if (response.ok) {
        setResult(response.data.result);
      } else {
        // toast.error(t("common.error"));
      }
    } catch (error) {
      console.error(error);
      // toast.error(t("common.error"));
    }
  };

  useEffect(() => {
    handleConvert();
  }, [inputValue, fromUnit, toUnit, category, rates]);

  const handleSwap = () => {
    const temp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(temp);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast.success(t("common.success"));
  };

  const getOptions = (): SelectOption[] => {
    return UNITS[category as keyof typeof UNITS].map((u) => ({
      key: u,
      label:
        category === "currency"
          ? u
          : t(`tools.unit_converter.units.${category}.${u}`),
    }));
  };

  return (
    <ToolLayout title={t("tools.unit_converter.name")}>
      <div className="flex-1 flex flex-col gap-6 p-6 overflow-auto custom-scrollbar">
        {/* 分类选择卡片 */}
        <div className="bg-(--card-bg) p-4 rounded-2xl border border-(--border-color) shadow-sm">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                onClick={() => setCategory(cat)}
                variant={category === cat ? "contained" : "text"}
                color={category === cat ? "primary" : "inherit"}
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textTransform: "none",
                  minWidth: 0,
                  height: "auto",
                  bgcolor: category === cat ? undefined : "var(--bg-main)",
                  "&:hover": {
                    bgcolor:
                      category === cat ? undefined : "var(--border-color)",
                  },
                }}
              >
                {t(`tools.unit_converter.${cat}`)}
              </Button>
            ))}
          </div>
        </div>

        {/* 转换主区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
          {/* 输入端 */}
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-(--text-muted) uppercase tracking-wider">
                {t("tools.unit_converter.from_unit")}
              </label>
              <Select
                value={fromUnit}
                onChange={setFromUnit}
                options={getOptions()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-(--text-muted) uppercase tracking-wider">
                {t("tools.unit_converter.input_value")}
              </label>
              <input
                type={category === "base" ? "text" : "number"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-4 py-3 bg-(--bg-main) border border-(--border-color) rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 text-(--text-main) font-medium transition-all"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* 交换按钮 */}
          <div className="flex justify-center items-center">
            <Button
              variant="contained"
              color="primary"
              onClick={handleSwap}
              sx={{
                minWidth: 0,
                width: 48,
                height: 48,
                borderRadius: "50%",
                p: 1.5,
                boxShadow: 2,
                "&:hover": {
                  boxShadow: 4,
                },
              }}
            >
              <ArrowRightLeft className="w-6 h-6" />
            </Button>
          </div>

          {/* 输出端 */}
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-(--text-muted) uppercase tracking-wider">
                {t("tools.unit_converter.to_unit")}
              </label>
              <Select
                value={toUnit}
                onChange={setToUnit}
                options={getOptions()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-(--text-muted) uppercase tracking-wider">
                {t("tools.unit_converter.output_value")}
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={result}
                  readOnly
                  className="w-full px-4 py-3 bg-(--bg-main) border border-(--border-color) rounded-xl text-(--text-main) font-mono font-bold text-lg"
                />
                <Button
                  variant="text"
                  size="small"
                  onClick={handleCopy}
                  className="!absolute right-2 top-1/2 -translate-y-1/2 p-2 text-(--text-muted) hover:text-primary hover:bg-primary/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 h-auto min-w-0"
                  title={t("common.copy")}
                >
                  <Copy className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 底部状态栏 (仅汇率) */}
        {category === "currency" && (
          <div className="bg-(--card-bg) px-6 py-4 rounded-2xl border border-(--border-color) shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-(--text-muted)">
              <div
                className={`p-2 rounded-lg ${
                  loading ? "bg-primary/10 text-primary" : "bg-(--bg-main)"
                }`}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </div>
              <span>
                {t("tools.unit_converter.last_update")}:{" "}
                <span className="font-mono font-medium text-(--text-main)">
                  {lastUpdate || "---"}
                </span>
              </span>
            </div>
            <Button
              variant="outlined"
              size="small"
              onClick={fetchRates}
              disabled={loading}
              className="rounded-xl"
            >
              {t("common.refresh")}
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}

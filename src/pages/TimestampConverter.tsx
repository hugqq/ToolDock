import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import { invokeWrapper } from "../api";
import toast from "react-hot-toast";
import { Clock, Copy, Zap } from "lucide-react";

interface ConversionResult {
  input: string;
  output: string;
  unit: string;
  timezone: string;
  convert_type: string;
  timestamp?: number;
}

const TimestampConverter: React.FC = () => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const [outputValue, setOutputValue] = useState("");
  const [convertType, setConvertType] = useState("to_datetime");
  const [unit, setUnit] = useState("seconds");
  const [timezone, setTimezone] = useState("Local");
  const [history, setHistory] = useState<ConversionResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (!inputValue.trim()) {
      toast.error(t("common.required"));
      return;
    }

    setLoading(true);
    try {
      const res = await invokeWrapper<ConversionResult>("convert_timestamp", {
        value: inputValue,
        convertType: convertType,
        unit,
        timezone,
      });

      if (res.ok && res.data) {
        setOutputValue(res.data.output);
        setHistory([res.data, ...history.slice(0, 9)]);
        toast.success(t("common.success"));
      } else {
        toast.error(t("common.error"));
      }
    } catch (error: any) {
      toast.error(error.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleGetNow = async () => {
    try {
      const res = await invokeWrapper<string>("get_current_datetime");
      if (res.ok && res.data) {
        setInputValue(res.data);
        setConvertType("to_timestamp");
        setOutputValue("");
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCopyOutput = () => {
    if (outputValue) {
      navigator.clipboard.writeText(outputValue);
      toast.success(t("common.copy_success"));
    }
  };

  const handleCopyFromHistory = (result: ConversionResult) => {
    navigator.clipboard.writeText(result.output);
    toast.success(t("common.copy_success"));
  };

  const handleClearHistory = () => {
    setHistory([]);
    toast.success(t("common.cleared"));
  };

  return (
    <ToolLayout title={t("tools.timestamp_converter.name")}>
      <div className="max-w-4xl mx-auto w-full space-y-6 pb-10">
        {/* 控制按钮 - 放在最上面 */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
            {t("tools.timestamp_converter.convert")}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setConvertType("to_datetime");
                setOutputValue("");
              }}
              className={`py-2 px-6 rounded-lg font-medium transition-colors ${
                convertType === "to_datetime"
                  ? "bg-blue-500 text-white"
                  : "bg-[var(--card-bg)] text-[var(--text-main)] border border-[var(--border-color)]"
              }`}
            >
              {t("tools.timestamp_converter.to_datetime")}
            </button>
            <button
              onClick={() => {
                setConvertType("to_timestamp");
                setOutputValue("");
              }}
              className={`py-2 px-6 rounded-lg font-medium transition-colors ${
                convertType === "to_timestamp"
                  ? "bg-blue-500 text-white"
                  : "bg-[var(--card-bg)] text-[var(--text-main)] border border-[var(--border-color)]"
              }`}
            >
              {t("tools.timestamp_converter.to_timestamp")}
            </button>
            <button
              onClick={handleGetNow}
              className="flex items-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors ml-auto"
            >
              <Clock size={18} />
              {t("tools.timestamp_converter.now")}
            </button>
          </div>
        </div>

        {/* 转换器主体 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 左侧输入 */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-6">
            <label className="block text-sm font-bold text-[var(--text-main)] mb-3">
              {convertType === "to_datetime"
                ? t("tools.timestamp_converter.timestamp")
                : t("tools.timestamp_converter.datetime")}
            </label>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                convertType === "to_datetime"
                  ? "1234567890 或 1234567890000"
                  : "2024-12-30 15:30:00"
              }
              className="w-full h-32 p-4 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-4 flex gap-3">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="flex-1 px-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] focus:outline-none"
              >
                <option value="seconds">
                  {t("tools.timestamp_converter.seconds")}
                </option>
                <option value="milliseconds">
                  {t("tools.timestamp_converter.milliseconds")}
                </option>
                <option value="microseconds">
                  {t("tools.timestamp_converter.microseconds")}
                </option>
              </select>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex-1 px-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-[var(--text-main)] focus:outline-none"
              >
                <option value="Local">
                  {t("tools.timestamp_converter.local")}
                </option>
                <option value="UTC">
                  {t("tools.timestamp_converter.utc")}
                </option>
              </select>
            </div>
          </div>

          {/* 右侧输出 */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-6">
            <label className="block text-sm font-bold text-[var(--text-main)] mb-3">
              {convertType === "to_datetime"
                ? t("tools.timestamp_converter.datetime")
                : t("tools.timestamp_converter.timestamp")}
            </label>
            <textarea
              value={outputValue}
              readOnly
              className="w-full h-32 p-4 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none"
              placeholder={t("common.loading")}
            />
            <button
              onClick={handleCopyOutput}
              disabled={!outputValue}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              <Copy size={18} />
              {t("common.copy")}
            </button>
          </div>
        </div>

        {/* 转换按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleConvert}
            disabled={loading || !inputValue.trim()}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Zap size={18} />
            {loading
              ? t("common.loading")
              : t("tools.timestamp_converter.convert")}
          </button>
        </div>

        {/* 历史记录 */}
        {history.length > 0 && (
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-main)]">
                {t("tools.timestamp_converter.history")}
              </h3>
              <button
                onClick={handleClearHistory}
                className="px-4 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                {t("common.clear")}
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-[var(--bg-main)] rounded-lg border border-[var(--border-color)] hover:border-blue-500 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--text-muted)]">
                      {result.input}
                    </div>
                    <div className="text-sm text-blue-400 truncate">
                      {result.output}
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopyFromHistory(result)}
                    className="ml-4 p-2 hover:bg-[var(--border-color)] rounded-lg transition-colors"
                  >
                    <Copy size={16} className="text-[var(--text-muted)]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default TimestampConverter;

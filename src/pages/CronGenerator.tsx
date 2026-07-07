/*
 * Cron 表达式生成器页面
 * 职责：可视化生成和解析 Cron 表达式，支持 AI 生成和下次运行时间预览
 */

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  Play,
  Copy,
  Info,
  Sparkles,
  Loader2,
  Calendar,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import { toast } from "react-hot-toast";
import { useSettingsStore } from "../stores/useSettingsStore";
import { invokeWrapper } from "../api";
import { Select } from "../components/mui";
import {
  buildCronExpression,
  createDefaultCronFieldStates,
  CRON_FIELD_CONFIGS,
  getCronTabs,
  parseCronExpression,
  type CronFieldCount,
  type CronFieldState,
  type CronFieldType,
} from "../lib/cronExpression";

const CronGenerator: React.FC = () => {
  const { t } = useTranslation();
  const { ai } = useSettingsStore();
  const [expression, setExpression] = useState("* * * * ?");
  const [nextRuns, setNextRuns] = useState<string[]>([]);
  const [fieldCount, setFieldCount] = useState<CronFieldCount>(5);
  const [activeTab, setActiveTab] = useState<CronFieldType>("minutes");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>(
    ai?.activeProvider || "deepseek"
  );

  const [fieldStates, setFieldStates] = useState<
    Record<CronFieldType, CronFieldState>
  >(createDefaultCronFieldStates);

  const tabs = getCronTabs(fieldCount);

  const aiProviders = Array.isArray(ai?.providers) ? ai!.providers : [];

  // 过滤出已配置 API Key 的服务商
  const availableProviders = aiProviders
    .filter((p) => p.apiKey.trim() !== "")
    .map((p) => ({ key: p.id, label: p.name }));

  const activeConfig =
    aiProviders.find((p) => p.id === selectedProvider) ?? aiProviders[0];

  const fetchNextRuns = async (expr: string) => {
    try {
      const runs = await invoke<string[]>("get_cron_next_runs", {
        expression: expr,
        count: 10,
      });
      setNextRuns(runs);
    } catch (error) {
      console.error(error);
      setNextRuns([]);
    }
  };

  useEffect(() => {
    setExpression(buildCronExpression(fieldStates, fieldCount));
  }, [fieldStates, fieldCount]);

  useEffect(() => {
    if (!tabs.includes(activeTab)) {
      setActiveTab(tabs[0]);
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    fetchNextRuns(expression);
  }, [expression]);

  const handleCopy = () => {
    navigator.clipboard.writeText(expression);
    toast.success(t("common.success"));
  };

  // 将 Cron 表达式字符串反解析为字段状态
  const parseExpressionToStates = (expr: string) => {
    const parsed = parseCronExpression(expr);
    if (!parsed) {
      toast.error(t("tools.cron_generator.invalid_expression"));
      return;
    }

    setFieldCount(parsed.fieldCount);
    setFieldStates(parsed.states);
  };

  const handleAiGenerate = async () => {
    if (!aiInput.trim()) return;
    if (!activeConfig?.apiKey) {
      toast.error(t("tools.cron_generator.ai_config_error"));
      return;
    }

    setAiLoading(true);
    try {
      const res = await invokeWrapper<string>("generate_cron_with_ai", {
        provider: selectedProvider,
        apiKey: activeConfig.apiKey,
        model: activeConfig.model,
        baseUrl: activeConfig.baseUrl,
        input: aiInput,
      });

      if (res.ok) {
        parseExpressionToStates(res.data);
        toast.success(t("common.success"));
      } else {
        toast.error(res.message || t("common.error"));
      }
    } catch (err: any) {
      toast.error(err.message || t("common.error"));
    } finally {
      setAiLoading(false);
    }
  };

  const updateField = (
    field: CronFieldType,
    updates: Partial<CronFieldState>
  ) => {
    setFieldStates((prev) => ({
      ...prev,
      [field]: { ...prev[field], ...updates },
    }));
  };

  const renderFieldEditor = (field: CronFieldType) => {
    const state = fieldStates[field];
    const config = CRON_FIELD_CONFIGS[field];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          {/* Any */}
          <label
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
              state.type === "any"
                ? "bg-blue-500/5 border-blue-500/50 ring-1 ring-blue-500/20"
                : "bg-(--bg-main)/50 border-(--border-color) hover:border-blue-500/30"
            }`}
          >
            <input
              type="radio"
              checked={state.type === "any"}
              onChange={() => updateField(field, { type: "any" })}
              className="w-4 h-4 text-blue-500"
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-(--text-main)">
                {t("tools.cron_generator.any")}
              </span>
              <span className="text-xs text-(--text-muted)">
                允许该字段匹配任何值
              </span>
            </div>
          </label>

          {/* Range */}
          <div
            className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${
              state.type === "range"
                ? "bg-blue-500/5 border-blue-500/50 ring-1 ring-blue-500/20"
                : "bg-(--bg-main)/50 border-(--border-color)"
            }`}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={state.type === "range"}
                onChange={() => updateField(field, { type: "range" })}
                className="w-4 h-4 text-blue-500"
              />
              <span className="text-sm font-medium text-(--text-main)">
                {t("tools.cron_generator.from")}
              </span>
            </label>
            <div className="flex items-center gap-3 pl-7">
              <input
                type="number"
                min={config.min}
                max={config.max}
                value={state.rangeStart}
                onChange={(e) =>
                  updateField(field, {
                    rangeStart: parseInt(e.target.value) || config.min,
                    type: "range",
                  })
                }
                className="w-24 px-3 py-1.5 bg-(--bg-main) border border-(--border-color) rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-sm text-(--text-muted)">
                {t("tools.cron_generator.to")}
              </span>
              <input
                type="number"
                min={config.min}
                max={config.max}
                value={state.rangeEnd}
                onChange={(e) =>
                  updateField(field, {
                    rangeEnd: parseInt(e.target.value) || config.max,
                    type: "range",
                  })
                }
                className="w-24 px-3 py-1.5 bg-(--bg-main) border border-(--border-color) rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Step */}
          <div
            className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${
              state.type === "step"
                ? "bg-blue-500/5 border-blue-500/50 ring-1 ring-blue-500/20"
                : "bg-(--bg-main)/50 border-(--border-color)"
            }`}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={state.type === "step"}
                onChange={() => updateField(field, { type: "step" })}
                className="w-4 h-4 text-blue-500"
              />
              <span className="text-sm font-medium text-(--text-main)">
                {t("tools.cron_generator.from")}
              </span>
            </label>
            <div className="flex items-center gap-3 pl-7">
              <input
                type="number"
                min={config.min}
                max={config.max}
                value={state.stepStart}
                onChange={(e) =>
                  updateField(field, {
                    stepStart: parseInt(e.target.value) || config.min,
                    type: "step",
                  })
                }
                className="w-24 px-3 py-1.5 bg-(--bg-main) border border-(--border-color) rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-sm text-(--text-muted)">
                {t("tools.cron_generator.every")}
              </span>
              <input
                type="number"
                min={1}
                max={config.max}
                value={state.stepValue}
                onChange={(e) =>
                  updateField(field, {
                    stepValue: parseInt(e.target.value) || 1,
                    type: "step",
                  })
                }
                className="w-24 px-3 py-1.5 bg-(--bg-main) border border-(--border-color) rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-sm text-(--text-muted)">
                {t(`tools.cron_generator.${field}`)}
              </span>
            </div>
          </div>

          {/* Specific */}
          <div
            className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${
              state.type === "specific"
                ? "bg-blue-500/5 border-blue-500/50 ring-1 ring-blue-500/20"
                : "bg-(--bg-main)/50 border-(--border-color)"
            }`}
          >
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                checked={state.type === "specific"}
                onChange={() => updateField(field, { type: "specific" })}
                className="w-4 h-4 text-blue-500"
              />
              <span className="text-sm font-medium text-(--text-main)">
                {t("tools.cron_generator.specific")}
              </span>
            </label>
            <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 pl-7">
              {Array.from(
                { length: config.max - config.min + 1 },
                (_, i) => i + config.min
              ).map((val) => (
                <Button
                  key={val}
                  variant={
                    state.specificValues.includes(val) &&
                    state.type === "specific"
                      ? "contained"
                      : "outlined"
                  }
                  size="small"
                  onClick={() => {
                    const newSpecific = state.specificValues.includes(val)
                      ? state.specificValues.filter((v) => v !== val)
                      : [...state.specificValues, val];
                    updateField(field, {
                      specificValues: newSpecific,
                      type: "specific",
                    });
                  }}
                  className="!min-w-[40px] !w-full !h-[28px] !px-0 !py-0"
                  style={{ fontSize: "13px", fontWeight: 500 }}
                >
                  {val}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ToolLayout title={t("tools.cron_generator.name")}>
      <div className="max-w-6xl mx-auto w-full p-6 space-y-6 pb-10">
        {/* AI Generation Card */}
        <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) shadow-sm">
          <div className="p-4 border-b border-(--border-color) bg-(--bg-main)/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-purple-500" />
              <h2 className="font-bold text-(--text-main)">
                {t("tools.cron_generator.ai_generate")}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-36">
                <Select
                  value={selectedProvider}
                  onChange={setSelectedProvider}
                  options={availableProviders}
                />
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiGenerate()}
                  placeholder={t("tools.cron_generator.ai_placeholder")}
                  className="w-full bg-(--bg-main) border border-(--border-color) rounded-xl pl-4 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <Button
                onClick={handleAiGenerate}
                disabled={aiLoading || !aiInput.trim()}
                className="px-6 rounded-xl shadow-lg shadow-purple-500/20"
              >
                {aiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {t("tools.cron_generator.generate")}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Editor & Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor Card */}
          <div className="lg:col-span-2 flex flex-col bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden shadow-sm">
            <div className="p-4 border-b border-(--border-color) bg-(--bg-main)/30 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-(--text-main)">
                  {t("tools.cron_generator.field_count")}
                </div>
                <div className="text-xs text-(--text-muted) mt-1">
                  {t("tools.cron_generator.field_count_hint")}
                </div>
              </div>
              <div className="inline-flex p-1 rounded-xl bg-(--bg-main) border border-(--border-color)">
                <Button
                  variant={fieldCount === 5 ? "contained" : "text"}
                  size="small"
                  onClick={() => setFieldCount(5)}
                  className="rounded-lg !px-4"
                >
                  {t("tools.cron_generator.five_fields")}
                </Button>
                <Button
                  variant={fieldCount === 6 ? "contained" : "text"}
                  size="small"
                  onClick={() => setFieldCount(6)}
                  className="rounded-lg !px-4"
                >
                  {t("tools.cron_generator.six_fields")}
                </Button>
                <Button
                  variant={fieldCount === 7 ? "contained" : "text"}
                  size="small"
                  onClick={() => setFieldCount(7)}
                  className="rounded-lg !px-4"
                >
                  {t("tools.cron_generator.seven_fields")}
                </Button>
              </div>
            </div>
            <div className="flex bg-(--bg-main)/30 border-b border-(--border-color) overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <Button
                  key={tab}
                  variant="text"
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 h-auto rounded-none text-sm font-medium transition-all whitespace-nowrap relative ${
                    activeTab === tab
                      ? "text-blue-500"
                      : "text-(--text-muted) hover:text-(--text-main)"
                  }`}
                >
                  {t(`tools.cron_generator.${tab}`)}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                  )}
                </Button>
              ))}
            </div>
            <div className="p-6 min-h-[450px]">
              {renderFieldEditor(activeTab)}
            </div>
          </div>

          {/* Result & Preview Card */}
          <div className="space-y-6">
            {/* Expression Card */}
            <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden shadow-sm">
              <div className="p-4 border-b border-(--border-color) bg-(--bg-main)/30 flex items-center gap-2">
                <Settings2 size={18} className="text-blue-500" />
                <h2 className="font-bold text-(--text-main)">
                  {t("tools.cron_generator.expression")}
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-(--bg-main) border border-(--border-color) rounded-xl font-mono text-lg text-center text-blue-500 break-all">
                  {expression}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outlined"
                    onClick={handleCopy}
                    className="flex-1 rounded-xl"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {t("common.copy")}
                  </Button>
                  <Button
                    onClick={() => fetchNextRuns(expression)}
                    className="flex-1 rounded-xl"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {t("tools.cron_generator.parse")}
                  </Button>
                </div>
              </div>
            </div>

            {/* Next Runs Card */}
            <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden shadow-sm">
              <div className="p-4 border-b border-(--border-color) bg-(--bg-main)/30 flex items-center gap-2">
                <Calendar size={18} className="text-green-500" />
                <h2 className="font-bold text-(--text-main)">
                  {t("tools.cron_generator.next_runs")}
                </h2>
              </div>
              <div className="p-4 max-h-[300px] overflow-y-auto">
                {nextRuns.length > 0 ? (
                  <div className="space-y-2">
                    {nextRuns.map((run, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-(--bg-main) transition-colors group"
                      >
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-green-500/10 text-green-500 rounded text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <span className="text-sm font-mono text-(--text-main)">
                          {run}
                        </span>
                        <ChevronRight
                          size={14}
                          className="ml-auto text-(--text-muted) opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-red-500/60 gap-3">
                    <Info size={32} className="opacity-20" />
                    <p className="text-xs font-medium">
                      {t("tools.cron_generator.invalid_expression")}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Help Card */}
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
              <h4 className="text-sm font-bold text-blue-500 mb-3 flex items-center gap-2">
                <Info size={16} />
                {t("tools.cron_generator.preview")}
              </h4>
              <div className="space-y-3">
                <p className="text-xs text-(--text-muted) leading-relaxed">
                  Cron 表达式由 5、6 或 7 个字段组成：
                  <br />
                  <span className="font-mono text-blue-500/80">
                    分 时 日 月 周 / 秒 分 时 日 月 周 / 秒 分 时 日 月 周 年
                  </span>
                </p>
                <div className="space-y-2">
                  <div className="p-2 bg-(--bg-main)/50 rounded-lg border border-(--border-color)">
                    <code className="text-[10px] text-blue-500">
                      0 0 12 * * ?
                    </code>
                    <p className="text-[10px] text-(--text-muted) mt-1">
                      每天中午 12 点
                    </p>
                  </div>
                  <div className="p-2 bg-(--bg-main)/50 rounded-lg border border-(--border-color)">
                    <code className="text-[10px] text-blue-500">
                      0 15 10 ? * MON-FRI
                    </code>
                    <p className="text-[10px] text-(--text-muted) mt-1">
                      周一至周五上午 10:15
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default CronGenerator;

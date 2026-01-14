/**
 * VariablePickerModal - 变量选择器模态框
 * 允许用户选择并插入各种变量（计数器、随机字符、日期时间等）
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Hash, Shuffle, Calendar, Plus } from "lucide-react";
import { Button } from "../../../components/mui";

interface VariablePickerModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (variable: string) => void;
}

export const VariablePickerModal: React.FC<VariablePickerModalProps> = ({
  open,
  onClose,
  onInsert,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<
    "counter" | "random" | "datetime"
  >("counter");
  const [counterConfig, setCounterConfig] = useState({
    start: 0,
    increment: 1,
    padding: 3,
  });
  const [randomLength, setRandomLength] = useState(8);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-1100"
      onClick={onClose}
    >
      <div
        className="bg-(--card-bg) rounded-2xl w-200 max-w-[95vw] shadow-2xl border border-(--border-color) overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-(--border-color)">
          <div className="flex items-center gap-3">
            <Hash className="text-blue-500" />
            <h3 className="text-lg font-bold text-(--text-main)">
              {t("tools.batch_renamer.variable_picker.title")}
            </h3>
          </div>
          <Button
            variant="text"
            size="small"
            className="p-1.5 rounded-lg text-(--text-muted) hover:text-(--text-main) hover:bg-black/5 dark:hover:bg-white/5 transition-colors h-auto"
            onClick={onClose}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-(--border-color)">
          <Button
            variant="text"
            size="small"
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors rounded-none h-auto ${
              activeTab === "counter"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-500/5"
                : "text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-main)/50"
            }`}
            onClick={() => setActiveTab("counter")}
          >
            <div className="flex items-center justify-center gap-2">
              <Hash className="w-4 h-4" />
              {t("tools.batch_renamer.variable_picker.tab_counter")}
            </div>
          </Button>
          <Button
            variant="text"
            size="small"
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors rounded-none h-auto ${
              activeTab === "random"
                ? "text-purple-600 border-b-2 border-purple-600 bg-purple-500/5"
                : "text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-main)/50"
            }`}
            onClick={() => setActiveTab("random")}
          >
            <div className="flex items-center justify-center gap-2">
              <Shuffle className="w-4 h-4" />
              {t("tools.batch_renamer.variable_picker.tab_random")}
            </div>
          </Button>
          <Button
            variant="text"
            size="small"
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors rounded-none h-auto ${
              activeTab === "datetime"
                ? "text-orange-600 border-b-2 border-orange-600 bg-orange-500/5"
                : "text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-main)/50"
            }`}
            onClick={() => setActiveTab("datetime")}
          >
            <div className="flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" />
              {t("tools.batch_renamer.variable_picker.tab_datetime")}
            </div>
          </Button>
        </div>

        <div className="px-8 py-6 max-h-[65vh] overflow-y-auto">
          {/* 计数器标签页 */}
          {activeTab === "counter" && (
            <div className="space-y-6">
              <p className="text-sm text-(--text-muted) leading-relaxed">
                {t("tools.batch_renamer.variable_picker.counter_desc")}
              </p>

              {/* 配置区域 */}
              <div className="p-5 rounded-xl bg-(--bg-main)/50 border border-(--border-color) space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-(--text-muted) block mb-2">
                      {t("tools.batch_renamer.variable_picker.start_value")}
                    </label>
                    <p className="text-[10px] text-(--text-muted) mb-2 leading-relaxed opacity-80 h-8 line-clamp-2">
                      {t(
                        "tools.batch_renamer.variable_picker.start_value_desc"
                      )}
                    </p>
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) text-sm"
                      value={counterConfig.start}
                      onChange={(e) =>
                        setCounterConfig({
                          ...counterConfig,
                          start: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-(--text-muted) block mb-2">
                      {t("tools.batch_renamer.variable_picker.increment")}
                    </label>
                    <p className="text-[10px] text-(--text-muted) mb-2 leading-relaxed opacity-80 h-8 line-clamp-2">
                      {t(
                        "tools.batch_renamer.variable_picker.increment_desc"
                      )}
                    </p>
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) text-sm"
                      value={counterConfig.increment}
                      onChange={(e) =>
                        setCounterConfig({
                          ...counterConfig,
                          increment: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-(--text-muted) block mb-2">
                      {t("tools.batch_renamer.variable_picker.padding")}
                    </label>
                    <p className="text-[10px] text-(--text-muted) mb-2 leading-relaxed opacity-80 h-8 line-clamp-2">
                      {t("tools.batch_renamer.variable_picker.padding_desc")}
                    </p>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="w-full px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) text-sm"
                      value={counterConfig.padding}
                      onChange={(e) =>
                        setCounterConfig({
                          ...counterConfig,
                          padding: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="text-xs text-(--text-muted) flex items-center gap-2 pt-2 border-t border-(--border-color)/50">
                  <span>
                    {t("tools.batch_renamer.variable_picker.preview")}:
                  </span>
                  <code className="px-2 py-1 rounded bg-(--bg-main) text-blue-600 font-mono">
                    {`${counterConfig.start}`.padStart(
                      counterConfig.padding,
                      "0"
                    )}
                    ,{" "}
                    {`${
                      counterConfig.start + counterConfig.increment
                    }`.padStart(counterConfig.padding, "0")}
                    ,{" "}
                    {`${
                      counterConfig.start + counterConfig.increment * 2
                    }`.padStart(counterConfig.padding, "0")}
                    ...
                  </code>
                </div>
              </div>

              {/* 快捷按钮 */}
              <div className="space-y-3">
                <div className="text-xs font-medium text-(--text-muted) uppercase tracking-wide">
                  {t("tools.batch_renamer.variable_picker.quick_insert")}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="text"
                    size="small"
                    className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left group h-auto block"
                    onClick={() => onInsert("${}")}
                  >
                    <div className="flex items-start gap-3">
                      <code className="text-sm font-mono text-blue-600 font-bold whitespace-nowrap">
                        ${"{}"}
                      </code>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-(--text-main) font-medium mb-1">
                          {t(
                            "tools.batch_renamer.variable_picker.simple_counter"
                          )}
                        </div>
                        <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                          {t(
                            "tools.batch_renamer.variable_picker.simple_counter_desc"
                          )}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-blue-500 flex-shrink-0" />
                    </div>
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left group h-auto block"
                    onClick={() =>
                      onInsert(
                        `\${start=${counterConfig.start};increment=${counterConfig.increment};padding=${counterConfig.padding}}`
                      )
                    }
                  >
                    <div className="flex items-start gap-3">
                      <code className="text-xs font-mono text-blue-600 font-bold whitespace-nowrap">
                        ${`{start=${counterConfig.start}...}`}
                      </code>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-(--text-main) font-medium mb-1">
                          {t(
                            "tools.batch_renamer.variable_picker.custom_counter"
                          )}
                        </div>
                        <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                          {t(
                            "tools.batch_renamer.variable_picker.custom_counter_desc"
                          )}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-blue-500 flex-shrink-0" />
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 随机字符串标签页 */}
          {activeTab === "random" && (
            <div className="space-y-6">
              <p className="text-sm text-(--text-muted) leading-relaxed">
                {t("tools.batch_renamer.variable_picker.random_desc")}
              </p>

              {/* 长度配置 */}
              <div className="p-5 rounded-xl bg-(--bg-main)/50 border border-(--border-color)">
                <label className="text-xs font-medium text-(--text-muted) block mb-2">
                  {t("tools.batch_renamer.variable_picker.string_length")}
                </label>
                <p className="text-[10px] text-(--text-muted) mb-3 leading-relaxed opacity-80">
                  {t(
                    "tools.batch_renamer.variable_picker.string_length_desc"
                  )}
                </p>
                <input
                  type="number"
                  min="1"
                  max="32"
                  className="w-32 px-3 py-2 rounded-lg bg-(--bg-main) border border-(--border-color) text-sm"
                  value={randomLength}
                  onChange={(e) =>
                    setRandomLength(parseInt(e.target.value) || 8)
                  }
                />
              </div>

              {/* 随机字符串选项 */}
              <div>
                <div className="text-sm font-semibold mb-3 text-(--text-main)">
                  {t(
                    "tools.batch_renamer.variable_picker.random_string_types"
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <Button
                    variant="text"
                    size="small"
                    className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group h-auto block"
                    onClick={() =>
                      onInsert(`\${rstringalnum=${randomLength}}`)
                    }
                  >
                    <div className="flex items-start gap-3">
                      <code className="text-sm font-mono text-purple-600 font-bold whitespace-nowrap">
                        ${`{rstringalnum=${randomLength}}`}
                      </code>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-(--text-main) font-medium mb-1">
                          {t(
                            "tools.batch_renamer.variable_picker.alphanumeric"
                          )}
                        </div>
                        <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                          {t(
                            "tools.batch_renamer.variable_picker.alphanumeric_desc"
                          )}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-purple-500 flex-shrink-0" />
                    </div>
                  </Button>

                  <Button
                    variant="text"
                    size="small"
                    className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group h-auto block"
                    onClick={() =>
                      onInsert(`\${rstringalpha=${randomLength}}`)
                    }
                  >
                    <div className="flex items-start gap-3">
                      <code className="text-sm font-mono text-purple-600 font-bold whitespace-nowrap">
                        ${`{rstringalpha=${randomLength}}`}
                      </code>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-(--text-main) font-medium mb-1">
                          {t(
                            "tools.batch_renamer.variable_picker.alphabetic"
                          )}
                        </div>
                        <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80 mb-1">
                          {t(
                            "tools.batch_renamer.variable_picker.alphabetic_desc"
                          )}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-purple-500 flex-shrink-0" />
                    </div>
                  </Button>

                  <Button
                    variant="text"
                    size="small"
                    className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group h-auto block"
                    onClick={() =>
                      onInsert(`\${rstringdigit=${randomLength}}`)
                    }
                  >
                    <div className="flex items-start gap-3">
                      <code className="text-sm font-mono text-purple-600 font-bold whitespace-nowrap">
                        ${`{rstringdigit=${randomLength}}`}
                      </code>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-(--text-main) font-medium mb-1">
                          {t("tools.batch_renamer.variable_picker.numeric")}
                        </div>
                        <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80 mb-1">
                          {t(
                            "tools.batch_renamer.variable_picker.numeric_desc"
                          )}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-purple-500 flex-shrink-0" />
                    </div>
                  </Button>

                  <Button
                    variant="text"
                    size="small"
                    className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group h-auto block"
                    onClick={() => onInsert("${ruuidv4}")}
                  >
                    <div className="flex items-start gap-3">
                      <code className="text-sm font-mono text-purple-600 font-bold whitespace-nowrap">
                        ${"{ruuidv4}"}
                      </code>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-(--text-main) font-medium mb-1">
                          {t("tools.batch_renamer.variable_picker.uuid")}
                        </div>
                        <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                          {t("tools.batch_renamer.variable_picker.uuid_desc")}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-purple-500 flex-shrink-0" />
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 日期时间标签页 */}
          {activeTab === "datetime" && (
            <div className="space-y-6">
              <p className="text-sm text-(--text-muted) leading-relaxed">
                {t("tools.batch_renamer.variable_picker.datetime_desc")}
              </p>

              {/* 年份 */}
              <div>
                <div className="text-sm font-semibold mb-3 text-(--text-main) flex items-center gap-2">
                  {t("tools.batch_renamer.variable_picker.year")}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { var: "$YYYY", desc: "year_full", example: "2024" },
                    { var: "$YY", desc: "year_short", example: "24" },
                    { var: "$Y", desc: "year_single", example: "4" },
                  ].map((item) => (
                    <Button
                      key={item.var}
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                      onClick={() => onInsert(item.var)}
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                          {item.var}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}`
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}_desc`
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 月份 */}
              <div>
                <div className="text-sm font-semibold mb-2 text-(--text-main)">
                  {t("tools.batch_renamer.variable_picker.month")}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { var: "$MMMM", desc: "month_full", example: "December" },
                    { var: "$MMM", desc: "month_short", example: "Dec" },
                    { var: "$MM", desc: "month_padded", example: "12" },
                    { var: "$M", desc: "month_number", example: "12" },
                  ].map((item) => (
                    <Button
                      key={item.var}
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                      onClick={() => onInsert(item.var)}
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                          {item.var}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}`
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}_desc`
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 星期 */}
              <div>
                <div className="text-sm font-semibold mb-2 text-(--text-main)">
                  {t("tools.batch_renamer.variable_picker.weekday")}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      var: "$DDDD",
                      desc: "weekday_full",
                      example: "Wednesday",
                    },
                    { var: "$DDD", desc: "weekday_short", example: "Wed" },
                  ].map((item) => (
                    <Button
                      key={item.var}
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                      onClick={() => onInsert(item.var)}
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                          {item.var}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}`
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}_desc`
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 日期 */}
              <div>
                <div className="text-sm font-semibold mb-2 text-(--text-main)">
                  {t("tools.batch_renamer.variable_picker.day")}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { var: "$DD", desc: "day_padded", example: "25" },
                    { var: "$D", desc: "day_number", example: "25" },
                  ].map((item) => (
                    <Button
                      key={item.var}
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                      onClick={() => onInsert(item.var)}
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                          {item.var}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}`
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}_desc`
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 时间 */}
              <div>
                <div className="text-sm font-semibold mb-2 text-(--text-main)">
                  {t("tools.batch_renamer.variable_picker.time")}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { var: "$hh", desc: "hour_padded", example: "09" },
                    { var: "$mm", desc: "minute_padded", example: "05" },
                    { var: "$ss", desc: "second_padded", example: "03" },
                    { var: "$h", desc: "hour_number", example: "9" },
                    { var: "$m", desc: "minute_number", example: "5" },
                    { var: "$s", desc: "second_number", example: "3" },
                  ].map((item) => (
                    <Button
                      key={item.var}
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                      onClick={() => onInsert(item.var)}
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                          {item.var}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}`
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}_desc`
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 毫秒 */}
              <div>
                <div className="text-sm font-semibold mb-2 text-(--text-main)">
                  {t("tools.batch_renamer.variable_picker.millisecond")}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { var: "$fff", desc: "ms_three", example: "123" },
                    { var: "$ff", desc: "ms_two", example: "12" },
                    { var: "$f", desc: "ms_one", example: "1" },
                  ].map((item) => (
                    <Button
                      key={item.var}
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                      onClick={() => onInsert(item.var)}
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                          {item.var}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}`
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}_desc`
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 常用组合 */}
              <div>
                <div className="text-sm font-semibold mb-2 text-(--text-main)">
                  {t(
                    "tools.batch_renamer.variable_picker.common_combinations"
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      var: "$YYYY$MM$DD",
                      desc: "date_basic",
                      example: "20241225",
                    },
                    {
                      var: "$YYYY-$MM-$DD",
                      desc: "date_dashed",
                      example: "2024-12-25",
                    },
                    {
                      var: "$YYYY$MM$DD_$hh$mm$ss",
                      desc: "datetime_full",
                      example: "20241225_143022",
                    },
                  ].map((item) => (
                    <Button
                      key={item.var}
                      variant="text"
                      size="small"
                      className="px-4 py-4 rounded-xl border border-(--border-color) hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left group h-auto block"
                      onClick={() => onInsert(item.var)}
                    >
                      <div className="flex items-start gap-3">
                        <code className="text-sm font-mono text-orange-600 font-bold whitespace-nowrap">
                          {item.var}
                        </code>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-(--text-main) font-medium mb-1">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}`
                            )}
                          </div>
                          <div className="text-[10px] text-(--text-muted) leading-relaxed opacity-80">
                            {t(
                              `tools.batch_renamer.variable_picker.${item.desc}_desc`
                            )}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-(--text-muted) group-hover:text-orange-500 flex-shrink-0" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-black/2 dark:bg-white/2 flex justify-end border-t border-(--border-color)">
          <Button
            variant="text"
            size="small"
            className="px-4 py-2 bg-(--bg-main) border border-(--border-color) rounded-xl text-sm font-medium hover:bg-(--border-color) transition-colors h-auto"
            onClick={onClose}
          >
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

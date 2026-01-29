/**
 * RegexHelpModal - 正则表达式帮助弹窗
 * 提供正则表达式语法参考和示例
 */

import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Info, Copy } from "lucide-react";
import { Button } from "../../../components/mui";
import { toast } from "react-hot-toast";

interface RegexHelpModalProps {
  open: boolean;
  onClose: () => void;
  onSelectPattern: (pattern: string) => void;
}

export const RegexHelpModal: React.FC<RegexHelpModalProps> = ({
  open,
  onClose,
  onSelectPattern,
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  const handleCopyPattern = (pattern: string) => {
    navigator.clipboard?.writeText(pattern);
    onSelectPattern(pattern);
    toast.success(t("tools.batch_renamer.regex_help.copy.copied"));
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-1100"
      onClick={onClose}
    >
      <div
        className="bg-(--card-bg) rounded-2xl w-190 max-w-[95vw] shadow-2xl border border-(--border-color) overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Info className="text-blue-500" />
            <h3 className="text-lg font-bold text-(--text-main)">
              {t("tools.batch_renamer.regex_help.title")}
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

        {/* 内容区域 */}
        <div className="px-6 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 基础语法表格 */}
          <div>
            <div className="text-sm font-semibold mb-2">
              {t("tools.batch_renamer.regex_help.basic.title")}
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-(--text-muted) text-xs">
                    <th className="px-3 py-2 text-left">
                      {t("tools.batch_renamer.regex_help.basic.col_pattern")}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t("tools.batch_renamer.regex_help.basic.col_desc")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border-color)">
                  {[
                    { pattern: "^", i18nKey: "anchor_start" },
                    { pattern: "$", i18nKey: "anchor_end" },
                    { pattern: ".*", i18nKey: "any_text" },
                    { pattern: "^test", i18nKey: "example_start_test" },
                    { pattern: "bar$", i18nKey: "example_end_bar" },
                    { pattern: "^test.*bar$", i18nKey: "example_test_bar" },
                    { pattern: ".+?(?=bar)", i18nKey: "example_until_bar" },
                    {
                      pattern: "first[\\s\\S]*end",
                      i18nKey: "example_between",
                    },
                  ].map(({ pattern, i18nKey }) => (
                    <tr key={pattern}>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>{pattern}</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern",
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => handleCopyPattern(pattern)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        {t(`tools.batch_renamer.regex_help.basic.${i18nKey}`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 变量替换表格 */}
          <div>
            <div className="text-sm font-semibold mb-2">
              {t("tools.batch_renamer.regex_help.variables.title")}
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-(--text-muted) text-xs">
                    <th className="px-3 py-2 text-left">
                      {t("tools.batch_renamer.regex_help.variables.col_search")}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t(
                        "tools.batch_renamer.regex_help.variables.col_replace",
                      )}
                    </th>
                    <th className="px-3 py-2 text-left">
                      {t("tools.batch_renamer.regex_help.variables.col_desc")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border-color)">
                  {[
                    {
                      pattern: "(.*).png",
                      replace: "test_${1}.png",
                      i18nKey: "add_prefix",
                    },
                    {
                      pattern: "(.*).png",
                      replace: "${1}_test.png",
                      i18nKey: "add_suffix",
                    },
                    {
                      pattern: "(.*)",
                      replace: "${1}.txt",
                      i18nKey: "append_ext",
                    },
                    {
                      pattern: "(^\\w+\\.$)\\|(^\\w+$)",
                      replace: "${2}.txt",
                      i18nKey: "cond_append",
                    },
                    {
                      pattern: "(\\d\\d)-(\\d\\d)-(\\d\\d\\d\\d)",
                      replace: "${3}-${2}-${1}",
                      i18nKey: "reorder_date",
                    },
                    {
                      pattern: "^(.{n})(.*) 或 (.*)(.{n})$",
                      replace: "${1}test${2}",
                      i18nKey: "insert_at_n",
                    },
                  ].map(({ pattern, replace, i18nKey }, idx) => (
                    <tr key={`${pattern}-${idx}`}>
                      <td className="px-3 py-2 flex items-center justify-between">
                        <span>{pattern}</span>
                        <Button
                          variant="text"
                          size="small"
                          title={t(
                            "tools.batch_renamer.regex_help.copy.copy_pattern",
                          )}
                          className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                          onClick={() => handleCopyPattern(pattern)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-3 py-2">
                        <span>{replace}</span>
                      </td>
                      <td className="px-3 py-2">
                        {t(
                          `tools.batch_renamer.regex_help.variables.${i18nKey}`,
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-3 py-2 flex items-center justify-between">
                      <span>{"^.{n} 或 .{n}$"}</span>
                      <Button
                        variant="text"
                        size="small"
                        title={t(
                          "tools.batch_renamer.regex_help.copy.copy_pattern",
                        )}
                        className="ml-2 p-1 rounded text-(--text-muted) hover:text-blue-500 hover:bg-blue-500/5 h-auto"
                        onClick={() => handleCopyPattern("^.{n} 或 .{n}$")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </td>
                    <td className="px-3 py-2">
                      {t("tools.batch_renamer.regex_help.variables.no_replace")}
                    </td>
                    <td className="px-3 py-2">
                      {t("tools.batch_renamer.regex_help.variables.truncate")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-black/2 dark:bg-white/2 flex justify-end gap-3 border-t border-(--border-color)">
          <Button variant="text" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

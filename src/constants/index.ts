/**
 * 全局常量定义
 * 集中管理硬编码字符串和魔法数字，提升代码可维护性
 */

// ========== 分类标识符 ==========
export const CATEGORY = {
  ALL: "all",
  FAVORITES: "favorites",
} as const;

export type CategoryType = (typeof CATEGORY)[keyof typeof CATEGORY] | string;

// ========== 时间相关常量 (毫秒) ==========
export const TIMING = {
  /** JSON 格式化防抖延迟 */
  DEBOUNCE_MS: 300,
  /** 命令超时时间 */
  COMMAND_TIMEOUT_MS: 30000,
} as const;

// ========== UI 相关常量 ==========
export const UI = {
  /** JSON 树默认展开深度 */
  JSON_TREE_DEFAULT_DEPTH: 2,
  /** 触发错误提示的最小输入长度 */
  MIN_INPUT_LENGTH_FOR_ERROR: 10,
  /** Toast 显示时长 */
  TOAST_DURATION_MS: 3000,
} as const;


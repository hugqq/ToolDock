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
  /** 进程列表刷新延迟 */
  REFRESH_DELAY_MS: 500,
  /** 默认自动刷新间隔 */
  DEFAULT_REFRESH_INTERVAL_MS: 60000,
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

// ========== 刷新间隔选项 ==========
export const REFRESH_INTERVALS = [
  { value: 10000, labelKey: "tools.process_manager.refresh_10s" },
  { value: 30000, labelKey: "tools.process_manager.refresh_30s" },
  { value: 60000, labelKey: "tools.process_manager.refresh_60s" },
  { value: 0, labelKey: "tools.process_manager.refresh_off" },
] as const;

// ========== 协议过滤选项 ==========
export const PROTOCOL_FILTERS = ["ALL", "TCP", "UDP"] as const;
export type ProtocolFilter = (typeof PROTOCOL_FILTERS)[number];

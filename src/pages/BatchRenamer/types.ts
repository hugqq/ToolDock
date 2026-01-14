/**
 * BatchRenamer 类型定义
 * 包含重命名规则、预览和历史记录的接口定义
 */

export interface RenameRule {
  prefix: string;
  suffix: string;
  search: string;
  replace: string;
  use_regex: boolean;
  case_sensitive: boolean;
  auto_increment: boolean;
  sequence_start: number;
  sequence_step: number;
  sequence_padding: number;
  // 高级选项
  apply_to: "both" | "name_only" | "extension_only";
  include_files: boolean;
  include_folders: boolean;
  include_subfolders: boolean;
  text_formatting:
    | "none"
    | "lowercase"
    | "uppercase"
    | "titlecase"
    | "capitalize";
  enumerate_items: boolean;
  random_string: boolean;
  use_datetime: boolean;
}

export interface RenamePreview {
  old_path: string;
  new_name: string;
}

export interface RenameHistoryItem {
  current_path: string;
  original_name: string;
  timestamp: number;
}

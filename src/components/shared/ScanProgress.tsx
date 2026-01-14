/**
 * 通用扫描进度条组件
 * 用于显示长耗时任务的实时进度，包括百分比、文件计数和当前文件名
 */
import React from "react";
import { Loader2 } from "lucide-react";
import { LinearProgress, Box, Typography } from "../mui";

export interface ScanProgressData {
  scanned_files: number;
  total_files: number;
  percentage: number;
  current_file: string;
}

export interface ScanProgressProps {
  /**
   * 进度数据
   */
  progress: ScanProgressData | null;

  /**
   * 是否正在加载（控制显示隐藏）
   */
  loading: boolean;

  /**
   * 主标题文本
   */
  title: string;

  /**
   * 进度详情描述函数，允许自定义文件名显示逻辑
   * @param scanned 已扫描文件数
   * @param currentFile 当前文件路径
   * @returns 描述文本
   */
  descriptionFormatter?: (scanned: number, currentFile: string) => string;

  /**
   * 自定义样式类名
   */
  className?: string;
}

export const ScanProgress: React.FC<ScanProgressProps> = ({
  progress,
  loading,
  title,
  descriptionFormatter,
  className = "",
}) => {
  // 如果不加载或没有进度数据，不显示
  if (!loading || !progress) {
    return null;
  }

  const displayPercentage = Math.min(progress.percentage, 100);
  const isIndeterminate = progress.total_files === 0;

  return (
    <div
      className={`p-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          {/* 标题区 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
            <div>
              <Typography
                variant="subtitle1"
                className="font-bold text-[var(--text-main)]"
              >
                {title}
              </Typography>
              <Typography
                variant="caption"
                className="text-[var(--text-muted)] transition-all duration-200"
              >
                {isIndeterminate
                  ? `已扫描 ${progress.scanned_files} 项...`
                  : `${progress.scanned_files} / ${progress.total_files} 项`}
              </Typography>
            </div>
          </div>

          {/* 描述区 - 显示当前文件的层级路径 */}
          <div className="min-h-[2.5rem] pl-[52px] overflow-hidden">
            <Typography
              variant="body2"
              className="text-[var(--text-main)] font-medium block break-all leading-relaxed transition-opacity duration-300 ease-in-out"
              title={
                descriptionFormatter
                  ? descriptionFormatter(
                      progress.scanned_files,
                      progress.current_file
                    )
                  : progress.current_file
              }
            >
              {descriptionFormatter
                ? descriptionFormatter(
                    progress.scanned_files,
                    progress.current_file
                  )
                : progress.current_file}
            </Typography>
          </div>
        </div>

        {/* 百分比显示 - 只在确定进度时显示 */}
        {!isIndeterminate && (
          <div className="text-right ml-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Typography
                variant="h6"
                className="font-bold text-primary transition-transform duration-200 ease-out"
              >
                {Math.round(displayPercentage)}%
              </Typography>
            </div>
          </div>
        )}
      </div>

      {/* 进度条 */}
      <Box sx={{ width: "100%" }}>
        <LinearProgress
          variant={isIndeterminate ? "indeterminate" : "determinate"}
          value={isIndeterminate ? undefined : displayPercentage}
          sx={{
            height: 10,
            borderRadius: 5,
            backgroundColor: "var(--bg-main)",
            "& .MuiLinearProgress-bar": {
              borderRadius: 5,
              backgroundColor: "var(--primary-color)",
              boxShadow: "0 0 10px rgba(59, 130, 246, 0.5)",
            },
          }}
        />
      </Box>
    </div>
  );
};

export default ScanProgress;

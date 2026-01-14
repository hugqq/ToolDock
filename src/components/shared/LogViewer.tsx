/**
 * LogViewer 组件
 * 用于实时显示任务执行日志，支持自动滚动和清空。
 */
import React, { useEffect, useRef } from "react";
import { Terminal, Trash2 } from "lucide-react";
import { Box, IconButton, Typography } from "@mui/material";

interface LogViewerProps {
  logs: string[];
  onClear?: () => void;
  title?: string;
  maxHeight?: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  logs,
  onClear,
  title = "执行日志",
  maxHeight = "300px",
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // 过滤 ANSI 转义字符（如 [36m 等颜色代码）
  const stripAnsi = (str: string) => {
    return str.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      ""
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
        boxShadow: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1,
          bgcolor: "action.hover",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Terminal size={14} color="var(--mui-palette-primary-main)" />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "text.secondary",
            }}
          >
            {title}
          </Typography>
        </Box>
        {onClear && (
          <IconButton
            onClick={onClear}
            size="small"
            title="清空日志"
            sx={{ color: "text.secondary" }}
          >
            <Trash2 size={14} />
          </IconButton>
        )}
      </Box>
      <Box
        ref={scrollRef}
        sx={{
          p: 2,
          maxHeight,
          overflowY: "auto",
          fontFamily: "monospace",
          fontSize: "0.875rem",
          bgcolor: "background.paper",
          color: "text.primary",
          "& .log-line": {
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            mb: 0.5,
            lineHeight: 1.6,
          },
          "& .log-index": {
            color: "text.disabled",
            mr: 1,
            userSelect: "none",
          },
        }}
      >
        {logs.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: "text.disabled", fontStyle: "italic" }}
          >
            等待任务启动...
          </Typography>
        ) : (
          logs.map((log, index) => (
            <Box key={index} className="log-line">
              <Box component="span" className="log-index">
                [{index + 1}]
              </Box>
              {stripAnsi(log)}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

/**
 * TabLayout 组件 - 带标签页和使用说明的通用布局
 *
 * 用途：为工具页面提供统一的标签页导航和使用说明展示
 *
 * 属性说明：
 * - tabs: TabItem[] 标签页配置数组
 * - instructions?: Step[] 使用说明步骤数组（可选）
 * - instructionsTitle?: string 使用说明标题（可选）
 * - instructionsColor?: 'blue'|'green'|'purple'|'orange'|'red' 使用说明颜色（可选）
 * - activeTab: number 当前激活的标签页索引
 * - onTabChange: (index: number) => void 标签页切换回调
 *
 * 使用示例：
 * ```tsx
 * <TabLayout
 *   tabs={[
 *     { label: "依赖管理", icon: <BoxIcon />, content: <DepsContent /> },
 *     { label: "版本管理", icon: <Cpu />, content: <NvmContent /> },
 *   ]}
 *   instructions={[
 *     { title: "步骤1", description: "描述内容" },
 *   ]}
 *   instructionsTitle="使用说明"
 *   instructionsColor="blue"
 *   activeTab={0}
 *   onTabChange={(index) => setActiveTab(index)}
 * />
 * ```
 */

import React, { ReactNode } from "react";
import { Box, Stack, Paper, Tabs, Tab } from "@mui/material";
import { InstructionsCard } from "../shared/InstructionsCard";
import { Lightbulb } from "lucide-react";

interface Step {
  title: string;
  description: string;
}

interface TabItem {
  label: string;
  icon: ReactNode;
  content: ReactNode;
  instructions?: Step[];
  instructionsTitle?: string;
  instructionsColor?: "blue" | "green" | "purple" | "orange" | "red";
}

interface TabLayoutProps {
  tabs: TabItem[];
  activeTab: number;
  onTabChange: (index: number) => void;
  showInstructions?: boolean;
  maxInstructionsHeight?: number;
}

export const TabLayout: React.FC<TabLayoutProps> = ({
  tabs,
  activeTab,
  onTabChange,
  showInstructions = true,
  maxInstructionsHeight = 180,
}) => {
  const currentTab = tabs[activeTab];
  const hasInstructions =
    showInstructions &&
    currentTab?.instructions &&
    currentTab.instructions.length > 0;

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={4} sx={{ mx: "auto" }}>
        {/* 使用说明卡片 */}
        {hasInstructions && (
          <Box
            sx={{
              maxHeight: maxInstructionsHeight,
              overflowY: "auto",
              overflowX: "hidden",
              "&::-webkit-scrollbar": {
                width: "6px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "var(--border-color)",
                borderRadius: "3px",
                "&:hover": {
                  background: "var(--text-muted)",
                },
              },
            }}
          >
            <InstructionsCard
              title={currentTab.instructionsTitle || "使用说明"}
              color={currentTab.instructionsColor || "blue"}
              icon={Lightbulb}
              steps={currentTab.instructions!}
            />
          </Box>
        )}

        {/* Tabs 卡片 */}
        <Paper
          sx={{
            borderRadius: 1,
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => onTabChange(v)}
            variant="fullWidth"
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            {tabs.map((tab, index) => (
              <Tab
                key={index}
                icon={
                  typeof tab.icon === "string"
                    ? undefined
                    : (tab.icon as React.ReactElement)
                }
                label={tab.label}
                iconPosition="start"
              />
            ))}
          </Tabs>

          <Box sx={{ p: 4, bgcolor: "background.paper" }}>
            {tabs[activeTab]?.content}
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
};

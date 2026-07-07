/**
 * InstructionsCard 组件 - 使用说明卡片
 *
 * 用途：展示分步骤的使用说明或操作指南
 *
 * 属性说明：
 * - title: 卡片标题（必填）
 * - steps: Step[] 数组，每个Step包含 title（步骤标题）和 description（步骤描述）（必填）
 * - color?: 兼容旧调用，使用说明统一显示为蓝色
 * - icon?: 自定义图标组件，来自lucide-react（默认Info图标）
 *
 * 使用示例：
 * ```tsx
 * <InstructionsCard
 *   title="使用步骤"
 *   color="blue"
 *   icon={Settings}
 *   steps={[
 *     { title: "步骤1", description: "描述内容" },
 *     { title: "步骤2", description: "描述内容" }
 *   ]}
 * />
 * ```
 */

import React from "react";
import { Info, LucideIcon } from "lucide-react";

interface Step {
  title: string;
  description: string;
}

interface InstructionsCardProps {
  title: string;
  steps: Step[];
  color?: "blue" | "green" | "purple" | "orange" | "red";
  icon?: LucideIcon;
  columns?: 1 | 2 | 3 | 4;
}

const instructionColors = {
  border: "border-blue-500/20",
  bg: "bg-blue-500/5",
  iconText: "text-blue-600",
  titleText: "text-blue-700",
  descText: "text-blue-600/80",
};

export const InstructionsCard: React.FC<InstructionsCardProps> = ({
  title,
  steps,
  icon: Icon = Info,
  columns = 4,
}) => {
  const colors = instructionColors;

  const gridColsClass = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
  }[columns];

  return (
    <div className={`p-6 rounded-2xl border ${colors.border} ${colors.bg}`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${colors.iconText}`} />
        <div className={`text-lg font-bold ${colors.titleText}`}>{title}</div>
      </div>
      <div className={`grid grid-cols-1 md:grid-cols-2 ${gridColsClass} gap-4`}>
        {steps.map((step, index) => (
          <div key={index} className="space-y-2">
            <div className={`text-sm font-semibold ${colors.titleText}`}>
              {step.title}
            </div>
            <div className={`text-xs ${colors.descText} leading-relaxed`}>
              {step.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

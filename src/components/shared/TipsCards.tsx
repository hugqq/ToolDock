import React from "react";
import { LucideIcon } from "lucide-react";

interface Tip {
  icon: LucideIcon;
  title: string;
  description: string | React.ReactNode;
  color: "blue" | "green" | "purple" | "orange" | "amber" | "emerald" | "red";
}

interface TipsCardsProps {
  tips: Tip[];
}

const colorClasses = {
  blue: {
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    iconText: "text-blue-500",
    titleText: "text-blue-600",
    descText: "text-blue-500/80",
  },
  green: {
    border: "border-green-500/20",
    bg: "bg-green-500/5",
    iconText: "text-green-500",
    titleText: "text-green-600",
    descText: "text-green-500/80",
  },
  purple: {
    border: "border-purple-500/20",
    bg: "bg-purple-500/5",
    iconText: "text-purple-500",
    titleText: "text-purple-600",
    descText: "text-purple-500/80",
  },
  orange: {
    border: "border-orange-500/20",
    bg: "bg-orange-500/5",
    iconText: "text-orange-500",
    titleText: "text-orange-600",
    descText: "text-orange-500/80",
  },
  amber: {
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    iconText: "text-amber-500",
    titleText: "text-amber-600",
    descText: "text-amber-500/80",
  },
  emerald: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    iconText: "text-emerald-500",
    titleText: "text-emerald-600",
    descText: "text-emerald-500/80",
  },
  red: {
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    iconText: "text-red-500",
    titleText: "text-red-600",
    descText: "text-red-500/80",
  },
};

export const TipsCards: React.FC<TipsCardsProps> = ({ tips }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {tips.map((tip, index) => {
        const colors = colorClasses[tip.color];
        const Icon = tip.icon;

        return (
          <div
            key={index}
            className={`p-4 rounded-2xl border ${colors.border} ${colors.bg} flex items-start gap-3`}
          >
            <Icon className={`w-5 h-5 ${colors.iconText} shrink-0 mt-0.5`} />
            <div>
              <div className={`text-sm font-bold ${colors.titleText} mb-1`}>
                {tip.title}
              </div>
              <div className={`text-xs ${colors.descText} leading-relaxed`}>
                {tip.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

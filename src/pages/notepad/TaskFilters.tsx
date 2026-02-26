import React from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { TaskType } from "../../types/notepad";

interface TaskFiltersProps {
  activeTab: TaskType;
  onChangeTab: (tab: TaskType) => void;
  onAddTask: () => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  activeTab,
  onChangeTab,
  onAddTask,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between border-b border-(--border-color) pr-4">
      <div className="flex">
        {[
          TaskType.TodayPlan,
          TaskType.ShortTerm,
          TaskType.LongTerm,
        ].map((type) => (
          <button
            key={type}
            onClick={() => onChangeTab(type)}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === type
                ? "bg-(--bg-secondary) text-(--primary-color) border-b-2 border-(--primary-color)"
                : "text-(--text-secondary) hover:text-(--text-main) hover:bg-(--bg-hover)"
            }`}
          >
            {type === TaskType.TodayPlan && t("tools.notepad.today_plan")}
            {type === TaskType.ShortTerm && t("tools.notepad.short_term")}
            {type === TaskType.LongTerm && t("tools.notepad.long_term")}
          </button>
        ))}
      </div>
      {activeTab !== TaskType.TodayPlan && (
        <button
          onClick={onAddTask}
          className="flex items-center gap-2 px-3 py-1.5 bg-(--primary-color) text-white rounded-lg hover:bg-(--primary-hover) active:scale-95 transition-all text-sm font-medium"
        >
          <Plus size={16} />
          {t("tools.notepad.add_plan")}
        </button>
      )}
    </div>
  );
};

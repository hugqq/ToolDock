import React from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Circle,
  Clock,
  Bell,
  Eye,
  Edit2,
  Trash2,
  Flame,
  ClipboardList,
  Clock3,
  Calendar,
} from "lucide-react";
import { Task, TaskType } from "../../types/notepad";

interface TaskCardProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onPreview: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onToggle,
  onDelete,
  onEdit,
  onPreview,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className="group flex flex-col gap-2 p-4 rounded-xl bg-(--bg-secondary) border border-(--border-color) hover:border-(--primary-color) transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggle(task.id)}
            className={`mt-1 transition-colors ${
              task.isCompleted
                ? "text-(--primary-color)"
                : "text-(--text-secondary) hover:text-(--primary-color)"
            }`}
          >
            {task.isCompleted ? (
              <CheckCircle2 size={22} />
            ) : (
              <Circle size={22} />
            )}
          </button>
          <div
            className={`${
              task.isCompleted ? "opacity-50 line-through" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-(--text-main) text-lg line-clamp-1">
                {task.title || (task.content && task.content.length > 50 ? task.content.slice(0, 50) + '...' : task.content) || t("tools.notepad.untitled")}
              </h4>
              {task.tags && task.tags.length > 0 && (
                <div className="flex gap-1">
                  {task.tags.includes("important") && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                      <Flame size={12} />{" "}
                      {t("tools.notepad.tag_important")}
                    </span>
                  )}
                  {task.tags.includes("planned") && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                      <ClipboardList size={12} />{" "}
                      {t("tools.notepad.tag_planned")}
                    </span>
                  )}
                  {task.tags.includes("delayed") && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                      <Clock3 size={12} />{" "}
                      {t("tools.notepad.tag_delayed")}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="text-sm text-(--text-secondary) flex items-center gap-4 mt-1">
              {task.taskType === TaskType.ShortTerm && (
                 <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {task.startTime
                        ? new Date(task.startTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--"}
                      {" - "}
                      {task.endTime
                        ? new Date(task.endTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--"}
                    </span>
              )}
               {task.taskType === TaskType.LongTerm && (
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {t(`tools.notepad.recurrence.${task.recurrencePattern}`)}
                    {task.recurrenceFixedDate &&
                      ` (${new Date(task.recurrenceFixedDate).toLocaleDateString()})`}
                  </span>
                )}
              {task.reminderTime && (
                <span className="flex items-center gap-1 text-amber-500">
                  <Bell size={14} />
                  {new Date(task.reminderTime).toLocaleString([], {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {(task.content || (task.images && task.images.length > 0)) && (
            <button
              onClick={() => onPreview(task)}
              className="p-2 hover:bg-(--bg-hover) rounded-full text-(--text-secondary)"
              title={t("common.view") || "View"}
            >
              <Eye size={16} />
            </button>
          )}
          <button
            onClick={() => onEdit(task)}
            className="p-2 hover:bg-(--bg-hover) rounded-full text-(--text-secondary)"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full text-(--text-secondary)"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

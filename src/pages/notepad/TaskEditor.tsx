import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  ImageIcon,
  Bell,
  Flame,
  ClipboardList,
  Clock3,
} from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import toast from "react-hot-toast";
import { Task, TaskType, RecurrenceType } from "../../types/notepad";

interface TaskEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => Promise<void>;
  initialTask: Partial<Task>;
  activeTab: TaskType;
}

export const TaskEditor: React.FC<TaskEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTask,
  activeTab,
}) => {
  const { t } = useTranslation();
  const [currentTask, setCurrentTask] = useState<Partial<Task>>(initialTask);
  const isEditing = !!currentTask.id;

  useEffect(() => {
    setCurrentTask(initialTask);
  }, [initialTask]);

  const toLocalISOString = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 16);
  };

  const toLocalDateString = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 10);
  };

  const fromLocalISOString = (value: string) => {
    if (!value) return undefined;
    return new Date(value).getTime();
  };

  const handleImageUpload = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif"] }],
      });

      if (selected && typeof selected === "string") {
        const contents = await readFile(selected);
        const fileName = `img_${Date.now()}.png`;
        const response = await invoke<{
          ok: boolean;
          data?: string;
          error?: any;
        }>("save_notepad_image", {
          fileName,
          data: Array.from(contents),
        });

        if (!response.ok || !response.data) {
          toast.error(t("tools.notepad.save_image_error"));
          return;
        }

        setCurrentTask((prev) => ({
          ...prev,
          images: [...(prev?.images || []), response.data!],
        }));
      }
    } catch (e) {
      console.error(e);
      toast.error(t("error"));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-(--card-bg) w-full max-w-2xl rounded-xl border border-(--border-color) shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-(--border-color)">
          <h3 className="text-lg font-semibold text-(--text-main)">
            {isEditing
              ? t("tools.notepad.edit_task")
              : t("tools.notepad.add_task")}
          </h3>
          <button
            onClick={onClose}
            className="text-(--text-secondary) hover:text-(--text-main)"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-(--text-secondary) mb-1">
              {t("tools.notepad.title") || "Title"}
            </label>
            <input
              type="text"
              value={currentTask.title || ""}
              onChange={(e) =>
                setCurrentTask({ ...currentTask, title: e.target.value })
              }
              className="w-full bg-(--bg-main) border border-(--border-color) rounded-lg px-3 py-2 text-(--text-main) focus:ring-2 focus:ring-(--primary-color) focus:outline-hidden"
            />
          </div>

          {/* Type Specific Fields */}
          {activeTab === TaskType.ShortTerm && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                  {t("tools.notepad.start_time") || "Start Time"}
                </label>
                <input
                  type="datetime-local"
                  onChange={(e) =>
                    setCurrentTask({
                      ...currentTask,
                      startTime: fromLocalISOString(e.target.value),
                    })
                  }
                  value={toLocalISOString(currentTask.startTime)}
                  className="w-full bg-(--bg-main) border border-(--border-color) rounded-lg px-3 py-2 text-(--text-main)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                  {t("tools.notepad.end_time") || "End Time"}
                </label>
                <input
                  type="datetime-local"
                  onChange={(e) =>
                    setCurrentTask({
                      ...currentTask,
                      endTime: fromLocalISOString(e.target.value),
                    })
                  }
                  value={toLocalISOString(currentTask.endTime)}
                  className="w-full bg-(--bg-main) border border-(--border-color) rounded-lg px-3 py-2 text-(--text-main)"
                />
              </div>
            </div>
          )}

          {activeTab === TaskType.LongTerm && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                  {t("tools.notepad.recurrence_label") || "Recurrence"}
                </label>
                <select
                  value={currentTask.recurrencePattern}
                  onChange={(e) =>
                    setCurrentTask({
                      ...currentTask,
                      recurrencePattern: e.target.value as RecurrenceType,
                    })
                  }
                  className="w-full bg-(--bg-main) border border-(--border-color) rounded-lg px-3 py-2 text-(--text-main)"
                >
                  <option value={RecurrenceType.None}>
                    {t("tools.notepad.recurrence.None") || "None"}
                  </option>
                  <option value={RecurrenceType.Workdays}>
                    {t("tools.notepad.recurrence.Workdays") ||
                      "Weekdays (Mon-Fri)"}
                  </option>
                  <option value={RecurrenceType.Daily}>
                    {t("tools.notepad.recurrence.Daily") || "Every Day"}
                  </option>
                  <option value={RecurrenceType.FixedDate}>
                    {t("tools.notepad.recurrence.FixedDate") || "Fixed Date"}
                  </option>
                  <option value={RecurrenceType.CustomRange}>
                    {t("tools.notepad.recurrence.CustomRange") || "Date Range"}
                  </option>
                </select>
              </div>
              {currentTask.recurrencePattern === RecurrenceType.FixedDate && (
                <div>
                  <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                    {t("tools.notepad.date") || "Date"}
                  </label>
                  <input
                    type="date"
                    onChange={(e) =>
                      setCurrentTask({
                        ...currentTask,
                        recurrenceFixedDate: fromLocalISOString(e.target.value),
                      })
                    }
                    value={toLocalDateString(currentTask.recurrenceFixedDate)}
                    className="w-full bg-(--bg-main) border border-(--border-color) rounded-lg px-3 py-2 text-(--text-main)"
                  />
                </div>
              )}
            </div>
          )}

          {/* Markdown Content */}
          <div>
            <label className="block text-sm font-medium text-(--text-secondary) mb-1">
              {t("tools.notepad.content_md") || "Content (Markdown)"}
            </label>
            <textarea
              className="w-full h-32 bg-(--bg-main) border border-(--border-color) rounded-lg px-3 py-2 text-(--text-main) font-mono text-sm resize-none focus:ring-2 focus:ring-(--primary-color) focus:outline-hidden"
              value={currentTask.content || ""}
              onChange={(e) =>
                setCurrentTask({ ...currentTask, content: e.target.value })
              }
              placeholder="# Support Markdown..."
            />
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-(--text-secondary)">
                {t("tools.notepad.images") || "Images"}
              </label>
              <button
                onClick={handleImageUpload}
                className="text-xs flex items-center gap-1 text-(--primary-color) hover:underline"
              >
                <ImageIcon size={14} /> {t("tools.notepad.upload") || "Upload"}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto py-2">
              {currentTask.images?.map((path, idx) => (
                <div key={idx} className="relative group shrink-0">
                  <img
                    src={convertFileSrc(path)}
                    className="w-20 h-20 object-cover rounded-lg border border-(--border-color)"
                  />
                  <button
                    onClick={() =>
                      setCurrentTask((prev) => ({
                        ...prev,
                        images: prev.images?.filter((_, i) => i !== idx),
                      }))
                    }
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-1/3 -translate-y-1/3"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {(!currentTask.images || currentTask.images.length === 0) && (
                <div className="text-sm text-(--text-secondary) italic">
                  {t("tools.notepad.no_images")}
                </div>
              )}
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-sm font-medium text-(--text-secondary) mb-1">
              {t("tools.notepad.reminder") || "Reminder"}
            </label>
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-(--text-secondary)" />
              <input
                type="datetime-local"
                onChange={(e) =>
                  setCurrentTask({
                    ...currentTask,
                    reminderTime: fromLocalISOString(e.target.value),
                  })
                }
                value={toLocalISOString(currentTask.reminderTime)}
                className="flex-1 bg-(--bg-main) border border-(--border-color) rounded-lg px-3 py-2 text-(--text-main)"
              />
            </div>
          </div>

            {/* Tags */}
            <div>
            <label className="block text-sm font-medium text-(--text-secondary) mb-2">
                {t("tools.notepad.tags") || "标签"}
            </label>
            <div className="flex flex-wrap gap-2">
                {[
                {
                    id: "important",
                    label: t("tools.notepad.tag_important"),
                    icon: Flame,
                    color: "red",
                },
                {
                    id: "planned",
                    label: t("tools.notepad.tag_planned"),
                    icon: ClipboardList,
                    color: "blue",
                },
                {
                    id: "delayed",
                    label: t("tools.notepad.tag_delayed"),
                    icon: Clock3,
                    color: "yellow",
                },
                ].map((tag) => {
                const isSelected = currentTask.tags?.includes(tag.id);
                const IconComponent = tag.icon;
                return (
                    <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                        const currentTags = currentTask.tags || [];
                        const newTags = isSelected
                        ? currentTags.filter((t) => t !== tag.id)
                        : [...currentTags, tag.id];
                        setCurrentTask({ ...currentTask, tags: newTags });
                    }}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all flex items-center gap-1.5 ${
                        isSelected
                        ? tag.color === "red"
                            ? "bg-red-500/20 text-red-400 border-red-500/50"
                            : tag.color === "blue"
                            ? "bg-blue-500/20 text-blue-400 border-blue-500/50"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
                        : "bg-(--bg-main) text-(--text-secondary) border-(--border-color) hover:border-(--primary-color)"
                    }`}
                    >
                    <IconComponent size={14} /> {tag.label}
                    </button>
                );
                })}
            </div>
            </div>

        </div>

        <div className="p-4 border-t border-(--border-color) flex justify-end gap-3 bg-(--bg-secondary)/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-(--text-secondary) hover:bg-(--bg-hover)"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => onSave(currentTask)}
            className="px-4 py-2 rounded-lg bg-(--primary-color) text-white hover:bg-(--primary-hover) shadow-lg shadow-(--primary-color)/20"
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
};

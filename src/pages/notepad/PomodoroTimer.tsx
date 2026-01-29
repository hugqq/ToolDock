import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Timer,
  Settings,
  Target,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  History,
  Bell,
} from "lucide-react";
import { Task, PomodoroSettings, PomodoroSession } from "../../types/notepad";

interface PomodoroTimerProps {
  time: number;
  isRunning: boolean;
  mode: "work" | "break";
  settings: PomodoroSettings;
  sessions: PomodoroSession[];
  tasks: Task[];
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onUpdateSettings: (settings: PomodoroSettings) => void;
  onUpdateFocusedTask: (taskId: string | null, taskTitle?: string) => void;
  onTestSound: () => void;
  notificationPermission: string;
  onTestNotification: () => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  time,
  isRunning,
  mode,
  settings,
  sessions,
  tasks,
  onToggleTimer,
  onResetTimer,
  onUpdateSettings,
  onUpdateFocusedTask,
  onTestSound,
  notificationPermission,
  onTestNotification,
}) => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string>("");

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const todayPomodoroCount = sessions.filter((s) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return s.completedAt >= today.getTime() && s.mode === "work";
  }).length;

  const incompleteTasks = tasks.filter((t) => !t.isCompleted);

  const handleTaskChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setFocusedTaskId(id);
      const task = tasks.find(t => t.id === id);
      onUpdateFocusedTask(id || null, task?.title);
  }

  return (
    <div className="bg-(--bg-main) rounded-xl border border-(--border-color) p-6 flex flex-col items-center justify-center sticky top-0">
      {/* Header with settings toggle */}
      <div className="w-full flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-(--text-main) flex items-center gap-2">
          <Timer size={20} className="text-(--primary-color)" />
          {t("tools.notepad.pomodoro")}
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings
              ? "bg-(--primary-color) text-white"
              : "hover:bg-(--bg-hover) text-(--text-secondary)"
          }`}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="w-full mb-4 p-3 bg-(--bg-secondary) rounded-lg space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-(--text-secondary)">
              {t("tools.notepad.work_duration") || "工作时长"}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="60"
                value={settings.workDuration}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    workDuration: Math.max(
                      1,
                      Math.min(60, parseInt(e.target.value) || 25)
                    ),
                  })
                }
                className="w-16 px-2 py-1 text-center bg-(--bg-main) border border-(--border-color) rounded text-sm text-(--text-main)"
              />
              <span className="text-sm text-(--text-secondary)">
                {t("tools.notepad.minutes") || "分钟"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-(--text-secondary)">
              {t("tools.notepad.break_duration") || "休息时长"}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="30"
                value={settings.breakDuration}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    breakDuration: Math.max(
                      1,
                      Math.min(30, parseInt(e.target.value) || 5)
                    ),
                  })
                }
                className="w-16 px-2 py-1 text-center bg-(--bg-main) border border-(--border-color) rounded text-sm text-(--text-main)"
              />
              <span className="text-sm text-(--text-secondary)">
                {t("tools.notepad.minutes") || "分钟"}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-(--text-secondary)">
              {t("tools.notepad.sound_alert") || "声音提醒"}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    soundEnabled: !settings.soundEnabled,
                  })
                }
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  settings.soundEnabled
                    ? "bg-(--primary-color)"
                    : "bg-(--border-color)"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.soundEnabled ? "left-7" : "left-1"
                  }`}
                />
              </button>
              <button
                onClick={onTestSound}
                className="px-2 py-1 text-xs bg-(--bg-main) border border-(--border-color) rounded hover:bg-(--bg-hover) text-(--text-secondary)"
              >
                <Volume2 size={14} className="inline mr-1" />
                {t("tools.notepad.test_sound") || "测试"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timer Display */}
      <div className="text-5xl font-mono font-bold text-(--text-main) mb-6 tracking-wider">
        {formatTime(time)}
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={onToggleTimer}
          className="p-4 rounded-full bg-(--primary-color) text-white hover:bg-(--primary-hover) active:scale-95 transition-all shadow-lg shadow-(--primary-color)/20"
        >
          {isRunning ? (
            <Pause size={24} fill="currentColor" />
          ) : (
            <Play size={24} fill="currentColor" className="ml-1" />
          )}
        </button>
        <button
          onClick={onResetTimer}
          className="p-4 rounded-full bg-(--bg-secondary) text-(--text-main) hover:bg-(--bg-hover) active:scale-95 transition-all border border-(--border-color)"
        >
          <RotateCcw size={24} />
        </button>
      </div>

      {/* Mode indicator */}
      <div className="text-sm text-(--text-secondary) mb-4">
        {mode === "work"
          ? t("tools.notepad.work_mode")
          : t("tools.notepad.break_mode")}
      </div>

      {/* Stats */}
      <div className="w-full flex justify-around py-3 border-t border-(--border-color)">
        <div className="text-center">
          <div className="text-2xl font-bold text-(--primary-color)">
            {todayPomodoroCount}
          </div>
          <div className="text-xs text-(--text-secondary)">
            {t("tools.notepad.today_count") || "今日完成"}
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-(--text-main)">
            {sessions.filter((s) => s.mode === "work").length}
          </div>
          <div className="text-xs text-(--text-secondary)">
            {t("tools.notepad.total_count") || "累计完成"}
          </div>
        </div>
      </div>

      {/* History */}
      {sessions.length > 0 && (
        <div className="w-full mt-4 pt-4 border-t border-(--border-color)">
          <div className="flex items-center gap-2 text-sm text-(--text-secondary) mb-2">
            <History size={14} />
            <span>{t("tools.notepad.history") || "历史记录"}</span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
            {sessions.slice(0, 5).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between px-2 py-1 bg-(--bg-secondary) rounded text-xs"
              >
                <span className="text-(--text-main) truncate max-w-[120px]">
                  {session.taskTitle || (session.mode === "work" ? "🍅" : "☕")}
                </span>
                <span className="text-(--text-secondary)">
                  {new Date(session.completedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification Permission */}
      <div className="w-full mt-4 pt-4 border-t border-(--border-color)">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-(--text-secondary)">
            通知权限:
          </span>
          <span
            className={`text-xs font-medium ${
              notificationPermission === "granted"
                ? "text-green-500"
                : notificationPermission === "denied"
                ? "text-red-500"
                : "text-yellow-500"
            }`}
          >
            {notificationPermission === "granted"
              ? "✔ 已开启"
              : notificationPermission === "denied"
              ? "✖ 已拒绝"
              : notificationPermission === "error"
              ? "⚠ 错误"
              : "⚠ 未设置"}
          </span>
        </div>
        <button
          onClick={onTestNotification}
          className="w-full px-3 py-2 text-xs bg-(--bg-secondary) text-(--text-main) rounded-lg hover:bg-(--bg-hover) transition-colors border border-(--border-color)"
        >
          <Bell size={14} className="inline mr-1" />
          测试通知
        </button>
      </div>
    </div>
  );
};

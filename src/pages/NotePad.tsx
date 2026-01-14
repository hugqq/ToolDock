// src/pages/NotePad.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import {
  Notebook,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Circle,
  Timer,
  Pause,
  Play,
  RotateCcw,
  Calendar,
  Image as ImageIcon,
  Edit2,
  X,
  Bell,
  Flame,
  ClipboardList,
  Clock3,
  Eye,
  Settings,
  Volume2,
  Target,
  History,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";

// Pomodoro Session Interface
interface PomodoroSession {
  id: string;
  taskId?: string;
  taskTitle?: string;
  completedAt: number;
  duration: number; // in seconds
  mode: "work" | "break";
}

// Pomodoro Settings Interface
interface PomodoroSettings {
  workDuration: number; // in minutes
  breakDuration: number; // in minutes
  soundEnabled: boolean;
}

enum TaskType {
  TodayPlan = "todayPlan",
  ShortTerm = "shortTerm",
  LongTerm = "longTerm",
  Memo = "memo",
}

enum RecurrenceType {
  None = "none",
  Daily = "daily",
  Workdays = "workdays",
  CustomRange = "customRange",
  FixedDate = "fixedDate",
}

interface Task {
  id: string;
  title: string;
  content: string;
  taskType: TaskType;
  createdAt: number;

  // Short Term
  startTime?: number;
  endTime?: number;

  // Long Term
  recurrencePattern?: RecurrenceType;
  recurrenceStart?: number;
  recurrenceEnd?: number;
  recurrenceFixedDate?: number;

  // Common
  reminderTime?: number;
  isCompleted: boolean;
  images: string[];
  reminderNotified?: boolean;
  tags?: string[];
}

interface NoteData {
  tasks: Task[];
}

export default function NotePad() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<TaskType>(TaskType.TodayPlan);
  const [loading, setLoading] = useState(true);

  // Edit/Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Partial<Task>>({});
  const [isEditing, setIsEditing] = useState(false);

  // Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);

  // Image Viewer State
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Pomodoro
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<"work" | "break">("work");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<string>("default");

  // Pomodoro Enhancements
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettings>({
    workDuration: 25,
    breakDuration: 5,
    soundEnabled: true,
  });
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [showPomodoroSettings, setShowPomodoroSettings] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play beep sound using Web Audio API
  const playBeepSound = useCallback(() => {
    if (!pomodoroSettings.soundEnabled) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Failed to play sound:", e);
    }
  }, [pomodoroSettings.soundEnabled]);

  // Get today's completed pomodoro count
  const todayPomodoroCount = pomodoroSessions.filter((s) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return s.completedAt >= today.getTime() && s.mode === "work";
  }).length;

  // Get focused task
  const focusedTask = focusedTaskId
    ? tasks.find((t) => t.id === focusedTaskId)
    : null;

  useEffect(() => {
    const initData = async () => {
      try {
        const response = await invoke<{
          ok: boolean;
          data?: NoteData;
          error?: any;
        }>("load_notepad_data");

        if (!response.ok || !response.data) {
          toast.error(t("tools.notepad.load_error"));
          setTasks([]);
          setLoading(false);
          return;
        }

        const data = response.data;

        if (data && data.tasks) {
          setTasks(data.tasks);
        } else {
          setTasks([]);
        }
      } catch (e) {
        toast.error(t("tools.notepad.load_error"));
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    initData();
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
        setNotificationPermission(permission);
      } else {
        setNotificationPermission("granted");
      }
    } catch (error) {
      setNotificationPermission("error");
    }
  };

  // 移除自动保存，改为在每个操作中显式保存，避免竞态条件
  // useEffect(() => {
  //   if (isInitialMount.current) {
  //     isInitialMount.current = false;
  //     return;
  //   }
  //   if (!loading) {
  //     saveData();
  //   }
  // }, [tasks, loading]);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setPomodoroTime((prev) => {
          if (prev <= 0) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  // Reminder interval - 每10秒检查一次
  useEffect(() => {
    // 等待数据加载完成
    if (loading) return;

    const checkReminders = () => {
      const now = Date.now();
      const updatedTasks: Task[] = [];
      let hasChanges = false;

      tasks.forEach((task) => {
        if (!task.isCompleted && task.reminderTime && !task.reminderNotified) {
          const timeDiff = task.reminderTime - now;
          // 提前2分钟到过去5秒之间都可以触发
          if (timeDiff <= 120000 && timeDiff >= -5000) {
            sendNotification({
              title: t("tools.notepad.name"),
              body: t("tools.notepad.reminder_msg", { title: task.title }),
            });

            // 标记为已通知
            updatedTasks.push({ ...task, reminderNotified: true });
            hasChanges = true;
          } else {
            updatedTasks.push(task);
          }
        } else {
          updatedTasks.push(task);
        }
      });

      if (hasChanges) {
        setTasks(updatedTasks);
        saveTasksData(updatedTasks);
      }
    };

    // 立即检查一次
    checkReminders();

    // 每10秒检查一次
    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, [tasks, t, loading]);

  const handleTimerComplete = () => {
    setIsTimerRunning(false);
    
    // Play sound alert
    playBeepSound();
    
    // Send notification
    sendNotification({
      title: t("tools.notepad.pomodoro"),
      body:
        timerMode === "work"
          ? t("tools.notepad.break_time")
          : t("tools.notepad.start_focus"),
    });
    
    // Record session to history
    const newSession: PomodoroSession = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      taskId: focusedTaskId || undefined,
      taskTitle: focusedTask?.title,
      completedAt: Date.now(),
      duration: timerMode === "work" 
        ? pomodoroSettings.workDuration * 60 
        : pomodoroSettings.breakDuration * 60,
      mode: timerMode,
    };
    setPomodoroSessions((prev) => [newSession, ...prev].slice(0, 50)); // Keep last 50
    
    // Switch mode and set new duration
    if (timerMode === "work") {
      setTimerMode("break");
      setPomodoroTime(pomodoroSettings.breakDuration * 60);
    } else {
      setTimerMode("work");
      setPomodoroTime(pomodoroSettings.workDuration * 60);
    }
    toast.success(t("tools.notepad.pomodoro") + " " + t("common.success"));
  };

  const saveTasksData = async (tasksToSave: Task[]) => {
    try {
      console.log("=== Saving data ===");
      console.log("Tasks to save:", tasksToSave.length, "task(s)");
      const response = await invoke<{ ok: boolean; error?: any }>(
        "save_notepad_data",
        {
          data: { tasks: tasksToSave },
        }
      );

      if (!response.ok) {
        console.error("Save failed:", response.error);
        toast.error(t("tools.notepad.save_error"));
        return;
      }

      console.log("Tasks saved successfully");
    } catch (e) {
      console.error("Failed to save tasks:", e);
      toast.error(t("tools.notepad.save_error"));
    }
  };

  const openAddModal = () => {
    // 今日计划添加的是短期任务
    const taskType =
      activeTab === TaskType.TodayPlan ? TaskType.ShortTerm : activeTab;

    // 如果是今日计划，默认设置今天的日期（每次都创建新的 Date 对象）
    const defaultStartTime =
      activeTab === TaskType.TodayPlan
        ? new Date().setHours(9, 0, 0, 0)
        : undefined;

    setCurrentTask({
      taskType: taskType,
      content: "",
      title: "",
      images: [],
      isCompleted: false,
      startTime: defaultStartTime,
      endTime: undefined,
      reminderTime: undefined,
      recurrencePattern: RecurrenceType.None,
      createdAt: Date.now(),
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setCurrentTask({ ...task });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSaveTask = async () => {
    if (!currentTask.title?.trim()) {
      toast.error(t("common.required"));
      return;
    }

    let newTasks: Task[];

    if (isEditing && currentTask.id) {
      newTasks = tasks.map((t) =>
        t.id === currentTask.id
          ? ({ ...currentTask, id: currentTask.id } as Task)
          : t
      );
    } else {
      const newTask = {
        ...currentTask,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        createdAt: Date.now(),
        images: currentTask.images || [],
        isCompleted: false,
      } as Task;
      newTasks = [...tasks, newTask];
    }

    // 先保存到后端，确保保存成功后再更新UI
    await saveTasksData(newTasks);

    // 保存成功后更新状态
    setTasks(newTasks);

    toast.success(
      isEditing
        ? t("common.save") + " " + t("common.success")
        : t("tools.notepad.add_task") + " " + t("common.success")
    );

    setIsModalOpen(false);
  };

  const deleteTask = async (id: string) => {
    try {
      const newTasks = tasks.filter((t) => t.id !== id);
      await saveTasksData(newTasks);
      setTasks(newTasks);
      toast.success(t("common.delete") + " " + t("common.success"));
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error(t("tools.notepad.delete_error"));
    }
  };

  const testNotification = async () => {
    try {
      await sendNotification({
        title: "测试通知",
        body: "如果你看到这条消息，说明通知功能正常！",
      });
      toast.success("通知已发送");
    } catch (error) {
      console.error("Failed to send test notification:", error);
      toast.error("发送通知失败");
    }
  };

  const toggleTask = async (id: string) => {
    const newTasks = tasks.map((t) =>
      t.id === id
        ? { ...t, isCompleted: !t.isCompleted, reminderNotified: false }
        : t
    );
    await saveTasksData(newTasks);
    setTasks(newTasks);
  };

  const handleImageUpload = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "gif"],
          },
        ],
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };
  const toLocalISOString = (timestamp?: number) => {
    if (!timestamp) return "";
    // 将时间戳转换为当前时区的ISO格式字符串 (YYYY-MM-DDTHH:mm)
    // 技巧：利用 Date 对象在 toISOString 时是 UTC，所以我们先偏移时间戳
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60000; // 分钟转毫秒
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
    // new Date(value) 会默认使用本地时区解析 YYYY-MM-DDTHH:mm
    return new Date(value).getTime();
  };
  const filteredTasks = tasks.filter((t) => {
    if (activeTab === TaskType.TodayPlan) {
      // 今日计划显示今天的短期任务
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      return (
        t.taskType === TaskType.ShortTerm &&
        t.startTime &&
        t.startTime >= today.getTime() &&
        t.startTime < tomorrow.getTime()
      );
    }

    return t.taskType === activeTab;
  });

  return (
    <ToolLayout title={t("tools.notepad.name")}>
      <div className="flex flex-col h-full overflow-hidden pb-4">
        {/* Main Content */}
        <div className="flex flex-col h-full bg-(--card-bg) rounded-xl border border-(--border-color) shadow-sm overflow-hidden">
          {/* Tabs and Add Button */}
          <div className="flex items-center justify-between border-b border-(--border-color) pr-4">
            <div className="flex">
              {[
                TaskType.TodayPlan,
                TaskType.ShortTerm,
                TaskType.LongTerm,
                TaskType.Memo,
              ].map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === type
                      ? "bg-(--bg-secondary) text-(--primary-color) border-b-2 border-(--primary-color)"
                      : "text-(--text-secondary) hover:text-(--text-main) hover:bg-(--bg-hover)"
                  }`}
                >
                  {type === TaskType.TodayPlan && t("tools.notepad.today_plan")}
                  {type === TaskType.ShortTerm && t("tools.notepad.short_term")}
                  {type === TaskType.LongTerm && t("tools.notepad.long_term")}
                  {type === TaskType.Memo && t("tools.notepad.memo")}
                </button>
              ))}
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-3 py-1.5 bg-(--primary-color) text-white rounded-lg hover:bg-(--primary-hover) active:scale-95 transition-all text-sm font-medium"
            >
              <Plus size={16} />
              {t("tools.notepad.add_task")}
            </button>
          </div>

          {/* Today Plan with Pomodoro */}
          {activeTab === TaskType.TodayPlan && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pomodoro Timer */}
                <div className="lg:col-span-1">
                  <div className="bg-(--bg-main) rounded-xl border border-(--border-color) p-6 flex flex-col items-center justify-center sticky top-0">
                    {/* Header with settings toggle */}
                    <div className="w-full flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-(--text-main) flex items-center gap-2">
                        <Timer size={20} className="text-(--primary-color)" />
                        {t("tools.notepad.pomodoro")}
                      </h3>
                      <button
                        onClick={() => setShowPomodoroSettings(!showPomodoroSettings)}
                        className={`p-2 rounded-lg transition-colors ${
                          showPomodoroSettings
                            ? "bg-(--primary-color) text-white"
                            : "hover:bg-(--bg-hover) text-(--text-secondary)"
                        }`}
                      >
                        <Settings size={18} />
                      </button>
                    </div>

                    {/* Settings Panel */}
                    {showPomodoroSettings && (
                      <div className="w-full mb-4 p-3 bg-(--bg-secondary) rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-(--text-secondary)">
                            {t("tools.notepad.work_duration") || "工作时长"}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={pomodoroSettings.workDuration}
                              onChange={(e) =>
                                setPomodoroSettings((prev) => ({
                                  ...prev,
                                  workDuration: Math.max(1, Math.min(60, parseInt(e.target.value) || 25)),
                                }))
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
                              value={pomodoroSettings.breakDuration}
                              onChange={(e) =>
                                setPomodoroSettings((prev) => ({
                                  ...prev,
                                  breakDuration: Math.max(1, Math.min(30, parseInt(e.target.value) || 5)),
                                }))
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
                                setPomodoroSettings((prev) => ({
                                  ...prev,
                                  soundEnabled: !prev.soundEnabled,
                                }))
                              }
                              className={`w-12 h-6 rounded-full transition-colors relative ${
                                pomodoroSettings.soundEnabled
                                  ? "bg-(--primary-color)"
                                  : "bg-(--border-color)"
                              }`}
                            >
                              <div
                                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                  pomodoroSettings.soundEnabled ? "left-7" : "left-1"
                                }`}
                              />
                            </button>
                            <button
                              onClick={playBeepSound}
                              className="px-2 py-1 text-xs bg-(--bg-main) border border-(--border-color) rounded hover:bg-(--bg-hover) text-(--text-secondary)"
                            >
                              <Volume2 size={14} className="inline mr-1" />
                              {t("tools.notepad.test_sound") || "测试"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Task Selector */}
                    <div className="w-full mb-4">
                      <div className="flex items-center gap-2 text-sm text-(--text-secondary) mb-2">
                        <Target size={14} />
                        <span>{t("tools.notepad.focus_task") || "专注任务"}</span>
                      </div>
                      <select
                        value={focusedTaskId || ""}
                        onChange={(e) => setFocusedTaskId(e.target.value || null)}
                        className="w-full px-3 py-2 bg-(--bg-secondary) border border-(--border-color) rounded-lg text-sm text-(--text-main) cursor-pointer"
                      >
                        <option value="">{t("tools.notepad.no_task_selected") || "-- 未选择任务 --"}</option>
                        {filteredTasks.filter((t) => !t.isCompleted).map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Timer Display */}
                    <div className="text-5xl font-mono font-bold text-(--text-main) mb-6 tracking-wider">
                      {formatTime(pomodoroTime)}
                    </div>

                    {/* Controls */}
                    <div className="flex gap-4 mb-4">
                      <button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className="p-4 rounded-full bg-(--primary-color) text-white hover:bg-(--primary-hover) active:scale-95 transition-all shadow-lg shadow-(--primary-color)/20"
                      >
                        {isTimerRunning ? (
                          <Pause size={24} fill="currentColor" />
                        ) : (
                          <Play size={24} fill="currentColor" className="ml-1" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setIsTimerRunning(false);
                          setPomodoroTime(
                            timerMode === "work"
                              ? pomodoroSettings.workDuration * 60
                              : pomodoroSettings.breakDuration * 60
                          );
                        }}
                        className="p-4 rounded-full bg-(--bg-secondary) text-(--text-main) hover:bg-(--bg-hover) active:scale-95 transition-all border border-(--border-color)"
                      >
                        <RotateCcw size={24} />
                      </button>
                    </div>

                    {/* Mode indicator */}
                    <div className="text-sm text-(--text-secondary) mb-4">
                      {timerMode === "work"
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
                          {pomodoroSessions.filter((s) => s.mode === "work").length}
                        </div>
                        <div className="text-xs text-(--text-secondary)">
                          {t("tools.notepad.total_count") || "累计完成"}
                        </div>
                      </div>
                    </div>

                    {/* History */}
                    {pomodoroSessions.length > 0 && (
                      <div className="w-full mt-4 pt-4 border-t border-(--border-color)">
                        <div className="flex items-center gap-2 text-sm text-(--text-secondary) mb-2">
                          <History size={14} />
                          <span>{t("tools.notepad.history") || "历史记录"}</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {pomodoroSessions.slice(0, 5).map((session) => (
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

                    {/* Notification permission */}
                    <div className="mt-4 pt-4 border-t border-(--border-color) w-full">
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
                        onClick={testNotification}
                        className="w-full px-3 py-2 text-xs bg-(--bg-secondary) text-(--text-main) rounded-lg hover:bg-(--bg-hover) transition-colors border border-(--border-color)"
                      >
                        <Bell size={14} className="inline mr-1" />
                        测试通知
                      </button>
                    </div>
                  </div>
                </div>

                {/* Today's Tasks */}
                <div className="lg:col-span-2 space-y-3">
                  <h3 className="text-lg font-semibold text-(--text-main) mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-(--primary-color)" />
                    {t("tools.notepad.today_tasks")}
                  </h3>
                  {filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-(--text-secondary) opacity-50">
                      <Notebook size={48} className="mb-2" />
                      <span>{t("tools.notepad.no_today_tasks")}</span>
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <div
                        key={task.id}
                        className="group flex flex-col gap-2 p-4 rounded-xl bg-(--bg-secondary) border border-(--border-color) hover:border-(--primary-color) transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleTask(task.id)}
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
                                task.isCompleted
                                  ? "opacity-50 line-through"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-(--text-main) text-lg">
                                  {task.title}
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
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {task.startTime
                                    ? new Date(
                                        task.startTime
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "--"}
                                  {" - "}
                                  {task.endTime
                                    ? new Date(task.endTime).toLocaleTimeString(
                                        [],
                                        { hour: "2-digit", minute: "2-digit" }
                                      )
                                    : "--"}
                                </span>
                                {task.reminderTime && (
                                  <span className="flex items-center gap-1 text-amber-500">
                                    <Bell size={14} />
                                    {new Date(
                                      task.reminderTime
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {(task.content ||
                              (task.images && task.images.length > 0)) && (
                              <button
                                onClick={() => {
                                  setPreviewTask(task);
                                  setIsPreviewOpen(true);
                                }}
                                className="p-2 hover:bg-(--bg-hover) rounded-full text-(--text-secondary)"
                                title={t("common.view") || "View"}
                              >
                                <Eye size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(task)}
                              className="p-2 hover:bg-(--bg-hover) rounded-full text-(--text-secondary)"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full text-(--text-secondary)"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Task List for other tabs */}
          {activeTab !== TaskType.TodayPlan && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-(--text-secondary) opacity-50">
                  <Notebook size={48} className="mb-2" />
                  <span>{t("common.no_results")}</span>
                </div>
              )}
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex flex-col gap-2 p-4 rounded-xl bg-(--bg-main) border border-(--border-color) hover:border-(--primary-color) transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleTask(task.id)}
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
                          <h4 className="font-medium text-(--text-main) text-lg">
                            {task.title}
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
                        {/* Task Details Display */}
                        <div className="text-sm text-(--text-secondary) flex items-center gap-4 mt-1">
                          {task.taskType === TaskType.ShortTerm && (
                            <span className="flex items-center gap-1">
                              <Clock size={14} />
                              {task.startTime
                                ? new Date(task.startTime).toLocaleTimeString()
                                : "--"}
                              {" - "}
                              {task.endTime
                                ? new Date(task.endTime).toLocaleTimeString()
                                : "--"}
                            </span>
                          )}
                          {task.taskType === TaskType.LongTerm && (
                            <span className="flex items-center gap-1">
                              <Calendar size={14} />
                              {t(
                                `tools.notepad.recurrence.${task.recurrencePattern}`
                              )}
                              {task.recurrenceFixedDate &&
                                ` (${new Date(
                                  task.recurrenceFixedDate
                                ).toLocaleDateString()})`}
                            </span>
                          )}
                          {task.reminderTime && (
                            <span className="flex items-center gap-1 text-amber-500">
                              <Bell size={14} />
                              {new Date(task.reminderTime).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(task.content ||
                        (task.images && task.images.length > 0)) && (
                        <button
                          onClick={() => {
                            setPreviewTask(task);
                            setIsPreviewOpen(true);
                          }}
                          className="p-2 hover:bg-(--bg-hover) rounded-full text-(--text-secondary)"
                          title={t("common.view") || "View"}
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-2 hover:bg-(--bg-hover) rounded-full text-(--text-secondary)"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-full text-(--text-secondary)"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-(--card-bg) w-full max-w-2xl rounded-xl border border-(--border-color) shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-(--border-color)">
              <h3 className="text-lg font-semibold text-(--text-main)">
                {isEditing
                  ? t("tools.notepad.edit_task")
                  : t("tools.notepad.add_task")}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
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
                  value={currentTask.title}
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
                        {t("tools.notepad.recurrence.FixedDate") ||
                          "Fixed Date"}
                      </option>
                      <option value={RecurrenceType.CustomRange}>
                        {t("tools.notepad.recurrence.CustomRange") ||
                          "Date Range"}
                      </option>
                    </select>
                  </div>
                  {currentTask.recurrencePattern ===
                    RecurrenceType.FixedDate && (
                    <div>
                      <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                        {t("tools.notepad.date") || "Date"}
                      </label>
                      <input
                        type="date"
                        onChange={(e) =>
                          setCurrentTask({
                            ...currentTask,
                            recurrenceFixedDate: fromLocalISOString(
                              e.target.value
                            ),
                          })
                        }
                        value={toLocalDateString(
                          currentTask.recurrenceFixedDate
                        )}
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
                  value={currentTask.content}
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
                    <ImageIcon size={14} />{" "}
                    {t("tools.notepad.upload") || "Upload"}
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
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-(--text-secondary) hover:bg-(--bg-hover)"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSaveTask}
                className="px-4 py-2 rounded-lg bg-(--primary-color) text-white hover:bg-(--primary-hover) shadow-lg shadow-(--primary-color)/20"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Preview Modal */}
      {isPreviewOpen && previewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-(--card-bg) w-full max-w-3xl rounded-xl border border-(--border-color) shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-(--border-color)">
              <h3 className="text-lg font-semibold text-(--text-main)">
                {previewTask.title}
              </h3>
              <button
                onClick={() => {
                  setIsPreviewOpen(false);
                  setPreviewTask(null);
                }}
                className="text-(--text-secondary) hover:text-(--text-main)"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Markdown Content */}
              {previewTask.content && (
                <div className="text-(--text-main) space-y-2">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-2xl font-bold mb-3 mt-4 text-(--text-main)">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-xl font-bold mb-2 mt-3 text-(--text-main)">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-lg font-bold mb-2 mt-2 text-(--text-main)">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-2 text-(--text-main) leading-relaxed">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-2 space-y-1 text-(--text-main)">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-2 space-y-1 text-(--text-main)">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-(--text-main)">{children}</li>
                      ),
                      code: ({ className, children }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-(--bg-secondary) px-1.5 py-0.5 rounded text-sm font-mono text-(--primary-color)">
                            {children}
                          </code>
                        ) : (
                          <code className="block bg-(--bg-secondary) p-3 rounded-lg text-sm font-mono overflow-x-auto text-(--text-main)">
                            {children}
                          </code>
                        );
                      },
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-(--primary-color) pl-4 italic text-(--text-secondary) my-2">
                          {children}
                        </blockquote>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="text-(--primary-color) hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {previewTask.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Images */}
              {previewTask.images && previewTask.images.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-(--text-main)">
                    {t("tools.notepad.images") || "Images"}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {previewTask.images.map((path, idx) => (
                      <div
                        key={idx}
                        className="relative group rounded-lg overflow-hidden border border-(--border-color) cursor-pointer hover:border-(--primary-color) transition-colors"
                        onClick={() => setViewingImage(path)}
                      >
                        <img
                          src={convertFileSrc(path)}
                          alt={`attachment-${idx}`}
                          className="w-16 h-16 object-cover bg-(--bg-main) hover:opacity-90 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!previewTask.content &&
                (!previewTask.images || previewTask.images.length === 0) && (
                  <div className="text-(--text-secondary) italic">
                    {t("common.no_results")}
                  </div>
                )}
            </div>

            <div className="p-4 border-t border-(--border-color) flex justify-end bg-(--bg-secondary)/50">
              <button
                onClick={() => {
                  setIsPreviewOpen(false);
                  setPreviewTask(null);
                }}
                className="px-4 py-2 rounded-lg bg-(--primary-color) text-white hover:bg-(--primary-hover)"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img
              src={convertFileSrc(viewingImage)}
              alt="preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}

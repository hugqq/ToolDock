import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { sendNotification, isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Task, NoteData, TaskType } from "../types/notepad";

export function useNotePadData() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<string>("default");

  // Load data
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
          return;
        }

        if (response.data && response.data.tasks) {
          setTasks(response.data.tasks);
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
  }, [t]);

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

  const saveTasksData = async (tasksToSave: Task[]) => {
    try {
      const response = await invoke<{ ok: boolean; error?: any }>(
        "save_notepad_data",
        {
          data: { tasks: tasksToSave },
        }
      );

      if (!response.ok) {
        console.error("Save failed:", response.error);
        toast.error(t("tools.notepad.save_error"));
        return false;
      }
      return true;
    } catch (e) {
      console.error("Failed to save tasks:", e);
      toast.error(t("tools.notepad.save_error"));
      return false;
    }
  };

  // Reminder Logic
  useEffect(() => {
    if (loading) return;

    const checkReminders = () => {
      const now = Date.now();
      const updatedTasks: Task[] = [];
      let hasChanges = false;

      tasks.forEach((task) => {
        if (!task.isCompleted && task.reminderTime && !task.reminderNotified) {
          const timeDiff = task.reminderTime - now;
          // Trigger if within 2 minutes before or 5 seconds past
          if (timeDiff <= 120000 && timeDiff >= -5000) {
            sendNotification({
              title: t("tools.notepad.name"),
              body: t("tools.notepad.reminder_msg", { title: task.title }),
            });

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

    checkReminders();
    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, [tasks, loading, t]);

  const addTask = async (newTask: Task) => {
    const newTasks = [...tasks, newTask];
    await saveTasksData(newTasks);
    setTasks(newTasks);
  };

  const updateTask = async (updatedTask: Task) => {
    const newTasks = tasks.map((t) =>
      t.id === updatedTask.id ? updatedTask : t
    );
    await saveTasksData(newTasks);
    setTasks(newTasks);
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

  const toggleTask = async (id: string) => {
    const newTasks = tasks.map((t) =>
      t.id === id
        ? { ...t, isCompleted: !t.isCompleted, reminderNotified: false }
        : t
    );
    await saveTasksData(newTasks);
    setTasks(newTasks);
  };

  const filteredTasks = useCallback((activeTab: TaskType) => {
     return tasks.filter((t) => {
        if (activeTab === TaskType.TodayPlan) {
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
  }, [tasks]);

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

  return {
    tasks,
    loading,
    notificationPermission,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    checkNotificationPermission,
    testNotification,
    filteredTasks
  };
}

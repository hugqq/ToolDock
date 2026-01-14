import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

interface TaskProgress {
  taskId: string;
  progress: number;
  message?: string;
  status: "running" | "completed" | "error";
}

/**
 * 长耗时任务进度监听 Hook
 * 自动监听 task://progress 事件
 */
export function useToolTask(taskId: string | null) {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<TaskProgress["status"]>("running");

  useEffect(() => {
    if (!taskId) return;

    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      unlisten = await listen<TaskProgress>("task://progress", (event) => {
        if (event.payload.taskId === taskId) {
          setProgress(event.payload.progress);
          setMessage(event.payload.message || "");
          setStatus(event.payload.status);
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [taskId]);

  return { progress, message, status };
}

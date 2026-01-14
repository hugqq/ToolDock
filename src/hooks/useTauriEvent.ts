import { useEffect, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

/**
 * Tauri 事件监听 Hook
 * 自动处理组件卸载时的清理
 */
export function useTauriEvent(
  eventName: string,
  handler: (event: any) => void
) {
  const handlerRef = useRef(handler);

  // 保持 handler 引用最新
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      unlisten = await listen(eventName, (event) => {
        handlerRef.current(event);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventName]);
}

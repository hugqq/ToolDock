import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * Tauri invoke 封装
 * 提供类型安全的命令调用接口
 */
export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (error) {
    console.error(`Tauri invoke error [${cmd}]:`, error);
    throw error;
  }
}

/**
 * 带超时的 invoke
 */
export async function invokeWithTimeout<T>(
  cmd: string,
  args?: Record<string, unknown>,
  timeout: number = 30000
): Promise<T> {
  return Promise.race([
    invoke<T>(cmd, args),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Command timeout")), timeout)
    ),
  ]);
}

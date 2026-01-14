export type Response<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; details?: unknown };

export async function invokeWrapper<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<Response<T>> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<any>(cmd, args);

    // 如果返回结构符合 ApiResponse
    if (result && typeof result === "object" && "ok" in result) {
      if (result.ok) {
        return { ok: true, data: result.data as T };
      } else {
        return {
          ok: false,
          code: result.error?.code || "API_ERROR",
          message: result.error?.message || "Unknown API error",
          details: result.error,
        };
      }
    }

    // 兼容直接返回数据的情况
    return { ok: true, data: result as T };
  } catch (error: any) {
    // Error details returned in response object
    return {
      ok: false,
      code: error.code || "UNKNOWN_ERROR",
      message: error.message || String(error),
      details: error,
    };
  }
}

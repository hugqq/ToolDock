export type ToolPlatform = "windows" | "macos" | "linux" | "unknown";

export interface PlatformScopedTool {
  supportedPlatforms?: ToolPlatform[];
}

export function getCurrentPlatform(): ToolPlatform {
  const userAgent = globalThis.navigator?.userAgent.toLowerCase() ?? "";
  const platform = globalThis.navigator?.platform.toLowerCase() ?? "";
  const source = `${userAgent} ${platform}`;

  if (source.includes("win")) return "windows";
  if (source.includes("mac")) return "macos";
  if (source.includes("linux")) return "linux";

  return "unknown";
}

export function getVisibleTools<T extends PlatformScopedTool>(
  tools: T[],
  platform: ToolPlatform = getCurrentPlatform()
): T[] {
  return tools.filter(
    (tool) =>
      !tool.supportedPlatforms || tool.supportedPlatforms.includes(platform)
  );
}


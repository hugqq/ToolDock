/**
 * 设置状态管理
 * 职责：持久化存储全局设置，如 API Keys
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TranslatorSettings {
  googleKey: string;
  youdaoKey: string;
  baiduKey: string;
  tencentKey: string;
  volcengineKey: string;
  deeplKey: string;
  deeplxKey: string;
}

export interface AiProviderSettings {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface AiSettings {
  activeProvider: string;
  providers: AiProviderSettings[];
}

interface OcrSettings {
  engine:
    | "windows"
    | "tencent"
    | "tencent_high_precision"
    | "baidu"
    | "baidu_high_precision";
  tencentSecretId: string;
  tencentSecretKey: string;
  tencentRegion: string;
  baiduApiKey: string;
  baiduSecretKey: string;
}

interface OthelloSettings {
  serverUrl: string;
  nickname: string;
}

export type HomeViewMode = "list" | "grouped";

export const DEFAULT_AI_PROVIDERS: AiProviderSettings[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    apiKey: "",
    model: "deepseek-chat",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
  },
];

interface SettingsState {
  translator: TranslatorSettings;
  ai: AiSettings;
  othello: OthelloSettings;
  ocr: OcrSettings;
  runAsAdmin: boolean;
  clipboardEnabled: boolean;
  clipboardPrefix: string;
  clipboardSuffix: string;
  nginxPath: string;
  wechatSystemPrompt: string;
  globalShortcut: string;
  closeBehavior: "minimize" | "exit";
  homeViewMode: HomeViewMode;
  favoriteTools: string[];
  pinnedTools: string[];
  toggleFavorite: (toolId: string) => void;
  togglePin: (toolId: string) => void;
  setHomeViewMode: (mode: HomeViewMode) => void;
  setTranslatorKey: (
    engine:
      | "google"
      | "youdao"
      | "baidu"
      | "tencent"
      | "volcengine"
      | "deepl"
      | "deeplx",
    key: string
  ) => void;
  setAiActiveProvider: (id: string) => void;
  addAiProvider: (provider: AiProviderSettings) => void;
  updateAiProvider: (
    id: string,
    key: keyof AiProviderSettings,
    value: string
  ) => void;
  removeAiProvider: (id: string) => void;
  setAiConfig: (config: AiSettings) => void;
  setOcrEngine: (engine: OcrSettings["engine"]) => void;
  setOcrSetting: (key: keyof OcrSettings, value: string) => void;
  setOcrConfig: (config: OcrSettings) => void;
  setRunAsAdmin: (enabled: boolean) => void;
  setCloseBehavior: (behavior: "minimize" | "exit") => void;
  setClipboardEnabled: (enabled: boolean) => void;
  setClipboardPrefix: (prefix: string) => void;
  setClipboardSuffix: (suffix: string) => void;
  setNginxPath: (path: string) => void;
  setWechatSystemPrompt: (prompt: string) => void;
  setOthelloConfig: (config: Partial<OthelloSettings>) => void;
  setGlobalShortcut: (shortcut: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      translator: {
        googleKey: "",
        youdaoKey: "",
        baiduKey: "",
        tencentKey: "",
        volcengineKey: "",
        deeplKey: "",
        deeplxKey: "",
      },
      ai: {
        activeProvider: "deepseek",
        providers: DEFAULT_AI_PROVIDERS,
      },
      othello: {
        serverUrl: "ws://localhost:3030",
        nickname: "",
      },
      ocr: {
        engine: "windows",
        tencentSecretId: "",
        tencentSecretKey: "",
        tencentRegion: "ap-shanghai",
        baiduApiKey: "",
        baiduSecretKey: "",
      },
      runAsAdmin: false,
      closeBehavior: "minimize",
      homeViewMode: "grouped",
      clipboardEnabled: false,
      clipboardPrefix: "",
      clipboardSuffix: "",
      nginxPath: "",
      wechatSystemPrompt:
        "你是一个友好且专业的助手，请根据收到的消息生成合适的回复。回复要简洁、自然、有礼貌。",
      globalShortcut: "",
      favoriteTools: [],
      pinnedTools: [],
      toggleFavorite: (toolId) =>
        set((state) => ({
          favoriteTools: state.favoriteTools.includes(toolId)
            ? state.favoriteTools.filter((id) => id !== toolId)
            : [...state.favoriteTools, toolId],
        })),
      togglePin: (toolId) =>
        set((state) => ({
          pinnedTools: state.pinnedTools.includes(toolId)
            ? state.pinnedTools.filter((id) => id !== toolId)
            : [...state.pinnedTools, toolId],
        })),
      setHomeViewMode: (mode) => set({ homeViewMode: mode }),
      setTranslatorKey: (engine, key) =>
        set((state) => ({
          translator: {
            ...state.translator,
            [`${engine}Key`]: key,
          },
        })),
      setAiActiveProvider: (id) =>
        set((state) => ({
          ai: { ...state.ai, activeProvider: id },
        })),
      addAiProvider: (provider) =>
        set((state) => ({
          ai: {
            ...state.ai,
            providers: [...state.ai.providers, provider],
          },
        })),
      updateAiProvider: (id, key, value) =>
        set((state) => ({
          ai: {
            ...state.ai,
            providers: state.ai.providers.map((p) =>
              p.id === id ? { ...p, [key]: value } : p
            ),
          },
        })),
      removeAiProvider: (id) =>
        set((state) => {
          const remaining = state.ai.providers.filter((p) => p.id !== id);
          const newActive =
            state.ai.activeProvider === id
              ? (remaining[0]?.id ?? "")
              : state.ai.activeProvider;
          return {
            ai: {
              activeProvider: newActive,
              providers: remaining,
            },
          };
        }),
      setAiConfig: (config) => set({ ai: config }),
      setOcrEngine: (engine) =>
        set((state) => ({ ocr: { ...state.ocr, engine } })),
      setOcrSetting: (key, value) =>
        set((state) => ({ ocr: { ...state.ocr, [key]: value } })),
      setOcrConfig: (config) => set({ ocr: config }),
      setRunAsAdmin: (enabled) => set({ runAsAdmin: enabled }),
      setCloseBehavior: (behavior) => set({ closeBehavior: behavior }),
      setClipboardEnabled: (enabled) => set({ clipboardEnabled: enabled }),
      setClipboardPrefix: (prefix) => set({ clipboardPrefix: prefix }),
      setClipboardSuffix: (suffix) => set({ clipboardSuffix: suffix }),
      setNginxPath: (path) => set({ nginxPath: path }),
      setWechatSystemPrompt: (prompt) => set({ wechatSystemPrompt: prompt }),
      setOthelloConfig: (config) =>
        set((state) => ({
          othello: { ...state.othello, ...config },
        })),
      setGlobalShortcut: (shortcut) => set({ globalShortcut: shortcut }),
    }),
    {
      name: "tooldock-settings",
      version: 6,
      migrate: (persistedState: any, _version: number) => {
        let state = persistedState;

        // version 0: 从旧的单服务商结构迁移
        if (state.ai && !state.ai.providers) {
          const oldAi = state.ai;
          state = {
            ...state,
            ai: {
              activeProvider: "deepseek",
              providers: {
                deepseek: { apiKey: oldAi.apiKey || "", model: oldAi.model || "deepseek-chat" },
                doubao: { apiKey: "", model: "" },
                openai: { apiKey: "", model: "gpt-4o", baseUrl: "https://api.openai.com/v1" },
                siliconflow: { apiKey: "", model: "deepseek-ai/DeepSeek-V3", baseUrl: "https://api.siliconflow.cn/v1" },
              },
            },
          };
        }

        // 补全 ocr
        if (!state.ocr) {
          state = {
            ...state,
            ocr: {
              engine: "windows",
              tencentSecretId: "",
              tencentSecretKey: "",
              tencentRegion: "ap-shanghai",
              baiduApiKey: "",
              baiduSecretKey: "",
            },
          };
        }
        if (state.ocr && state.ocr.baiduApiKey === undefined) {
          state = { ...state, ocr: { ...state.ocr, baiduApiKey: "", baiduSecretKey: "" } };
        }

        // 补全 wechatSystemPrompt
        if (!state.wechatSystemPrompt) {
          state = {
            ...state,
            wechatSystemPrompt: "你是一个友好且专业的助手，请根据收到的消息生成合适的回复。回复要简洁、自然、有礼貌。",
          };
        }

        // version 5 → 6: providers 从 object 迁移到 array
        if (state.ai?.providers && !Array.isArray(state.ai.providers)) {
          const old = state.ai.providers as any;
          const newProviders: AiProviderSettings[] = [
            {
              id: "deepseek",
              name: "DeepSeek",
              baseUrl: "https://api.deepseek.com",
              apiKey: old.deepseek?.apiKey || "",
              model: old.deepseek?.model || "deepseek-chat",
            },
            {
              id: "openai",
              name: "OpenAI",
              baseUrl: old.openai?.baseUrl || "https://api.openai.com/v1",
              apiKey: old.openai?.apiKey || "",
              model: old.openai?.model || "gpt-4o",
            },
          ];
          // 保留已配置的豆包/SiliconFlow 作为自定义提供商
          if (old.doubao?.apiKey) {
            newProviders.push({
              id: "doubao",
              name: "豆包",
              baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
              apiKey: old.doubao.apiKey,
              model: old.doubao.model || "",
            });
          }
          if (old.siliconflow?.apiKey) {
            newProviders.push({
              id: "siliconflow",
              name: "SiliconFlow",
              baseUrl: old.siliconflow?.baseUrl || "https://api.siliconflow.cn/v1",
              apiKey: old.siliconflow.apiKey,
              model: old.siliconflow.model || "",
            });
          }
          const oldActive = state.ai.activeProvider || "deepseek";
          const activeExists = newProviders.find((p) => p.id === oldActive);
          state = {
            ...state,
            ai: {
              activeProvider: activeExists ? oldActive : newProviders[0]?.id ?? "deepseek",
              providers: newProviders,
            },
          };
        }

        return state;
      },
    }
  )
);

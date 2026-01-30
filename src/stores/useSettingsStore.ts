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

interface AiProviderSettings {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

interface AiSettings {
  activeProvider: "deepseek" | "doubao" | "openai" | "siliconflow";
  providers: {
    deepseek: AiProviderSettings;
    doubao: AiProviderSettings;
    openai: AiProviderSettings;
    siliconflow: AiProviderSettings;
  };
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
  serverUrl: string; // e.g. "ws://localhost:3030"
  nickname: string;
}

export type HomeViewMode = "list" | "grouped";

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
  setAiActiveProvider: (
    provider: "deepseek" | "doubao" | "openai" | "siliconflow"
  ) => void;
  setAiProviderSetting: (
    provider: "deepseek" | "doubao" | "openai" | "siliconflow",
    key: keyof AiProviderSettings,
    value: string
  ) => void;
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
        providers: {
          deepseek: {
            apiKey: "",
            model: "deepseek-chat",
          },
          doubao: {
            apiKey: "",
            model: "",
          },
          openai: {
            apiKey: "",
            model: "gpt-4o",
            baseUrl: "https://api.openai.com/v1",
          },
          siliconflow: {
            apiKey: "",
            model: "deepseek-ai/DeepSeek-V3",
            baseUrl: "https://api.siliconflow.cn/v1",
          },
        },
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
      setAiActiveProvider: (provider) =>
        set((state) => ({
          ai: {
            ...state.ai,
            activeProvider: provider,
          },
        })),
      setAiProviderSetting: (provider, key, value) =>
        set((state) => ({
          ai: {
            ...state.ai,
            providers: {
              ...state.ai.providers,
              [provider]: {
                ...state.ai.providers[provider],
                [key]: value,
              },
            },
          },
        })),
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
      version: 5,
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;

        if (version === 0) {
          // 从旧的单服务商结构迁移到新的多服务商结构
          const oldAi = state.ai;
          if (oldAi && !oldAi.providers) {
            state = {
              ...state,
              ai: {
                activeProvider: "deepseek",
                providers: {
                  deepseek: {
                    apiKey: oldAi.apiKey || "",
                    model: oldAi.model || "deepseek-chat",
                  },
                  doubao: {
                    apiKey: "",
                    model: "",
                  },
                  openai: {
                    apiKey: "",
                    model: "gpt-4o",
                    baseUrl: "https://api.openai.com/v1",
                  },
                  siliconflow: {
                    apiKey: "",
                    model: "deepseek-ai/DeepSeek-V3",
                    baseUrl: "https://api.siliconflow.cn/v1",
                  },
                },
              },
            };
          }
        }

        // 补全 openai (version 1)
        if (state.ai && state.ai.providers && !state.ai.providers.openai) {
          state = {
            ...state,
            ai: {
              ...state.ai,
              providers: {
                ...state.ai.providers,
                openai: {
                  apiKey: "",
                  model: "gpt-4o",
                  baseUrl: "https://api.openai.com/v1",
                },
              },
            },
          };
        }

        // 补全 siliconflow (version 2)
        if (state.ai && state.ai.providers && !state.ai.providers.siliconflow) {
          state = {
            ...state,
            ai: {
              ...state.ai,
              providers: {
                ...state.ai.providers,
                siliconflow: {
                  apiKey: "",
                  model: "deepseek-ai/DeepSeek-V3",
                  baseUrl: "https://api.siliconflow.cn/v1",
                },
              },
            },
          };
        }

        // 补全 ocr (version 3)
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

        // 补全 baidu ocr (version 4)
        if (state.ocr && state.ocr.baiduApiKey === undefined) {
          state = {
            ...state,
            ocr: {
              ...state.ocr,
              baiduApiKey: "",
              baiduSecretKey: "",
            },
          };
        }

        // 补全 wechatSystemPrompt (version 5)
        if (!state.wechatSystemPrompt) {
          state = {
            ...state,
            wechatSystemPrompt:
              "你是一个友好且专业的助手，请根据收到的消息生成合适的回复。回复要简洁、自然、有礼貌。",
          };
        }

        return state;
      },
    }
  )
);

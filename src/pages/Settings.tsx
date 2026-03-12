/**
 * 系统设置页面 - 重新设计版本
 * 特点：侧边栏导航、分类卡片、渐变设计、AI Provider 标签页
 */
import React from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ToolLayout } from "../components/layout/ToolLayout";
import { useSettingsStore } from "../stores/useSettingsStore";
import {
  Save,
  CheckCircle2,
  ExternalLink,
  Download,
  Upload,
  Shield,
  Lock,
  Clipboard,
  Zap,
  Loader2,
  Camera,
  Keyboard,
  Settings2,
  Languages,
  FolderInput,
} from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { invokeWrapper } from "../api";
import { useModal } from "../components/ModalContext";
import { Input } from "../components/mui";
import { Button } from "../components/mui";

// 设置分类定义
type SettingsCategory =
  | "general"
  | "shortcuts"
  | "security"
  | "clipboard"
  | "ai"
  | "ocr"
  | "translator"
  | "importExport";

interface CategoryConfig {
  id: SettingsCategory;
  icon: React.ElementType;
  labelKey: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: "general",
    icon: Settings2,
    labelKey: "tools.settings.general_settings",
  },
  {
    id: "shortcuts",
    icon: Keyboard,
    labelKey: "tools.settings.shortcut_settings",
  },
  {
    id: "security",
    icon: Shield,
    labelKey: "tools.settings.admin_mode",
  },
  {
    id: "clipboard",
    icon: Clipboard,
    labelKey: "tools.settings.clipboard_settings",
  },
  {
    id: "ai",
    icon: Zap,
    labelKey: "tools.settings.ai_settings",
  },
  {
    id: "ocr",
    icon: Camera,
    labelKey: "tools.ocr.settings",
  },
  {
    id: "translator",
    icon: Languages,
    labelKey: "tools.settings.translator_keys",
  },
  {
    id: "importExport",
    icon: FolderInput,
    labelKey: "tools.settings.export_config",
  },
];

// AI Provider 定义
type AIProvider = "deepseek" | "doubao" | "openai" | "siliconflow";

interface ProviderConfig {
  id: AIProvider;
  name: string;
  url: string;
  color: string;
}

const AI_PROVIDERS: ProviderConfig[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://platform.deepseek.com/",
    color: "blue",
  },
  {
    id: "doubao",
    name: "豆包",
    url: "https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint",
    color: "orange",
  },
  {
    id: "openai",
    name: "OpenAI",
    url: "https://platform.openai.com/",
    color: "green",
  },
  {
    id: "siliconflow",
    name: "SiliconFlow",
    url: "https://cloud.siliconflow.cn/",
    color: "purple",
  },
];

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { confirm } = useModal();
  const {
    translator,
    setTranslatorKey,
    ai,
    setAiActiveProvider,
    setAiProviderSetting,
    setAiConfig,
    runAsAdmin,
    setRunAsAdmin,
    clipboardEnabled,
    setClipboardEnabled,
    clipboardPrefix,
    setClipboardPrefix,
    clipboardSuffix,
    setClipboardSuffix,
    ocr,
    setOcrSetting,
    setOcrConfig,
    nginxPath,
    setNginxPath,
    globalShortcut,
    setGlobalShortcut,
    closeBehavior,
    setCloseBehavior,
  } = useSettingsStore();

  const [saved, setSaved] = React.useState(false);
  const [autoStart, setAutoStart] = React.useState(false);
  const [testingAi, setTestingAi] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [tempShortcut, setTempShortcut] = React.useState("");
  const [activeCategory, setActiveCategory] =
    React.useState<SettingsCategory>("general");
  const [activeAiTab, setActiveAiTab] = React.useState<AIProvider>("deepseek");

  // 导出导入相关状态
  const [encryptExport, setEncryptExport] = React.useState(false);
  const [exportPassword, setExportPassword] = React.useState("");
  const [importPassword, setImportPassword] = React.useState("");

  React.useEffect(() => {
    // 检查开机自启状态
    invoke<boolean>("plugin:autostart|is_enabled")
      .then((yes) => setAutoStart(yes))
      .catch(() => {});

    // 同步关闭行为配置到后端
    invoke("set_close_behavior", { behavior: closeBehavior }).catch(() => {});

    // 同步管理员启动状态
    invokeWrapper<boolean>("is_run_as_admin").then((res) => {
      if (res.ok) {
        setRunAsAdmin(res.data);
      }
    });

    // 加载快捷键配置
    invokeWrapper<string>("get_global_shortcut").then((res) => {
      if (res.ok && res.data) {
        setGlobalShortcut(res.data);
        setTempShortcut(res.data);
      }
    });
  }, []);

  // 同步 AI 活动 Provider 到标签页
  React.useEffect(() => {
    if (ai?.activeProvider) {
      setActiveAiTab(ai.activeProvider as AIProvider);
    }
  }, [ai?.activeProvider]);

  // 防御性检查 AI 配置
  const safeAi = {
    activeProvider: ai?.activeProvider || "deepseek",
    providers: {
      deepseek: ai?.providers?.deepseek || {
        apiKey: "",
        model: "deepseek-chat",
      },
      doubao: ai?.providers?.doubao || { apiKey: "", model: "" },
      openai: ai?.providers?.openai || {
        apiKey: "",
        model: "gpt-4o",
        baseUrl: "https://api.openai.com/v1",
      },
      siliconflow: ai?.providers?.siliconflow || {
        apiKey: "",
        model: "deepseek-ai/DeepSeek-V3",
        baseUrl: "https://api.siliconflow.cn/v1",
      },
    },
  };

  const handleSave = async () => {
    await invokeWrapper("set_run_as_admin", { enabled: runAsAdmin });
    await invokeWrapper("set_clipboard_config", {
      prefix: clipboardPrefix,
      suffix: clipboardSuffix,
    });
    if (tempShortcut !== globalShortcut) {
      const res = await invokeWrapper("set_global_shortcut", {
        shortcut: tempShortcut,
      });
      if (res.ok) {
        setGlobalShortcut(tempShortcut);
      }
    }
    setSaved(true);
    toast.success(t("common.success"));
    setTimeout(() => setSaved(false), 2000);
  };

  const handleShortcutKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();

    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push("Ctrl");
    if (e.shiftKey) modifiers.push("Shift");
    if (e.altKey) modifiers.push("Alt");
    if (e.metaKey) modifiers.push("Meta");

    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
      return;
    }

    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    const shortcut = [...modifiers, key].join("+");

    setTempShortcut(shortcut);
    setRecording(false);
  };

  const handleClearShortcut = () => {
    setTempShortcut("");
  };

  const toggleAutoStart = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    try {
      if (checked) {
        await invoke("plugin:autostart|enable");
      } else {
        await invoke("plugin:autostart|disable");
      }
      setAutoStart(checked);
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleSetCloseBehavior = async (val: "minimize" | "exit") => {
    setCloseBehavior(val);
    await invoke("set_close_behavior", { behavior: val });
  };

  const handleTestAi = async (provider: string) => {
    const config = (safeAi.providers as Record<string, any>)[provider];
    if (!config?.apiKey) {
      await confirm({
        title: t("common.error"),
        message: t("tools.settings.ai_api_key_placeholder"),
        type: "error",
      });
      return;
    }

    setTestingAi(provider);
    try {
      const res = await invokeWrapper<string>("test_ai_connection", {
        provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
      });

      if (res.ok) {
        await confirm({
          title: t("common.success"),
          message: t("tools.settings.ai_test_success", { message: res.data }),
          type: "success",
        });
      } else {
        await confirm({
          title: t("common.error"),
          message: t("tools.settings.ai_test_failed", { message: res.message }),
          type: "error",
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await confirm({
        title: t("common.error"),
        message: t("tools.settings.ai_test_failed", { message: errorMessage }),
        type: "error",
      });
    } finally {
      setTestingAi(null);
    }
  };

  const handleExport = async () => {
    try {
      const configData = JSON.stringify({
        translator,
        ai,
        ocr,
        runAsAdmin,
        clipboardEnabled,
        clipboardPrefix,
        clipboardSuffix,
        nginxPath,
        globalShortcut,
      });
      const res = await invokeWrapper<string>("export_config", {
        data: configData,
        password: encryptExport ? exportPassword : null,
      });

      if (res.ok) {
        const filePath = await save({
          filters: [{ name: "ToolDock Config", extensions: ["tdc"] }],
          defaultPath: "tooldock_config.tdc",
        });

        if (filePath) {
          await writeTextFile(filePath, res.data);
          await confirm({
            title: t("common.success"),
            message: t("tools.settings.export_success"),
            type: "success",
          });
        }
      } else {
        await confirm({
          title: t("common.error"),
          message: t("tools.settings.export_failed", { message: res.message }),
          type: "error",
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await confirm({
        title: t("common.error"),
        message: t("tools.settings.export_failed", { message: errorMessage }),
        type: "error",
      });
    }
  };

  const handleImport = async () => {
    try {
      const filePath = await open({
        filters: [{ name: "ToolDock Config", extensions: ["tdc"] }],
        multiple: false,
      });

      if (filePath) {
        const confirmed = await confirm({
          title: t("tools.settings.import_config"),
          message: t("common.confirm"),
        });

        if (!confirmed) return;

        const content = await readTextFile(filePath as string);
        const res = await invokeWrapper<string>("import_config", {
          encryptedData: content,
          password: importPassword,
        });

        if (res.ok) {
          const imported = JSON.parse(res.data);
          if (imported.translator) {
            Object.entries(imported.translator).forEach(([key, value]) => {
              const engine = key.replace("Key", "") as
                | "google"
                | "youdao"
                | "baidu"
                | "tencent"
                | "volcengine"
                | "deepl"
                | "deeplx";
              setTranslatorKey(engine, value as string);
            });
          }
          if (imported.ai) {
            setAiConfig(imported.ai);
          }
          if (imported.ocr) {
            setOcrConfig(imported.ocr);
          }
          if (typeof imported.runAsAdmin === "boolean") {
            setRunAsAdmin(imported.runAsAdmin);
            await invokeWrapper("set_run_as_admin", {
              enabled: imported.runAsAdmin,
            });
          }
          if (typeof imported.clipboardEnabled === "boolean") {
            setClipboardEnabled(imported.clipboardEnabled);
          }
          if (
            typeof imported.clipboardPrefix === "string" ||
            typeof imported.clipboardSuffix === "string"
          ) {
            const prefix = imported.clipboardPrefix ?? clipboardPrefix;
            const suffix = imported.clipboardSuffix ?? clipboardSuffix;
            setClipboardPrefix(prefix);
            setClipboardSuffix(suffix);
            await invokeWrapper("set_clipboard_config", { prefix, suffix });
          }
          if (typeof imported.nginxPath === "string") {
            setNginxPath(imported.nginxPath);
          }
          if (typeof imported.globalShortcut === "string") {
            setGlobalShortcut(imported.globalShortcut);
            setTempShortcut(imported.globalShortcut);
            await invokeWrapper("set_global_shortcut", {
              shortcut: imported.globalShortcut,
            });
          }
          await confirm({
            title: t("common.success"),
            message: t("tools.settings.import_success"),
            type: "success",
          });
        } else {
          await confirm({
            title: t("common.error"),
            message: t("tools.settings.import_failed", {
              message: res.message,
            }),
            type: "error",
          });
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await confirm({
        title: t("common.error"),
        message: t("tools.settings.import_failed", { message: errorMessage }),
        type: "error",
      });
    }
  };

  // ============ 渲染分类内容 ============

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      {/* 开机自启 */}
      <div className="flex items-start gap-4 p-4 rounded-xl bg-(--bg-main)/50 hover:bg-(--bg-main)/80 transition-colors">
        <div className="flex items-center h-5">
          <input
            id="auto-start"
            type="checkbox"
            className="w-5 h-5 text-blue-600 border-(--border-color) rounded focus:ring-blue-500 bg-(--bg-main) cursor-pointer"
            checked={autoStart}
            onChange={toggleAutoStart}
          />
        </div>
        <div className="flex flex-col">
          <label
            htmlFor="auto-start"
            className="text-sm font-medium text-(--text-main) cursor-pointer"
          >
            {t("tools.settings.auto_start")}
          </label>
          <p className="text-xs text-(--text-muted) mt-1">
            {t("tools.settings.auto_start_desc")}
          </p>
        </div>
      </div>

      {/* 关闭行为 */}
      <div className="space-y-3 p-4 rounded-xl bg-(--bg-main)/50">
        <label className="text-sm font-medium text-(--text-main)">
          {t("tools.settings.close_behavior")}
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-lg border border-(--border-color) hover:border-blue-400 transition-colors flex-1">
            <input
              type="radio"
              name="close-behavior"
              className="w-4 h-4 text-blue-600 border-(--border-color) focus:ring-blue-500 bg-(--bg-main)"
              checked={closeBehavior === "minimize"}
              onChange={() => handleSetCloseBehavior("minimize")}
            />
            <span className="text-sm text-(--text-main)">
              {t("tools.settings.close_minimize")}
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-lg border border-(--border-color) hover:border-blue-400 transition-colors flex-1">
            <input
              type="radio"
              name="close-behavior"
              className="w-4 h-4 text-blue-600 border-(--border-color) focus:ring-blue-500 bg-(--bg-main)"
              checked={closeBehavior === "exit"}
              onChange={() => handleSetCloseBehavior("exit")}
            />
            <span className="text-sm text-(--text-main)">
              {t("tools.settings.close_exit")}
            </span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderShortcutSettings = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-(--text-main) mb-2">
          {t("tools.settings.global_shortcut")}
        </label>
        <p className="text-xs text-(--text-muted) mb-4">
          {t("tools.settings.global_shortcut_desc")}
        </p>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              fullWidth
              value={
                recording
                  ? t("tools.settings.shortcut_recording")
                  : tempShortcut
              }
              placeholder={t("tools.settings.shortcut_placeholder")}
              onFocus={() => setRecording(true)}
              onBlur={() => setRecording(false)}
              onKeyDown={handleShortcutKeyDown}
              className={`font-mono ${
                recording ? "border-blue-500 animate-pulse" : ""
              }`}
              inputProps={{ readOnly: true }}
            />
          </div>
          <Button
            variant="outlined"
            color="error"
            onClick={handleClearShortcut}
            disabled={!tempShortcut}
            className="px-4"
          >
            {t("tools.settings.shortcut_clear")}
          </Button>
        </div>
        <p className="text-xs text-(--text-muted) mt-2">
          {t("tools.settings.shortcut_example")}
        </p>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="flex items-start gap-4 p-4 rounded-xl bg-(--bg-main)/50 hover:bg-(--bg-main)/80 transition-colors">
        <div className="flex items-center h-5">
          <input
            id="run-as-admin"
            type="checkbox"
            className="w-5 h-5 text-orange-600 border-(--border-color) rounded focus:ring-orange-500 bg-(--bg-main) cursor-pointer"
            checked={runAsAdmin}
            onChange={(e) => setRunAsAdmin(e.target.checked)}
          />
        </div>
        <div className="flex flex-col">
          <label
            htmlFor="run-as-admin"
            className="text-sm font-medium text-(--text-main) cursor-pointer"
          >
            {t("tools.settings.run_as_admin")}
          </label>
          <p className="text-xs text-(--text-muted) mt-1">
            {t("tools.settings.run_as_admin_desc")}
          </p>
        </div>
      </div>
    </div>
  );

  const renderClipboardSettings = () => (
    <div className="space-y-6">
      <div className="flex items-start gap-4 p-4 rounded-xl bg-(--bg-main)/50 hover:bg-(--bg-main)/80 transition-colors">
        <div className="flex items-center h-5">
          <input
            id="clipboard-monitoring"
            type="checkbox"
            className="w-5 h-5 text-blue-600 border-(--border-color) rounded focus:ring-blue-500 bg-(--bg-main) cursor-pointer"
            checked={clipboardEnabled}
            onChange={(e) => setClipboardEnabled(e.target.checked)}
          />
        </div>
        <div className="flex flex-col">
          <label
            htmlFor="clipboard-monitoring"
            className="text-sm font-medium text-(--text-main) cursor-pointer"
          >
            {t("tools.settings.clipboard_monitoring")}
          </label>
          <p className="text-xs text-(--text-muted) mt-1">
            {t("tools.settings.clipboard_monitoring_desc")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-(--bg-main)/50">
        <div className="space-y-2">
          <label className="text-sm font-medium text-(--text-main)">
            {t("tools.clipboard_manager.prefix")}
          </label>
          <Input
            fullWidth
            placeholder={t("tools.clipboard_manager.prefix_placeholder")}
            value={clipboardPrefix}
            onChange={(e) => setClipboardPrefix(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-(--text-main)">
            {t("tools.clipboard_manager.suffix")}
          </label>
          <Input
            fullWidth
            placeholder={t("tools.clipboard_manager.suffix_placeholder")}
            value={clipboardSuffix}
            onChange={(e) => setClipboardSuffix(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  const renderAiSettings = () => (
    <div className="space-y-6">
      {/* Provider 选择 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-(--text-main)">
          {t("tools.settings.ai_active_provider")}
        </label>
        <div className="flex flex-wrap gap-3">
          {AI_PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                safeAi.activeProvider === p.id
                  ? "border-blue-500 bg-blue-500/10 text-blue-600"
                  : "border-(--border-color) hover:border-blue-300 text-(--text-muted)"
              }`}
            >
              <input
                type="radio"
                name="active-provider"
                className="hidden"
                checked={safeAi.activeProvider === p.id}
                onChange={() => setAiActiveProvider(p.id)}
              />
              <div
                className={`w-2 h-2 rounded-full ${
                  safeAi.activeProvider === p.id
                    ? "bg-green-500 animate-pulse"
                    : "bg-gray-400"
                }`}
              />
              <span className="text-sm font-medium">{p.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Provider 配置内容 */}
      <div className="border border-(--border-color) rounded-xl overflow-hidden">
        <div 
          key={activeAiTab}
          className="p-6 animate-fadeIn"
        >
          {renderAiProviderContent(activeAiTab)}
        </div>
      </div>
    </div>
  );

  const renderAiProviderContent = (provider: AIProvider) => {
    const config = safeAi.providers[provider];
    const providerInfo = AI_PROVIDERS.find((p) => p.id === provider)!;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-(--text-main) flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                safeAi.activeProvider === provider
                  ? "bg-green-500 animate-pulse"
                  : "bg-gray-400"
              }`}
            />
            {providerInfo.name}
          </h3>
          <div className="flex items-center gap-3">
            <Button
              variant="text"
              size="small"
              onClick={() => handleTestAi(provider)}
              disabled={testingAi === provider}
              className="text-xs text-green-500 hover:text-green-600 flex items-center gap-1 h-auto p-0"
            >
              {testingAi === provider ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Zap size={12} />
              )}
              {t("tools.settings.ai_test_connection")}
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => openPath(providerInfo.url)}
              className="text-xs text-blue-500 hover:underline flex items-center gap-1 h-auto p-0"
            >
              {t("tools.translator.get_key")} <ExternalLink size={12} />
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label={t("tools.settings.ai_api_key")}
            type="password"
            value={config.apiKey}
            placeholder={t("tools.settings.ai_api_key_placeholder")}
            onChange={(e) =>
              setAiProviderSetting(provider, "apiKey", e.target.value)
            }
          />

          <Input
            label={
              provider === "doubao"
                ? t("tools.settings.ai_doubao_model_desc")
                : t("tools.settings.ai_model")
            }
            type="text"
            placeholder={
              provider === "deepseek"
                ? "deepseek-chat"
                : provider === "doubao"
                ? "ep-2024..."
                : provider === "openai"
                ? "gpt-4o"
                : "deepseek-ai/DeepSeek-V3"
            }
            value={config.model}
            onChange={(e) =>
              setAiProviderSetting(provider, "model", e.target.value)
            }
          />

          {(provider === "openai" || provider === "siliconflow") && (
            <Input
              label={t("tools.settings.ai_base_url")}
              type="text"
              placeholder={
                provider === "openai"
                  ? "https://api.openai.com/v1"
                  : "https://api.siliconflow.cn/v1"
              }
              value={(config as { baseUrl?: string }).baseUrl || ""}
              onChange={(e) =>
                setAiProviderSetting(provider, "baseUrl", e.target.value)
              }
            />
          )}
        </div>
      </div>
    );
  };

  const renderOcrSettings = () => (
    <div className="space-y-8">
      {/* Tencent OCR */}
      <div className="space-y-4 p-4 rounded-xl bg-(--bg-main)/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-(--text-main)">
            {t("tools.ocr.engine_tencent").split("(")[0].trim()}
          </h3>
          <Button
            variant="text"
            size="small"
            onClick={() =>
              openPath("https://console.cloud.tencent.com/cam/capi")
            }
            className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer h-auto p-0"
          >
            {t("tools.translator.get_key")} <ExternalLink size={12} />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-(--text-main)">
              {t("tools.ocr.tencent_secret_id")}
            </label>
            <Input
              fullWidth
              type="password"
              placeholder="SecretId"
              value={ocr.tencentSecretId}
              onChange={(e) =>
                setOcrSetting("tencentSecretId", e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-(--text-main)">
              {t("tools.ocr.tencent_secret_key")}
            </label>
            <Input
              fullWidth
              type="password"
              placeholder="SecretKey"
              value={ocr.tencentSecretKey}
              onChange={(e) =>
                setOcrSetting("tencentSecretKey", e.target.value)
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-(--text-main)">
            {t("tools.ocr.tencent_region")}
          </label>
          <Input
            fullWidth
            placeholder="ap-shanghai"
            value={ocr.tencentRegion}
            onChange={(e) => setOcrSetting("tencentRegion", e.target.value)}
          />
          <p className="text-xs text-(--text-muted)">
            例如: ap-shanghai, ap-guangzhou, ap-beijing
          </p>
        </div>
      </div>

      {/* Baidu OCR */}
      <div className="space-y-4 p-4 rounded-xl bg-(--bg-main)/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-(--text-main)">
            {t("tools.ocr.engine_baidu").split("(")[0].trim()}
          </h3>
          <Button
            variant="text"
            size="small"
            onClick={() =>
              openPath(
                "https://console.bce.baidu.com/ai/#/ai/ocr/overview/index"
              )
            }
            className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer h-auto p-0"
          >
            {t("tools.translator.get_key")} <ExternalLink size={12} />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-(--text-main)">
              {t("tools.ocr.baidu_api_key")}
            </label>
            <Input
              fullWidth
              type="password"
              placeholder="API Key"
              value={ocr.baiduApiKey}
              onChange={(e) => setOcrSetting("baiduApiKey", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-(--text-main)">
              {t("tools.ocr.baidu_secret_key")}
            </label>
            <Input
              fullWidth
              type="password"
              placeholder="Secret Key"
              value={ocr.baiduSecretKey}
              onChange={(e) => setOcrSetting("baiduSecretKey", e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderTranslatorSettings = () => {
    const translatorConfigs = [
      {
        key: "google",
        label: "Google Cloud Translation API Key",
        url: "https://console.cloud.google.com/apis/credentials",
        placeholderKey: "tools.translator.google_key_placeholder",
        descKey: "tools.translator.google_key_desc",
      },
      {
        key: "youdao",
        label: "Youdao Translate (AppKey:Secret)",
        url: "https://ai.youdao.com/console/#/",
        placeholderKey: "tools.translator.youdao_key_placeholder",
        descKey: "tools.translator.youdao_key_desc",
      },
      {
        key: "baidu",
        label: "Baidu Translate (AppID:Secret)",
        url: "https://fanyi-api.baidu.com/manage/developer",
        placeholderKey: "tools.translator.baidu_key_placeholder",
        descKey: "tools.translator.baidu_key_desc",
      },
      {
        key: "tencent",
        label: "Tencent Translate (SecretId:SecretKey)",
        url: "https://console.cloud.tencent.com/cam/capi",
        placeholderKey: "tools.translator.tencent_key_placeholder",
        descKey: "tools.translator.tencent_key_desc",
      },
      {
        key: "volcengine",
        label: "Volcengine Translate (AccessKey:SecretKey)",
        url: "https://console.volcengine.com/iam/keymanage/",
        placeholderKey: "tools.translator.volcengine_key_placeholder",
        descKey: "tools.translator.volcengine_key_desc",
      },
      {
        key: "deepl",
        label: "DeepL API Key",
        url: "https://www.deepl.com/en/your-account/keys",
        placeholderKey: "tools.translator.deepl_key_placeholder",
        descKey: "tools.translator.deepl_key_desc",
      },
      {
        key: "deeplx",
        label: "DeepLX API Key",
        url: "https://api.deeplx.org/",
        placeholderKey: "tools.translator.deeplx_key_placeholder",
        descKey: "tools.translator.deeplx_key_desc",
      },
    ];

    return (
      <div className="space-y-4">
        {translatorConfigs.map((config) => {
          const valueKey = `${config.key}Key` as keyof typeof translator;
          const value = translator[valueKey] as string;
          const isTencentInvalid =
            config.key === "tencent" &&
            value &&
            value.split(":")[0]?.length < 30;

          return (
            <div
              key={config.key}
              className="space-y-2 p-4 rounded-xl bg-(--bg-main)/50 hover:bg-(--bg-main)/80 transition-colors"
            >
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-(--text-main)">
                  {config.label}
                </label>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => openPath(config.url)}
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer h-auto p-0"
                >
                  {t("tools.translator.get_key")} <ExternalLink size={12} />
                </Button>
              </div>
              <Input
                type="password"
                className={`text-sm ${isTencentInvalid ? "border-red-500" : ""}`}
                placeholder={t(config.placeholderKey)}
                value={value}
                onChange={(e) =>
                  setTranslatorKey(
                    config.key as
                      | "google"
                      | "youdao"
                      | "baidu"
                      | "tencent"
                      | "volcengine"
                      | "deepl"
                      | "deeplx",
                    config.key === "tencent" || config.key === "volcengine"
                      ? e.target.value.trim()
                      : e.target.value
                  )
                }
              />
              <p className="text-xs text-(--text-muted)">{t(config.descKey)}</p>
              {isTencentInvalid && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1 animate-pulse">
                  <span className="mt-0.5">❌</span>
                  <span>
                    SecretId 长度不足！当前 {value.split(":")[0]?.length}{" "}
                    字符，应为 36-40 字符
                  </span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderImportExportSettings = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 导出 */}
      <div className="space-y-4 p-4 rounded-xl bg-(--bg-main)/50 border border-(--border-color)">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-green-500" />
          <h3 className="font-bold text-(--text-main)">
            {t("tools.settings.export_config")}
          </h3>
        </div>
        <p className="text-xs text-(--text-muted)">
          {t("tools.settings.export_desc")}
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              id="encrypt-export"
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-(--border-color) rounded focus:ring-blue-500 bg-(--bg-main)"
              checked={encryptExport}
              onChange={(e) => setEncryptExport(e.target.checked)}
            />
            <label
              htmlFor="encrypt-export"
              className="text-sm text-(--text-main) cursor-pointer"
            >
              {t("tools.settings.encrypt_config")}
            </label>
          </div>
          {encryptExport && (
            <Input
              type="password"
              icon={<Lock size={14} />}
              className="text-sm"
              placeholder={t("tools.settings.encryption_key_placeholder")}
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
            />
          )}
          <Button
            color="success"
            variant="contained"
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          >
            <Download size={16} />
            {t("tools.settings.export_config")}
          </Button>
        </div>
      </div>

      {/* 导入 */}
      <div className="space-y-4 p-4 rounded-xl bg-(--bg-main)/50 border border-(--border-color)">
        <div className="flex items-center gap-2">
          <Upload size={18} className="text-purple-500" />
          <h3 className="font-bold text-(--text-main)">
            {t("tools.settings.import_config")}
          </h3>
        </div>
        <p className="text-xs text-(--text-muted)">
          {t("tools.settings.import_desc")}
        </p>
        <div className="space-y-3">
          <Input
            type="password"
            icon={<Lock size={14} />}
            className="text-sm"
            placeholder={t("tools.settings.encryption_key_placeholder")}
            value={importPassword}
            onChange={(e) => setImportPassword(e.target.value)}
          />
          <Button
            variant="contained"
            onClick={handleImport}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl text-sm font-medium"
          >
            <Upload size={16} />
            {t("tools.settings.import_config")}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case "general":
        return renderGeneralSettings();
      case "shortcuts":
        return renderShortcutSettings();
      case "security":
        return renderSecuritySettings();
      case "clipboard":
        return renderClipboardSettings();
      case "ai":
        return renderAiSettings();
      case "ocr":
        return renderOcrSettings();
      case "translator":
        return renderTranslatorSettings();
      case "importExport":
        return renderImportExportSettings();
      default:
        return null;
    }
  };

  const currentCategory = CATEGORIES.find((c) => c.id === activeCategory)!;

  return (
    <ToolLayout
      title={t("tools.settings.name")}
      actions={
        <Button
          onClick={handleSave}
          variant="contained"
          className="flex items-center gap-2 px-6 py-2 rounded-xl font-medium shadow-lg shadow-blue-500/20 active:scale-95"
        >
          {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saved ? t("common.success") : t("common.save")}
        </Button>
      }
    >
      <div className="flex h-full gap-6 pb-4">
        {/* 侧边栏导航 */}
        <div className="w-48 shrink-0">
          <nav className="space-y-1 sticky top-0">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isActive = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-300 ${
                    isActive
                      ? "bg-(--bg-main) text-(--primary-color) font-semibold border border-(--primary-color) shadow-sm"
                      : "text-(--text-muted) hover:bg-(--bg-main) hover:text-(--text-main)"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium truncate">
                    {t(category.labelKey)}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 min-w-0">
          <div
            className="bg-(--card-bg) rounded-2xl border border-(--border-color) overflow-hidden shadow-sm"
          >
            {/* 卡片头部 */}
            <div
              className="p-5 bg-(--bg-main)/50 border-b border-(--border-color) flex items-center gap-3 transition-all duration-300"
            >
              {React.createElement(currentCategory.icon, {
                size: 22,
                className: "text-(--text-main)",
              })}
              <h2 className="font-bold text-(--text-main) text-lg">
                {t(currentCategory.labelKey)}
              </h2>
            </div>

            {/* 卡片内容 */}
            <div 
              key={activeCategory}
              className="p-6 animate-fadeIn"
            >
              {renderCategoryContent()}
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default Settings;

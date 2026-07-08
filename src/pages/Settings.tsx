/**
 * 系统设置页面 - 重新设计版本
 * 特点：侧边栏导航、分类卡片、渐变设计、AI Provider 标签页
 */
import React from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ToolLayout } from "../components/layout/ToolLayout";
import {
  useSettingsStore,
  type DeveloperLogLevel,
} from "../stores/useSettingsStore";
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
  RefreshCw,
  Languages,
  FolderInput,
  PlusCircle,
  X,
  XCircle,
  Bug,
  FileText,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
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
  | "developer"
  | "importExport";

interface CategoryConfig {
  id: SettingsCategory;
  icon: React.ElementType;
  labelKey: string;
}

interface GitHubRelease {
  tag_name?: string;
  name?: string;
  html_url?: string;
}

interface DeveloperLogs {
  logDir: string;
  runLogPath?: string | null;
  errorLogPath?: string | null;
  runLog: string;
  errorLog: string;
}

type UpdateStatus = "idle" | "latest" | "available" | "error";

const RELEASES_URL = "https://github.com/hugqq/ToolDock/releases";
const FALLBACK_VERSION = "1.0.0";
const LOG_LEVELS: DeveloperLogLevel[] = [
  "error",
  "warn",
  "info",
  "debug",
  "trace",
];

const normalizeVersion = (version: string) =>
  version
    .trim()
    .replace(/^v/i, "")
    .split(/[+-]/)[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));

const isNewerVersion = (latest: string, current: string) => {
  const latestParts = normalizeVersion(latest);
  const currentParts = normalizeVersion(current);
  const length = Math.max(latestParts.length, currentParts.length);

  for (let i = 0; i < length; i += 1) {
    const latestPart = latestParts[i] ?? 0;
    const currentPart = currentParts[i] ?? 0;

    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
};

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
    id: "developer",
    icon: Bug,
    labelKey: "tools.settings.developer_settings",
  },
  {
    id: "importExport",
    icon: FolderInput,
    labelKey: "tools.settings.export_config",
  },
];

type TranslatorEngine =
  | "google"
  | "youdao"
  | "baidu"
  | "tencent"
  | "volcengine"
  | "deepl";

interface TranslatorCredentialFields {
  firstPlaceholderKey: string;
  secondPlaceholderKey: string;
}

const TRANSLATOR_CREDENTIAL_FIELDS: Partial<
  Record<TranslatorEngine, TranslatorCredentialFields>
> = {
  youdao: {
    firstPlaceholderKey: "tools.translator.youdao_app_key_placeholder",
    secondPlaceholderKey: "tools.translator.youdao_secret_placeholder",
  },
  baidu: {
    firstPlaceholderKey: "tools.translator.baidu_app_id_placeholder",
    secondPlaceholderKey: "tools.translator.baidu_secret_placeholder",
  },
  tencent: {
    firstPlaceholderKey: "tools.translator.tencent_secret_id_placeholder",
    secondPlaceholderKey: "tools.translator.tencent_secret_key_placeholder",
  },
  volcengine: {
    firstPlaceholderKey: "tools.translator.volcengine_access_key_placeholder",
    secondPlaceholderKey: "tools.translator.volcengine_secret_key_placeholder",
  },
};

const splitTranslatorCredential = (value: string): [string, string] => {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex === -1) return [value, ""];
  return [
    value.slice(0, separatorIndex),
    value.slice(separatorIndex + 1),
  ];
};

const joinTranslatorCredential = (first: string, second: string) => {
  if (!first && !second) return "";
  return `${first}:${second}`;
};

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { confirm } = useModal();
  const {
    translator,
    setTranslatorKey,
    ai,
    setAiActiveProvider,
    addAiProvider,
    updateAiProvider,
    removeAiProvider,
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
    silentStart,
    setSilentStart,
    developerSettingsEnabled,
    setDeveloperSettingsEnabled,
    developerLogLevel,
    setDeveloperLogLevel,
  } = useSettingsStore();

  const [saved, setSaved] = React.useState(false);
  const [autoStart, setAutoStart] = React.useState(false);
  const [testingAi, setTestingAi] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [tempShortcut, setTempShortcut] = React.useState("");
  const [currentVersion, setCurrentVersion] = React.useState(FALLBACK_VERSION);
  const [isCheckingUpdate, setIsCheckingUpdate] = React.useState(false);
  const [updateStatus, setUpdateStatus] = React.useState<UpdateStatus>("idle");
  const [latestRelease, setLatestRelease] = React.useState<GitHubRelease | null>(null);
  const [developerLogs, setDeveloperLogs] =
    React.useState<DeveloperLogs | null>(null);
  const [isRefreshingLogs, setIsRefreshingLogs] = React.useState(false);
  const [activeCategory, setActiveCategory] =
    React.useState<SettingsCategory>("general");
  // 导出导入相关状态
  const [encryptExport, setEncryptExport] = React.useState(false);
  const [exportPassword, setExportPassword] = React.useState("");
  const [importPassword, setImportPassword] = React.useState("");

  const refreshDeveloperLogs = React.useCallback(async () => {
    setIsRefreshingLogs(true);
    try {
      const res = await invokeWrapper<DeveloperLogs>("get_developer_logs");
      if (res.ok) {
        setDeveloperLogs(res.data);
      } else {
        toast.error(res.message || t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsRefreshingLogs(false);
    }
  }, [t]);

  const handleDeveloperLogLevelChange = async (level: DeveloperLogLevel) => {
    setDeveloperLogLevel(level);
    const res = await invokeWrapper<string>("set_developer_log_level", {
      level,
    });
    if (!res.ok) {
      toast.error(res.message || t("common.error"));
      return;
    }
    toast.success(t("tools.settings.developer_log_level_saved"));
    await refreshDeveloperLogs();
  };

  const handleToggleDeveloperSettings = async (checked: boolean) => {
    setDeveloperSettingsEnabled(checked);
    if (checked) {
      await handleDeveloperLogLevelChange(developerLogLevel);
      await refreshDeveloperLogs();
    }
  };

  React.useEffect(() => {
    invokeWrapper<boolean>("is_auto_start_enabled").then((res) => {
      if (res.ok) setAutoStart(res.data);
    });

    invoke("set_close_behavior", { behavior: closeBehavior }).catch(() => {});

    invokeWrapper<boolean>("get_silent_start").then((res) => {
      if (res.ok) setSilentStart(res.data);
    });

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

    getVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion(FALLBACK_VERSION));
  }, []);

  React.useEffect(() => {
    if (!developerSettingsEnabled) return;
    invokeWrapper<string>("set_developer_log_level", {
      level: developerLogLevel,
    }).catch(() => {});
    refreshDeveloperLogs();
  }, []);

  // AI 服务商列表（带防御性默认值）
  const aiProviders = Array.isArray(ai?.providers) ? ai!.providers : [];
  const activeProviderId = ai?.activeProvider || aiProviders[0]?.id || "";

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

  const toggleAutoStart = async (checked: boolean) => {
    try {
      if (checked) {
        const res = await invokeWrapper("set_auto_start", { enabled: true });
        if (!res.ok) {
          toast.error(res.message || t("common.error"));
          return;
        }
      } else {
        const res = await invokeWrapper("set_auto_start", { enabled: false });
        if (!res.ok) {
          toast.error(res.message || t("common.error"));
          return;
        }
        setSilentStart(false);
        await invokeWrapper("set_silent_start", { enabled: false });
      }
      setAutoStart(checked);
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleToggleCloseToTray = async (checked: boolean) => {
    const behavior = checked ? "minimize" : "exit";
    setCloseBehavior(behavior);
    await invoke("set_close_behavior", { behavior });
  };

  const handleToggleSilentStart = async (checked: boolean) => {
    try {
      if (checked) {
        const autoStartRes = await invokeWrapper("set_auto_start", {
          enabled: true,
        });
        if (!autoStartRes.ok) {
          toast.error(autoStartRes.message || t("common.error"));
          return;
        }
        setAutoStart(true);
      }

      const res = await invokeWrapper("set_silent_start", { enabled: checked });
      if (!res.ok) {
        toast.error(t("common.error"));
        return;
      }

      setSilentStart(checked);
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus("idle");

    try {
      const releaseRes = await invokeWrapper<GitHubRelease>("check_latest_release");

      if (!releaseRes.ok) {
        throw new Error(releaseRes.message);
      }

      const release = releaseRes.data;
      const latestVersion = release.tag_name || release.name;

      if (!latestVersion) {
        throw new Error("GitHub release response missing version");
      }

      setLatestRelease({
        ...release,
        html_url: release.html_url || RELEASES_URL,
      });

      if (isNewerVersion(latestVersion, currentVersion)) {
        setUpdateStatus("available");
        toast.success(
          t("tools.settings.update_available", { version: latestVersion })
        );
      } else {
        setUpdateStatus("latest");
        toast.success(t("tools.settings.update_latest"));
      }
    } catch (error) {
      console.error("Failed to check updates:", error);
      setLatestRelease(null);
      setUpdateStatus("error");
      toast.error(t("tools.settings.update_failed"));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleTestAi = async (providerId: string) => {
    const config = aiProviders.find((p) => p.id === providerId);
    if (!config?.apiKey) {
      await confirm({
        title: t("common.error"),
        message: t("tools.settings.ai_api_key_placeholder"),
        type: "error",
      });
      return;
    }

    setTestingAi(providerId);
    try {
      const res = await invokeWrapper<string>("test_ai_connection", {
        provider: providerId,
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

  const handleAddProvider = () => {
    addAiProvider({
      id: `provider-${Date.now()}`,
      name: "",
      baseUrl: "",
      apiKey: "",
      model: "",
    });
  };

  const handleExport = async () => {
    try {
      const translatorConfig = {
        googleKey: translator.googleKey,
        youdaoKey: translator.youdaoKey,
        baiduKey: translator.baiduKey,
        tencentKey: translator.tencentKey,
        volcengineKey: translator.volcengineKey,
        deeplKey: translator.deeplKey,
      };
      const configData = JSON.stringify({
        translator: translatorConfig,
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
                | "deepl";
              if (
                [
                  "google",
                  "youdao",
                  "baidu",
                  "tencent",
                  "volcengine",
                  "deepl",
                ].includes(engine)
              ) {
                setTranslatorKey(engine, value as string);
              }
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

  const ToggleSwitch = ({
    checked,
    onChange,
    label,
    description,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between p-4 rounded-xl bg-(--bg-main)/50 hover:bg-(--bg-main)/80 transition-colors">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-(--text-main)">{label}</span>
        <span className="text-xs text-(--text-muted) mt-0.5">
          {description}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );

  const renderGeneralSettings = () => (
    <div className="space-y-2">
      <ToggleSwitch
        checked={closeBehavior === "minimize"}
        onChange={handleToggleCloseToTray}
        label={t("tools.settings.close_to_tray")}
        description={t("tools.settings.close_to_tray_desc")}
      />
      <ToggleSwitch
        checked={autoStart}
        onChange={toggleAutoStart}
        label={t("tools.settings.auto_start")}
        description={t("tools.settings.auto_start_desc")}
      />
      <ToggleSwitch
        checked={autoStart && silentStart}
        onChange={handleToggleSilentStart}
        label={t("tools.settings.silent_start")}
        description={t("tools.settings.silent_start_desc")}
      />
      <div className="flex flex-col gap-3 rounded-xl bg-(--bg-main)/50 p-4 transition-colors hover:bg-(--bg-main)/80">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-(--text-main)">
              {t("tools.settings.check_update")}
            </span>
            <span className="mt-0.5 text-xs text-(--text-muted)">
              {t("tools.settings.current_version", {
                version: currentVersion,
              })}
            </span>
          </div>
          <Button
            variant="outlined"
            onClick={handleCheckUpdate}
            disabled={isCheckingUpdate}
            className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          >
            <RefreshCw
              size={16}
              className={isCheckingUpdate ? "animate-spin" : ""}
            />
            {isCheckingUpdate
              ? t("tools.settings.checking_update")
              : t("tools.settings.check_update")}
          </Button>
        </div>
        {updateStatus !== "idle" && (
          <div className="rounded-lg border border-(--border-color) bg-(--card-bg) p-3">
            {updateStatus === "available" && latestRelease && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-(--text-main)">
                    {t("tools.settings.update_available", {
                      version: latestRelease.tag_name || latestRelease.name,
                    })}
                  </p>
                  <p className="mt-1 text-xs text-(--text-muted)">
                    {t("tools.settings.current_version", {
                      version: currentVersion,
                    })}
                  </p>
                </div>
                <Button
                  variant="contained"
                  onClick={() =>
                    openUrl(latestRelease.html_url || RELEASES_URL).catch(() =>
                      toast.error(t("common.error"))
                    )
                  }
                  className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                >
                  {t("tools.settings.open_release")}
                  <ExternalLink size={14} />
                </Button>
              </div>
            )}
            {updateStatus === "latest" && (
              <p className="text-sm font-medium text-(--text-main)">
                {t("tools.settings.update_latest")}
              </p>
            )}
            {updateStatus === "error" && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-(--text-main)">
                  {t("tools.settings.update_failed")}
                </p>
                <Button
                  variant="outlined"
                  onClick={() =>
                    openUrl(RELEASES_URL).catch(() =>
                      toast.error(t("common.error"))
                    )
                  }
                  className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                >
                  {t("tools.settings.open_release")}
                  <ExternalLink size={14} />
                </Button>
              </div>
            )}
          </div>
        )}
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
    <div className="space-y-4">
      {aiProviders.map((provider) => (
        <div
          key={provider.id}
          className="p-4 rounded-xl border border-(--border-color) bg-(--bg-main)/50 space-y-3"
        >
          {/* 标题行 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  activeProviderId === provider.id
                    ? "bg-green-500 animate-pulse"
                    : "bg-gray-400"
                }`}
              />
              <span className="text-sm font-semibold text-(--text-main)">
                {provider.name || (
                  <span className="text-(--text-muted) italic">
                    {t("tools.settings.ai_provider_name_placeholder")}
                  </span>
                )}
              </span>
              {activeProviderId === provider.id && (
                <span className="text-[10px] bg-green-500/15 text-green-600 px-2 py-0.5 rounded-full font-medium">
                  {t("tools.settings.ai_active_badge")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {activeProviderId !== provider.id && (
                <button
                  onClick={() => setAiActiveProvider(provider.id)}
                  className="text-xs text-blue-500 hover:text-blue-600 px-2 py-1 rounded border border-blue-500/30 hover:border-blue-500 transition-colors"
                >
                  {t("tools.settings.ai_set_active")}
                </button>
              )}
              <Button
                variant="text"
                size="small"
                onClick={() => handleTestAi(provider.id)}
                disabled={testingAi === provider.id}
                className="text-xs text-green-500 hover:text-green-600 flex items-center gap-1 h-auto p-0 min-w-0"
              >
                {testingAi === provider.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Zap size={12} />
                )}
                {t("tools.settings.ai_test_connection")}
              </Button>
              {aiProviders.length > 1 && (
                <button
                  onClick={() => removeAiProvider(provider.id)}
                  className="p-1 text-red-400 hover:text-red-500 rounded hover:bg-red-500/10 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 表单字段 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={t("tools.settings.ai_provider_name")}
              value={provider.name}
              placeholder={t("tools.settings.ai_provider_name_placeholder")}
              onChange={(e) =>
                updateAiProvider(provider.id, "name", e.target.value)
              }
            />
            <Input
              label={t("tools.settings.ai_model")}
              value={provider.model}
              placeholder={t("tools.settings.ai_model_placeholder")}
              onChange={(e) =>
                updateAiProvider(provider.id, "model", e.target.value)
              }
            />
            <Input
              label={t("tools.settings.ai_base_url")}
              value={provider.baseUrl}
              placeholder={t("tools.settings.ai_base_url_placeholder")}
              onChange={(e) =>
                updateAiProvider(provider.id, "baseUrl", e.target.value)
              }
            />
            <Input
              label={t("tools.settings.ai_api_key")}
              type="password"
              value={provider.apiKey}
              placeholder={t("tools.settings.ai_api_key_placeholder")}
              onChange={(e) =>
                updateAiProvider(provider.id, "apiKey", e.target.value)
              }
            />
          </div>
        </div>
      ))}

      {/* 添加服务商 */}
      <button
        onClick={handleAddProvider}
        className="w-full py-3 rounded-xl border border-dashed border-(--border-color) text-sm text-(--text-muted) hover:text-(--text-main) hover:border-blue-400 transition-colors flex items-center justify-center gap-2"
      >
        <PlusCircle size={16} />
        {t("tools.settings.ai_add_provider")}
      </button>
    </div>
  );

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
        key: "google" as const,
        label: "Google Cloud Translation API Key",
        url: "https://console.cloud.google.com/apis/credentials",
        placeholderKey: "tools.translator.google_key_placeholder",
        descKey: "tools.translator.google_key_desc",
      },
      {
        key: "youdao" as const,
        label: "Youdao Translate",
        url: "https://ai.youdao.com/console/#/",
        placeholderKey: "tools.translator.youdao_key_placeholder",
        descKey: "tools.translator.youdao_key_desc",
      },
      {
        key: "baidu" as const,
        label: "Baidu Translate",
        url: "https://fanyi-api.baidu.com/manage/developer",
        placeholderKey: "tools.translator.baidu_key_placeholder",
        descKey: "tools.translator.baidu_key_desc",
      },
      {
        key: "tencent" as const,
        label: "Tencent Translate",
        url: "https://console.cloud.tencent.com/cam/capi",
        placeholderKey: "tools.translator.tencent_key_placeholder",
        descKey: "tools.translator.tencent_key_desc",
      },
      {
        key: "volcengine" as const,
        label: "Volcengine Translate",
        url: "https://console.volcengine.com/iam/keymanage/",
        placeholderKey: "tools.translator.volcengine_key_placeholder",
        descKey: "tools.translator.volcengine_key_desc",
      },
      {
        key: "deepl" as const,
        label: "DeepL API Key",
        url: "https://www.deepl.com/en/your-account/keys",
        placeholderKey: "tools.translator.deepl_key_placeholder",
        descKey: "tools.translator.deepl_key_desc",
      },
    ];

    return (
      <div className="space-y-4">
        {translatorConfigs.map((config) => {
          const valueKey = `${config.key}Key` as keyof typeof translator;
          const value = translator[valueKey] as string;
          const credentialFields = TRANSLATOR_CREDENTIAL_FIELDS[config.key];
          const [credentialFirst, credentialSecond] =
            splitTranslatorCredential(value);
          const isTencentInvalid = Boolean(
            config.key === "tencent" &&
              credentialFirst &&
              credentialFirst.length < 30
          );
          const updateCredentialField = (
            part: "first" | "second",
            nextValue: string
          ) => {
            const nextFirst =
              part === "first" ? nextValue.trim() : credentialFirst;
            const nextSecond =
              part === "second" ? nextValue.trim() : credentialSecond;
            setTranslatorKey(
              config.key,
              joinTranslatorCredential(nextFirst, nextSecond)
            );
          };

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
              {credentialFields ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    type="password"
                    className={`text-sm ${
                      isTencentInvalid ? "border-red-500" : ""
                    }`}
                    placeholder={t(credentialFields.firstPlaceholderKey)}
                    value={credentialFirst}
                    onChange={(e) =>
                      updateCredentialField("first", e.target.value)
                    }
                  />
                  <Input
                    type="password"
                    className="text-sm"
                    placeholder={t(credentialFields.secondPlaceholderKey)}
                    value={credentialSecond}
                    onChange={(e) =>
                      updateCredentialField("second", e.target.value)
                    }
                  />
                </div>
              ) : (
                <Input
                  type="password"
                  className="text-sm"
                  placeholder={t(config.placeholderKey)}
                  value={value}
                  onChange={(e) => setTranslatorKey(config.key, e.target.value)}
                />
              )}
              <p className="text-xs text-(--text-muted)">{t(config.descKey)}</p>
              {isTencentInvalid && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1 animate-pulse">
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    SecretId 长度不足！当前 {credentialFirst.length}{" "}
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

  const renderDeveloperSettings = () => (
    <div className="space-y-4">
      <ToggleSwitch
        checked={developerSettingsEnabled}
        onChange={handleToggleDeveloperSettings}
        label={t("tools.settings.developer_settings")}
        description={t("tools.settings.developer_settings_desc")}
      />

      {developerSettingsEnabled && (
        <div className="space-y-4 rounded-xl border border-(--border-color) bg-(--bg-main)/50 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-(--text-main)">
                {t("tools.settings.developer_log_level")}
              </label>
              <select
                value={developerLogLevel}
                onChange={(event) =>
                  handleDeveloperLogLevelChange(
                    event.target.value as DeveloperLogLevel
                  )
                }
                className="w-full rounded-lg border border-(--border-color) bg-(--card-bg) px-3 py-2 text-sm text-(--text-main) outline-none focus:border-(--primary-color)"
              >
                {LOG_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`tools.settings.developer_log_level_${level}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-(--text-muted)">
                {t("tools.settings.developer_log_level_desc")}
              </p>
            </div>

            <div className="flex flex-col justify-end gap-2 sm:flex-row sm:items-end">
              <Button
                variant="outlined"
                onClick={refreshDeveloperLogs}
                disabled={isRefreshingLogs}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                <RefreshCw
                  size={16}
                  className={isRefreshingLogs ? "animate-spin" : ""}
                />
                {t("tools.settings.developer_logs_refresh")}
              </Button>
              <Button
                variant="outlined"
                onClick={() =>
                  developerLogs?.logDir &&
                  openPath(developerLogs.logDir).catch(() =>
                    toast.error(t("common.error"))
                  )
                }
                disabled={!developerLogs?.logDir}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                <FolderInput size={16} />
                {t("tools.settings.developer_logs_open_dir")}
              </Button>
            </div>
          </div>

          {developerLogs?.logDir && (
            <div className="rounded-lg border border-(--border-color) bg-(--card-bg) px-3 py-2 text-xs text-(--text-muted)">
              {developerLogs.logDir}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-(--text-main)">
                <FileText size={16} />
                {t("tools.settings.developer_run_log")}
              </div>
              <pre className="h-80 overflow-auto rounded-xl border border-(--border-color) bg-(--card-bg) p-3 text-xs leading-relaxed text-(--text-main)">
                {developerLogs?.runLog ||
                  t("tools.settings.developer_logs_empty")}
              </pre>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-(--text-main)">
                <Bug size={16} />
                {t("tools.settings.developer_error_log")}
              </div>
              <pre className="h-80 overflow-auto rounded-xl border border-(--border-color) bg-(--card-bg) p-3 text-xs leading-relaxed text-(--text-main)">
                {developerLogs?.errorLog ||
                  t("tools.settings.developer_logs_empty")}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );

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
      case "developer":
        return renderDeveloperSettings();
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

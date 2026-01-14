/**
 * 系统设置页面
 * 职责：管理全局配置，如翻译引擎的 API Keys
 */
import React from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ToolLayout } from "../components/layout/ToolLayout";
import { useSettingsStore } from "../stores/useSettingsStore";
import {
  Key,
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
} from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { invokeWrapper } from "../api";
import { useModal } from "../components/ModalContext";
import { Input } from "../components/mui";
import { Button } from "../components/mui";

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

  // 导出导入相关状态
  const [encryptExport, setEncryptExport] = React.useState(false);
  const [exportPassword, setExportPassword] = React.useState("");
  const [importPassword, setImportPassword] = React.useState("");

  React.useEffect(() => {
    // 检查开机自启状态
    invoke<boolean>("plugin:autostart|is_enabled")
      .then((yes) => setAutoStart(yes))
      .catch((e) => console.error("Autostart check failed", e));

    // 同步关闭行为配置到后端
    invoke("set_close_behavior", { behavior: closeBehavior }).catch(
      console.error
    );

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

  // 防御性检查 AI 配置，确保所有服务商配置都存在
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
    // 保存管理员启动设置到系统
    await invokeWrapper("set_run_as_admin", { enabled: runAsAdmin });
    // 同步剪贴板配置
    await invokeWrapper("set_clipboard_config", {
      prefix: clipboardPrefix,
      suffix: clipboardSuffix,
    });
    // 保存快捷键配置
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

    // 忽略单独的修饰键
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
      return;
    }

    // 生成快捷键字符串
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
    } catch (err) {
      toast.error(t("common.error"));
      console.error(err);
    }
  };

  const handleSetCloseBehavior = async (val: "minimize" | "exit") => {
    setCloseBehavior(val);
    await invoke("set_close_behavior", { behavior: val });
  };

  const handleTestAi = async (provider: string) => {
    const config = (safeAi.providers as any)[provider];
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
    } catch (error: any) {
      await confirm({
        title: t("common.error"),
        message: t("tools.settings.ai_test_failed", { message: error.message }),
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
    } catch (error: any) {
      await confirm({
        title: t("common.error"),
        message: t("tools.settings.export_failed", { message: error.message }),
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
              const engine = key.replace("Key", "") as any;
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
    } catch (error: any) {
      await confirm({
        title: t("common.error"),
        message: t("tools.settings.import_failed", { message: error.message }),
        type: "error",
      });
    }
  };

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
      <div className="max-w-3xl mx-auto w-full space-y-6 pb-10">
        {/* 通用设置 */}
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center gap-2">
            <Settings2 size={18} className="text-gray-500" />
            <h2 className="font-bold text-[var(--text-main)]">
              {t("tools.settings.general_settings")}
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {/* 开机自启 */}
            <div className="flex items-start gap-4">
              <div className="flex items-center h-5">
                <input
                  id="auto-start"
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-[var(--border-color)] rounded focus:ring-blue-500 bg-[var(--bg-main)]"
                  checked={autoStart}
                  onChange={toggleAutoStart}
                />
              </div>
              <div className="flex flex-col">
                <label
                  htmlFor="auto-start"
                  className="text-sm font-medium text-[var(--text-main)] cursor-pointer"
                >
                  {t("tools.settings.auto_start")}
                </label>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {t("tools.settings.auto_start_desc")}
                </p>
              </div>
            </div>

            {/* 关闭行为 */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-[var(--text-main)]">
                {t("tools.settings.close_behavior")}
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="close-behavior"
                    className="w-4 h-4 text-blue-600 border-[var(--border-color)] focus:ring-blue-500 bg-[var(--bg-main)]"
                    checked={closeBehavior === "minimize"}
                    onChange={() => handleSetCloseBehavior("minimize")}
                  />
                  <span className="text-sm text-[var(--text-main)]">
                    {t("tools.settings.close_minimize")}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="close-behavior"
                    className="w-4 h-4 text-blue-600 border-[var(--border-color)] focus:ring-blue-500 bg-[var(--bg-main)]"
                    checked={closeBehavior === "exit"}
                    onChange={() => handleSetCloseBehavior("exit")}
                  />
                  <span className="text-sm text-[var(--text-main)]">
                    {t("tools.settings.close_exit")}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 快捷键设置 */}
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center gap-2">
            <Keyboard size={18} className="text-indigo-500" />
            <h2 className="font-bold text-[var(--text-main)]">
              {t("tools.settings.shortcut_settings")}
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-main)] mb-2">
                  {t("tools.settings.global_shortcut")}
                </label>
                <p className="text-xs text-[var(--text-muted)] mb-4">
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
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  {t("tools.settings.shortcut_example")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 管理员模式 */}
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center gap-2">
            <Shield size={18} className="text-orange-500" />
            <h2 className="font-bold text-[var(--text-main)]">
              {t("tools.settings.admin_mode")}
            </h2>
          </div>
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center h-5">
                <input
                  id="run-as-admin"
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-[var(--border-color)] rounded focus:ring-blue-500 bg-[var(--bg-main)]"
                  checked={runAsAdmin}
                  onChange={(e) => setRunAsAdmin(e.target.checked)}
                />
              </div>
              <div className="flex flex-col">
                <label
                  htmlFor="run-as-admin"
                  className="text-sm font-medium text-[var(--text-main)] cursor-pointer"
                >
                  {t("tools.settings.run_as_admin")}
                </label>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {t("tools.settings.run_as_admin_desc")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 剪贴板设置 */}
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center gap-2">
            <Clipboard size={18} className="text-blue-500" />
            <h2 className="font-bold text-[var(--text-main)]">
              {t("tools.settings.clipboard_settings")}
            </h2>
          </div>
          <div className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center h-5">
                <input
                  id="clipboard-monitoring"
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-[var(--border-color)] rounded focus:ring-blue-500 bg-[var(--bg-main)]"
                  checked={clipboardEnabled}
                  onChange={(e) => setClipboardEnabled(e.target.checked)}
                />
              </div>
              <div className="flex flex-col">
                <label
                  htmlFor="clipboard-monitoring"
                  className="text-sm font-medium text-[var(--text-main)] cursor-pointer"
                >
                  {t("tools.settings.clipboard_monitoring")}
                </label>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {t("tools.settings.clipboard_monitoring_desc")}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--text-main)]">
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
                <label className="text-sm font-medium text-[var(--text-main)]">
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
        </div>

        {/* AI 设置 */}
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center gap-2">
            <Key size={18} className="text-purple-500" />
            <h2 className="font-bold text-[var(--text-main)]">
              {t("tools.settings.ai_settings")}
            </h2>
          </div>
          <div className="p-6 space-y-8">
            {/* Active Provider Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-main)]">
                {t("tools.settings.ai_active_provider")}
              </label>
              <div className="flex flex-wrap gap-4">
                {["deepseek", "doubao", "openai", "siliconflow"].map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name="active-provider"
                      className="w-4 h-4 text-blue-600 border-[var(--border-color)] focus:ring-blue-500 bg-[var(--bg-main)]"
                      checked={safeAi.activeProvider === p}
                      onChange={() => setAiActiveProvider(p as any)}
                    />
                    <span
                      className={`text-sm transition-colors ${
                        safeAi.activeProvider === p
                          ? "text-blue-500 font-bold"
                          : "text-[var(--text-muted)] group-hover:text-[var(--text-main)]"
                      }`}
                    >
                      {p === "deepseek"
                        ? t("tools.settings.ai_deepseek_name")
                        : p === "doubao"
                        ? t("tools.settings.ai_doubao_name")
                        : p === "openai"
                        ? t("tools.settings.ai_openai_name")
                        : t("tools.settings.ai_siliconflow_name")}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* DeepSeek Settings */}
              <div className="space-y-4 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        safeAi.activeProvider === "deepseek"
                          ? "bg-green-500 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    DeepSeek
                  </h3>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleTestAi("deepseek")}
                      disabled={testingAi === "deepseek"}
                      className="text-[10px] text-green-500 hover:text-green-600 flex items-center gap-1 h-auto p-0"
                    >
                      {testingAi === "deepseek" ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Zap size={10} />
                      )}
                      {t("tools.settings.ai_test_connection")}
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => openPath("https://platform.deepseek.com/")}
                      className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 h-auto p-0"
                    >
                      {t("tools.translator.get_key")} <ExternalLink size={10} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    label={t("tools.settings.ai_api_key")}
                    type="password"
                    value={safeAi.providers.deepseek.apiKey}
                    placeholder={t("tools.settings.ai_api_key_placeholder")}
                    onChange={(e) =>
                      setAiProviderSetting("deepseek", "apiKey", e.target.value)
                    }
                  />

                  <Input
                    label={t("tools.settings.ai_model")}
                    type="text"
                    placeholder="deepseek-chat"
                    value={safeAi.providers.deepseek.model}
                    onChange={(e) =>
                      setAiProviderSetting("deepseek", "model", e.target.value)
                    }
                  />
                </div>
              </div>

              {/* Doubao Settings */}
              <div className="space-y-4 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        safeAi.activeProvider === "doubao"
                          ? "bg-green-500 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    {t("tools.settings.ai_doubao_title").split(" ")[0]}
                  </h3>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleTestAi("doubao")}
                      disabled={testingAi === "doubao"}
                      className="text-[10px] text-green-500 hover:text-green-600 flex items-center gap-1 h-auto p-0"
                    >
                      {testingAi === "doubao" ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Zap size={10} />
                      )}
                      {t("tools.settings.ai_test_connection")}
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() =>
                        openPath(
                          "https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint"
                        )
                      }
                      className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 h-auto p-0"
                    >
                      {t("tools.translator.get_key")} <ExternalLink size={10} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    label={t("tools.settings.ai_api_key")}
                    type="password"
                    value={safeAi.providers.doubao.apiKey}
                    placeholder={t("tools.settings.ai_api_key_placeholder")}
                    onChange={(e) =>
                      setAiProviderSetting("doubao", "apiKey", e.target.value)
                    }
                  />

                  <Input
                    label={t("tools.settings.ai_doubao_model_desc")}
                    type="text"
                    placeholder="ep-2024..."
                    value={safeAi.providers.doubao.model}
                    onChange={(e) =>
                      setAiProviderSetting("doubao", "model", e.target.value)
                    }
                  />
                </div>
              </div>

              {/* OpenAI Settings */}
              <div className="space-y-4 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        safeAi.activeProvider === "openai"
                          ? "bg-green-500 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    OpenAI
                  </h3>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleTestAi("openai")}
                      disabled={testingAi === "openai"}
                      className="text-[10px] text-green-500 hover:text-green-600 flex items-center gap-1 h-auto p-0"
                    >
                      {testingAi === "openai" ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Zap size={10} />
                      )}
                      {t("tools.settings.ai_test_connection")}
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => openPath("https://platform.openai.com/")}
                      className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 h-auto p-0"
                    >
                      {t("tools.translator.get_key")} <ExternalLink size={10} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    label={t("tools.settings.ai_api_key")}
                    type="password"
                    value={safeAi.providers.openai.apiKey}
                    placeholder={t("tools.settings.ai_api_key_placeholder")}
                    onChange={(e) =>
                      setAiProviderSetting("openai", "apiKey", e.target.value)
                    }
                  />

                  <Input
                    label={t("tools.settings.ai_model")}
                    type="text"
                    placeholder="gpt-4o"
                    value={safeAi.providers.openai.model}
                    onChange={(e) =>
                      setAiProviderSetting("openai", "model", e.target.value)
                    }
                  />

                  <Input
                    label={t("tools.settings.ai_base_url")}
                    type="text"
                    placeholder="https://api.openai.com/v1"
                    value={safeAi.providers.openai.baseUrl}
                    onChange={(e) =>
                      setAiProviderSetting("openai", "baseUrl", e.target.value)
                    }
                  />
                </div>
              </div>

              {/* SiliconFlow Settings */}
              <div className="space-y-4 p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        safeAi.activeProvider === "siliconflow"
                          ? "bg-green-500 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    />
                    SiliconFlow
                  </h3>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleTestAi("siliconflow")}
                      disabled={testingAi === "siliconflow"}
                      className="text-[10px] text-green-500 hover:text-green-600 flex items-center gap-1 h-auto p-0"
                    >
                      {testingAi === "siliconflow" ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Zap size={10} />
                      )}
                      {t("tools.settings.ai_test_connection")}
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => openPath("https://cloud.siliconflow.cn/")}
                      className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 h-auto p-0"
                    >
                      {t("tools.translator.get_key")} <ExternalLink size={10} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    label={t("tools.settings.ai_api_key")}
                    type="password"
                    value={safeAi.providers.siliconflow.apiKey}
                    placeholder={t("tools.settings.ai_api_key_placeholder")}
                    onChange={(e) =>
                      setAiProviderSetting(
                        "siliconflow",
                        "apiKey",
                        e.target.value
                      )
                    }
                  />

                  <Input
                    label={t("tools.settings.ai_model")}
                    type="text"
                    placeholder="deepseek-ai/DeepSeek-V3"
                    value={safeAi.providers.siliconflow.model}
                    onChange={(e) =>
                      setAiProviderSetting(
                        "siliconflow",
                        "model",
                        e.target.value
                      )
                    }
                  />

                  <Input
                    label={t("tools.settings.ai_base_url")}
                    type="text"
                    placeholder="https://api.siliconflow.cn/v1"
                    value={safeAi.providers.siliconflow.baseUrl}
                    onChange={(e) =>
                      setAiProviderSetting(
                        "siliconflow",
                        "baseUrl",
                        e.target.value
                      )
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* OCR 设置 */}
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center gap-2">
            <Camera size={18} className="text-blue-500" />
            <h2 className="font-bold text-[var(--text-main)]">
              {t("tools.ocr.settings")}
            </h2>
          </div>
          <div className="p-6 space-y-8">
            {/* Tencent OCR */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text-main)]">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-main)]">
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
                  <label className="text-sm font-medium text-[var(--text-main)]">
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
                <label className="text-sm font-medium text-[var(--text-main)]">
                  {t("tools.ocr.tencent_region")}
                </label>
                <Input
                  fullWidth
                  placeholder="ap-shanghai"
                  value={ocr.tencentRegion}
                  onChange={(e) =>
                    setOcrSetting("tencentRegion", e.target.value)
                  }
                />
                <p className="text-xs text-[var(--text-muted)]">
                  例如: ap-shanghai, ap-guangzhou, ap-beijing
                </p>
              </div>
            </div>

            {/* Baidu OCR */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--text-main)]">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-main)]">
                    {t("tools.ocr.baidu_api_key")}
                  </label>
                  <Input
                    fullWidth
                    type="password"
                    placeholder="API Key"
                    value={ocr.baiduApiKey}
                    onChange={(e) =>
                      setOcrSetting("baiduApiKey", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-main)]">
                    {t("tools.ocr.baidu_secret_key")}
                  </label>
                  <Input
                    fullWidth
                    type="password"
                    placeholder="Secret Key"
                    value={ocr.baiduSecretKey}
                    onChange={(e) =>
                      setOcrSetting("baiduSecretKey", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 翻译设置 */}
        <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center gap-2">
            <Key size={18} className="text-blue-500" />
            <h2 className="font-bold text-[var(--text-main)]">
              {t("tools.settings.translator_keys")}
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {/* Google */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  Google Cloud Translation API Key
                </label>
                <Button
                  variant="text"
                  size="small"
                  onClick={() =>
                    openPath(
                      "https://console.cloud.google.com/apis/credentials"
                    )
                  }
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer h-auto p-0"
                >
                  {t("tools.translator.get_key")} <ExternalLink size={12} />
                </Button>
              </div>
              <Input
                type="password"
                className="text-sm"
                placeholder={t("tools.translator.google_key_placeholder")}
                value={translator.googleKey}
                onChange={(e) => setTranslatorKey("google", e.target.value)}
              />
              <p className="text-xs text-[var(--text-muted)]">
                {t("tools.translator.google_key_desc")}
              </p>
            </div>

            {/* Youdao */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  Youdao Translate (AppKey:Secret)
                </label>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => openPath("https://ai.youdao.com/console/#/")}
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer h-auto p-0"
                >
                  {t("tools.translator.get_key")} <ExternalLink size={12} />
                </Button>
              </div>
              <Input
                type="password"
                className="text-sm"
                placeholder={t("tools.translator.youdao_key_placeholder")}
                value={translator.youdaoKey}
                onChange={(e) => setTranslatorKey("youdao", e.target.value)}
              />
              <p className="text-xs text-[var(--text-muted)]">
                {t("tools.translator.youdao_key_desc")}
              </p>
            </div>

            {/* Baidu */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  Baidu Translate (AppID:Secret)
                </label>
                <Button
                  variant="text"
                  size="small"
                  onClick={() =>
                    openPath("https://fanyi-api.baidu.com/manage/developer")
                  }
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer h-auto p-0"
                >
                  {t("tools.translator.get_key")} <ExternalLink size={12} />
                </Button>
              </div>
              <Input
                type="password"
                className="text-sm"
                placeholder={t("tools.translator.baidu_key_placeholder")}
                value={translator.baiduKey}
                onChange={(e) => setTranslatorKey("baidu", e.target.value)}
              />
              <p className="text-xs text-[var(--text-muted)]">
                {t("tools.translator.baidu_key_desc")}
              </p>
            </div>

            {/* Tencent */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  Tencent Translate (SecretId:SecretKey)
                </label>
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
              <Input
                type="password"
                className={`text-sm font-mono ${
                  translator.tencentKey &&
                  translator.tencentKey.split(":")[0]?.length < 30
                    ? "border-red-500"
                    : ""
                }`}
                placeholder={t("tools.translator.tencent_key_placeholder")}
                value={translator.tencentKey}
                onChange={(e) =>
                  setTranslatorKey("tencent", e.target.value.trim())
                }
              />
              <p className="text-xs text-[var(--text-muted)]">
                {t("tools.translator.tencent_key_desc")}
              </p>
              <div className="space-y-1">
                {translator.tencentKey &&
                  translator.tencentKey.split(":")[0]?.length < 30 && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1 animate-pulse">
                      <span className="mt-0.5">❌</span>
                      <span>
                        SecretId 长度不足！当前{" "}
                        {translator.tencentKey.split(":")[0]?.length} 字符，应为
                        36-40 字符
                      </span>
                    </p>
                  )}
              </div>
            </div>

            {/* Volcengine */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  Volcengine Translate (AccessKey:SecretKey)
                </label>
                <Button
                  variant="text"
                  size="small"
                  onClick={() =>
                    openPath("https://console.volcengine.com/iam/keymanage/")
                  }
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer h-auto p-0"
                >
                  {t("tools.translator.get_key")} <ExternalLink size={12} />
                </Button>
              </div>
              <Input
                type="password"
                className="text-sm font-mono"
                placeholder={t("tools.translator.volcengine_key_placeholder")}
                value={translator.volcengineKey}
                onChange={(e) =>
                  setTranslatorKey("volcengine", e.target.value.trim())
                }
              />
              <p className="text-xs text-[var(--text-muted)]">
                {t("tools.translator.volcengine_key_desc")}
              </p>
            </div>

            {/* DeepL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  DeepL API Key
                </label>
                <Button
                  variant="text"
                  size="small"
                  onClick={() =>
                    openPath("https://www.deepl.com/en/your-account/keys")
                  }
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer h-auto p-0"
                >
                  {t("tools.translator.get_key")} <ExternalLink size={12} />
                </Button>
              </div>
              <Input
                type="password"
                className="text-sm"
                placeholder={t("tools.translator.deepl_key_placeholder")}
                value={translator.deeplKey}
                onChange={(e) => setTranslatorKey("deepl", e.target.value)}
              />
              <p className="text-xs text-[var(--text-muted)]">
                {t("tools.translator.deepl_key_desc")}
              </p>
            </div>

            {/* DeepLX */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--text-main)]">
                  DeepLX API Key
                </label>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => openPath("https://api.deeplx.org/")}
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1 cursor-pointer h-auto p-0"
                >
                  {t("tools.translator.get_key")} <ExternalLink size={12} />
                </Button>
              </div>
              <Input
                type="password"
                className="text-sm"
                placeholder={t("tools.translator.deeplx_key_placeholder")}
                value={translator.deeplxKey}
                onChange={(e) => setTranslatorKey("deeplx", e.target.value)}
              />
              <p className="text-xs text-[var(--text-muted)]">
                {t("tools.translator.deeplx_key_desc")}
              </p>
            </div>
          </div>
        </div>

        {/* 导出导入 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 导出 */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center gap-2">
              <Download size={18} className="text-green-500" />
              <h2 className="font-bold text-[var(--text-main)]">
                {t("tools.settings.export_config")}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-muted)]">
                {t("tools.settings.export_desc")}
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="encrypt-export"
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-[var(--border-color)] rounded focus:ring-blue-500 bg-[var(--bg-main)]"
                    checked={encryptExport}
                    onChange={(e) => setEncryptExport(e.target.checked)}
                  />
                  <label
                    htmlFor="encrypt-export"
                    className="text-sm text-[var(--text-main)] cursor-pointer"
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                >
                  <Download size={16} />
                  {t("tools.settings.export_config")}
                </Button>
              </div>
            </div>
          </div>

          {/* 导入 */}
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/30 flex items-center gap-2">
              <Upload size={18} className="text-purple-500" />
              <h2 className="font-bold text-[var(--text-main)]">
                {t("tools.settings.import_config")}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-muted)]">
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-xl text-sm font-medium transition-all"
                >
                  <Upload size={16} />
                  {t("tools.settings.import_config")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
};

export default Settings;

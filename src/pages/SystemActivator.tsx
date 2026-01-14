/**
 * 系统激活工具页面
 * 负责启动激活程序，激活程序将在独立窗口中运行
 */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import { AlertCircle, ExternalLink, Play, Square, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useModal } from "../components/ModalContext";
import { ToolLayout } from "../components/layout/ToolLayout";
import { InstructionsCard } from "../components/shared/InstructionsCard";
import { LogViewer } from "../components/shared/LogViewer";
import { Button } from "../components/mui";

const SystemActivator: React.FC = () => {
  const { t } = useTranslation();
  const { confirm } = useModal();
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState(t("tools.system_activator.ready"));

  // 使用 useMemo 构建步骤数据
  const instructionSteps = useMemo(
    () => [
      {
        title: t("tools.system_activator.instructions.step1_title"),
        description: t("tools.system_activator.instructions.step1_desc"),
      },
      {
        title: t("tools.system_activator.instructions.step2_title"),
        description: t("tools.system_activator.instructions.step2_desc"),
      },
      {
        title: t("tools.system_activator.instructions.step3_title"),
        description: t("tools.system_activator.instructions.step3_desc"),
      },
      {
        title: t("tools.system_activator.instructions.step4_title"),
        description: t("tools.system_activator.instructions.step4_desc"),
      },
    ],
    [t]
  );

  // 监听后端事件
  useEffect(() => {
    let unlistenDone: () => void;

    const setupListeners = async () => {
      unlistenDone = await listen<number>("activation://done", (event) => {
        setIsRunning(false);
        setStatus(t("tools.system_activator.ready"));
        setLogs((prev) => [
          ...prev,
          t("tools.system_activator.process_ended", { code: event.payload }),
        ]);
      });
    };

    setupListeners();

    return () => {
      if (unlistenDone) unlistenDone();
    };
  }, [t]);

  const handleStart = async () => {
    const confirmed = await confirm({
      title: t("tools.system_activator.warning_title"),
      message: t("tools.system_activator.warning_content"),
    });

    if (!confirmed) return;

    try {
      setLogs([]);
      setLogs((prev) => [
        ...prev,
        "=".repeat(50),
        t("tools.system_activator.start_msg"),
        t("tools.system_activator.cmd_msg"),
        "=".repeat(50),
        "",
      ]);
      setIsRunning(true);
      setStatus(t("tools.system_activator.running"));
      await invoke("start_activation");
    } catch (error) {
      setLogs((prev) => [...prev, `[ERROR] ${error}`]);
      setIsRunning(false);
      setStatus(t("tools.system_activator.ready"));
    }
  };

  const handleStop = async () => {
    try {
      await invoke("stop_activation");
      setLogs((prev) => [
        ...prev,
        t("tools.system_activator.process_terminated"),
      ]);
      setIsRunning(false);
      setStatus(t("tools.system_activator.ready"));
    } catch (error) {
      setLogs((prev) => [...prev, `[ERROR] ${error}`]);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <ToolLayout title={t("tools.system_activator.name")} status={status}>
      <div className="flex flex-col gap-4 h-full">
        {/* 说明区域 */}
        <div className="space-y-3">
          <InstructionsCard
            title={t("tools.system_activator.instructions.title")}
            steps={instructionSteps}
            color="red"
            icon={AlertCircle}
          />
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-2">
          <Button
            onClick={handleStart}
            disabled={isRunning}
            color="success"
            variant="contained"
            className="flex items-center gap-2"
          >
            <Play size={16} />
            {t("tools.system_activator.start")}
          </Button>
          <Button
            onClick={handleStop}
            disabled={!isRunning}
            color="error"
            variant="contained"
            className="flex items-center gap-2"
          >
            <Square size={16} />
            {t("tools.system_activator.stop")}
          </Button>
          <Button
            onClick={handleClearLogs}
            variant="outlined"
            className="flex items-center gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10 ml-auto"
          >
            <Trash2 size={16} />
            {t("tools.system_activator.clear")}
          </Button>
          <Button
            variant="outlined"
            onClick={() => openPath("https://massgrave.dev/")}
            className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors bg-blue-500/10 px-3 py-1.5 rounded border border-blue-500/30 w-fit h-auto"
          >
            <ExternalLink size={14} />
            {t("tools.system_activator.view_docs")}
          </Button>
        </div>

        {/* 日志输出 */}
        <div className="flex-1 min-h-0">
          <LogViewer
            logs={logs}
            onClear={handleClearLogs}
            title={t("tools.system_activator.name")}
            maxHeight="100%"
          />
        </div>
      </div>
    </ToolLayout>
  );
};

export default SystemActivator;


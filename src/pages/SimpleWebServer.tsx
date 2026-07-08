import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { ToolLayout } from "../components/layout/ToolLayout";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, Lightbulb } from "lucide-react";
import { InstructionsDialog } from "../components/shared/InstructionsDialog";

interface ServerStatus {
  is_running: boolean;
  port: number;
  ip: string;
}

export default function SimpleWebServer() {
  const { t } = useTranslation();
  const [folderPath, setFolderPath] = useState("");
  const [port, setPort] = useState(8080);
  const [isRunning, setIsRunning] = useState(false);
  const [localAddress, setLocalAddress] = useState("");
  const [networkAddress, setNetworkAddress] = useState("");

  useEffect(() => {
    // 获取初始服务器状态
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    try {
      const response: any = await invoke("get_web_server_status");
      if (response.ok && response.data) {
        const status: ServerStatus = response.data;
        setIsRunning(status.is_running);
        if (status.is_running) {
          setPort(status.port);
          setLocalAddress(`http://127.0.0.1:${status.port}`);
          setNetworkAddress(`http://${status.ip}:${status.port}`);
        }
      }
    } catch (error) {
      console.error("Failed to get server status:", error);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("tools.simple_web_server.select_folder"),
      });

      if (selected && typeof selected === "string") {
        setFolderPath(selected);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
      toast.error(t("common.error"));
    }
  };

  const handleStartServer = async () => {
    if (!folderPath) {
      toast.error(t("tools.simple_web_server.no_folder_selected"));
      return;
    }

    if (port < 1024 || port > 65535) {
      toast.error(t("tools.simple_web_server.invalid_port"));
      return;
    }

    try {
      const response: any = await invoke("start_web_server", {
        request: {
          root_dir: folderPath,
          port: port,
        },
      });

      if (response.ok && response.data) {
        setIsRunning(true);
        setLocalAddress(`http://127.0.0.1:${response.data.port}`);
        setNetworkAddress(`http://${response.data.ip}:${response.data.port}`);
        toast.success(t("tools.simple_web_server.start_success"));
      } else if (response.error) {
        toast.error(t(response.error.message_key));
      }
    } catch (error) {
      console.error("Failed to start server:", error);
      toast.error(t("tools.simple_web_server.start_failed"));
    }
  };

  const handleStopServer = async () => {
    try {
      const response: any = await invoke("stop_web_server");

      if (response.ok) {
        setIsRunning(false);
        setLocalAddress("");
        setNetworkAddress("");
        toast.success(t("tools.simple_web_server.stop_success"));
      } else if (response.error) {
        toast.error(t(response.error.message_key));
      }
    } catch (error) {
      console.error("Failed to stop server:", error);
      toast.error(t("tools.simple_web_server.stop_failed"));
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success(t("common.copy_success"));
  };

  const handleOpenBrowser = async (address: string) => {
    try {
      await openPath(address);
    } catch (error) {
      console.error("Failed to open URL:", error);
      toast.error(t("common.error"));
    }
  };

  return (
    <ToolLayout title={t("tools.simple_web_server.name")}>
      <div className="space-y-6">
        {/* 设计思路 */}
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex justify-end mb-3">
            <InstructionsDialog
              title={t("tools.simple_web_server.instructions.title")}
              steps={[
                {
                  title: t("tools.simple_web_server.instructions.step1_title"),
                  description: t(
                    "tools.simple_web_server.instructions.step1_desc"
                  ),
                },
                {
                  title: t("tools.simple_web_server.instructions.step2_title"),
                  description: t(
                    "tools.simple_web_server.instructions.step2_desc"
                  ),
                },
                {
                  title: t("tools.simple_web_server.instructions.step3_title"),
                  description: t(
                    "tools.simple_web_server.instructions.step3_desc"
                  ),
                },
                {
                  title: t("tools.simple_web_server.instructions.step4_title"),
                  description: t(
                    "tools.simple_web_server.instructions.step4_desc"
                  ),
                },
              ]}
            />
          </div>
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-base font-semibold text-orange-800 dark:text-orange-300 mb-1">
                {t("tools.simple_web_server.design_philosophy.title")}
              </h3>
              <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed">
                {t("tools.simple_web_server.design_philosophy.content")}
              </p>
            </div>
          </div>
        </div>

        {/* 配置区域 */}
        <div className="bg-(--bg-secondary) rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-(--text-main) mb-2">
              {t("tools.simple_web_server.folder_path")}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={folderPath}
                readOnly
                placeholder={t("tools.simple_web_server.select_folder")}
                className="flex-1 px-3 py-2 bg-(--bg-main) border border-(--border-main) rounded-lg text-(--text-main) focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSelectFolder}
                disabled={isRunning}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {t("common.browse")}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-(--text-main) mb-2">
              {t("tools.simple_web_server.port")}
            </label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 8080)}
              disabled={isRunning}
              min={1024}
              max={65535}
              className="w-full px-3 py-2 bg-(--bg-main) border border-(--border-main) rounded-lg text-(--text-main) focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex gap-2">
            {!isRunning ? (
              <button
                onClick={handleStartServer}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
              >
                {t("tools.simple_web_server.start_server")}
              </button>
            ) : (
              <button
                onClick={handleStopServer}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                {t("tools.simple_web_server.stop_server")}
              </button>
            )}
          </div>
        </div>

        {/* 服务器状态 */}
        <div className="bg-(--bg-secondary) rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div
              className={`w-3 h-3 rounded-full ${
                isRunning ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <span className="text-lg font-medium text-(--text-main)">
              {isRunning
                ? t("tools.simple_web_server.server_running")
                : t("tools.simple_web_server.server_stopped")}
            </span>
          </div>

          {isRunning && localAddress && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                  {t("tools.simple_web_server.local_address")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localAddress}
                    readOnly
                    className="flex-1 px-3 py-2 bg-(--bg-main) border border-(--border-main) rounded-lg text-(--text-main) font-mono text-sm"
                  />
                  <button
                    onClick={() => handleCopyAddress(localAddress)}
                    className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
                    title={t("tools.simple_web_server.copy_address")}
                  >
                    <Copy size={20} />
                  </button>
                  <button
                    onClick={() => handleOpenBrowser(localAddress)}
                    className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center"
                    title={t("tools.simple_web_server.open_browser")}
                  >
                    <ExternalLink size={20} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                  {t("tools.simple_web_server.network_address")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={networkAddress}
                    readOnly
                    className="flex-1 px-3 py-2 bg-(--bg-main) border border-(--border-main) rounded-lg text-(--text-main) font-mono text-sm"
                  />
                  <button
                    onClick={() => handleCopyAddress(networkAddress)}
                    className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
                    title={t("tools.simple_web_server.copy_address")}
                  >
                    <Copy size={20} />
                  </button>
                  <button
                    onClick={() => handleOpenBrowser(networkAddress)}
                    className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center"
                    title={t("tools.simple_web_server.open_browser")}
                  >
                    <ExternalLink size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}

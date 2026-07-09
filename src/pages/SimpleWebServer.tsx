import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { ToolLayout } from "../components/layout/ToolLayout";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  Copy,
  ExternalLink,
  FolderOpen,
  Monitor,
  Play,
  Server,
  Square,
  Wifi,
} from "lucide-react";
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
    <ToolLayout
      title={t("tools.simple_web_server.name")}
      status={
        isRunning
          ? t("tools.simple_web_server.server_running")
          : t("tools.simple_web_server.server_stopped")
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-6">
        <section className="rounded-2xl border border-(--border-color) bg-(--card-bg) p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Server className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-bold text-(--text-main)">
                    {t("tools.simple_web_server.name")}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
                      isRunning
                        ? "bg-green-500/10 text-green-500"
                        : "bg-slate-500/10 text-(--text-muted)"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isRunning ? "bg-green-500" : "bg-slate-400"
                      }`}
                    />
                    {isRunning
                      ? t("tools.simple_web_server.server_running")
                      : t("tools.simple_web_server.server_stopped")}
                  </span>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-(--text-muted)">
                  {t("tools.simple_web_server.design_philosophy.content")}
                </p>
              </div>
            </div>
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
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-(--border-color) bg-(--card-bg) p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FolderOpen className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-(--text-main)">
                {t("tools.simple_web_server.folder_path")}
              </h3>
            </div>

            <div className="space-y-5">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <FolderOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-muted)" />
                  <input
                    type="text"
                    value={folderPath}
                    readOnly
                    title={
                      folderPath || t("tools.simple_web_server.select_folder")
                    }
                    placeholder={t("tools.simple_web_server.select_folder")}
                    className="h-11 w-full rounded-xl border border-(--border-color) bg-(--bg-main) pl-10 pr-3 text-sm text-(--text-main) outline-none placeholder:text-(--text-muted) focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <button
                  onClick={handleSelectFolder}
                  disabled={isRunning}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                >
                  <FolderOpen className="h-4 w-4" />
                  {t("common.browse")}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-end">
                <div>
                  <label className="mb-2 block text-sm font-bold text-(--text-main)">
                    {t("tools.simple_web_server.port")}
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value) || 8080)}
                    disabled={isRunning}
                    min={1024}
                    max={65535}
                    className="h-11 w-full rounded-xl border border-(--border-color) bg-(--bg-main) px-3 font-mono text-sm text-(--text-main) outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {!isRunning ? (
                  <button
                    onClick={handleStartServer}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary-hover"
                  >
                    <Play className="h-4 w-4" />
                    {t("tools.simple_web_server.start_server")}
                  </button>
                ) : (
                  <button
                    onClick={handleStopServer}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-5 text-sm font-bold text-white shadow-sm shadow-red-500/20 transition-colors hover:bg-red-600"
                  >
                    <Square className="h-4 w-4" />
                    {t("tools.simple_web_server.stop_server")}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-(--border-color) bg-(--card-bg) p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-lg p-2 ${
                    isRunning
                      ? "bg-green-500/10 text-green-500"
                      : "bg-slate-500/10 text-(--text-muted)"
                  }`}
                >
                  <Server className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-(--text-main)">
                  {isRunning
                    ? t("tools.simple_web_server.server_running")
                    : t("tools.simple_web_server.server_stopped")}
                </h3>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isRunning ? "bg-green-500" : "bg-slate-400"
                }`}
              />
            </div>

            {!isRunning || !localAddress ? (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-(--border-color) bg-(--bg-main) px-4 text-center">
                <Server className="mb-3 h-9 w-9 text-(--text-muted) opacity-40" />
                <p className="text-sm font-bold text-(--text-main)">
                  {t("tools.simple_web_server.server_stopped")}
                </p>
                <p className="mt-1 text-xs text-(--text-muted)">
                  {t("tools.simple_web_server.select_folder")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <AddressRow
                  icon={<Monitor className="h-4 w-4" />}
                  label={t("tools.simple_web_server.local_address")}
                  value={localAddress}
                  onCopy={() => handleCopyAddress(localAddress)}
                  onOpen={() => handleOpenBrowser(localAddress)}
                  copyTitle={t("tools.simple_web_server.copy_address")}
                  openTitle={t("tools.simple_web_server.open_browser")}
                />
                <AddressRow
                  icon={<Wifi className="h-4 w-4" />}
                  label={t("tools.simple_web_server.network_address")}
                  value={networkAddress}
                  onCopy={() => handleCopyAddress(networkAddress)}
                  onOpen={() => handleOpenBrowser(networkAddress)}
                  copyTitle={t("tools.simple_web_server.copy_address")}
                  openTitle={t("tools.simple_web_server.open_browser")}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </ToolLayout>
  );
}

interface AddressRowProps {
  icon: ReactNode;
  label: string;
  value: string;
  onCopy: () => void;
  onOpen: () => void;
  copyTitle: string;
  openTitle: string;
}

function AddressRow({
  icon,
  label,
  value,
  onCopy,
  onOpen,
  copyTitle,
  openTitle,
}: AddressRowProps) {
  return (
    <div className="rounded-xl border border-(--border-color) bg-(--bg-main) p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-(--text-muted)">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="text"
          value={value}
          readOnly
          className="h-9 min-w-0 flex-1 rounded-lg border border-(--border-color) bg-(--card-bg) px-3 font-mono text-xs text-(--text-main) outline-none"
        />
        <button
          onClick={onCopy}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-white"
          title={copyTitle}
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={onOpen}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-white"
          title={openTitle}
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/*
 * @file DnsTool.tsx
 * @brief DNS 助手页面，支持刷新 DNS 缓存和切换公共 DNS
 */

import { invoke } from "@tauri-apps/api/core";
import { invokeWrapper } from "../api";
import { listen } from "@tauri-apps/api/event";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Globe,
  Network,
  Play,
  RefreshCw,
  Route,
  Settings2,
  ShieldCheck,
  Square,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import { LogViewer } from "../components/shared/LogViewer";
import { Select } from "../components/mui";
import { Button } from "../components/mui";

interface NetworkInterface {
  name: string;
  dns_servers: string[];
  is_dhcp: boolean;
}

interface NetworkTaskPayload {
  id: string;
  line: string;
  status: string;
}

const PUBLIC_DNS = [
  { name: "AliDNS", servers: ["223.5.5.5", "223.6.6.6"], icon: "🇨🇳" },
  { name: "DNSPod", servers: ["119.29.29.29", "182.254.116.116"], icon: "🇨🇳" },
  { name: "Google DNS", servers: ["8.8.8.8", "8.8.4.4"], icon: "🇺🇸" },
  { name: "Cloudflare", servers: ["1.1.1.1", "1.0.0.1"], icon: "🇺🇸" },
  {
    name: "OpenDNS",
    servers: ["208.67.222.222", "208.67.220.220"],
    icon: "🇺🇸",
  },
];

export default function DnsTool() {
  const { t } = useTranslation();
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState("");
  const [, setIsLoading] = useState(true);

  // Ping & Trace State
  const [pingTarget, setPingTarget] = useState("www.baidu.com");
  const [traceTarget, setTraceTarget] = useState("www.baidu.com");
  const [pingLogs, setPingLogs] = useState<string[]>([]);
  const [traceLogs, setTraceLogs] = useState<string[]>([]);
  const [isPingRunning, setIsPingRunning] = useState(false);
  const [isTraceRunning, setIsTraceRunning] = useState(false);

  const pingId = "ping-task";
  const traceId = "trace-task";

  useEffect(() => {
    const unlisten = listen<NetworkTaskPayload>(
      "network-task-progress",
      (event) => {
        const { id, line, status } = event.payload;
        if (id === pingId) {
          if (line) setPingLogs((prev) => [...prev, line]);
          if (status !== "running") {
            setIsPingRunning(false);
            setStatus(t(`tools.dns_tool.${status}`));
          }
        } else if (id === traceId) {
          if (line) setTraceLogs((prev) => [...prev, line]);
          if (status !== "running") {
            setIsTraceRunning(false);
            setStatus(t(`tools.dns_tool.${status}`));
          }
        }
      }
    );

    return () => {
      unlisten.then((f) => f());
      // 组件卸载时停止任务
      invoke("stop_network_task", { taskId: pingId });
      invoke("stop_network_task", { taskId: traceId });
    };
  }, [t]);

  const init = useCallback(async () => {
    try {
      setIsLoading(true);
      // 优先获取 DNS 设置，快速渲染主界面
      const dnsSettings = await invoke<NetworkInterface[]>("get_dns_settings");

      setInterfaces(dnsSettings);
      if (dnsSettings.length > 0 && !selectedInterface) {
        setSelectedInterface(dnsSettings[0].name);
      }
      setStatus(t("common.ready"));
      setIsLoading(false);

      // 管理员权限检测独立执行，不阻塞主界面
      invokeWrapper<boolean>("is_run_as_admin")
        .then((res) => {
          setIsAdmin(res.ok ? (res.data ?? false) : false);
        })
        .catch((error) => {
          console.error("Failed to check admin status:", error);
          setIsAdmin(false);
        });
    } catch (error) {
      console.error("Failed to init DNS tool:", error);
      setStatus(t("common.error"));
      setIsLoading(false);
    }
  }, [t, selectedInterface]);

  useEffect(() => {
    init();
  }, [init]);

  const handleFlushDns = async () => {
    try {
      setStatus(t("common.loading"));
      await invoke("flush_dns");
      setStatus(t("tools.dns_tool.flush_success"));
      setTimeout(() => setStatus(t("common.ready")), 3000);
    } catch (error) {
      console.error("Failed to flush DNS:", error);
      setStatus(t("tools.dns_tool.flush_failed"));
    }
  };

  const handleSetDns = async (servers: string[]) => {
    if (!selectedInterface) return;
    try {
      setStatus(t("common.loading"));
      await invoke("set_dns", {
        interfaceName: selectedInterface,
        dnsServers: servers,
      });
      await init();
      setStatus(t("tools.dns_tool.set_success"));
      setTimeout(() => setStatus(t("common.ready")), 3000);
    } catch (error) {
      console.error("Failed to set DNS:", error);
      setStatus(t("tools.dns_tool.set_failed"));
    }
  };

  const startPing = async () => {
    if (!pingTarget) return;
    setPingLogs([]);
    setIsPingRunning(true);
    setStatus(t("tools.dns_tool.running"));
    await invoke("start_network_task", {
      taskId: pingId,
      taskType: "ping",
      target: pingTarget,
    });
  };

  const stopPing = async () => {
    await invoke("stop_network_task", { taskId: pingId });
    setIsPingRunning(false);
  };

  const startTrace = async () => {
    if (!traceTarget) return;
    setTraceLogs([]);
    setIsTraceRunning(true);
    setStatus(t("tools.dns_tool.running"));
    await invoke("start_network_task", {
      taskId: traceId,
      taskType: "tracert",
      target: traceTarget,
    });
  };

  const stopTrace = async () => {
    await invoke("stop_network_task", { taskId: traceId });
    setIsTraceRunning(false);
  };

  return (
    <ToolLayout title={t("tools.dns_tool.name")} status={status}>
      <div className="flex flex-col h-full gap-6 overflow-y-auto pr-2 pb-6">
        {/* 顶部操作栏 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Zap size={20} />
              </div>
              <h3 className="font-bold text-lg">
                {t("tools.dns_tool.flush_dns")}
              </h3>
            </div>
            <p className="text-sm text-(--text-muted)">
              清除本地 DNS 解析缓存，解决域名解析不生效或指向错误的问题。
            </p>
            <Button
              onClick={handleFlushDns}
              className="mt-auto flex items-center justify-center gap-2 shadow-md shadow-primary/20"
            >
              <RefreshCw size={18} />
              <span className="font-medium">
                {t("tools.dns_tool.flush_dns")}
              </span>
            </Button>
          </div>

          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-bold text-lg">权限状态</h3>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              {isAdmin ? (
                <div className="flex items-center gap-3 text-green-500 bg-green-500/5 p-4 rounded-xl border border-green-500/20">
                  <CheckCircle2 size={24} />
                  <div>
                    <p className="font-bold">已获得管理员权限</p>
                    <p className="text-xs opacity-80">
                      您可以自由修改系统 DNS 设置
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-amber-500 bg-amber-500/5 p-4 rounded-xl border border-amber-500/20">
                  <AlertCircle size={24} />
                  <div>
                    <p className="font-bold">
                      {t("tools.dns_tool.admin_required")}
                    </p>
                    <p className="text-xs opacity-80">
                      请以管理员身份运行程序以修改设置
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 接口选择与当前状态 */}
        <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-500">
                <Network size={20} />
              </div>
              <h3 className="font-bold text-lg">
                {t("tools.dns_tool.interface")}
              </h3>
            </div>
            <div className="min-w-50">
              <Select
                value={selectedInterface}
                onChange={setSelectedInterface}
                options={interfaces.map((iface) => ({
                  key: iface.name,
                  label: iface.name,
                }))}
                align="right"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {interfaces
              .find((i) => i.name === selectedInterface)
              ?.dns_servers.map((dns, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-(--bg-main) rounded-xl border border-(--border-color)"
                >
                  <Globe size={16} className="text-primary" />
                  <span className="text-sm font-mono">{dns}</span>
                </div>
              )) || (
              <div className="col-span-full py-4 text-center text-(--text-muted) bg-(--bg-main) rounded-xl border border-dashed border-(--border-color)">
                {t("tools.dns_tool.dhcp")}
              </div>
            )}
          </div>
        </div>

        {/* 公共 DNS 列表 */}
        <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
              <Settings2 size={20} />
            </div>
            <h3 className="font-bold text-lg">
              {t("tools.dns_tool.public_dns")}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* DHCP 选项 */}
            <Button
              variant="outlined"
              onClick={() => handleSetDns([])}
              disabled={!isAdmin}
              className="group flex flex-col p-4 h-auto bg-(--bg-main) rounded-2xl border border-(--border-color) hover:border-primary hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between mb-2 w-full">
                <span className="font-bold text-primary">Auto</span>
                <RefreshCw
                  size={16}
                  className="text-(--text-muted) group-hover:rotate-180 transition-transform duration-500"
                />
              </div>
              <span className="text-sm font-medium mb-1 w-full">
                {t("tools.dns_tool.dhcp")}
              </span>
              <span className="text-xs text-(--text-muted) w-full">
                由路由器或运营商自动分配
              </span>
            </Button>

            {PUBLIC_DNS.map((dns) => (
              <Button
                key={dns.name}
                variant="outlined"
                onClick={() => handleSetDns(dns.servers)}
                disabled={!isAdmin}
                className="group flex flex-col p-4 h-auto bg-(--bg-main) rounded-2xl border border-(--border-color) hover:border-primary hover:shadow-lg transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between mb-2 w-full">
                  <span className="font-bold text-(--text-main)">
                    {dns.name}
                  </span>
                  <span className="text-lg">{dns.icon}</span>
                </div>
                <div className="flex flex-col gap-1 w-full">
                  {dns.servers.map((s) => (
                    <span
                      key={s}
                      className="text-xs font-mono text-(--text-muted) group-hover:text-primary transition-colors"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Ping & Trace 工具 */}
        <div className="grid grid-cols-1 gap-6">
          {/* Ping 测试 */}
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <Activity size={20} />
                </div>
                <h3 className="font-bold text-lg">
                  {t("tools.dns_tool.ping")}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pingTarget}
                  onChange={(e) => setPingTarget(e.target.value)}
                  placeholder={t("tools.dns_tool.target_placeholder")}
                  className="bg-(--bg-main) border border-(--border-color) rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-48"
                />
                {isPingRunning ? (
                  <Button
                    color="error"
                    variant="contained"
                    size="small"
                    onClick={stopPing}
                    className="p-2 h-auto"
                  >
                    <Square size={16} />
                  </Button>
                ) : (
                  <Button
                    size="small"
                    onClick={startPing}
                    className="p-2 h-auto"
                  >
                    <Play size={16} />
                  </Button>
                )}
              </div>
            </div>
            <div className="h-96">
              <LogViewer
                logs={pingLogs}
                title={t("tools.dns_tool.ping_result")}
                onClear={() => setPingLogs([])}
              />
            </div>
          </div>

          {/* 路由追踪 */}
          <div className="bg-(--card-bg) p-6 rounded-2xl border border-(--border-color) shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
                  <Route size={20} />
                </div>
                <h3 className="font-bold text-lg">
                  {t("tools.dns_tool.route_trace")}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={traceTarget}
                  onChange={(e) => setTraceTarget(e.target.value)}
                  placeholder={t("tools.dns_tool.target_placeholder")}
                  className="bg-(--bg-main) border border-(--border-color) rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-48"
                />
                {isTraceRunning ? (
                  <Button
                    color="error"
                    size="small"
                    onClick={stopTrace}
                    className="p-2 h-auto"
                  >
                    <Square size={16} />
                  </Button>
                ) : (
                  <Button
                    size="small"
                    onClick={startTrace}
                    className="p-2 h-auto"
                  >
                    <Play size={16} />
                  </Button>
                )}
              </div>
            </div>
            <div className="h-96">
              <LogViewer
                logs={traceLogs}
                title={t("tools.dns_tool.trace_result")}
                onClear={() => setTraceLogs([])}
              />
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}

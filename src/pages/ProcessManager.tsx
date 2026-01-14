/**
 * 进程管理工具页面
 * 职责：展示系统运行进程与监听端口，支持搜索、刷新、结束进程等操作
 */
import { open } from "@tauri-apps/plugin-dialog";
import {
  Activity,
  Copy,
  FileSearch,
  Hash,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invokeWrapper } from "../api";
import { useModal } from "../components/ModalContext";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import { TIMING, REFRESH_INTERVALS, PROTOCOL_FILTERS, ProtocolFilter } from "../constants";

interface PortInfo {
  pid: string;
  process_name: string;
  description: string;
  path: string;
  port: string;
  local_addr: string;
  foreign_addr: string;
  state: string;
  protocol: string;
}

const ProcessManager: React.FC = () => {
  const { t } = useTranslation();
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [protocolFilter, setProtocolFilter] = useState<ProtocolFilter>("ALL");
  const [selectionModel, setSelectionModel] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(TIMING.DEFAULT_REFRESH_INTERVAL_MS);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
    port: PortInfo | null;
  }>({ x: 0, y: 0, visible: false, port: null });
  const { confirm } = useModal();
  const isMounted = React.useRef(true);

  useEffect(() => {
    isMounted.current = true;
    checkAdmin().catch((err) => console.error("checkAdmin error:", err));
    return () => {
      isMounted.current = false;
    };
  }, []);

  const checkAdmin = async () => {
    try {
      const res = await invokeWrapper<boolean>("is_admin");
      if (isMounted.current && res.ok && res.data !== undefined) {
        setIsAdmin(res.data);
      }
    } catch {
      // Admin check failed silently
    }
  };

  const fetchPorts = useCallback(async () => {
    if (!isMounted.current) return;
    setLoading(true);
    try {
      const response = await invokeWrapper<PortInfo[]>("get_listening_ports");
      if (isMounted.current && response.ok && response.data) {
        setPorts(response.data);
      }
    } catch {
      // Fetch failed silently
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  const handleKillProcess = useCallback(
    async (pid: string, name: string) => {
      const confirmed = await confirm({
        title: t("tools.process_manager.kill_process"),
        message: t("tools.process_manager.kill_confirm", { pid, name }),
        confirmText: t("common.confirm"),
        cancelText: t("common.cancel"),
        type: "error",
      });

      if (confirmed) {
        const response = await invokeWrapper("kill_process", { pid });
        if (response.ok) {
          // 乐观更新：先从本地列表中移除，提升响应感
          setPorts((prev) => prev.filter((p) => p.pid !== pid));
          // 延迟刷新，确保系统已完全释放进程
          setTimeout(fetchPorts, TIMING.REFRESH_DELAY_MS);
        } else {
          const isAccessDenied = response.message?.includes("ACCESS_DENIED");
          // 即使失败也刷新一下，可能进程其实已经消失了
          fetchPorts();

          await confirm({
            title: t("common.error"),
            message: isAccessDenied
              ? t("tools.process_manager.kill_failed_admin")
              : t("tools.process_manager.kill_failed") +
                "\n" +
                (response.message || ""),
            confirmText: t("common.confirm"),
            type: "error",
          });
        }
      }
    },
    [confirm, fetchPorts, t]
  );

  const handleCopy = async (text: string, _label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const toggleSelection = (rowId: string) => {
    setSelectionModel((prev) =>
      prev.includes(rowId)
        ? prev.filter((id) => id !== rowId)
        : [...prev, rowId]
    );
  };

  const toggleSelectAll = () => {
    if (selectionModel.length === filteredPorts.length) {
      setSelectionModel([]);
    } else {
      setSelectionModel(
        filteredPorts.map(
          (p, index) =>
            `${p.pid}-${p.port}-${p.protocol}-${p.local_addr}-${index}`
        )
      );
    }
  };

  const handleFileSelection = useCallback(async (path: string) => {
    if (!isMounted.current) return;
    const filename = path.split(/[\\/]/).pop() || "";
    // 如果是 .exe，去掉后缀名作为搜索词，因为进程名通常不带 .exe
    const fallbackSearch = filename.toLowerCase().endsWith(".exe")
      ? filename.slice(0, -4)
      : filename;

    setLoading(true);
    // 先设置回退搜索词，让用户看到反馈
    setSearchText(fallbackSearch);

    const response = await invokeWrapper<number[]>("find_occupying_processes", {
      path,
    });
    if (isMounted.current) {
      if (response.ok && response.data && response.data.length > 0) {
        setSearchText(response.data.join("|"));
        setProtocolFilter("ALL");
      }
      // 如果没找到 PID，保留文件名搜索，这样如果是拖入的 .exe，依然能匹配到进程名
      setLoading(false);
    }
  }, []);

  const handleManualSelect = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
    });
    if (selected && typeof selected === "string") {
      handleFileSelection(selected);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  // 自动刷新逻辑
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchPorts, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchPorts]);

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    const handleGlobalClick = () => closeContextMenu();
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("contextmenu", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("contextmenu", handleGlobalClick);
    };
  }, []);

  const filteredPorts = useMemo(() => {
    const lowerSearch = searchText.toLowerCase();
    const searchTerms = lowerSearch
      .split("|")
      .map((t) => t.trim())
      .filter((t) => t !== "");

    return ports.filter((p) => {
      const matchesSearch =
        searchTerms.length === 0 ||
        searchTerms.some(
          (term) =>
            (p.port || "").includes(term) ||
            (p.process_name || "").toLowerCase().includes(term) ||
            (p.description || "").toLowerCase().includes(term) ||
            (p.path || "").toLowerCase().includes(term) ||
            (p.pid || "").includes(term) ||
            (p.local_addr || "").toLowerCase().includes(term)
        );

      const matchesProtocol =
        protocolFilter === "ALL" || p.protocol === protocolFilter;

      return matchesSearch && matchesProtocol;
    });
  }, [ports, searchText, protocolFilter]);

  const stats = useMemo(() => {
    const tcp = ports.filter((p) => p.protocol === "TCP").length;
    const udp = ports.filter((p) => p.protocol === "UDP").length;
    return { tcp, udp };
  }, [ports]);

  const handleBatchKill = async () => {
    const count = selectionModel.length;
    if (count === 0) return;

    const confirmed = await confirm({
      title: t("tools.process_manager.kill_process"),
      message: t("tools.process_manager.kill_selected_confirm", { count }),
      confirmText: t("common.confirm"),
      cancelText: t("common.cancel"),
      type: "error",
    });

    if (confirmed) {
      setLoading(true);
      const pids = selectionModel.map((id) => id.split("-")[0]); // 从 ID 中提取 PID
      const results = await Promise.all(
        pids.map((pid) => invokeWrapper("kill_process", { pid }))
      );

      const failedCount = results.filter((r) => !r.ok).length;

      if (failedCount === 0) {
        const selectedSet = new Set(selectionModel);
        setPorts((prev) =>
          prev.filter((p, index) => {
            const id = `${p.pid}-${p.port}-${p.protocol}-${p.local_addr}-${index}`;
            return !selectedSet.has(id);
          })
        );
        setSelectionModel([]);
        setTimeout(fetchPorts, TIMING.REFRESH_DELAY_MS);
      } else {
        fetchPorts();
        setSelectionModel([]);
        await confirm({
          title: t("common.error"),
          message: t("tools.process_manager.kill_failed") + ` (${failedCount})`,
          confirmText: t("common.confirm"),
          type: "error",
        });
      }
      setLoading(false);
    }
  };

  return (
    <ToolLayout title={t("tools.process_manager.name")}>
      <div className="flex flex-col h-full gap-4">
        {/* 管理员权限提示 */}
        {!isAdmin && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400 text-sm animate-in slide-in-from-top-2 duration-300">
            <ShieldAlert size={18} className="shrink-0" />
            <p className="flex-1 font-medium">
              {t("tools.process_manager.admin_warning")}
            </p>
          </div>
        )}

        {/* 控制栏 */}
        <div className="flex flex-wrap items-center gap-4 bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--border-color)]">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="text"
                placeholder={t("tools.process_manager.search_placeholder")}
                className="w-full pl-10 pr-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <Button
              variant="outlined"
              size="small"
              onClick={handleManualSelect}
              title={t("tools.process_manager.select_file_tooltip")}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all h-auto whitespace-nowrap border-[var(--border-color)] hover:border-primary hover:text-primary"
            >
              <FileSearch size={18} />
              <span className="text-xs font-medium hidden sm:inline">
                {t("tools.process_manager.select_file")}
              </span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 bg-[var(--bg-main)] p-1 rounded-xl border border-[var(--border-color)]">
              {PROTOCOL_FILTERS.map((p) => (
                <Button
                  key={p}
                  variant={protocolFilter === p ? "contained" : "text"}
                  size="small"
                  onClick={() => setProtocolFilter(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all h-auto whitespace-nowrap ${
                    protocolFilter === p
                      ? "shadow-sm"
                      : "text-[var(--text-muted)] hover:bg-[var(--border-color)]"
                  }`}
                >
                  {p === "ALL" ? t("common.all") : p}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[var(--bg-main)] p-1 rounded-xl border border-[var(--border-color)]">
              {REFRESH_INTERVALS.map((item) => (
                <Button
                  key={item.value}
                  variant={
                    refreshInterval === item.value ? "contained" : "text"
                  }
                  size="small"
                  onClick={() => setRefreshInterval(item.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all h-auto whitespace-nowrap ${
                    refreshInterval === item.value
                      ? "shadow-sm"
                      : "text-[var(--text-muted)] hover:bg-[var(--border-color)]"
                  }`}
                >
                  {t(item.labelKey)}
                </Button>
              ))}
            </div>

            <Button
              variant="contained"
              onClick={fetchPorts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all shadow-lg shadow-primary/20 h-auto whitespace-nowrap"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {t("tools.process_manager.refresh")}
            </Button>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="flex items-center justify-between px-2 text-sm text-[var(--text-muted)]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Activity size={14} />
              {t("tools.process_manager.stats", {
                tcp: stats.tcp,
                udp: stats.udp,
              })}
            </span>
            {selectionModel.length > 0 && (
              <Button
                color="error"
                variant="contained"
                size="small"
                onClick={handleBatchKill}
                className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all font-medium animate-in zoom-in-95 duration-200 h-auto"
              >
                <Trash2 size={14} />
                {t("tools.process_manager.kill_selected", {
                  count: selectionModel.length,
                })}
              </Button>
            )}
          </div>
          <span>
            {t("common.all")}: {filteredPorts.length}
          </span>
        </div>

        {/* 表格区域 */}
        <div className="flex-1 overflow-auto bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--card-bg)] border-b border-[var(--border-color)] z-10">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      filteredPorts.length > 0 &&
                      selectionModel.length === filteredPorts.length
                    }
                    onChange={toggleSelectAll}
                    className="cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t("tools.process_manager.col_pid")}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t("tools.process_manager.col_name")}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t("tools.process_manager.col_port")}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t("tools.process_manager.col_local_addr")}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t("tools.process_manager.col_status")}
                </th>
                <th className="px-4 py-3 text-left font-semibold">
                  {t("tools.process_manager.col_protocol")}
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  {t("common.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    {t("common.loading")}
                  </td>
                </tr>
              ) : filteredPorts.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    {t("common.no_data")}
                  </td>
                </tr>
              ) : (
                filteredPorts.map((port, index) => {
                  const rowId = `${port.pid}-${port.port}-${port.protocol}-${port.local_addr}-${index}`;
                  const isSelected = selectionModel.includes(rowId);
                  return (
                    <tr
                      key={rowId}
                      className={`border-b border-[var(--border-color)] hover:bg-[var(--bg-main)] transition-colors ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          visible: true,
                          port,
                        });
                      }}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(rowId)}
                          className="cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono">{port.pid}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span
                            className="font-bold truncate"
                            title={port.path || ""}
                          >
                            {port.description || port.process_name || "Unknown"}
                          </span>
                          {port.description && port.process_name && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono truncate">
                              {port.process_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-primary font-bold">
                          {port.port}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400 truncate">
                        {port.local_addr || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            port.state === "LISTENING"
                              ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {port.state}
                        </span>
                      </td>
                      <td className="px-4 py-3">{port.protocol}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="text"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(port.pid, "PID");
                            }}
                            className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-all h-auto"
                            title={t("tools.process_manager.copy_pid")}
                          >
                            <Hash size={14} />
                          </Button>
                          <Button
                            variant="text"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(port.port, "Port");
                            }}
                            className="p-1.5 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-all h-auto"
                            title={t("tools.process_manager.copy_port")}
                          >
                            <Copy size={14} />
                          </Button>
                          <Button
                            variant="text"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleKillProcess(port.pid, port.process_name);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all h-auto"
                            title={t("tools.process_manager.kill_process")}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1 min-w-[160px] animate-in fade-in zoom-in duration-100"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="text"
            onClick={() => {
              if (contextMenu.port) {
                handleKillProcess(
                  contextMenu.port.pid,
                  contextMenu.port.process_name
                );
              }
              closeContextMenu();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors justify-start"
          >
            <Trash2 size={16} />
            <span>{t("tools.process_manager.kill_process")}</span>
          </Button>
          <div className="h-[1px] bg-[var(--border-color)] my-1" />
          <Button
            variant="text"
            onClick={() => {
              if (contextMenu.port) {
                handleCopy(contextMenu.port.pid, "PID");
              }
              closeContextMenu();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors justify-start"
          >
            <Hash size={16} />
            <span>{t("tools.process_manager.copy_pid")}</span>
          </Button>
          <Button
            variant="text"
            onClick={() => {
              if (contextMenu.port) {
                handleCopy(contextMenu.port.port, "Port");
              }
              closeContextMenu();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-main)] hover:bg-[var(--bg-main)] transition-colors justify-start"
          >
            <Copy size={16} />
            <span>{t("tools.process_manager.copy_port")}</span>
          </Button>
        </div>
      )}
    </ToolLayout>
  );
};

export default ProcessManager;


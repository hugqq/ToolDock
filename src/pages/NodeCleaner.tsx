/**
 * Node管理工具页面
 * 职责：删除node_modules文件夹，管理NVM版本
 */
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Box as BoxIcon,
  CheckCircle2,
  CheckSquare,
  Cpu,
  Download,
  FolderOpen,
  Info,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderInfo,
  NvmVersion,
  deleteNodeModules,
  formatSize,
  installNvmVersion,
  listNvmVersions,
  pkgInstall,
  checkPkgManagers,
  scanNodeModules,
  stopScan,
  uninstallNvmVersion,
  useNvmVersion,
} from "../api/file";
import { useModal } from "../components/ModalContext";
import { ToolLayout } from "../components/layout/ToolLayout";
import { LogViewer } from "../components/shared/LogViewer";
import { TabLayout } from "../components/layout/TabLayout";
import { Button } from "../components/mui";

interface NodeModuleItem extends FolderInfo {
  checked: boolean;
  status: "pending" | "deleting" | "installing" | "success" | "error";
}

const VITE_FRAMEWORKS = [
  { id: "vanilla", name: "Vanilla", variants: ["vanilla", "vanilla-ts"] },
  { id: "vue", name: "Vue", variants: ["vue", "vue-ts"] },
  {
    id: "react",
    name: "React",
    variants: ["react", "react-ts", "react-swc", "react-swc-ts"],
  },
  { id: "preact", name: "Preact", variants: ["preact", "preact-ts"] },
  { id: "lit", name: "Lit", variants: ["lit", "lit-ts"] },
  { id: "svelte", name: "Svelte", variants: ["svelte", "svelte-ts"] },
  { id: "solid", name: "Solid", variants: ["solid", "solid-ts"] },
  { id: "qwik", name: "Qwik", variants: ["qwik", "qwik-ts"] },
];

const NodeCleaner: React.FC = () => {
  const { t } = useTranslation();
  const { confirm } = useModal();
  const [activeTab, setActiveTab] = useState(0);

  // Dependency Management State
  const [path, setPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState(
    t("tools.node_cleaner.status_ready")
  );
  const [results, setResults] = useState<NodeModuleItem[]>([]);
  const [installLogs, setInstallLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [pkgStatus, setPkgStatus] = useState({
    npm: false,
    pnpm: false,
    yarn: false,
    bun: false,
    deno: false,
  });
  const [selectedManager, setSelectedManager] = useState<
    "npm" | "pnpm" | "yarn" | "bun" | "deno"
  >("pnpm");

  // NVM Management State
  const [nvmVersions, setNvmVersions] = useState<NvmVersion[]>([]);
  const [nvmLoading, setNvmLoading] = useState(false);
  const [newVersion, setNewVersion] = useState("");

  // Vite Creation State
  const [viteProjectName, setViteProjectName] = useState("my-vite-app");
  const [viteTargetDir, setViteTargetDir] = useState("");
  const [viteFramework, setViteFramework] = useState("react");
  const [viteVariant, setViteVariant] = useState("react-ts");
  const [viteExtraArgs, setViteExtraArgs] = useState("");

  useEffect(() => {
    const unlisten = listen<string>("pkg-log", (event) => {
      setInstallLogs((prev) => [...prev, event.payload]);
    });

    fetchPkgStatus();

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const fetchPkgStatus = async () => {
    const response = await checkPkgManagers();
    if (response.ok) {
      setPkgStatus(response.data);
      if (response.data.pnpm) {
        setSelectedManager("pnpm");
      } else if (response.data.yarn) {
        setSelectedManager("yarn");
      } else {
        setSelectedManager("npm");
      }
    }
  };

  useEffect(() => {
    if (activeTab === 1) {
      fetchNvmVersions();
    }

    // Update status text based on active tab
    if (activeTab === 0) {
      setStatusText(t("tools.node_cleaner.status_ready"));
    } else if (activeTab === 2) {
      setStatusText(t("tools.node_cleaner.vite.status_ready"));
    } else {
      setStatusText(t("common.ready"));
    }
  }, [activeTab, t]);

  const fetchNvmVersions = async () => {
    setNvmLoading(true);
    const response = await listNvmVersions();
    if (response.ok) {
      setNvmVersions(response.data);
    } else {
      setStatusText(t("tools.node_cleaner.nvm.error_nvm_not_found"));
    }
    setNvmLoading(false);
  };

  const handleBrowse = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      setPath(selected);
    }
  };

  const handleScan = async () => {
    if (!path) return;
    setScanning(true);
    setStatusText(t("tools.node_cleaner.status_scanning"));
    setResults([]);
    setInstallLogs([]);
    setShowLogs(false);

    const response = await scanNodeModules(path);
    if (response.ok) {
      const items: NodeModuleItem[] = response.data.map((item) => ({
        ...item,
        checked: true,
        status: "pending",
      }));
      setResults(items);
      setStatusText(
        t("tools.node_cleaner.found_count", { count: items.length })
      );
    } else {
      setStatusText(`${t("common.error")}: ${response.message}`);
    }
    setScanning(false);
  };

  const handleStop = async () => {
    await stopScan();
    setScanning(false);
    setStatusText(t("tools.node_cleaner.status_ready"));
  };

  const handlePkgInstall = async (itemPath: string) => {
    // Get the parent directory of node_modules
    const projectPath = itemPath.replace(/[\\/]node_modules$/, "");

    setResults((prev) =>
      prev.map((i) =>
        i.path === itemPath ? { ...i, status: "installing" } : i
      )
    );
    setProcessing(true);
    setInstallLogs([]);
    setShowLogs(true);
    setStatusText(t("tools.node_cleaner.status_installing"));

    const response = await pkgInstall(
      projectPath,
      `${selectedManager} install`
    );
    if (response.ok) {
      setResults((prev) =>
        prev.map((i) => (i.path === itemPath ? { ...i, status: "success" } : i))
      );
      setStatusText(t("common.success"));
    } else {
      setResults((prev) =>
        prev.map((i) => (i.path === itemPath ? { ...i, status: "error" } : i))
      );
      setStatusText(`${t("common.error")}: ${response.message}`);
    }
    setProcessing(false);
  };

  const handleDirectPkgInstall = async () => {
    if (!path) return;
    setProcessing(true);
    setInstallLogs([]);
    setShowLogs(true);
    setStatusText(t("tools.node_cleaner.status_installing"));
    const response = await pkgInstall(path, `${selectedManager} install`);
    if (response.ok) {
      setStatusText(t("common.success"));
      // 安装成功后自动触发扫描，以便用户看到结果
      handleScan();
    } else {
      setStatusText(`${t("common.error")}: ${response.message}`);
    }
    setProcessing(false);
  };

  const handleDeleteSelected = async () => {
    const selectedItems = results.filter(
      (item) => item.checked && item.status !== "success"
    );
    if (selectedItems.length === 0) return;

    const confirmed = await confirm({
      title: t("tools.node_cleaner.confirm_title"),
      message: t("tools.node_cleaner.confirm_msg", {
        count: selectedItems.length,
      }),
      type: "warning",
    });

    if (!confirmed) return;

    setProcessing(true);
    setStatusText(t("tools.node_cleaner.status_deleting"));

    // 批量更新状态为正在删除
    setResults((prev) =>
      prev.map((i) =>
        selectedItems.some((si) => si.path === i.path)
          ? { ...i, status: "deleting" }
          : i
      )
    );

    let successCount = 0;
    let failedCount = 0;

    // 并发执行删除（限制并发数为 3，避免磁盘 I/O 过载）
    const limit = 3;
    for (let i = 0; i < selectedItems.length; i += limit) {
      const chunk = selectedItems.slice(i, i + limit);
      await Promise.all(
        chunk.map(async (item) => {
          const response = await deleteNodeModules(item.path);
          if (response.ok) {
            successCount++;
            setResults((prev) =>
              prev.map((i) =>
                i.path === item.path
                  ? { ...i, status: "success", checked: false }
                  : i
              )
            );
          } else {
            failedCount++;
            setResults((prev) =>
              prev.map((i) =>
                i.path === item.path ? { ...i, status: "error" } : i
              )
            );
          }
        })
      );
    }

    setProcessing(false);
    setStatusText(
      `${t("tools.node_cleaner.delete_success", { count: successCount })}${
        failedCount > 0
          ? `, ${t("tools.node_cleaner.delete_failed", { count: failedCount })}`
          : ""
      }`
    );
  };

  const handleUseVersion = async (version: string) => {
    setNvmLoading(true);
    setStatusText(t("tools.node_cleaner.nvm.switching", { version }));
    const response = await useNvmVersion(version);
    if (response.ok) {
      // 等待一小段时间让系统文件系统完成符号链接更新
      await new Promise((resolve) => setTimeout(resolve, 800));
      await fetchNvmVersions();
      setStatusText(t("tools.node_cleaner.nvm.success_switch", { version }));
    } else {
      setStatusText(`${t("common.error")}: ${response.message}`);
    }
    setNvmLoading(false);
  };

  const handleInstallVersion = async () => {
    if (!newVersion) return;
    setNvmLoading(true);
    setStatusText(
      t("tools.node_cleaner.nvm.installing", { version: newVersion })
    );
    const response = await installNvmVersion(newVersion);
    if (response.ok) {
      await fetchNvmVersions();
      setNewVersion("");
      setStatusText(
        t("tools.node_cleaner.nvm.success_install", { version: newVersion })
      );
    } else {
      setStatusText(`${t("common.error")}: ${response.message}`);
    }
    setNvmLoading(false);
  };

  const handleUninstallVersion = async (version: string) => {
    const confirmed = await confirm({
      title: t("common.delete"),
      message: t("common.delete") + " " + version + "?",
      type: "warning",
    });
    if (!confirmed) return;

    setNvmLoading(true);
    const response = await uninstallNvmVersion(version);
    if (response.ok) {
      await fetchNvmVersions();
    } else {
      setStatusText(`${t("common.error")}: ${response.message}`);
    }
    setNvmLoading(false);
  };

  const handleCreateVite = async () => {
    if (!viteTargetDir || !viteProjectName) return;

    setProcessing(true);
    setInstallLogs([]);
    setShowLogs(true);
    setStatusText(t("tools.node_cleaner.vite.creating"));

    // 构建命令：使用 echo y 自动回答交互式提示
    let command = `npm create vite@latest ${viteProjectName} -- --template ${viteVariant}`;

    // 添加额外参数
    if (viteExtraArgs.trim()) {
      command += ` ${viteExtraArgs.trim()}`;
    }

    // 在 Windows PowerShell 中使用管道自动回答 "y"
    command = `echo y | ${command}`;

    const response = await pkgInstall(viteTargetDir, command);
    if (response.ok) {
      setStatusText(t("tools.node_cleaner.vite.success"));
    } else {
      setStatusText(`${t("common.error")}: ${response.message}`);
    }
    setProcessing(false);
  };

  const totalSize = useMemo(
    () => results.reduce((acc, curr) => acc + curr.size, 0),
    [results]
  );
  const checkedCount = results.filter((r) => r.checked).length;

  const tabs = useMemo(
    () => [
      {
        label: t("tools.node_cleaner.tab_deps"),
        icon: <BoxIcon />,
        instructions: [
          {
            title: t("tools.node_cleaner.instructions.deps.step1_title"),
            description: t("tools.node_cleaner.instructions.deps.step1_desc"),
          },
          {
            title: t("tools.node_cleaner.instructions.deps.step2_title"),
            description: t("tools.node_cleaner.instructions.deps.step2_desc"),
          },
          {
            title: t("tools.node_cleaner.instructions.deps.step3_title"),
            description: t("tools.node_cleaner.instructions.deps.step3_desc"),
          },
          {
            title: t("tools.node_cleaner.instructions.deps.step4_title"),
            description: t("tools.node_cleaner.instructions.deps.step4_desc"),
          },
        ],
        instructionsTitle: t("tools.node_cleaner.instructions.deps.title"),
        instructionsColor: "blue" as const,
        content: (
          <>
            <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm mb-6">
              <div className="flex flex-col gap-4">
                <label className="text-sm font-bold text-[var(--text-main)]">
                  {t("tools.node_cleaner.col_path")}
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder={t("tools.node_cleaner.path_placeholder")}
                    className="flex-1 !px-4 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                  />
                  <Button
                    variant="outlined"
                    className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm font-medium hover:bg-[var(--border-color)] transition-colors disabled:opacity-50"
                    onClick={handleBrowse}
                    disabled={scanning || processing}
                  >
                    <FolderOpen size={18} />
                    <span>{t("tools.folder_size.browse")}</span>
                  </Button>
                  <Button
                    variant="contained"
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
                    onClick={handleScan}
                    disabled={scanning || processing || !path}
                  >
                    {scanning ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Search size={18} />
                    )}
                    <span>{t("tools.node_cleaner.scan")}</span>
                  </Button>
                </div>
              </div>
            </div>

            {showLogs && (
              <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <LogViewer
                  logs={installLogs}
                  onClear={() => setInstallLogs([])}
                  title={t("tools.node_cleaner.logs_title", {
                    name: selectedManager.toUpperCase(),
                  })}
                  maxHeight="400px"
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => setShowLogs(false)}
                    className="text-xs text-[var(--text-muted)] hover:text-primary transition-colors"
                  >
                    {t("tools.node_cleaner.logs_hide")}
                  </Button>
                </div>
              </div>
            )}

            {!showLogs && installLogs.length > 0 && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setShowLogs(true)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-all"
                >
                  <Terminal size={14} />
                  <span>
                    {t("tools.node_cleaner.logs_show")} ({installLogs.length})
                  </span>
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-4 mt-6 pt-6 border-t border-[var(--border-color)]">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[var(--text-main)]">
                  {t("tools.node_cleaner.tab_deps")}
                </label>
                <div className="flex gap-2">
                  {(["npm", "pnpm", "yarn", "bun", "deno"] as const).map(
                    (mgr) => (
                      <div
                        key={mgr}
                        className="flex flex-col items-center gap-1"
                      >
                        <Button
                          variant={
                            selectedManager === mgr ? "contained" : "outlined"
                          }
                          size="small"
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            !pkgStatus[mgr] ? "opacity-60" : ""
                          }`}
                          onClick={() => setSelectedManager(mgr)}
                        >
                          {mgr.toUpperCase()}
                          {pkgStatus[mgr] && selectedManager === mgr && (
                            <CheckCircle2 size={12} />
                          )}
                        </Button>
                        {!pkgStatus[mgr] && (
                          <button
                            className="text-[10px] text-primary hover:underline bg-transparent border-none cursor-pointer"
                            onClick={async () => {
                              setProcessing(true);
                              setInstallLogs([]);
                              setShowLogs(true);
                              setStatusText(
                                t("tools.node_cleaner.status_installing")
                              );
                              // Use npm wrapper for deno to avoid AV triggers from powershell iex
                              const installCmd =
                                mgr === "deno"
                                  ? "npm install -g deno"
                                  : `npm install -g ${mgr}`;

                              const res = await pkgInstall("", installCmd);
                              if (res.ok) {
                                fetchPkgStatus();
                                setStatusText(t("common.success"));
                              } else {
                                setStatusText(
                                  `${t("common.error")}: ${res.message}`
                                );
                              }
                              setProcessing(false);
                            }}
                          >
                            {t("tools.node_cleaner.install_pkg_btn", {
                              name: mgr,
                            })}
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 pt-6 border-t border-[var(--border-color)]">
              <Button
                variant="outlined"
                className="flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary border border-primary/20 rounded-xl text-sm font-bold hover:bg-primary/10 transition-colors disabled:opacity-50"
                onClick={handleDirectPkgInstall}
                disabled={scanning || processing || !path}
              >
                <Play size={16} />
                <span>
                  {t(`tools.node_cleaner.${selectedManager}_install`)}
                </span>
              </Button>
              <div className="w-px h-6 bg-[var(--border-color)] mx-1" />
              <Button
                variant="outlined"
                className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm font-medium hover:bg-[var(--border-color)] transition-colors disabled:opacity-50"
                onClick={() =>
                  setResults((prev) =>
                    prev.map((i) => ({ ...i, checked: true }))
                  )
                }
                disabled={scanning || processing || results.length === 0}
              >
                <CheckSquare size={16} />
                <span>{t("tools.node_cleaner.select_all")}</span>
              </Button>
              <Button
                variant="outlined"
                className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm font-medium hover:bg-[var(--border-color)] transition-colors disabled:opacity-50"
                onClick={() =>
                  setResults((prev) =>
                    prev.map((i) => ({ ...i, checked: false }))
                  )
                }
                disabled={scanning || processing || results.length === 0}
              >
                <Square size={16} />
                <span>{t("tools.node_cleaner.deselect_all")}</span>
              </Button>
              <div className="flex-1" />
              <Button
                color="error"
                variant="contained"
                className="flex items-center gap-2 px-5 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:shadow-none"
                onClick={handleDeleteSelected}
                disabled={scanning || processing || checkedCount === 0}
              >
                <Trash2 size={16} />
                <span>
                  {t("tools.node_cleaner.delete_selected")} ({checkedCount})
                </span>
              </Button>
            </div>

            {results.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-[var(--card-bg)] p-4 rounded-2xl border border-[var(--border-color)] shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                    <Trash2 size={24} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      {t("tools.node_cleaner.found_count", {
                        count: results.length,
                      })}
                    </span>
                    <span className="text-lg font-bold text-[var(--text-main)]">
                      {formatSize(totalSize)}
                    </span>
                  </div>
                </div>
                <div className="bg-[var(--card-bg)] p-4 rounded-2xl border border-emerald-500/20 shadow-sm flex items-center gap-4 border-l-4 border-l-emerald-500">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Info size={24} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      {t("tools.node_cleaner.total_size", { size: "" })}
                    </span>
                    <span className="text-lg font-bold text-emerald-500">
                      💡 Rimraf 级极速删除
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 min-h-0 bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden flex flex-col">
              {results.length > 0 ? (
                <div className="flex-1 overflow-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-[var(--card-bg)] z-10 border-b border-[var(--border-color)]">
                      <tr>
                        <th className="px-4 py-3 w-12 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-[var(--border-color)] text-primary focus:ring-primary/20"
                            checked={
                              checkedCount === results.length &&
                              results.length > 0
                            }
                            onChange={(e) =>
                              setResults((prev) =>
                                prev.map((i) => ({
                                  ...i,
                                  checked: e.target.checked,
                                }))
                              )
                            }
                          />
                        </th>
                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                          {t("tools.node_cleaner.col_path")}
                        </th>
                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-right w-[120px]">
                          {t("tools.node_cleaner.col_size")}
                        </th>
                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-center w-[120px]">
                          {t("tools.node_cleaner.col_status")}
                        </th>
                        <th className="px-4 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-center w-[120px]">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {results.map((item) => (
                        <tr
                          key={item.path}
                          className={`hover:bg-[var(--bg-main)] transition-colors ${
                            item.status === "success" ? "bg-emerald-500/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-[var(--border-color)] text-primary focus:ring-primary/20"
                              checked={item.checked}
                              disabled={item.status === "success" || processing}
                              onChange={() =>
                                setResults((prev) =>
                                  prev.map((i) =>
                                    i.path === item.path
                                      ? { ...i, checked: !i.checked }
                                      : i
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <BoxIcon
                                size={16}
                                className="text-primary shrink-0"
                              />
                              <span
                                className={`text-sm font-medium truncate max-w-[400px] ${
                                  item.status === "success"
                                    ? "text-[var(--text-muted)] line-through"
                                    : "text-[var(--text-main)]"
                                }`}
                                title={item.path}
                              >
                                {item.path}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-mono font-bold text-[var(--text-main)]">
                              {formatSize(item.size)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.status === "deleting" && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-500 text-xs font-bold whitespace-nowrap">
                                <RefreshCw size={12} className="animate-spin" />
                                {t("tools.node_cleaner.status_deleting")}
                              </span>
                            )}
                            {item.status === "success" && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold whitespace-nowrap">
                                <CheckCircle2 size={12} />
                                {t("common.success")}
                              </span>
                            )}
                            {item.status === "error" && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold whitespace-nowrap">
                                <Info size={12} />
                                {t("common.error")}
                              </span>
                            )}
                            {item.status === "installing" && (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-500 text-xs font-bold whitespace-nowrap">
                                <RefreshCw size={12} className="animate-spin" />
                                {t("tools.node_cleaner.status_installing")}
                              </span>
                            )}
                            {item.status === "pending" && (
                              <span className="text-xs text-[var(--text-muted)] font-medium whitespace-nowrap">
                                {t("common.ready")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="text"
                                size="small"
                                className="p-1.5 text-[var(--text-muted)] hover:text-primary hover:bg-primary/10 rounded-lg transition-all disabled:opacity-30"
                                onClick={() => handlePkgInstall(item.path)}
                                disabled={
                                  processing ||
                                  item.status === "success" ||
                                  item.status === "installing"
                                }
                                title={t("tools.node_cleaner.pnpm_install")}
                              >
                                <Play size={16} />
                              </Button>
                              <Button
                                variant="text"
                                size="small"
                                className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30"
                                onClick={() => {
                                  setResults((prev) =>
                                    prev.map((i) =>
                                      i.path === item.path
                                        ? { ...i, checked: true }
                                        : { ...i, checked: false }
                                    )
                                  );
                                  handleDeleteSelected();
                                }}
                                disabled={
                                  processing || item.status === "success"
                                }
                                title={t("common.delete")}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-[var(--bg-main)] flex items-center justify-center mb-6">
                    <BoxIcon size={40} className="text-primary/40" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">
                    {t("common.ready")}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] max-w-xs">
                    {scanning
                      ? t("tools.node_cleaner.status_scanning")
                      : t("tools.node_cleaner.status_ready")}
                  </p>
                </div>
              )}
            </div>
          </>
        ),
      },
      {
        label: t("tools.node_cleaner.tab_nvm"),
        icon: <Cpu />,
        instructions: [
          {
            title: t("tools.node_cleaner.instructions.nvm.step1_title"),
            description: t("tools.node_cleaner.instructions.nvm.step1_desc"),
          },
          {
            title: t("tools.node_cleaner.instructions.nvm.step2_title"),
            description: t("tools.node_cleaner.instructions.nvm.step2_desc"),
          },
          {
            title: t("tools.node_cleaner.instructions.nvm.step3_title"),
            description: t("tools.node_cleaner.instructions.nvm.step3_desc"),
          },
          {
            title: t("tools.node_cleaner.instructions.nvm.step4_title"),
            description: t("tools.node_cleaner.instructions.nvm.step4_desc"),
          },
        ],
        instructionsTitle: t("tools.node_cleaner.instructions.nvm.title"),
        instructionsColor: "green" as const,
        content: (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm mb-6">
              <div className="flex flex-col gap-4">
                <label className="text-sm font-bold text-[var(--text-main)]">
                  {t("tools.node_cleaner.nvm.install")}
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder={t("tools.node_cleaner.nvm.placeholder")}
                    className="flex-1 !px-4 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    value={newVersion}
                    onChange={(e) => setNewVersion(e.target.value)}
                  />
                  <Button
                    variant="contained"
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
                    onClick={handleInstallVersion}
                    disabled={nvmLoading || !newVersion}
                  >
                    <Download size={18} />
                    <span>{t("tools.node_cleaner.nvm.install_btn")}</span>
                  </Button>
                  <Button
                    variant="outlined"
                    className="p-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-[var(--text-muted)] hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50"
                    onClick={fetchNvmVersions}
                    disabled={nvmLoading}
                  >
                    <RefreshCw
                      size={18}
                      className={nvmLoading ? "animate-spin" : ""}
                    />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden flex flex-col">
              {nvmVersions.length > 0 ? (
                <div className="flex-1 overflow-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-[var(--card-bg)] z-10 border-b border-[var(--border-color)]">
                      <tr>
                        <th className="px-6 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                          {t("tools.node_cleaner.nvm.list")}
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-center w-[120px]">
                          {t("common.status")}
                        </th>
                        <th className="px-6 py-3 text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider text-center w-[200px]">
                          {t("tools.folder_size.col_actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {nvmVersions.map((v) => (
                        <tr
                          key={v.version}
                          className={`hover:bg-[var(--bg-main)] transition-colors ${
                            v.is_current ? "bg-emerald-500/5" : ""
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  v.is_current
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : "bg-[var(--bg-main)] text-[var(--text-muted)]"
                                }`}
                              >
                                <Cpu size={16} />
                              </div>
                              <span
                                className={`text-sm font-medium ${
                                  v.is_current
                                    ? "text-emerald-600 font-bold"
                                    : "text-[var(--text-main)]"
                                }`}
                              >
                                {v.version}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {v.is_current ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold whitespace-nowrap">
                                <CheckCircle2 size={12} />
                                {t("tools.node_cleaner.nvm.current")}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!v.is_current && (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary border border-primary/20 rounded-lg text-xs font-bold hover:bg-primary/10 transition-colors disabled:opacity-50"
                                  onClick={() => handleUseVersion(v.version)}
                                  disabled={nvmLoading}
                                >
                                  <Play size={14} />
                                  {t("tools.node_cleaner.nvm.use_btn")}
                                </Button>
                              )}
                              <Button
                                variant="text"
                                size="small"
                                className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                                onClick={() =>
                                  handleUninstallVersion(v.version)
                                }
                                disabled={nvmLoading || v.is_current}
                                title={t(
                                  "tools.node_cleaner.nvm.uninstall_btn"
                                )}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-[var(--bg-main)] flex items-center justify-center mb-6">
                    <Cpu size={40} className="text-primary/40" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-main)] mb-2">
                    {nvmLoading
                      ? t("common.loading")
                      : t("tools.node_cleaner.nvm.not_found")}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] max-w-xs">
                    {nvmLoading
                      ? t("tools.node_cleaner.status_scanning")
                      : t("tools.node_cleaner.nvm.error_nvm_not_found")}
                  </p>
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        label: t("tools.node_cleaner.tab_vite"),
        icon: <Zap />,
        instructions: [
          {
            title: t("tools.node_cleaner.instructions.vite.step1_title"),
            description: t("tools.node_cleaner.instructions.vite.step1_desc"),
          },
          {
            title: t("tools.node_cleaner.instructions.vite.step2_title"),
            description: t("tools.node_cleaner.instructions.vite.step2_desc"),
          },
          {
            title: t("tools.node_cleaner.instructions.vite.step3_title"),
            description: t("tools.node_cleaner.instructions.vite.step3_desc"),
          },
          {
            title: t("tools.node_cleaner.instructions.vite.step4_title"),
            description: t("tools.node_cleaner.instructions.vite.step4_desc"),
          },
        ],
        instructionsTitle: t("tools.node_cleaner.instructions.vite.title"),
        instructionsColor: "purple" as const,
        content: (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-[var(--border-color)] shadow-sm mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <label className="text-sm font-bold text-[var(--text-main)]">
                    {t("tools.node_cleaner.vite.project_name")}
                  </label>
                  <input
                    type="text"
                    className="!px-4 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    value={viteProjectName}
                    onChange={(e) => setViteProjectName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <label className="text-sm font-bold text-[var(--text-main)]">
                    {t("tools.node_cleaner.vite.target_dir")}
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder={t(
                        "tools.node_cleaner.vite.path_placeholder"
                      )}
                      className="flex-1 !px-4 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      value={viteTargetDir}
                      onChange={(e) => setViteTargetDir(e.target.value)}
                    />
                    <Button
                      variant="outlined"
                      className="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm font-medium hover:bg-[var(--border-color)] transition-colors"
                      onClick={async () => {
                        const selected = await openDialog({
                          directory: true,
                          multiple: false,
                        });
                        if (selected && typeof selected === "string") {
                          setViteTargetDir(selected);
                        }
                      }}
                    >
                      <FolderOpen size={18} />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <label className="text-sm font-bold text-[var(--text-main)] mb-4 block">
                  {t("tools.node_cleaner.vite.framework")}
                </label>
                <div className="flex flex-wrap gap-3">
                  {VITE_FRAMEWORKS.map((f) => (
                    <Button
                      key={f.id}
                      variant={
                        viteFramework === f.id ? "contained" : "outlined"
                      }
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                      onClick={() => {
                        setViteFramework(f.id);
                        setViteVariant(f.variants[0]);
                      }}
                    >
                      {f.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <label className="text-sm font-bold text-[var(--text-main)] mb-4 block">
                  {t("tools.node_cleaner.vite.variant")}
                </label>
                <div className="flex flex-wrap gap-3">
                  {VITE_FRAMEWORKS.find(
                    (f) => f.id === viteFramework
                  )?.variants.map((v) => (
                    <Button
                      key={v}
                      variant={viteVariant === v ? "contained" : "outlined"}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                      onClick={() => setViteVariant(v)}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <label className="text-sm font-bold text-[var(--text-main)] mb-2 block">
                  {t("tools.node_cleaner.vite.extra_args")}
                </label>
                <input
                  type="text"
                  placeholder="--help, --force, etc."
                  className="w-full !px-4 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={viteExtraArgs}
                  onChange={(e) => setViteExtraArgs(e.target.value)}
                />
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  💡 {t("tools.node_cleaner.vite.extra_args_tip")}
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-[var(--border-color)] flex justify-end">
                <Button
                  variant="contained"
                  className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  onClick={handleCreateVite}
                  disabled={processing || !viteTargetDir || !viteProjectName}
                >
                  <Plus size={18} />
                  <span>{t("tools.node_cleaner.vite.create_btn")}</span>
                </Button>
              </div>
            </div>

            {showLogs && (
              <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <LogViewer
                  logs={installLogs}
                  onClear={() => setInstallLogs([])}
                  title={t("tools.node_cleaner.logs_title", {
                    name: "Vite",
                  })}
                  maxHeight="400px"
                />
              </div>
            )}
          </div>
        ),
      },
    ],
    [
      t,
      scanning,
      processing,
      path,
      results,
      showLogs,
      installLogs,
      selectedManager,
      pkgStatus,
      checkedCount,
      totalSize,
      nvmLoading,
      nvmVersions,
      newVersion,
      viteProjectName,
      viteTargetDir,
      viteFramework,
      viteVariant,
      viteExtraArgs,
    ]
  );

  return (
    <ToolLayout
      title={t("tools.node_cleaner.name")}
      status={statusText}
      onCancel={scanning ? handleStop : undefined}
      progress={scanning ? 0 : undefined}
    >
      <TabLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </ToolLayout>
  );
};

export default NodeCleaner;

/**
 * 系统信息页面
 * 展示操作系统、处理器、内存、磁盘和网络等详细信息
 */
import { invoke } from "@tauri-apps/api/core";
import {
  Copy,
  Cpu,
  Database,
  HardDrive,
  Monitor,
  Network,
  QrCode,
  RefreshCw,
  Thermometer,
  X,
  Zap,
} from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invokeWrapper } from "../api/index";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button } from "../components/mui";
import { toast } from "react-hot-toast";

interface SystemInfoData {
  os: {
    name: string;
    version: string;
    kernel_version: string;
    hostname: string;
  };
  cpu: {
    model: string;
    cores: number;
    usage: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    sticks: Array<{
      manufacturer: string;
      speed: number;
      capacity: number;
      memory_type: string;
    }>;
  };
  gpus: Array<{
    name: string;
    memory_total: number;
    memory_used: number;
    temperature?: number;
    fan_speed?: number;
  }>;
  sensors: {
    cpu_temp?: number;
    mb_temp?: number;
  };
  disks: Array<{
    name: string;
    disk_type: string;
    total: number;
    available: number;
    mount_point: string;
    usage_time?: number;
  }>;
  networks: Array<{
    name: string;
    ip: string;
    mac: string;
  }>;
  wifi?: {
    ssid: string;
    password?: string;
    signal?: number;
    auth?: string;
  };
  public_ip?: string;
  proxy_ip?: string;
  uptime: number;
}

interface DiskSpeedResult {
  seq_read: number;
  seq_write: number;
  rand_4k_read: number;
  rand_4k_write: number;
}

export default function SystemInfo() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<SystemInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [testingDisk, setTestingDisk] = useState<string | null>(null);
  const [speedResults, setSpeedResults] = useState<
    Record<string, DiskSpeedResult>
  >({});
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");

  const generateWifiQrCode = async (
    ssid: string,
    password: string,
    auth: string = "WPA"
  ) => {
    try {
      // WiFi二维码格式: WIFI:T:认证类型;S:SSID;P:密码;;
      // 注意：特殊字符需要转义
      const escapedSsid = ssid.replace(/([\\;,":])/g, "\\$1");
      const escapedPassword = password.replace(/([\\;,":])/g, "\\$1");
      const wifiString = `WIFI:T:${auth};S:${escapedSsid};P:${escapedPassword};;`;

      // 生成二维码
      const dataUrl = await QRCode.toDataURL(wifiString, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      setQrCodeDataUrl(dataUrl);
      setShowQrCode(true);
    } catch (error) {
      console.error("生成二维码失败:", error);
    }
  };

  const CACHE_KEY = "system_info_cache";

  const saveCache = (data: SystemInfoData) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to save cache:", error);
    }
  };

  const loadCache = (): SystemInfoData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn("Failed to load cache:", error);
      return null;
    }
  };

  const fetchInfo = async (isInitial = false) => {
    // 初始加载时，如果有缓存就不显示loading
    if (isInitial) {
      const cached = loadCache();
      if (cached) {
        setInfo(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else {
      // 刷新时显示loading
      setLoading(true);
    }

    try {
      const adminRes = await invoke<boolean>("is_admin");
      setIsAdmin(adminRes);

      const response = await invokeWrapper<SystemInfoData>("get_system_info");
      if (response.ok) {
        console.log("System info fetched:", response.data);
        setInfo(response.data);
        saveCache(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch system info:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestSpeed = async (mountPoint: string) => {
    console.log("Testing speed for:", mountPoint);
    setTestingDisk(mountPoint);
    try {
      // 使用项目统一的 invokeWrapper，它会自动处理 ApiResponse 结构
      const response = await invokeWrapper<DiskSpeedResult>("test_disk_speed", {
        mountPoint,
      });
      console.log("Speed test response:", response);

      if (response.ok) {
        setSpeedResults((prev) => ({
          ...prev,
          [mountPoint]: response.data,
        }));
      } else {
        console.error("Disk speed test failed:", response);
        alert(`${t("common.error")}: ${response.message}`);
      }
    } catch (error) {
      console.error("Failed to test disk speed:", error);
      alert(`${t("common.error")}: ${error}`);
    } finally {
      setTestingDisk(null);
    }
  };

  useEffect(() => {
    // 初始加载：先显示缓存，再获取新数据
    fetchInfo(true);

    // 每5秒自动刷新一次
    const timer = setInterval(() => fetchInfo(false), 5000);
    return () => clearInterval(timer);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <ToolLayout title={t("tools.system_info.name")}>
      <div className="h-full overflow-y-auto pr-2 space-y-6">
        <div className="flex justify-between items-center">
          {!isAdmin && (
            <div className="text-xs text-orange-500 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20 flex items-center gap-2">
              <RefreshCw size={14} className="animate-pulse" />
              {t("tools.process_manager.admin_warning")}
            </div>
          )}
          <div className="flex-1"></div>
          <Button
            onClick={() => fetchInfo(false)}
            disabled={loading}
            variant="contained"
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 h-auto"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {t("tools.system_info.refresh")}
          </Button>
        </div>

        {/* 安全软件拦截提示 */}
        <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="flex-1 leading-relaxed">
            {t("tools.system_info.security_warning")}
          </span>
        </div>

        {!info ? (
          <SystemInfoSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 操作系统 */}
            <section className="bg-(--card-bg) border border-(--border-color) rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4 text-primary">
                <Monitor size={24} />
                <h2 className="text-lg font-bold">
                  {t("tools.system_info.os")}
                </h2>
              </div>
              <div className="space-y-3">
                <InfoItem
                  label={t("tools.system_info.os_name")}
                  value={info.os.name}
                />
                <InfoItem
                  label={t("tools.system_info.os_version")}
                  value={info.os.version}
                />
                <InfoItem
                  label={t("tools.system_info.kernel_version")}
                  value={info.os.kernel_version}
                />
                <InfoItem
                  label={t("tools.system_info.hostname")}
                  value={info.os.hostname}
                />
                <InfoItem
                  label={t("tools.system_info.uptime")}
                  value={formatUptime(info.uptime)}
                />
              </div>
            </section>
            {/* 处理器 */}
            <section className="bg-(--card-bg) border border-(--border-color) rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4 text-orange-500">
                <Cpu size={24} />
                <h2 className="text-lg font-bold">
                  {t("tools.system_info.cpu")}
                </h2>
              </div>
              <div className="space-y-3">
                <InfoItem
                  label={t("tools.system_info.cpu_model")}
                  value={info.cpu.model}
                />
                <InfoItem
                  label={t("tools.system_info.cpu_cores")}
                  value={info.cpu.cores.toString()}
                />
                {info.sensors.cpu_temp != null && (
                  <div className="flex justify-between items-center py-1 border-b border-(--border-color) border-dashed last:border-0">
                    <span className="text-sm text-(--text-muted)">
                      {t("tools.system_info.cpu_temp")}
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        info.sensors.cpu_temp > 80
                          ? "text-red-500"
                          : "text-orange-500"
                      }`}
                    >
                      {info.sensors.cpu_temp.toFixed(1)}°C
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-(--text-muted)">
                      {t("tools.system_info.cpu_usage")}
                    </span>
                    <span className="font-medium">
                      {info.cpu.usage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-(--bg-main) rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-orange-500 h-full transition-all duration-500"
                      style={{ width: `${info.cpu.usage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </section>
            {/* 内存 */}
            <section className="bg-(--card-bg) border border-(--border-color) rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4 text-green-500">
                <Database size={24} />
                <h2 className="text-lg font-bold">
                  {t("tools.system_info.memory")}
                </h2>
              </div>
              <div className="space-y-3">
                <InfoItem
                  label={t("tools.system_info.mem_total")}
                  value={formatBytes(info.memory.total)}
                />
                <InfoItem
                  label={t("tools.system_info.mem_used")}
                  value={formatBytes(info.memory.used)}
                />
                <InfoItem
                  label={t("tools.system_info.mem_free")}
                  value={formatBytes(info.memory.free)}
                />
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-(--text-muted)">
                      {t("common.progress")}
                    </span>
                    <span className="font-medium">
                      {((info.memory.used / info.memory.total) * 100).toFixed(
                        1
                      )}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-(--bg-main) rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-green-500 h-full transition-all duration-500"
                      style={{
                        width: `${
                          (info.memory.used / info.memory.total) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
                {info.memory.sticks && info.memory.sticks.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-(--border-color) border-dashed space-y-2">
                    {info.memory.sticks.map((stick, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center text-xs"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-(--text-main)">
                            {stick.manufacturer}
                          </span>
                          <span className="text-(--text-muted)">
                            {stick.memory_type} {stick.speed}MHz
                          </span>
                        </div>
                        <span className="font-medium px-2 py-0.5 bg-green-500/10 text-green-500 rounded-md">
                          {formatBytes(stick.capacity)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            {/* 显卡 */}
            <section className="bg-(--card-bg) border border-(--border-color) rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4 text-cyan-500">
                <Zap size={24} />
                <h2 className="text-lg font-bold">
                  {t("tools.system_info.gpu")}
                </h2>
              </div>
              <div className="space-y-4">
                {info.gpus.length > 0 ? (
                  info.gpus.map((gpu, i) => (
                    <div key={i} className="space-y-3">
                      <InfoItem
                        label={t("tools.system_info.gpu_model")}
                        value={gpu.name}
                      />
                      {gpu.memory_total > 0 && (
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-(--text-muted)">
                              {t("tools.system_info.gpu_memory")}
                            </span>
                            <span className="font-medium">
                              {formatBytes(gpu.memory_used)} /{" "}
                              {formatBytes(gpu.memory_total)}
                            </span>
                          </div>
                          <div className="w-full bg-(--bg-main) rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-cyan-500 h-full transition-all duration-500"
                              style={{
                                width: `${
                                  (gpu.memory_used / gpu.memory_total) * 100
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {gpu.temperature != null && (
                          <div className="flex items-center gap-2">
                            <Thermometer
                              size={14}
                              className="text-orange-500"
                            />
                            <span className="text-sm text-(--text-muted)">
                              {t("tools.system_info.gpu_temp")}:
                            </span>
                            <span className="text-sm font-medium">
                              {gpu.temperature}°C
                            </span>
                          </div>
                        )}
                        {gpu.fan_speed != null && (
                          <div className="flex items-center gap-2">
                            <RefreshCw size={14} className="text-blue-500" />
                            <span className="text-sm text-(--text-muted)">
                              {t("tools.system_info.gpu_fan")}:
                            </span>
                            <span className="text-sm font-medium">
                              {gpu.fan_speed}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-(--text-muted) italic">
                    No GPU detected
                  </div>
                )}
              </div>
            </section>
            {/* 磁盘和网络 - 同一行 */}
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 磁盘 */}
              <section className="bg-(--card-bg) border border-(--border-color) rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-purple-500">
                  <HardDrive size={24} />
                  <h2 className="text-lg font-bold">
                    {t("tools.system_info.disk")}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-4 max-h-[500px] overflow-y-auto pr-2">
                  {info.disks.map((disk, i) => (
                    <div
                      key={i}
                      className="p-4 bg-(--bg-main) rounded-xl border border-(--border-color) flex flex-col"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-sm">
                            {disk.mount_point}
                          </div>
                          <div className="text-xs text-(--text-muted)">
                            {disk.name || disk.disk_type}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-xs font-medium px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded-full">
                            {(
                              ((disk.total - disk.available) / disk.total) *
                              100
                            ).toFixed(0)}
                            %
                          </div>
                          {disk.usage_time !== undefined && (
                            <div className="text-[10px] text-(--text-muted)">
                              {t("tools.system_info.disk_usage_time")}:{" "}
                              {disk.usage_time}h
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-(--border-color) rounded-full h-1.5 mb-2 overflow-hidden">
                        <div
                          className="bg-purple-500 h-full"
                          style={{
                            width: `${
                              ((disk.total - disk.available) / disk.total) * 100
                            }%`,
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-(--text-muted) mb-4">
                        <span>
                          {formatBytes(disk.total - disk.available)} /{" "}
                          {formatBytes(disk.total)}
                        </span>
                        <span>
                          {t("tools.system_info.disk_available")}:{" "}
                          {formatBytes(disk.available)}
                        </span>
                      </div>

                      {/* 测速部分 */}
                      <div className="mt-auto pt-3 border-t border-(--border-color) border-dashed">
                        {speedResults[disk.mount_point] ? (
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-(--card-bg) p-2 rounded-lg border border-(--border-color)">
                              <div className="text-[9px] text-(--text-muted) uppercase">
                                {t("tools.system_info.disk_speed_seq_read")}
                              </div>
                              <div className="text-xs font-bold text-primary">
                                {speedResults[
                                  disk.mount_point
                                ].seq_read.toFixed(1)}{" "}
                                <span className="text-[9px] font-normal">
                                  {t("tools.system_info.disk_speed_unit")}
                                </span>
                              </div>
                            </div>
                            <div className="bg-(--card-bg) p-2 rounded-lg border border-(--border-color)">
                              <div className="text-[9px] text-(--text-muted) uppercase">
                                {t("tools.system_info.disk_speed_seq_write")}
                              </div>
                              <div className="text-xs font-bold text-orange-500">
                                {speedResults[
                                  disk.mount_point
                                ].seq_write.toFixed(1)}{" "}
                                <span className="text-[9px] font-normal">
                                  {t("tools.system_info.disk_speed_unit")}
                                </span>
                              </div>
                            </div>
                            <div className="bg-(--card-bg) p-2 rounded-lg border border-(--border-color)">
                              <div className="text-[9px] text-(--text-muted) uppercase">
                                {t("tools.system_info.disk_speed_4k_read")}
                              </div>
                              <div className="text-xs font-bold text-green-500">
                                {speedResults[
                                  disk.mount_point
                                ].rand_4k_read.toFixed(2)}{" "}
                                <span className="text-[9px] font-normal">
                                  {t("tools.system_info.disk_speed_unit")}
                                </span>
                              </div>
                            </div>
                            <div className="bg-(--card-bg) p-2 rounded-lg border border-(--border-color)">
                              <div className="text-[9px] text-(--text-muted) uppercase">
                                {t("tools.system_info.disk_speed_4k_write")}
                              </div>
                              <div className="text-xs font-bold text-purple-500">
                                {speedResults[
                                  disk.mount_point
                                ].rand_4k_write.toFixed(2)}{" "}
                                <span className="text-[9px] font-normal">
                                  {t("tools.system_info.disk_speed_unit")}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleTestSpeed(disk.mount_point)}
                          disabled={testingDisk !== null}
                          className="w-full py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 h-auto"
                        >
                          {testingDisk === disk.mount_point ? (
                            <>
                              <RefreshCw size={12} className="animate-spin" />
                              {t("tools.system_info.disk_speed_testing")}
                            </>
                          ) : (
                            <>
                              <RefreshCw size={12} />
                              {t("tools.system_info.disk_speed_test")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              {/* 网络 */}
              <section className="bg-(--card-bg) border border-(--border-color) rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4 text-blue-500">
                  <Network size={24} />
                  <h2 className="text-lg font-bold">
                    {t("tools.system_info.network")}
                  </h2>
                </div>
                <div className="space-y-4">
                  {info.networks.filter((n) => {
                    if (!n.ip) return false;
                    const ipv4 = n.ip
                      .split(",")
                      .find((ip) => !ip.trim().includes(":"));
                    return !!ipv4 && !ipv4.includes("127.");
                  }).length > 0 && (
                    <div className="p-3 bg-green-500/5 rounded-xl border border-green-500/20">
                      <div className="text-[10px] uppercase tracking-wider text-green-500 font-bold mb-1">
                        {t("tools.system_info.local_ip")}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-mono font-medium text-(--text-main)">
                          {(() => {
                            const network = info.networks.find((n) => {
                              if (!n.ip) return false;
                              const ipv4 = n.ip
                                .split(",")
                                .find((ip) => !ip.trim().includes(":"));
                              return !!ipv4 && !ipv4.includes("127.");
                            });
                            if (!network?.ip) return "-";
                            const ipv4 = network.ip
                              .split(",")
                              .find((ip) => !ip.trim().includes(":"));
                            return ipv4?.trim().split("/")[0] || "-";
                          })()}
                        </div>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => {
                            const network = info.networks.find((n) => {
                              if (!n.ip) return false;
                              const ipv4 = n.ip
                                .split(",")
                                .find((ip) => !ip.trim().includes(":"));
                              return !!ipv4 && !ipv4.includes("127.");
                            });
                            if (network?.ip) {
                              const ipv4 = network.ip
                                .split(",")
                                .find((ip) => !ip.trim().includes(":"));
                              const ip = ipv4?.trim().split("/")[0];
                              if (ip) {
                                navigator.clipboard.writeText(ip);
                                toast.success(t("common.copy_success"));
                              }
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-green-500/10 transition-colors h-auto"
                        >
                          <Copy size={16} className="text-green-500" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {info.public_ip && (
                    <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/20">
                      <div className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mb-1">
                        {t("tools.system_info.public_ip")}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-mono font-medium text-(--text-main)">
                          {info.public_ip}
                        </div>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => {
                            if (info.public_ip) {
                              navigator.clipboard.writeText(info.public_ip);
                              toast.success(t("common.copy_success"));
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-blue-500/10 transition-colors h-auto"
                        >
                          <Copy size={16} className="text-blue-500" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {info.proxy_ip && (
                    <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/20">
                      <div className="text-[10px] uppercase tracking-wider text-orange-500 font-bold mb-1">
                        {t("tools.system_info.proxy_ip")}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-mono font-medium text-(--text-main)">
                          {info.proxy_ip}
                        </div>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => {
                            if (info.proxy_ip) {
                              navigator.clipboard.writeText(info.proxy_ip);
                              toast.success(t("common.copy_success"));
                            }
                          }}
                          className="p-1.5 rounded-lg hover:bg-orange-500/10 transition-colors h-auto"
                        >
                          <Copy size={16} className="text-orange-500" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {info.wifi && (
                    <div className="p-4 bg-(--card-bg) rounded-xl border border-(--border-color) shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="text-xs uppercase tracking-wider text-primary font-bold mb-1">
                            {t("tools.system_info.wifi_connected")}
                          </div>
                          <div className="text-lg font-bold text-(--text-main) mb-1 flex items-center gap-2">
                            {info.wifi.ssid}
                            {info.wifi.password && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() =>
                                  generateWifiQrCode(
                                    info.wifi!.ssid,
                                    info.wifi!.password!,
                                    info.wifi!.auth?.includes("WPA")
                                      ? "WPA"
                                      : "WEP"
                                  )
                                }
                                className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all h-auto"
                                title="生成WiFi二维码"
                              >
                                <QrCode size={16} />
                              </Button>
                            )}
                          </div>
                          {info.wifi.auth && (
                            <div className="text-xs text-(--text-muted)">
                              {info.wifi.auth}
                            </div>
                          )}
                        </div>
                        {info.wifi.signal != null && (
                          <div className="flex flex-col items-end">
                            <div className="text-2xl font-bold text-primary">
                              {info.wifi.signal}%
                            </div>
                            <div className="text-[10px] text-(--text-muted) uppercase">
                              {t("tools.system_info.wifi_signal")}
                            </div>
                          </div>
                        )}
                      </div>
                      {info.wifi.password && (
                        <div className="pt-3 border-t border-(--border-color) border-dashed">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-(--text-muted)">
                              {t("tools.system_info.wifi_password")}:
                            </span>
                            <span className="text-sm font-mono font-bold text-primary select-all">
                              {info.wifi.password}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
                    {info.networks
                      .filter((n) => n.ip)
                      .map((net, i) => (
                        <div
                          key={i}
                          className="p-3 bg-(--bg-main) rounded-xl border border-(--border-color)"
                        >
                          <div className="font-bold text-sm mb-1 truncate">
                            {net.name}
                          </div>
                          <div className="text-xs text-(--text-muted) space-y-1">
                            <div className="flex justify-between">
                              <span>IP:</span>
                              <span className="text-(--text-main)">
                                {net.ip}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>MAC:</span>
                              <span className="text-(--text-main)">
                                {net.mac}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </section>{" "}
            </div>{" "}
          </div>
        )}
      </div>

      {/* WiFi 二维码弹窗 */}
      {showQrCode && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowQrCode(false)}
        >
          <div
            className="bg-(--card-bg) rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-(--text-main)">
                {t("tools.system_info.wifi_qr_title")}
              </h3>
              <Button
                variant="text"
                size="small"
                onClick={() => setShowQrCode(false)}
                className="p-1 rounded-lg hover:bg-(--bg-main) transition-colors h-auto"
              >
                <X size={20} className="text-(--text-muted)" />
              </Button>
            </div>
            <div className="flex justify-center mb-4">
              {qrCodeDataUrl && (
                <img
                  src={qrCodeDataUrl}
                  alt="WiFi QR Code"
                  className="w-64 h-64 rounded-lg border border-(--border-color)"
                />
              )}
            </div>
            <p className="text-sm text-(--text-muted) text-center">
              {t("tools.system_info.wifi_qr_desc")}
            </p>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-(--border-color) border-dashed last:border-0">
      <span className="text-sm text-(--text-muted)">{label}</span>
      <span className="text-sm font-medium text-(--text-main) truncate ml-4">
        {value}
      </span>
    </div>
  );
}

function SystemInfoSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-(--card-bg) border border-(--border-color) rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-6 h-6 bg-(--border-color) rounded-md"></div>
            <div className="w-24 h-6 bg-(--border-color) rounded-md"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((j) => (
              <div
                key={j}
                className="flex justify-between items-center py-1 border-b border-(--border-color) border-dashed last:border-0"
              >
                <div className="w-20 h-4 bg-(--border-color) rounded"></div>
                <div className="w-32 h-4 bg-(--border-color) rounded"></div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-(--card-bg) border border-(--border-color) rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-6 h-6 bg-(--border-color) rounded-md"></div>
              <div className="w-24 h-6 bg-(--border-color) rounded-md"></div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-20 bg-(--bg-main) rounded-xl border border-(--border-color)"
                ></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

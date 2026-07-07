import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import { invokeWrapper } from "../api";
import toast from "react-hot-toast";
import { Globe, Copy, Search, MapPin, AlertCircle } from "lucide-react";

interface IpQueryResult {
  ip: string;
  ip_type: string;
  country: string;
  province: string;
  city: string;
  isp: string;
  organization: string;
  latitude: number;
  longitude: number;
  asn: string;
  timezone: string;
}

const IpLookup: React.FC = () => {
  const { t } = useTranslation();
  const [ipInput, setIpInput] = useState("");
  const [queryResult, setQueryResult] = useState<IpQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [specialInfo, setSpecialInfo] = useState("");

  const handleQuery = async (targetIp?: string) => {
    const trimmedIp = (targetIp !== undefined ? targetIp : ipInput).trim();

    // 如果 targetIp 为空字符串，表示查询本机 IP
    const isMyIp = trimmedIp === "";

    setLoading(true);
    try {
      // 如果不是查询本机 IP，先验证 IP
      if (!isMyIp) {
        const validateRes = await invokeWrapper<string>("validate_ip_address", {
          ipAddress: trimmedIp,
        });

        if (!validateRes.ok) {
          toast.error(validateRes.message || t("tools.ip_lookup.invalid_ip"));
          setLoading(false);
          return;
        }

        // 检查是否是特殊地址
        const specialRes = await invokeWrapper<[boolean, string]>(
          "get_ip_special_info",
          {
            ipAddress: trimmedIp,
          }
        );

        if (specialRes.ok && specialRes.data && specialRes.data[0]) {
          setSpecialInfo(specialRes.data[1]);
        } else {
          setSpecialInfo("");
        }
      } else {
        setSpecialInfo("");
      }

      // 查询 IP 信息
      const res = await invokeWrapper<IpQueryResult>("query_ip_info", {
        req: { ip_address: trimmedIp },
      });

      if (res.ok && res.data) {
        setQueryResult(res.data);
        if (!isMyIp && !history.includes(trimmedIp)) {
          setHistory([trimmedIp, ...history.slice(0, 9)]);
        }
        if (isMyIp) {
          setIpInput(res.data.ip);
        }
        toast.success(t("common.success"));
      } else {
        toast.error(t("tools.ip_lookup.query_failed"));
      }
    } catch (error: any) {
      toast.error(error.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} ${t("common.copy_success")}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleQuery();
    }
  };

  return (
    <ToolLayout title={t("tools.ip_lookup.name")}>
      <div className="max-w-5xl mx-auto w-full space-y-6 pb-10">
        {/* 查询输入 */}
        <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) p-6">
          <label className="block text-sm font-bold text-(--text-main) mb-3">
            {t("tools.ip_lookup.ip_address")}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t("tools.ip_lookup.ip_placeholder")}
              className="flex-1 px-4 py-2 bg-(--bg-main) border border-(--border-color) rounded-lg text-(--text-main) placeholder-(--text-muted) focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => handleQuery()}
              disabled={loading || !ipInput.trim()}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Search size={18} />
              {loading ? t("common.loading") : t("tools.ip_lookup.query")}
            </button>
            <button
              onClick={() => handleQuery("")}
              disabled={loading}
              className="px-6 py-2 bg-(--bg-main) hover:bg-(--border-color) border border-(--border-color) text-(--text-main) rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Globe size={18} />
              {t("tools.ip_lookup.query_my_ip")}
            </button>
          </div>
        </div>

        {/* 特殊地址警告 */}
        {specialInfo && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle
              size={20}
              className="text-amber-500 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-bold text-amber-600">
                {t("common.status")}
              </p>
              <p className="text-sm text-amber-600">{specialInfo}</p>
            </div>
          </div>
        )}

        {/* 查询结果 */}
        {queryResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 基础信息 */}
            <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) p-6 lg:col-span-3">
              <h3 className="text-lg font-bold text-(--text-main) mb-4 flex items-center gap-2">
                <Globe size={20} />
                {t("common.status")}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-(--bg-main) p-4 rounded-lg">
                  <p className="text-xs text-(--text-muted)">IP</p>
                  <p className="text-lg font-bold text-(--text-main) truncate">
                    {queryResult.ip}
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    {queryResult.ip_type}
                  </p>
                </div>
                <div className="bg-(--bg-main) p-4 rounded-lg">
                  <p className="text-xs text-(--text-muted)">
                    {t("tools.ip_lookup.country")}
                  </p>
                  <p className="text-lg font-bold text-(--text-main) flex items-center gap-2">
                    <Globe size={18} />
                    {queryResult.country}
                  </p>
                </div>
                <div className="bg-(--bg-main) p-4 rounded-lg">
                  <p className="text-xs text-(--text-muted)">
                    {t("tools.ip_lookup.isp")}
                  </p>
                  <p className="text-lg font-bold text-(--text-main) truncate">
                    {queryResult.isp || "-"}
                  </p>
                </div>
                <div className="bg-(--bg-main) p-4 rounded-lg">
                  <p className="text-xs text-(--text-muted)">
                    {t("tools.ip_lookup.timezone")}
                  </p>
                  <p className="text-lg font-bold text-(--text-main) truncate">
                    {queryResult.timezone}
                  </p>
                </div>
              </div>
            </div>

            {/* 地理位置 */}
            <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) p-6">
              <h4 className="font-bold text-(--text-main) mb-4 flex items-center gap-2">
                <MapPin size={18} />
                {t("tools.ip_lookup.location")}
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-(--text-muted)">
                    {t("tools.ip_lookup.province")}
                  </p>
                  <p className="text-sm font-medium text-(--text-main)">
                    {queryResult.province || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--text-muted)">
                    {t("tools.ip_lookup.city")}
                  </p>
                  <p className="text-sm font-medium text-(--text-main)">
                    {queryResult.city || "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* 坐标 */}
            <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) p-6">
              <h4 className="font-bold text-(--text-main) mb-4">
                {t("tools.ip_lookup.coordinates")}
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-(--text-muted)">
                    {t("tools.ip_lookup.latitude")}
                  </p>
                  <p className="text-sm font-medium text-(--text-main)">
                    {queryResult.latitude}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--text-muted)">
                    {t("tools.ip_lookup.longitude")}
                  </p>
                  <p className="text-sm font-medium text-(--text-main)">
                    {queryResult.longitude}
                  </p>
                </div>
              </div>
            </div>

            {/* 其他信息 */}
            <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) p-6">
              <h4 className="font-bold text-(--text-main) mb-4">
                {t("tools.ip_lookup.others")}
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-(--text-muted)">
                    {t("tools.ip_lookup.organization")}
                  </p>
                  <p className="text-sm font-medium text-(--text-main) truncate">
                    {queryResult.organization || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-(--text-muted)">
                    {t("tools.ip_lookup.asn")}
                  </p>
                  <p className="text-sm font-medium text-(--text-main)">
                    {queryResult.asn || "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 查询历史 */}
        {history.length > 0 && (
          <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) p-6">
            <h3 className="text-lg font-bold text-(--text-main) mb-4">
              {t("tools.ip_lookup.query_history")}
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {history.map((ip, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-(--bg-main) rounded-lg border border-(--border-color) hover:border-blue-500 transition-colors"
                >
                  <span
                    onClick={() => setIpInput(ip)}
                    className="cursor-pointer text-sm text-(--text-main) hover:text-blue-500 transition-colors"
                  >
                    {ip}
                  </span>
                  <button
                    onClick={() => handleCopy(ip, "IP")}
                    className="p-2 hover:bg-(--border-color) rounded-lg transition-colors"
                  >
                    <Copy size={16} className="text-(--text-muted)" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default IpLookup;


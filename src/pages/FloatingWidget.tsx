/**
 * 悬浮窗组件
 * 置顶显示 CPU、内存和网速等核心指标
 */
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Activity, Cpu, Database, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/mui";

interface WidgetData {
  cpu_usage: number;
  mem_usage: number;
  net_speed?: string;
}

export default function FloatingWidget() {
  const [data, setData] = useState<WidgetData>({ cpu_usage: 0, mem_usage: 0 });

  const fetchData = async () => {
    try {
      // 为了性能，悬浮窗可以调用一个更轻量的命令，或者复用 get_system_info
      // 这里暂时复用 get_system_info，但只取需要的部分
      const res = await invoke<any>("get_system_info");
      if (res.ok && res.data) {
        const info = res.data;
        setData({
          cpu_usage: info.cpu.usage,
          mem_usage: (info.memory.used / info.memory.total) * 100,
        });
      }
    } catch (e) {
      console.error("Failed to fetch widget data", e);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 2000); // 悬浮窗刷新频率稍高
    return () => clearInterval(timer);
  }, []);

  const handleClose = async () => {
    const win = getCurrentWindow();
    await win.close();
  };

  return (
    <div
      className="h-screen w-screen bg-black/60 backdrop-blur-md text-white p-3 rounded-xl border border-white/10 flex flex-col justify-center gap-2 select-none overflow-hidden group"
      data-tauri-drag-region
    >
      <Button
        variant="text"
        size="small"
        onClick={handleClose}
        className="absolute! top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 h-auto min-w-0"
      >
        <X size={12} />
      </Button>

      <div className="flex items-center gap-3" data-tauri-drag-region>
        <Cpu size={14} className="text-orange-400" />
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-400 transition-all duration-500"
            style={{ width: `${data.cpu_usage}%` }}
          />
        </div>
        <span className="text-[10px] font-mono w-8 text-right">
          {data.cpu_usage.toFixed(0)}%
        </span>
      </div>

      <div className="flex items-center gap-3" data-tauri-drag-region>
        <Database size={14} className="text-green-400" />
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-400 transition-all duration-500"
            style={{ width: `${data.mem_usage}%` }}
          />
        </div>
        <span className="text-[10px] font-mono w-8 text-right">
          {data.mem_usage.toFixed(0)}%
        </span>
      </div>

      <div className="flex items-center gap-3" data-tauri-drag-region>
        <Activity size={14} className="text-blue-400" />
        <div className="flex-1 text-[10px] font-mono text-blue-400/80">
          Real-time Monitor
        </div>
      </div>
    </div>
  );
}


import React, { useState, useRef, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";

const ScreenshotSelector: React.FC = () => {
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [scaleFactor, setScaleFactor] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 获取缩放比例
    getCurrentWindow().scaleFactor().then(setScaleFactor);

    // 设置背景透明
    document.body.style.backgroundColor = "transparent";
    document.documentElement.style.backgroundColor = "transparent";
    const root = document.getElementById("root");
    if (root) root.style.backgroundColor = "transparent";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStartPos(null);
        setCurrentPos(null);
        getCurrentWindow().hide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.backgroundColor = "";
      document.documentElement.style.backgroundColor = "";
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (startPos) {
      setCurrentPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = async () => {
    if (startPos && currentPos) {
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const width = Math.abs(startPos.x - currentPos.x);
      const height = Math.abs(startPos.y - currentPos.y);

      if (width > 5 && height > 5) {
        // 发送物理像素坐标给主窗口
        await emit("screenshot-captured", {
          x: x * scaleFactor,
          y: y * scaleFactor,
          width: width * scaleFactor,
          height: height * scaleFactor,
        });
        await getCurrentWindow().hide();
      }
    }
    setStartPos(null);
    setCurrentPos(null);
  };

  const rect =
    startPos && currentPos
      ? {
          left: Math.min(startPos.x, currentPos.x),
          top: Math.min(startPos.y, currentPos.y),
          width: Math.abs(startPos.x - currentPos.x),
          height: Math.abs(startPos.y - currentPos.y),
        }
      : null;

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen bg-black/30 cursor-crosshair relative overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm backdrop-blur-md border border-white/10">
        拖动鼠标选择识别区域 (Esc 退出)
      </div>

      {rect && (
        <>
          {/* 选区高亮 */}
          <div
            className="absolute border-2 border-primary bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            }}
          >
            <div className="absolute -top-6 left-0 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded">
              {Math.round(rect.width)} x {Math.round(rect.height)}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ScreenshotSelector;


import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import React, { useEffect, useState, useRef } from "react";

interface PixelInfo {
  x: number;
  y: number;
  color: string;
}

const Magnifier: React.FC = () => {
  const [info, setInfo] = useState<PixelInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    // Make window click-through
    appWindow.setIgnoreCursorEvents(true);

    // Make background transparent
    document.body.style.backgroundColor = "transparent";
    document.documentElement.style.backgroundColor = "transparent";

    const root = document.getElementById("root");
    if (root) root.style.backgroundColor = "transparent";

    let animationFrameId: number;
    let isRunning = true;

    const update = async () => {
      if (!isRunning) return;
      try {
        const result = await invoke<PixelInfo>("get_mouse_pixel_color");

        // Update position immediately via DOM for maximum smoothness
        if (containerRef.current) {
          const scaleFactor = window.devicePixelRatio || 1;
          const logicalX = result.x / scaleFactor;
          const logicalY = result.y / scaleFactor;
          const offset = 20;
          const width = 160;
          const height = 64;

          let left = logicalX + offset;
          let top = logicalY + offset;

          if (left + width > window.innerWidth)
            left = logicalX - width - offset;
          if (top + height > window.innerHeight)
            top = logicalY - height - offset;
          if (left < 0) left = offset;
          if (top < 0) top = offset;

          containerRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        }

        setInfo(result);
      } catch (e) {
        // ignore
      }

      if (isRunning) {
        animationFrameId = requestAnimationFrame(update);
      }
    };

    update();

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (!info) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: 160,
        height: 64,
        borderRadius: "16px",
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(0, 0, 0, 0.1)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: "12px",
        pointerEvents: "none",
        zIndex: 9999,
        willChange: "transform",
      }}
    >
      {/* Color Swatch */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "8px",
          backgroundColor: info.color,
          border: "1px solid rgba(0, 0, 0, 0.1)",
          flexShrink: 0,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <div
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "16px",
            fontWeight: 700,
            color: "#1a1a1a",
            letterSpacing: "-0.5px",
          }}
        >
          {info.color.toUpperCase()}
        </div>
        <div style={{ fontSize: "11px", color: "#666", fontWeight: 500 }}>
          {info.x}, {info.y}
        </div>
      </div>
    </div>
  );
};

export default Magnifier;

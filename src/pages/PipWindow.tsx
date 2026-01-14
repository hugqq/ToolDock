import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export default function PipWindow() {
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();

    // 从 hash 中获取视频 URL (因为使用 HashRouter)
    const hash = window.location.hash;
    const queryStart = hash.indexOf("?");

    if (queryStart !== -1) {
      const queryString = hash.substring(queryStart + 1);
      const searchParams = new URLSearchParams(queryString);
      const url = searchParams.get("url");

      if (url) {
        setVideoUrl(decodeURIComponent(url));
      }
    }

    // 设置窗口标题
    appWindow.setTitle("画中画播放器").catch(console.error);
  }, []);

  if (!videoUrl) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000",
          color: "#fff",
        }}
      >
        加载中...
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <iframe
        src={videoUrl}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}


import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "react-i18next";
import { Box, Typography, CircularProgress, Button } from "@mui/material";
import { CheckCircle } from "@mui/icons-material";

export default function BilibiliLogin() {
  const { t } = useTranslation();
  const [isChecking, setIsChecking] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  useEffect(() => {
    const checkLoginInterval = setInterval(async () => {
      try {
        // 检查是否已经登录（通过检查 cookie）
        const cookies = document.cookie;
        if (cookies.includes("DedeUserID") && cookies.includes("SESSDATA")) {
          setIsChecking(true);
          // 保存 cookie
          await invoke("save_bilibili_cookie", { cookie: cookies });
          setLoginSuccess(true);
          setIsChecking(false);

          // 2秒后自动关闭窗口
          setTimeout(() => {
            const window = getCurrentWebviewWindow();
            window.close();
          }, 2000);

          clearInterval(checkLoginInterval);
        }
      } catch (error) {
        console.error("Failed to check login status:", error);
      }
    }, 2000);

    return () => clearInterval(checkLoginInterval);
  }, []);

  const handleClose = () => {
    const window = getCurrentWebviewWindow();
    window.close();
  };

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "100%",
        bgcolor: "rgba(0, 0, 0, 0.8)",
        color: "white",
        p: 2,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {loginSuccess ? (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircle color="success" />
            <Typography>{t("tools.bilibili_login.login_success")}</Typography>
          </Box>
        </>
      ) : isChecking ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={20} />
          <Typography>{t("tools.bilibili_login.saving_login")}</Typography>
        </Box>
      ) : (
        <>
          <Typography>{t("tools.bilibili_login.scan_qr_code")}</Typography>
          <Button variant="outlined" size="small" onClick={handleClose}>
            {t("tools.bilibili_login.cancel")}
          </Button>
        </>
      )}
    </Box>
  );
}

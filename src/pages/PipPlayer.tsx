import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Stack,
  Alert,
  FormControlLabel,
  Checkbox,
  Grid,
  Autocomplete,
  IconButton,
} from "@mui/material";
import {
  PlayArrow,
  Stop,
  PictureInPicture,
  Login,
  Save,
  Delete,
  History,
  Clear,
} from "@mui/icons-material";
import { ToolLayout } from "../components/layout/ToolLayout";
import { InstructionsCard } from "../components/shared/InstructionsCard";
import { listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

interface PipWindowConfig {
  width: number;
  height: number;
  always_on_top: boolean;
  auto_pip: boolean;
}

const HISTORY_KEY = "bilibili_video_history";
const MAX_HISTORY = 20;

export default function PipPlayer() {
  const { t } = useTranslation();
  const [videoUrl, setVideoUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasLogin, setHasLogin] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // 播放器配置
  const [config, setConfig] = useState<PipWindowConfig>({
    width: 100,
    height: 100,
    always_on_top: false,
    auto_pip: true,
  });

  // 加载历史记录
  const loadHistory = () => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  };

  // 保存视频地址到历史（去重）
  const saveToHistory = (url: string) => {
    try {
      const newHistory = [url, ...history.filter((h) => h !== url)].slice(
        0,
        MAX_HISTORY
      );
      setHistory(newHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
      console.error("Failed to save history:", error);
    }
  };

  // 清空历史记录
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    toast.success(t("tools.pip_player.history_cleared"));
  };

  // 检查是否有保存的 cookie
  const checkLoginStatus = async () => {
    try {
      const cookie = await invoke<string>("get_bilibili_cookie");
      setHasLogin(!!cookie && cookie.length > 0);
    } catch (error) {
      console.error("Failed to check login:", error);
    }
  };

  // 检查画中画窗口是否存在
  const checkPipWindow = async () => {
    try {
      const win = await WebviewWindow.getByLabel("pip-player");
      setIsPlaying(!!win);
    } catch (e) {
      setIsPlaying(false);
    }
  };

  // 加载保存的登录状态和历史记录
  useEffect(() => {
    checkLoginStatus();
    loadHistory();
    checkPipWindow();

    const interval = setInterval(checkPipWindow, 1000);

    // 监听登录成功事件
    const unlisten = listen("bilibili-login-success", () => {
      checkLoginStatus();
      toast.success(t("common.success"));
    });

    return () => {
      clearInterval(interval);
      unlisten.then((fn) => fn());
    };
  }, []);

  // 解析 B站 视频链接，支持 BV 号、av 号和短链接
  const parseVideoUrl = async (url: string): Promise<string | null> => {
    try {
      let targetUrl = url;

      // 如果是短链接，先解析重定向
      if (url.includes("b23.tv")) {
        try {
          targetUrl = await invoke<string>("resolve_bilibili_short_url", {
            url,
          });
        } catch (error) {
          console.error("Failed to resolve short URL:", error);
          return null;
        }
      }

      // 匹配 BV 号 - 返回完整视频页面（支持选集）
      const bvMatch = targetUrl.match(/BV[a-zA-Z0-9]+/);
      if (bvMatch) {
        return `https://www.bilibili.com/video/${bvMatch[0]}`;
      }

      // 匹配 av 号 - 返回完整视频页面（支持选集）
      const avMatch = targetUrl.match(/av(\d+)/);
      if (avMatch) {
        return `https://www.bilibili.com/video/av${avMatch[1]}`;
      }

      return null;
    } catch (error) {
      console.error("Parse video URL error:", error);
      return null;
    }
  };

  const handlePlay = async () => {
    if (!videoUrl.trim()) {
      toast.error(t("tools.pip_player.invalid_url"));
      return;
    }

    const playerUrl = await parseVideoUrl(videoUrl);
    if (!playerUrl) {
      toast.error(t("tools.pip_player.parse_error"));
      return;
    }

    try {
      await invoke("open_pip_window", {
        videoUrl: playerUrl,
        config: config,
      });
      saveToHistory(videoUrl); // 保存到历史记录
      setIsPlaying(true);
      toast.success(t("tools.pip_player.playing"));
    } catch (error) {
      console.error("Failed to open PIP window:", error);
      toast.error(t("tools.pip_player.open_error"));
    }
  };

  const handleStop = async () => {
    try {
      await invoke("close_pip_window");
      setIsPlaying(false);
      toast.success(t("common.success"));
    } catch (error) {
      console.error("Failed to close PIP window:", error);
    }
  };

  const handleOpenLogin = async () => {
    try {
      await invoke("open_bilibili_login_window");
      toast.success(t("tools.pip_player.scan_login_prompt"));
    } catch (error) {
      console.error("Failed to open login window:", error);
      toast.error(t("tools.pip_player.open_login_failed"));
    }
  };

  const handleSaveLogin = async () => {
    try {
      const result = await invoke<string>("extract_and_save_cookies");
      if (result && result.length > 0) {
        toast.success(result); // 显示详细的保存结果
        checkLoginStatus();
      } else {
        toast.error(t("tools.pip_player.no_login_found"));
      }
    } catch (error: any) {
      console.error("Failed to save login:", error);
      // 显示详细错误信息
      toast.error(
        typeof error === "string"
          ? error
          : error?.message || t("tools.pip_player.save_login_failed")
      );
    }
  };

  const handleClearLogin = async () => {
    try {
      await invoke("clear_bilibili_cookie");
      setHasLogin(false);
      toast.success(t("tools.pip_player.login_cleared"));
    } catch (error) {
      console.error("Failed to clear cookie:", error);
      toast.error(t("tools.pip_player.clear_failed"));
    }
  };

  return (
    <ToolLayout title={t("tools.pip_player.name")}>
      <Box sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* 使用说明卡片 */}
          <InstructionsCard
            title={t("tools.pip_player.instructions.title")}
            color="blue"
            steps={[
              {
                title: t("tools.pip_player.instructions.step1_title"),
                description: t("tools.pip_player.instructions.step1_desc"),
              },
              {
                title: t("tools.pip_player.instructions.step2_title"),
                description: t("tools.pip_player.instructions.step2_desc"),
              },
              {
                title: t("tools.pip_player.instructions.step3_title"),
                description: t("tools.pip_player.instructions.step3_desc"),
              },
              {
                title: t("tools.pip_player.instructions.step4_title"),
                description: t("tools.pip_player.instructions.step4_desc"),
              },
            ]}
          />

          <Paper elevation={2} sx={{ p: 3 }}>
            <Stack spacing={2}>
              {hasLogin && (
                <Alert severity="success" sx={{ mb: 1 }}>
                  {t("tools.pip_player.logged_in_account")}
                </Alert>
              )}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 1,
                  mb: 1,
                }}
              >
                <Button
                  size="small"
                  startIcon={<Login />}
                  onClick={handleOpenLogin}
                  variant="outlined"
                >
                  {t("tools.pip_player.scan_qr_login")}
                </Button>
                <Button
                  size="small"
                  startIcon={<Save />}
                  onClick={handleSaveLogin}
                  variant="outlined"
                  color="primary"
                >
                  {t("tools.pip_player.save_login")}
                </Button>
                {hasLogin && (
                  <Button
                    size="small"
                    startIcon={<Delete />}
                    onClick={handleClearLogin}
                    variant="outlined"
                    color="error"
                  >
                    {t("tools.pip_player.clear_login")}
                  </Button>
                )}
              </Box>

              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={history}
                  value={videoUrl}
                  onInputChange={(_, newValue) => setVideoUrl(newValue)}
                  disabled={isPlaying}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t("tools.pip_player.video_url")}
                      placeholder={t("tools.pip_player.video_url_placeholder")}
                      variant="outlined"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: history.length > 0 && (
                          <History sx={{ mr: 1, color: "action.active" }} />
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Typography
                        variant="body2"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {option}
                      </Typography>
                    </li>
                  )}
                />
                {history.length > 0 && (
                  <IconButton
                    onClick={clearHistory}
                    color="error"
                    title={t("tools.pip_player.clear_history_tooltip")}
                    disabled={isPlaying}
                  >
                    <Clear />
                  </IconButton>
                )}
              </Box>

              {history.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t("tools.pip_player.history_label")} ({history.length}/
                    {MAX_HISTORY})
                  </Typography>
                </Box>
              )}

              {/* 播放器配置 */}
              <Paper
                variant="outlined"
                sx={{ p: 2, bgcolor: "background.default" }}
              >
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  {t("tools.pip_player.player_config")}
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      label={t("tools.pip_player.window_width")}
                      type="number"
                      size="small"
                      value={config.width}
                      onChange={(e) =>
                        setConfig({ ...config, width: Number(e.target.value) })
                      }
                      InputProps={{ inputProps: { min: 200, max: 3840 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      fullWidth
                      label={t("tools.pip_player.window_height")}
                      type="number"
                      size="small"
                      value={config.height}
                      onChange={(e) =>
                        setConfig({ ...config, height: Number(e.target.value) })
                      }
                      InputProps={{ inputProps: { min: 150, max: 2160 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.auto_pip}
                          onChange={(e) =>
                            setConfig({ ...config, auto_pip: e.target.checked })
                          }
                        />
                      }
                      label={t("tools.pip_player.auto_pip_mode")}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.always_on_top}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              always_on_top: e.target.checked,
                            })
                          }
                        />
                      }
                      label={t("tools.pip_player.window_always_top")}
                    />
                  </Grid>
                </Grid>
              </Paper>

              <Box sx={{ display: "flex", gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={handlePlay}
                  disabled={isPlaying || !videoUrl.trim()}
                  fullWidth
                >
                  {t("tools.pip_player.play")}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<Stop />}
                  onClick={handleStop}
                  disabled={!isPlaying}
                  color="error"
                  fullWidth
                >
                  {t("tools.pip_player.stop")}
                </Button>
              </Box>
            </Stack>
          </Paper>

          {isPlaying && (
            <Alert severity="success" icon={<PictureInPicture />}>
              <Typography variant="body2">
                {t("tools.pip_player.playing")} -{" "}
                {t("tools.pip_player.always_on_top")}
              </Typography>
            </Alert>
          )}
        </Stack>
      </Box>
    </ToolLayout>
  );
}

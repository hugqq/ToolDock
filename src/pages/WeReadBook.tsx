import { useEffect, useState } from "react";
import { ToolLayout } from "../components/layout/ToolLayout";
import { InstructionsCard } from "../components/shared/InstructionsCard";
import {
  Box,
  Button,
  Typography,
  TextField,
  Stack,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Container,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Divider,
  Alert,
} from "@mui/material";
import {
  ExternalLink,
  Smartphone,
  Tablet,
  Monitor,
  Maximize,
  Play,
  Square,
  BookOpen,
  ScrollText,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import toast from "react-hot-toast";

const WEREAD_URL = "https://weread.qq.com/";
const WINDOW_LABEL = "weread";

const PRESETS = [
  { label: "Phone", width: 450, height: 844, icon: Smartphone },
  { label: "Tablet", width: 768, height: 1024, icon: Tablet },
  { label: "Desktop", width: 1280, height: 800, icon: Monitor },
  { label: "Large", width: 1440, height: 900, icon: Maximize },
];

type ReadingMode = "pagination" | "scroll";

export default function WeReadBook() {
  const { t } = useTranslation();
  const [windowExists, setWindowExists] = useState(false);
  const [width, setWidth] = useState(450);
  const [height, setHeight] = useState(844);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);

  // 自动阅读设置
  const [readingMode, setReadingMode] = useState<ReadingMode>("pagination");
  const [pageInterval, setPageInterval] = useState(10); // 秒
  const [scrollSpeed, setScrollSpeed] = useState(2); // 1=慢, 2=中, 3=快
  const [autoReadingActive, setAutoReadingActive] = useState(false);
  const [intervalId, setIntervalId] = useState<number | null>(null);
  const [autoSwitchMode, setAutoSwitchMode] = useState(true); // 是否自动切换阅读模式

  useEffect(() => {
    checkWindow();
    const interval = setInterval(checkWindow, 1000);
    return () => {
      clearInterval(interval);
      stopAutoReading(); // 组件卸载时停止自动阅读
    };
  }, []);

  const checkWindow = async () => {
    try {
      // 尝试获取窗口引用来检查是否存在
      const win = await WebviewWindow.getByLabel(WINDOW_LABEL);
      const exists = !!win;
      setWindowExists(exists);

      // 如果窗口关闭了，停止自动阅读
      if (!exists && autoReadingActive) {
        stopAutoReading();
      }
    } catch (e) {
      setWindowExists(false);
      if (autoReadingActive) {
        stopAutoReading();
      }
    }
  };

  const openWeReadWindow = async () => {
    const webview = new WebviewWindow(WINDOW_LABEL, {
      url: WEREAD_URL,
      title: "微信读书",
      width: width,
      height: height,
      center: true,
      focus: true,
      alwaysOnTop: alwaysOnTop,
    });

    webview.once("tauri://created", () => {
      setWindowExists(true);
    });

    webview.once("tauri://error", () => {
      setWindowExists(false);
    });
  };

  const focusWindow = async () => {
    const win = await WebviewWindow.getByLabel(WINDOW_LABEL);
    if (win) {
      win.setFocus();
    } else {
      setWindowExists(false);
      openWeReadWindow();
    }
  };

  const handlePresetSelect = (preset: (typeof PRESETS)[0]) => {
    setWidth(preset.width);
    setHeight(preset.height);
  };

  // 切换微信读书的阅读模式
  const switchReadingMode = async (targetMode: ReadingMode) => {
    if (!windowExists) {
      return false;
    }

    const win = await WebviewWindow.getByLabel(WINDOW_LABEL);
    if (!win) {
      return false;
    }

    const switchScript = `
      (function() {
        const modeButton = document.querySelector('button.readerControls_item.isHorizontalReader');
        if (!modeButton) {
          return { success: false, reason: 'button_not_found' };
        }

        const isHorizontal = modeButton.classList.contains('isHorizontalReader');
        const currentMode = isHorizontal ? 'pagination' : 'scroll';
        const targetMode = '${targetMode}';

        if (currentMode === targetMode) {
          return { success: true, switched: false, currentMode: currentMode };
        }

        modeButton.click();
        return { success: true, switched: true, from: currentMode, to: targetMode };
      })();
    `;

    try {
      await invoke("execute_weread_script", {
        windowLabel: WINDOW_LABEL,
        script: switchScript,
      });
      return true;
    } catch (e) {
      return false;
    }
  };

  // 启动自动阅读
  const startAutoReading = async () => {
    if (!windowExists) {
      toast.error(t("tools.weread_book.window_must_open"));
      return;
    }

    const win = await WebviewWindow.getByLabel(WINDOW_LABEL);
    if (!win) {
      setWindowExists(false);
      return;
    }

    // 如果启用了自动切换模式，先切换到目标模式
    if (autoSwitchMode) {
      const switched = await switchReadingMode(readingMode);
      if (switched) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    setAutoReadingActive(true);

    if (readingMode === "pagination") {
      // 双栏翻页模式：定时点击下一页按钮
      const clickScript = `
        (function() {
          const selectors = [
            'button.renderTarget_pager_button_right',
            'button[class*="pager_button_right"]',
            'button[class*="pager"][class*="right"]',
            '.renderTarget_pager_button_right',
            '[data-v-33aa0108].renderTarget_pager_button_right'
          ];
          
          let nextBtn = null;
          for (const selector of selectors) {
            nextBtn = document.querySelector(selector);
            if (nextBtn) {
              break;
            }
          }
          
          if (nextBtn) {
            nextBtn.click();
            return true;
          } else {
            return false;
          }
        })();
      `;

      // 立即执行一次并检查结果
      try {
        await invoke("execute_weread_script", {
          windowLabel: WINDOW_LABEL,
          script: clickScript,
        });
      } catch (e) {
        toast.error("无法找到翻页按钮，请确认已进入阅读页面");
        setAutoReadingActive(false);
        return;
      }

      // 设置定时器
      const id = window.setInterval(async () => {
        try {
          await invoke("execute_weread_script", {
            windowLabel: WINDOW_LABEL,
            script: clickScript,
          });
        } catch (e) {
          stopAutoReading();
        }
      }, pageInterval * 1000);

      setIntervalId(id);
    } else {
      // 滚动模式：持续向下滚动，到底部后点击下一章
      const scrollPixels = scrollSpeed * 50; // 根据速度调整滚动距离

      const scrollScript = `
        (function() {
          const containerSelectors = [
            '.wr_readerImage_opacity',
            '.readerChapterContent',
            '.app_content',
            '#app .app_content',
            '.wr_whiteTheme',
            '.renderTargetContainer',
            '#app'
          ];
          
          let scrollContainer = null;
          let containerInfo = '';
          
          for (const selector of containerSelectors) {
            const elem = document.querySelector(selector);
            if (elem) {
              const hasScroll = elem.scrollHeight > elem.clientHeight;
              const computedStyle = window.getComputedStyle(elem);
              const overflowY = computedStyle.overflowY;
              
              if (hasScroll && (overflowY === 'scroll' || overflowY === 'auto')) {
                scrollContainer = elem;
                containerInfo = selector;
                break;
              }
            }
          }
          
          if (!scrollContainer && document.body.scrollHeight > document.body.clientHeight) {
            scrollContainer = document.body;
            containerInfo = 'document.body';
          }
          
          if (!scrollContainer) {
            scrollContainer = document.documentElement;
            containerInfo = 'document.documentElement';
          }
          
          // 计算是否到底部
          let isAtBottom = false;
          let currentScroll = 0;
          let maxScroll = 0;
          
          if (scrollContainer === document.documentElement || scrollContainer === document.body) {
            currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
            maxScroll = Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight
            ) - window.innerHeight;
            isAtBottom = currentScroll >= maxScroll - 100;
          } else {
            currentScroll = scrollContainer.scrollTop;
            maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
            isAtBottom = currentScroll >= maxScroll - 100;
          }
          
          if (isAtBottom) {
            const nextChapterSelectors = [
              'button.readerFooter_button[title="下一章"]',
              'button[title*="下一章"]',
              '.readerFooter_button:last-child',
              'button[class*="footer"][class*="button"]:last-child'
            ];
            
            let nextChapterBtn = null;
            for (const selector of nextChapterSelectors) {
              nextChapterBtn = document.querySelector(selector);
              if (nextChapterBtn) {
                break;
              }
            }
            
            if (nextChapterBtn) {
              nextChapterBtn.click();
              return 'next_chapter';
            } else {
              return 'at_bottom';
            }
          } else {
            const newScrollTop = currentScroll + ${scrollPixels};
            
            if (scrollContainer === document.documentElement || scrollContainer === document.body) {
              window.scrollTo({
                top: newScrollTop,
                behavior: 'smooth'
              });
            } else {
              scrollContainer.scrollTop = newScrollTop;
            }
            
            return 'scrolling';
          }
        })();
      `;

      // 立即执行一次
      try {
        await invoke("execute_weread_script", {
          windowLabel: WINDOW_LABEL,
          script: scrollScript,
        });
      } catch (e) {
        toast.error("滚动功能启动失败");
        setAutoReadingActive(false);
        return;
      }

      // 设置定时器（滚动模式使用较短的间隔）
      const id = window.setInterval(async () => {
        try {
          await invoke("execute_weread_script", {
            windowLabel: WINDOW_LABEL,
            script: scrollScript,
          });
        } catch (e) {
          stopAutoReading();
        }
      }, 1000); // 每秒执行一次

      setIntervalId(id);
    }

    toast.success(t("tools.weread_book.auto_reading_active"));
  };

  // 停止自动阅读
  const stopAutoReading = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      setIntervalId(null);
    }
    setAutoReadingActive(false);
  };

  return (
    <ToolLayout title={t("tools.weread_book.title")}>
      <Container maxWidth="lg" sx={{ py: 2, height: "100%" }}>
        {/* Design Ideas Card */}
        <InstructionsCard
          title={t("tools.weread_book.design_ideas.title")}
          color="blue"
          steps={[
            {
              title: t("tools.weread_book.design_ideas.step1_title"),
              description: t("tools.weread_book.design_ideas.step1_desc"),
            },
            {
              title: t("tools.weread_book.design_ideas.step2_title"),
              description: t("tools.weread_book.design_ideas.step2_desc"),
            },
          ]}
          columns={2}
        />

        {/* Main Action Buttons - 放在设置上面 */}
        <Card
          elevation={0}
          sx={{
            mt: 2,
            p: 2,
            bgcolor: "var(--bg-secondary)",
            borderRadius: 2,
          }}
        >
          <Stack
            direction="row"
            spacing={2}
            flexWrap="wrap"
            justifyContent="center"
            alignItems="center"
          >
            <Button
              variant="contained"
              size="medium"
              onClick={windowExists ? focusWindow : openWeReadWindow}
              endIcon={<ExternalLink size={16} />}
              sx={{
                px: 3,
                py: 1,
                borderRadius: 1,
                bgcolor: windowExists ? "success.main" : "primary.main",
                "&:hover": {
                  bgcolor: windowExists ? "success.dark" : "primary.dark",
                },
              }}
            >
              {windowExists
                ? t("tools.weread_book.switch_window")
                : t("tools.weread_book.open_weread")}
            </Button>

            {windowExists && (
              <>
                <Button
                  variant={autoReadingActive ? "contained" : "outlined"}
                  size="medium"
                  color={autoReadingActive ? "error" : "primary"}
                  onClick={
                    autoReadingActive ? stopAutoReading : startAutoReading
                  }
                  startIcon={
                    autoReadingActive ? (
                      <Square size={16} />
                    ) : (
                      <Play size={16} />
                    )
                  }
                  sx={{
                    px: 3,
                    py: 1,
                    borderRadius: 1,
                  }}
                >
                  {autoReadingActive
                    ? t("tools.weread_book.stop_auto_reading")
                    : t("tools.weread_book.start_auto_reading")}
                </Button>
              </>
            )}

            {windowExists && (
              <Chip
                label={t("tools.weread_book.running")}
                color="success"
                size="small"
                icon={
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: "currentColor",
                    }}
                  />
                }
              />
            )}
          </Stack>

          {autoReadingActive && (
            <Alert severity="info" sx={{ mt: 2 }} icon={<BookOpen size={18} />}>
              {t("tools.weread_book.auto_reading_active")}
            </Alert>
          )}
        </Card>

        {/* Settings Area */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={3}
          sx={{ mt: 2 }}
        >
          {/* Window Settings Card */}
          <Card
            elevation={0}
            variant="outlined"
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              bgcolor: "background.paper",
            }}
          >
            <CardHeader
              title={t("tools.weread_book.window_settings")}
              subheader={t("tools.weread_book.custom_size")}
              titleTypographyProps={{ variant: "h6", fontWeight: "bold" }}
            />
            <CardContent
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <Box>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  color="text.secondary"
                  sx={{ mb: 1.5 }}
                >
                  {t("tools.weread_book.preset_sizes")}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {PRESETS.map((p) => (
                    <Chip
                      key={p.label}
                      label={p.label}
                      icon={<p.icon size={14} />}
                      onClick={() => handlePresetSelect(p)}
                      variant={
                        width === p.width && height === p.height
                          ? "filled"
                          : "outlined"
                      }
                      color={
                        width === p.width && height === p.height
                          ? "primary"
                          : "default"
                      }
                      clickable
                      sx={{ borderRadius: 1.5 }}
                    />
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  color="text.secondary"
                  sx={{ mb: 1.5 }}
                >
                  {t("tools.weread_book.custom_dimensions")}
                </Typography>
                <Stack spacing={2.5}>
                  <TextField
                    label={t("tools.weread_book.width")}
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">px</InputAdornment>
                      ),
                    }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label={t("tools.weread_book.height")}
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">px</InputAdornment>
                      ),
                    }}
                    fullWidth
                    size="small"
                  />
                </Stack>
              </Box>

              <Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="subtitle2" color="text.primary">
                      {t("tools.weread_book.always_on_top")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("tools.weread_book.always_on_top_desc")}
                    </Typography>
                  </Box>
                  <Box
                    component="label"
                    sx={{
                      position: "relative",
                      display: "inline-block",
                      width: 48,
                      height: 24,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={alwaysOnTop}
                      onChange={(e) => setAlwaysOnTop(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: alwaysOnTop ? "primary.main" : "grey.400",
                        borderRadius: 12,
                        transition: "all 0.3s",
                        "&::before": {
                          content: '""',
                          position: "absolute",
                          height: 18,
                          width: 18,
                          left: alwaysOnTop ? 26 : 3,
                          bottom: 3,
                          bgcolor: "white",
                          borderRadius: "50%",
                          transition: "all 0.3s",
                        },
                      }}
                    />
                  </Box>
                </Stack>
              </Box>

              <Box sx={{ mt: "auto", pt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {t("tools.weread_book.tip")}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Auto Reading Settings Card */}
          <Card
            elevation={0}
            variant="outlined"
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              bgcolor: "background.paper",
            }}
          >
            <CardHeader
              title={t("tools.weread_book.auto_reading_settings")}
              subheader={t("tools.weread_book.auto_reading_desc")}
              titleTypographyProps={{ variant: "h6", fontWeight: "bold" }}
            />
            <CardContent
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <Box>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  color="text.secondary"
                  sx={{ mb: 1.5 }}
                >
                  {t("tools.weread_book.reading_mode")}
                </Typography>
                <ToggleButtonGroup
                  value={readingMode}
                  exclusive
                  onChange={(_, newMode) => {
                    if (newMode !== null) {
                      setReadingMode(newMode);
                      if (autoReadingActive) {
                        stopAutoReading();
                      }
                    }
                  }}
                  fullWidth
                  size="small"
                >
                  <ToggleButton value="pagination">
                    <BookOpen size={16} style={{ marginRight: 8 }} />
                    {t("tools.weread_book.mode_pagination")}
                  </ToggleButton>
                  <ToggleButton value="scroll">
                    <ScrollText size={16} style={{ marginRight: 8 }} />
                    {t("tools.weread_book.mode_scroll")}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Box>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography variant="subtitle2" color="text.primary">
                      {t("tools.weread_book.auto_switch_mode")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t("tools.weread_book.auto_switch_mode_desc")}
                    </Typography>
                  </Box>
                  <Box
                    component="label"
                    sx={{
                      position: "relative",
                      display: "inline-block",
                      width: 48,
                      height: 24,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={autoSwitchMode}
                      onChange={(e) => setAutoSwitchMode(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: autoSwitchMode ? "primary.main" : "grey.400",
                        borderRadius: 12,
                        transition: "all 0.3s",
                        "&::before": {
                          content: '""',
                          position: "absolute",
                          height: 18,
                          width: 18,
                          left: autoSwitchMode ? 26 : 3,
                          bottom: 3,
                          bgcolor: "white",
                          borderRadius: "50%",
                          transition: "all 0.3s",
                        },
                      }}
                    />
                  </Box>
                </Stack>
              </Box>

              <Divider />

              {readingMode === "pagination" ? (
                <Box>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    color="text.secondary"
                  >
                    {t("tools.weread_book.page_interval")}
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={2}
                    alignItems="center"
                    sx={{ mt: 1 }}
                  >
                    <Slider
                      value={pageInterval}
                      onChange={(_, val) => setPageInterval(val as number)}
                      min={3}
                      max={60}
                      step={1}
                      marks={[
                        { value: 3, label: "3s" },
                        { value: 30, label: "30s" },
                        { value: 60, label: "60s" },
                      ]}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(val) =>
                        `${val} ${t("tools.weread_book.seconds")}`
                      }
                      sx={{ flex: 1 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ minWidth: 50, textAlign: "right" }}
                    >
                      {pageInterval}s
                    </Typography>
                  </Stack>
                </Box>
              ) : (
                <Box>
                  <Typography
                    variant="subtitle2"
                    gutterBottom
                    color="text.secondary"
                    sx={{ mb: 1.5 }}
                  >
                    {t("tools.weread_book.scroll_speed")}
                  </Typography>
                  <ToggleButtonGroup
                    value={scrollSpeed}
                    exclusive
                    onChange={(_, newSpeed) => {
                      if (newSpeed !== null) {
                        setScrollSpeed(newSpeed);
                        if (autoReadingActive) {
                          stopAutoReading();
                        }
                      }
                    }}
                    fullWidth
                    size="small"
                  >
                    <ToggleButton value={1}>
                      {t("tools.weread_book.speed_slow")}
                    </ToggleButton>
                    <ToggleButton value={2}>
                      {t("tools.weread_book.speed_normal")}
                    </ToggleButton>
                    <ToggleButton value={3}>
                      {t("tools.weread_book.speed_fast")}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </ToolLayout>
  );
}

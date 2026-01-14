import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import {
  CheckCircle,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import { InstructionsCard } from "../components/shared/InstructionsCard";
import { TipsCards } from "../components/shared/TipsCards";
import { useSettingsStore } from "../stores/useSettingsStore";

interface WeChatWindowInfo {
  hwnd: number;
  title: string;
}

export default function WeChatAssistant() {
  const { t } = useTranslation();
  const { ai, setAiActiveProvider, wechatSystemPrompt, setWechatSystemPrompt } =
    useSettingsStore();

  // 防御性检查 AI 配置
  const safeAi = {
    activeProvider: ai?.activeProvider || "deepseek",
    providers: {
      deepseek: ai?.providers?.deepseek || {
        apiKey: "",
        model: "deepseek-chat",
      },
      doubao: ai?.providers?.doubao || { apiKey: "", model: "" },
      openai: ai?.providers?.openai || {
        apiKey: "",
        model: "gpt-4o",
        baseUrl: "https://api.openai.com/v1",
      },
      siliconflow: ai?.providers?.siliconflow || {
        apiKey: "",
        model: "deepseek-ai/DeepSeek-V3",
        baseUrl: "https://api.siliconflow.cn/v1",
      },
    },
  };

  // 当前选中的 provider 配置
  const currentProvider = (safeAi.providers as any)[safeAi.activeProvider];

  const [windowInfo, setWindowInfo] = useState<WeChatWindowInfo | null>(null);
  const [capturedMessage, setCapturedMessage] = useState("");
  const [generatedReply, setGeneratedReply] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  // 用于跟踪上一次的剪贴板内容
  const lastClipboardRef = useRef("");

  // 自动监听剪贴板变化
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkClipboard = async () => {
      // 如果还没有窗口信息，先查找微信窗口（静默）
      if (!windowInfo) {
        try {
          const window = await invoke<WeChatWindowInfo>("find_wechat_window");
          setWindowInfo(window);
        } catch {
          return; // 忽略错误，下次再试
        }
      }

      try {
        // 使用静默方法读取剪贴板（不激活窗口）
        const message = await invoke<string>("read_clipboard_silent");

        // 如果内容有变化且不为空，自动更新
        if (message && message !== lastClipboardRef.current) {
          lastClipboardRef.current = message;
          setCapturedMessage(message);
          console.log("自动捕获到新消息，长度:", message.length);
        }
      } catch {
        // 忽略错误（比如剪贴板为空）
      }
    };

    // 每500ms检查一次剪贴板
    intervalId = setInterval(checkClipboard, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [windowInfo]);

  // 查找微信窗口
  const handleFindWindow = async () => {
    try {
      const result = await invoke<WeChatWindowInfo>("find_wechat_window");
      setWindowInfo(result);
      toast.success(
        t("tools.wechat_assistant.window_title") + ": " + result.title
      );
    } catch (error: any) {
      console.error("Find window error:", error);
      toast.error(
        error?.message || t("tools.wechat_assistant.window_not_found")
      );
    }
  };

  // 捕获消息
  const handleCaptureMessage = async () => {
    if (!currentProvider?.apiKey || !currentProvider?.model) {
      toast.error(t("tools.wechat_assistant.config_incomplete"));
      return;
    }

    // 如果还没有窗口信息，先查找微信窗口
    if (!windowInfo) {
      try {
        const window = await invoke<WeChatWindowInfo>("find_wechat_window");
        setWindowInfo(window);
      } catch (error: any) {
        toast.error(error?.message || "未找到微信窗口");
        return;
      }
    }

    setIsCapturing(true);

    try {
      // 直接捕获消息（从剪贴板读取）
      const message = await invoke<string>("capture_wechat_message", {
        hwnd: windowInfo!.hwnd,
      });

      console.log("消息捕获成功，长度:", message.length);
      setCapturedMessage(message);
      toast.success(t("tools.wechat_assistant.captured_message"));
    } catch (error: any) {
      console.error("Capture error:", error);
      toast.error(error?.message || t("tools.wechat_assistant.capture_error"));
    } finally {
      setIsCapturing(false);
    }
  };

  // 生成AI回复
  const handleGenerateReply = async () => {
    if (!capturedMessage.trim()) {
      toast.error(t("tools.wechat_assistant.no_message"));
      return;
    }

    if (!currentProvider?.apiKey || !currentProvider?.model) {
      toast.error(t("tools.wechat_assistant.config_incomplete"));
      return;
    }

    setIsGenerating(true);
    try {
      const reply = await invoke<string>("ask_ai", {
        provider: safeAi.activeProvider,
        apiKey: currentProvider.apiKey,
        model: currentProvider.model,
        baseUrl: currentProvider.baseUrl || "",
        systemPrompt: wechatSystemPrompt,
        userPrompt: capturedMessage,
      });

      setGeneratedReply(reply);
      toast.success(t("tools.wechat_assistant.ai_reply"));
    } catch (error: any) {
      console.error("Generate error:", error);
      toast.error(error?.message || t("tools.wechat_assistant.generate_error"));
    } finally {
      setIsGenerating(false);
    }
  };

  // 填充回复到微信
  const handleFillReply = async () => {
    if (!generatedReply.trim()) {
      toast.error(t("tools.wechat_assistant.message_empty"));
      return;
    }

    if (!windowInfo) {
      toast.error(t("tools.wechat_assistant.window_not_found"));
      return;
    }

    setIsFilling(true);

    try {
      // 直接调用填充命令，通过窗口句柄自动定位输入框
      await invoke("fill_wechat_reply", {
        hwnd: windowInfo!.hwnd,
        reply: generatedReply,
      });

      // 成功提示，提醒用户检查
      toast.success(t("tools.wechat_assistant.filled_success_detail"), {
        duration: 5000,
      });

      // 填充成功后清空输入框和捕获的消息，准备下一次使用
      setGeneratedReply("");
      setCapturedMessage("");
    } catch (error: any) {
      console.error("Fill error:", error);

      // 填充失败时，将内容复制到剪贴板作为备用方案
      try {
        await navigator.clipboard.writeText(generatedReply);
        toast.error(t("tools.wechat_assistant.fill_error_detail"), {
          duration: 6000,
        });
      } catch {
        toast.error(error?.message || t("tools.wechat_assistant.fill_error"));
      }
    } finally {
      setIsFilling(false);
    }
  };

  return (
    <ToolLayout title={t("tools.wechat_assistant.name")}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* 使用说明卡片 */}
        <InstructionsCard
          title={t("tools.wechat_assistant.instructions.title")}
          color="blue"
          steps={[
            {
              title: t("tools.wechat_assistant.instructions.step1"),
              description: t("tools.wechat_assistant.instructions.step1_desc"),
            },
            {
              title: t("tools.wechat_assistant.instructions.step2"),
              description: t("tools.wechat_assistant.instructions.step2_desc"),
            },
            {
              title: t("tools.wechat_assistant.instructions.step3"),
              description: t("tools.wechat_assistant.instructions.step3_desc"),
            },
          ]}
          columns={3}
        />

        {/* 兼容性提示 */}
        <TipsCards
          tips={[
            {
              icon: AlertTriangle,
              color: "amber",
              title: "兼容性说明",
              description:
                "自动填充功能会尝试多种策略，但由于微信版本差异，在某些电脑上可能无法完全自动化。如填充失败，内容已自动复制到剪贴板，可手动粘贴（Ctrl+V）。",
            },
            {
              icon: Info,
              color: "blue",
              title: "最佳实践",
              description:
                "建议在填充后检查微信输入框内容是否正确，确认无误后再发送。如果遇到问题，可尝试手动点击微信输入框后再次点击填充按钮。",
            },
          ]}
        />

        {/* AI 配置区域 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t("tools.wechat_assistant.ai_provider")}
            </Typography>

            {/* AI Provider 下拉选择 */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>{t("tools.wechat_assistant.ai_provider")}</InputLabel>
              <Select
                value={safeAi.activeProvider}
                label={t("tools.wechat_assistant.ai_provider")}
                onChange={(e) => setAiActiveProvider(e.target.value as any)}
              >
                <MenuItem value="deepseek">DeepSeek</MenuItem>
                <MenuItem value="doubao">豆包 (Doubao)</MenuItem>
                <MenuItem value="openai">OpenAI</MenuItem>
                <MenuItem value="siliconflow">SiliconFlow</MenuItem>
              </Select>
            </FormControl>

            {/* 当前配置信息 */}
            <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                {t("tools.wechat_assistant.ai_model")}:{" "}
                {currentProvider?.model || "未配置"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                API Key: {currentProvider?.apiKey ? "••••••" : "未配置"}
              </Typography>
              {currentProvider?.baseUrl && (
                <Typography variant="body2" color="text.secondary">
                  Base URL: {currentProvider.baseUrl}
                </Typography>
              )}
            </Box>

            {(!currentProvider?.apiKey || !currentProvider?.model) && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {t("tools.wechat_assistant.config_incomplete")}
                ，请前往设置页面配置
              </Alert>
            )}

            <TextField
              fullWidth
              label={t("tools.wechat_assistant.system_prompt")}
              value={wechatSystemPrompt}
              onChange={(e) => setWechatSystemPrompt(e.target.value)}
              multiline
              rows={3}
              size="small"
              sx={{ mb: 2 }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                toast.success(
                  t("tools.wechat_assistant.system_prompt") + " 已保存"
                );
              }}
            >
              {t("common.save")}
            </Button>
          </CardContent>
        </Card>

        {/* 微信窗口信息 */}
        <Card>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Typography variant="h6">
                {t("tools.wechat_assistant.wechat_window")}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshCw size={16} />}
                onClick={handleFindWindow}
              >
                {t("tools.wechat_assistant.refresh_window")}
              </Button>
            </Box>
            {windowInfo ? (
              <Alert severity="success" icon={<CheckCircle />}>
                {windowInfo.title}
              </Alert>
            ) : (
              <Alert severity="info">
                点击"刷新窗口信息"或"捕获消息"时自动获取
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* 捕获消息 */}
        <Card>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Typography variant="h6">
                {t("tools.wechat_assistant.original_message")}
              </Typography>
              <Button
                variant="contained"
                startIcon={
                  isCapturing ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <MessageSquare size={16} />
                  )
                }
                onClick={handleCaptureMessage}
                disabled={isCapturing}
              >
                {isCapturing
                  ? t("tools.wechat_assistant.capturing")
                  : t("tools.wechat_assistant.capture_message")}
              </Button>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={capturedMessage}
              onChange={(e) => setCapturedMessage(e.target.value)}
              placeholder="点击上方按钮，然后点击微信聊天窗口以捕获最新消息..."
              variant="outlined"
            />
          </CardContent>
        </Card>

        {/* 生成回复 */}
        <Card>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Typography variant="h6">
                {t("tools.wechat_assistant.generated_reply")}
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                startIcon={
                  isGenerating ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <Sparkles size={16} />
                  )
                }
                onClick={handleGenerateReply}
                disabled={
                  !capturedMessage.trim() ||
                  isGenerating ||
                  !currentProvider?.apiKey ||
                  !currentProvider?.model
                }
              >
                {isGenerating
                  ? t("tools.wechat_assistant.generating")
                  : t("tools.wechat_assistant.generate_reply")}
              </Button>
            </Box>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={generatedReply}
              onChange={(e) => setGeneratedReply(e.target.value)}
              placeholder="AI生成的回复将显示在这里，你可以编辑后再填充..."
              variant="outlined"
            />
          </CardContent>
        </Card>

        {/* 填充回复 */}
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={
              isFilling ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <Send size={20} />
              )
            }
            onClick={handleFillReply}
            disabled={!generatedReply.trim() || isFilling}
            sx={{ minWidth: 200 }}
          >
            {isFilling
              ? t("tools.wechat_assistant.filling")
              : t("tools.wechat_assistant.fill_reply")}
          </Button>
        </Box>
      </Box>
    </ToolLayout>
  );
}

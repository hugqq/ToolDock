import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Typography,
  Paper,
  Stack,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Card,
  CardContent,
  CardActions,
  Switch,
  Chip,
} from "@mui/material";
import {
  PlayArrow,
  Stop,
  Mouse as MouseIcon,
  Keyboard as KeyboardIcon,
  TextFields as TextFieldsIcon,
  Add,
  Edit,
  Delete,
  ContentCopy,
  Send,
  Bolt as BoltIcon,
} from "@mui/icons-material";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ToolLayout } from "../components/layout/ToolLayout";
import { InstructionsCard } from "../components/shared/InstructionsCard";
import { toast } from "react-hot-toast";

const COMMON_KEYS = [
  { label: "Space", value: 0x20 },
  { label: "Enter", value: 0x0d },
  { label: "Escape", value: 0x1b },
  { label: "Backspace", value: 0x08 },
  { label: "Tab", value: 0x09 },
  { label: "Page Up", value: 0x21 },
  { label: "Page Down", value: 0x22 },
  { label: "End", value: 0x23 },
  { label: "Home", value: 0x24 },
  { label: "Left Arrow", value: 0x25 },
  { label: "Up Arrow", value: 0x26 },
  { label: "Right Arrow", value: 0x27 },
  { label: "Down Arrow", value: 0x28 },
  { label: "Insert", value: 0x2d },
  { label: "Delete", value: 0x2e },
  ...Array.from({ length: 26 }, (_, i) => ({
    label: String.fromCharCode(65 + i),
    value: 65 + i,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    label: i.toString(),
    value: 48 + i,
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    label: `F${i + 1}`,
    value: 0x70 + i,
  })),
];

interface Macro {
  id: string;
  name: string;
  content: string;
}

const STORAGE_KEY = "clicker_macros";

const Clicker: React.FC = () => {
  const { t } = useTranslation();
  const [tabValue, setTabValue] = useState(0);

  // Mouse State
  const [mouseInterval, setMouseInterval] = useState<number>(100);
  const [mouseButton, setMouseButton] = useState<string>("Left");
  const [clickType, setClickType] = useState<string>("Single");
  const [isMouseRunning, setIsMouseRunning] = useState<boolean>(false);

  // Keyboard State
  const [kbInterval, setKbInterval] = useState<number>(100);
  const [keyCode, setKeyCode] = useState<number>(0x20);
  const [isKbRunning, setIsKbRunning] = useState<boolean>(false);

  // Quick Input State
  const [quickText, setQuickText] = useState<string>("");
  const [keyDelay, setKeyDelay] = useState<number>(10);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [macroDialogOpen, setMacroDialogOpen] = useState(false);
  const [editingMacro, setEditingMacro] = useState<Macro | null>(null);
  const [macroName, setMacroName] = useState("");
  const [macroContent, setMacroContent] = useState("");

  // F8/F9 热键开关，默认关闭，持久化到 localStorage
  const [hotkeyEnabled, setHotkeyEnabled] = useState<boolean>(() => {
    return localStorage.getItem("clicker_hotkey_enabled") === "true";
  });

  // Load macros from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setMacros(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load macros:", err);
      }
    }
    // 初始化时将热键状态同步到后端
    const enabled = localStorage.getItem("clicker_hotkey_enabled") === "true";
    invoke("set_clicker_hotkey_enabled", { enabled }).catch(console.error);
  }, []);

  // Save macros to localStorage
  const saveMacros = (newMacros: Macro[]) => {
    setMacros(newMacros);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMacros));
  };

  // 切换 F8/F9 热键开关
  const handleHotkeyToggle = async (enabled: boolean) => {
    setHotkeyEnabled(enabled);
    localStorage.setItem("clicker_hotkey_enabled", String(enabled));
    try {
      await invoke("set_clicker_hotkey_enabled", { enabled });
    } catch (err) {
      console.error("Failed to set hotkey enabled:", err);
    }
  };

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const mRes = await invoke<any>("is_mouse_clicker_running");
        if (mRes.ok) setIsMouseRunning(mRes.data);
        const kRes = await invoke<any>("is_keyboard_clicker_running");
        if (kRes.ok) setIsKbRunning(kRes.data);
      } catch (err) {
        console.error("Failed to check clicker status:", err);
      }
    };
    checkStatus();

    const unlisten = listen<boolean>(
      "clicker://mouse-status-changed",
      (event) => {
        setIsMouseRunning(event.payload);
      }
    );

    const unlistenKb = listen<boolean>(
      "clicker://keyboard-status-changed",
      (event) => {
        setIsKbRunning(event.payload);
      }
    );

    return () => {
      unlisten.then((f) => f());
      unlistenKb.then((f) => f());
    };
  }, []);

  const handleMouseToggle = async () => {
    console.log("handleMouseToggle called, isMouseRunning:", isMouseRunning);
    try {
      if (isMouseRunning) {
        const res = await invoke<any>("stop_mouse_clicker");
        console.log("stop_mouse_clicker response:", res);
        if (res.ok) setIsMouseRunning(false);
      } else {
        console.log("Calling start_mouse_clicker with:", {
          intervalMs: mouseInterval,
          button: mouseButton,
          clickType: clickType,
        });
        const res = await invoke<any>("start_mouse_clicker", {
          intervalMs: mouseInterval,
          button: mouseButton,
          clickType: clickType,
        });
        console.log("start_mouse_clicker response:", res);
        if (res.ok) setIsMouseRunning(true);
      }
    } catch (err) {
      console.error("Failed to toggle mouse clicker:", err);
    }
  };

  const handleKbToggle = async () => {
    try {
      if (isKbRunning) {
        const res = await invoke<any>("stop_keyboard_clicker");
        if (res.ok) setIsKbRunning(false);
      } else {
        const res = await invoke<any>("start_keyboard_clicker", {
          intervalMs: kbInterval,
          keyCode: keyCode,
        });
        if (res.ok) setIsKbRunning(true);
      }
    } catch (err) {
      console.error("Failed to toggle keyboard clicker:", err);
    }
  };

  const handleSendText = async () => {
    if (!quickText.trim()) {
      toast.error(t("tools.clicker.macro_content_required"));
      return;
    }
    try {
      const res = await invoke<any>("send_text_input", {
        text: quickText,
        delayMs: keyDelay,
      });
      if (res.ok) {
        toast.success(t("tools.clicker.text_sent"));
      } else {
        toast.error(res.error?.message || "Failed to send text");
      }
    } catch (err) {
      console.error("Failed to send text:", err);
      toast.error(String(err));
    }
  };

  const handleCopyText = async () => {
    if (!quickText.trim()) {
      toast.error(t("tools.clicker.macro_content_required"));
      return;
    }
    try {
      await navigator.clipboard.writeText(quickText);
      toast.success(t("tools.clicker.text_copied"));
    } catch (err) {
      console.error("Failed to copy text:", err);
      toast.error(String(err));
    }
  };

  const handleAddMacro = () => {
    setEditingMacro(null);
    setMacroName("");
    setMacroContent("");
    setMacroDialogOpen(true);
  };

  const handleEditMacro = (macro: Macro) => {
    setEditingMacro(macro);
    setMacroName(macro.name);
    setMacroContent(macro.content);
    setMacroDialogOpen(true);
  };

  const handleSaveMacro = () => {
    if (!macroName.trim()) {
      toast.error(t("tools.clicker.macro_name_required"));
      return;
    }
    if (!macroContent.trim()) {
      toast.error(t("tools.clicker.macro_content_required"));
      return;
    }

    if (editingMacro) {
      // Update existing
      const updated = macros.map((m) =>
        m.id === editingMacro.id
          ? { ...m, name: macroName, content: macroContent }
          : m
      );
      saveMacros(updated);
    } else {
      // Add new
      const newMacro: Macro = {
        id: Date.now().toString(),
        name: macroName,
        content: macroContent,
      };
      saveMacros([...macros, newMacro]);
    }
    setMacroDialogOpen(false);
    toast.success(t("tools.clicker.macro_saved"));
  };

  const handleDeleteMacro = (id: string) => {
    const updated = macros.filter((m) => m.id !== id);
    saveMacros(updated);
    toast.success(t("tools.clicker.macro_deleted"));
  };

  const handleExecuteMacro = async (content: string) => {
    try {
      const res = await invoke<any>("send_text_input", {
        text: content,
        delayMs: keyDelay,
      });
      if (res.ok) {
        toast.success(t("tools.clicker.text_sent"));
      } else {
        toast.error(res.error?.message || "Failed to send text");
      }
    } catch (err) {
      console.error("Failed to execute macro:", err);
      toast.error(String(err));
    }
  };

  return (
    <ToolLayout title={t("tools.clicker.name")}>
      <Box sx={{ p: 3 }}>
        {/* 使用说明卡片 */}
        <Stack spacing={4} sx={{ mx: "auto" }}>
          {/* Tabs 卡片 */}
          <InstructionsCard
            title={t("common.instructions")}
            color="blue"
            steps={[
              {
                title: t("tools.clicker.step1"),
                description: t("tools.clicker.step1_desc"),
              },
              {
                title: t("tools.clicker.step2"),
                description: t("tools.clicker.step2_desc"),
              },
              {
                title: t("tools.clicker.step3"),
                description: t("tools.clicker.step3_desc"),
              },
              {
                title: t("tools.clicker.step4"),
                description: t("tools.clicker.step4_desc"),
              },
            ]}
          />
          {/* F8/F9 热键全局开关 */}
          <Paper
            sx={{
              borderRadius: 1,
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              px: 3,
              py: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <BoltIcon color={hotkeyEnabled ? "warning" : "disabled"} />
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {t("tools.clicker.mouse_hotkey_tip").replace(/快捷键：|Shortcut: /, "").replace("按 F8 开始/停止", "").replace("Press F8 to Start/Stop", "")}
                  {t("tools.clicker.hotkey_switch_label", "F8 / F9 快捷键")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {hotkeyEnabled
                    ? t("tools.clicker.hotkey_switch_on", "已启用 · F8 控制鼠标，F9 控制键盘")
                    : t("tools.clicker.hotkey_switch_off", "已关闭 · 启用后可用 F8/F9 全局快捷控制连点")}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {hotkeyEnabled && (
                <Chip
                  label="F8 · F9"
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
              <Switch
                checked={hotkeyEnabled}
                onChange={(e) => handleHotkeyToggle(e.target.checked)}
                color="warning"
              />
            </Box>
          </Paper>

          <Paper
            sx={{
              borderRadius: 1,
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            <Tabs
              value={tabValue}
              onChange={(_, v) => setTabValue(v)}
              variant="fullWidth"
              sx={{
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <Tab
                icon={<MouseIcon />}
                label={t("tools.clicker.mouse_tab")}
                iconPosition="start"
              />
              <Tab
                icon={<KeyboardIcon />}
                label={t("tools.clicker.keyboard_tab")}
                iconPosition="start"
              />
              <Tab
                icon={<TextFieldsIcon />}
                label={t("tools.clicker.quick_input_tab")}
                iconPosition="start"
              />
            </Tabs>

            <Box sx={{ p: 4, bgcolor: "background.paper" }}>
              {tabValue === 0 && (
                <Stack spacing={3}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {t("tools.clicker.mouse_settings")}
                  </Typography>

                  <TextField
                    label={t("tools.clicker.interval")}
                    type="number"
                    value={mouseInterval}
                    onChange={(e) => setMouseInterval(Number(e.target.value))}
                    fullWidth
                    disabled={isMouseRunning}
                    slotProps={{ htmlInput: { min: 10 } }}
                    helperText={t("tools.clicker.interval_helper")}
                  />

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 2,
                    }}
                  >
                    <TextField
                      select
                      label={t("tools.clicker.mouse_button")}
                      value={mouseButton}
                      onChange={(e) => setMouseButton(e.target.value)}
                      fullWidth
                      disabled={isMouseRunning}
                    >
                      <MenuItem value="Left">
                        {t("tools.clicker.left")}
                      </MenuItem>
                      <MenuItem value="Right">
                        {t("tools.clicker.right")}
                      </MenuItem>
                      <MenuItem value="Middle">
                        {t("tools.clicker.middle")}
                      </MenuItem>
                    </TextField>

                    <TextField
                      select
                      label={t("tools.clicker.click_type")}
                      value={clickType}
                      onChange={(e) => setClickType(e.target.value)}
                      fullWidth
                      disabled={isMouseRunning}
                    >
                      <MenuItem value="Single">
                        {t("tools.clicker.single")}
                      </MenuItem>
                      <MenuItem value="Double">
                        {t("tools.clicker.double")}
                      </MenuItem>
                    </TextField>
                  </Box>

                  <Button
                    variant="contained"
                    color={isMouseRunning ? "error" : "primary"}
                    size="large"
                    startIcon={isMouseRunning ? <Stop /> : <PlayArrow />}
                    onClick={handleMouseToggle}
                    fullWidth
                    sx={{ py: 1.5, fontWeight: 600 }}
                  >
                    {isMouseRunning
                      ? t("tools.clicker.mouse_stop")
                      : t("tools.clicker.mouse_start")}
                  </Button>

                  <Alert
                    severity={isMouseRunning ? "info" : "success"}
                    sx={{ borderRadius: 1 }}
                  >
                    {isMouseRunning
                      ? t("tools.clicker.status_running")
                      : t("tools.clicker.status_stopped")}
                  </Alert>

                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}
                  >
                    <BoltIcon sx={{ fontSize: "0.9rem" }} />
                    {t("tools.clicker.mouse_hotkey_tip")}
                  </Typography>
                </Stack>
              )}

              {tabValue === 1 && (
                <Stack spacing={3}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {t("tools.clicker.keyboard_settings")}
                  </Typography>

                  <TextField
                    label={t("tools.clicker.interval")}
                    type="number"
                    value={kbInterval}
                    onChange={(e) => setKbInterval(Number(e.target.value))}
                    fullWidth
                    disabled={isKbRunning}
                    slotProps={{ htmlInput: { min: 10 } }}
                    helperText={t("tools.clicker.interval_helper")}
                  />

                  <TextField
                    select
                    label={t("tools.clicker.keyboard_key")}
                    value={keyCode}
                    onChange={(e) => setKeyCode(Number(e.target.value))}
                    fullWidth
                    disabled={isKbRunning}
                    slotProps={{
                      select: {
                        MenuProps: { PaperProps: { sx: { maxHeight: 300 } } },
                      },
                    }}
                  >
                    {COMMON_KEYS.map((key) => (
                      <MenuItem key={key.value} value={key.value}>
                        {key.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Button
                    variant="contained"
                    color={isKbRunning ? "error" : "primary"}
                    size="large"
                    startIcon={isKbRunning ? <Stop /> : <PlayArrow />}
                    onClick={handleKbToggle}
                    fullWidth
                    sx={{ py: 1.5, fontWeight: 600 }}
                  >
                    {isKbRunning
                      ? t("tools.clicker.keyboard_stop")
                      : t("tools.clicker.keyboard_start")}
                  </Button>

                  <Alert
                    severity={isKbRunning ? "info" : "success"}
                    sx={{ borderRadius: 1 }}
                  >
                    {isKbRunning
                      ? t("tools.clicker.status_running")
                      : t("tools.clicker.status_stopped")}
                  </Alert>

                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}
                  >
                    <BoltIcon sx={{ fontSize: "0.9rem" }} />
                    {t("tools.clicker.keyboard_hotkey_tip")}
                  </Typography>
                </Stack>
              )}

              {tabValue === 2 && (
                <Stack spacing={3}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {t("tools.clicker.quick_input_settings")}
                  </Typography>

                  <TextField
                    label={t("tools.clicker.text_input")}
                    multiline
                    rows={4}
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    placeholder={t("tools.clicker.text_input_placeholder")}
                    fullWidth
                  />

                  <TextField
                    label={t("tools.clicker.delay_between_keys")}
                    type="number"
                    value={keyDelay}
                    onChange={(e) => setKeyDelay(Number(e.target.value))}
                    fullWidth
                    slotProps={{ htmlInput: { min: 0 } }}
                    helperText={t("tools.clicker.delay_helper")}
                  />

                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      startIcon={<Send />}
                      onClick={handleSendText}
                      fullWidth
                      sx={{ py: 1.5, fontWeight: 600 }}
                    >
                      {t("tools.clicker.send_text")}
                    </Button>
                    <Button
                      variant="outlined"
                      color="primary"
                      size="large"
                      startIcon={<ContentCopy />}
                      onClick={handleCopyText}
                      fullWidth
                      sx={{ py: 1.5, fontWeight: 600 }}
                    >
                      {t("tools.clicker.copy_text")}
                    </Button>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {t("tools.clicker.macro_list")}
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddMacro}
                      size="small"
                    >
                      {t("tools.clicker.add_macro")}
                    </Button>
                  </Box>

                  {macros.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 1 }}>
                      {t("tools.clicker.no_macros")}
                    </Alert>
                  ) : (
                    <Stack spacing={2}>
                      {macros.map((macro) => (
                        <Card
                          key={macro.id}
                          sx={{
                            borderRadius: 1,
                            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                          }}
                        >
                          <CardContent>
                            <Typography
                              variant="subtitle1"
                              sx={{ fontWeight: 600, mb: 1 }}
                            >
                              {macro.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                              }}
                            >
                              {macro.content}
                            </Typography>
                          </CardContent>
                          <CardActions sx={{ px: 2, pb: 2 }}>
                            <Button
                              size="small"
                              startIcon={<PlayArrow />}
                              onClick={() => handleExecuteMacro(macro.content)}
                              variant="contained"
                            >
                              {t("tools.clicker.execute_macro")}
                            </Button>
                            <Button
                              size="small"
                              startIcon={<Edit />}
                              onClick={() => handleEditMacro(macro)}
                            >
                              {t("tools.clicker.edit_macro")}
                            </Button>
                            <Button
                              size="small"
                              startIcon={<Delete />}
                              color="error"
                              onClick={() => handleDeleteMacro(macro.id)}
                            >
                              {t("tools.clicker.delete_macro")}
                            </Button>
                          </CardActions>
                        </Card>
                      ))}
                    </Stack>
                  )}

                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", textAlign: "center" }}
                  >
                    💡 点击"发送文本"后，会在 500ms
                    后开始输入，请提前切换到目标窗口
                  </Typography>
                </Stack>
              )}
            </Box>
          </Paper>

          {/* Macro Dialog */}
          <Dialog
            open={macroDialogOpen}
            onClose={() => setMacroDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {editingMacro
                ? t("tools.clicker.edit_macro")
                : t("tools.clicker.add_macro")}
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label={t("tools.clicker.macro_name")}
                  value={macroName}
                  onChange={(e) => setMacroName(e.target.value)}
                  fullWidth
                  autoFocus
                />
                <TextField
                  label={t("tools.clicker.macro_content")}
                  multiline
                  rows={6}
                  value={macroContent}
                  onChange={(e) => setMacroContent(e.target.value)}
                  fullWidth
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setMacroDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSaveMacro} variant="contained">
                {t("common.save")}
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </Box>
    </ToolLayout>
  );
};

export default Clicker;

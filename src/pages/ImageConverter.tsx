import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import toast from "react-hot-toast";
import { ToolLayout } from "../components/layout/ToolLayout";
import { Button, Select } from "../components/mui";
import {
  FolderOpen as FolderIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import {
  IconButton,
  Typography,
  Box,
  Slider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Dialog,
  DialogContent,
} from "@mui/material";

type OutputFormat =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/bmp"
  | "image/x-icon"
  | "image/tiff"
  | "image/svg+xml";

function mimeToExt(m: string) {
  if (m === "image/jpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  if (m === "image/bmp") return "bmp";
  if (m === "image/x-icon") return "ico";
  if (m === "image/tiff") return "tiff";
  if (m === "image/svg+xml") return "svg";
  return "bin";
}

export default function ImageConverter() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = useState<number>(0.9);
  const [icoSize, setIcoSize] = useState<number>(256);
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.name.match(/\.(svg|heic|heif|psd|raw|cr2|nef|arw|dng)$/i)
    );
    if (arr.length === 0) {
      toast.error(t("tools.image_converter.unsupported", { name: "file" }));
      return;
    }
    setFiles((s) => [...s, ...arr]);
    // 清空 input value 以允许重复选择相同文件
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleSelectDir = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("common.browse"),
    });
    if (selected && typeof selected === "string") {
      setOutputPath(selected);
    }
  };

  const handleConvertOne = async (file: File) => {
    try {
      const buf = await readFileAsBase64(file);
      const resp: Array<[string, string, string]> = (await invoke(
        "convert_images",
        {
          files: [{ name: file.name, data_base64: buf }],
          outputFormat: format,
          quality,
          icoSize,
          customWidth,
          customHeight,
        }
      )) as any;

      console.log("Convert response:", resp);

      if (resp && resp.length > 0) {
        const [, b64, mime] = resp[0];
        console.log("MIME type:", mime);
        const extOut = mimeToExt(mime);
        const fileName = file.name.replace(/\.[^/.]+$/, "") + "." + extOut;
        console.log("Output filename:", fileName);
        const byteChars = atob(b64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++)
          byteNumbers[i] = byteChars.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);

        if (outputPath) {
          // Save to specific folder
          try {
            const fullPath = `${outputPath}${
              outputPath.endsWith("\\") || outputPath.endsWith("/") ? "" : "\\"
            }${fileName}`;
            console.log("Saving to:", fullPath);
            await writeFile(fullPath, byteArray);
            console.log("File saved successfully");
            return true;
          } catch (fsErr) {
            console.error("FS Error:", fsErr);
            throw new Error(`Failed to save to folder: ${fsErr}`);
          }
        } else {
          // Browser download
          const blob = new Blob([byteArray], { type: mime });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(a.href);
          console.log("File downloaded successfully");
          return true;
        }
      }
      throw new Error("Backend returned empty response");
    } catch (err) {
      console.error("Convert Error:", err);
      const msg =
        typeof err === "string"
          ? err
          : (err as Error).message || "Convert failed";
      toast.error(`${file.name}: ${msg}`);
      return false;
    }
  };

  const handleConvertAll = async () => {
    if (files.length === 0) {
      toast.error(t("common.no_results"));
      return;
    }
    let ok = 0;
    let failed = 0;
    for (const f of files) {
      const r = await handleConvertOne(f);
      if (r) ok++;
      else failed++;
    }

    // 清空成功转换的文件列表
    if (ok > 0) {
      setFiles([]);
      const msgKey = outputPath
        ? "tools.image_converter.convert_success"
        : "tools.image_converter.convert_success_downloads";
      toast.success(t(msgKey, { count: ok }));
    }

    // 如果有失败的，额外提示
    if (failed > 0) {
      toast.error(t("tools.image_converter.convert_failed", { count: failed }));
    }
  };

  return (
    <ToolLayout title={t("tools.image_converter.name")}>
      <Box sx={{ p: 3 }}>
        {/* 上传区域 */}
        <Paper
          variant="outlined"
          onDrop={(e) => {
            e.preventDefault();
            onFiles(e.dataTransfer.files);
          }}
          onDragOver={(e) => e.preventDefault()}
          sx={{
            p: files.length > 0 ? 2 : 6,
            textAlign: "center",
            borderStyle: "dashed",
            cursor: "pointer",
            mb: 3,
            bgcolor: "action.hover",
            transition: "all 0.2s",
            "&:hover": {
              bgcolor: "action.selected",
              borderColor: "primary.main",
            },
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.svg"
            style={{ display: "none" }}
            onChange={(e) => onFiles(e.target.files)}
          />
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Typography variant="h6" color="primary">
              {t("tools.image_converter.drag_drop")}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {t("tools.image_converter.supported_formats")}
            </Typography>
          </Box>
        </Paper>

        {/* 配置区域 */}
        <Paper sx={{ p: 2, mb: 3, borderRadius: 1 }} variant="outlined">
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {/* 第一行：格式、质量/尺寸、分辨率 */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "150px 200px 1fr",
                },
                alignItems: "start",
                gap: 2,
              }}
            >
              {/* 格式选择 */}
              <Box>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ mb: 0.5, mt: 0.5, display: "block" }}
                >
                  {t("tools.image_converter.select_format")}
                </Typography>
                <Select
                  value={format}
                  onChange={(v) => setFormat(v as OutputFormat)}
                  options={[
                    { key: "image/jpeg", label: "JPEG" },
                    { key: "image/png", label: "PNG" },
                    { key: "image/webp", label: "WebP" },
                    { key: "image/bmp", label: "BMP" },
                    { key: "image/x-icon", label: "ICO" },
                    { key: "image/tiff", label: "TIFF" },
                    { key: "image/svg+xml", label: "SVG" },
                  ]}
                />
                {format === "image/svg+xml" && (
                  <Typography
                    variant="caption"
                    color="warning.main"
                    sx={{ mt: 0.5, display: "block", fontSize: "10px" }}
                  >
                    {t("tools.image_converter.svg_note")}
                  </Typography>
                )}
              </Box>

              {/* 质量/尺寸调节 */}
              <Box>
                {format === "image/x-icon" ? (
                  <>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      sx={{ mb: 0.5, mt: 0.5, display: "block" }}
                    >
                      {t("tools.image_converter.ico_size")}: {icoSize}x{icoSize}
                    </Typography>
                    <Select
                      value={icoSize.toString()}
                      onChange={(v) => setIcoSize(parseInt(v))}
                      options={[
                        { key: "16", label: "16x16" },
                        { key: "32", label: "32x32" },
                        { key: "48", label: "48x48" },
                        { key: "64", label: "64x64" },
                        { key: "128", label: "128x128" },
                        { key: "256", label: "256x256" },
                      ]}
                    />
                  </>
                ) : (
                  <>
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      sx={{ mb: 0.5, mt: 0.5, display: "block" }}
                    >
                      {t("tools.image_converter.quality")}:{" "}
                      {Math.round(quality * 100)}%
                    </Typography>
                    <Slider
                      size="small"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={quality}
                      onChange={(_, v) => setQuality(v as number)}
                      sx={{ mt: 1 }}
                    />
                  </>
                )}
              </Box>

              {/* 自定义分辨率 */}
              <Box>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ mb: 0.5, mt: 0.5, display: "block" }}
                >
                  {t("tools.image_converter.custom_resolution")}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <input
                    type="number"
                    placeholder="宽度"
                    value={customWidth || ""}
                    onChange={(e) =>
                      setCustomWidth(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    style={{
                      width: "80px",
                      padding: "6px 8px",
                      borderRadius: "4px",
                      border: "1px solid rgba(0,0,0,0.23)",
                      fontSize: "14px",
                    }}
                  />
                  <Typography variant="body2">×</Typography>
                  <input
                    type="number"
                    placeholder="高度"
                    value={customHeight || ""}
                    onChange={(e) =>
                      setCustomHeight(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    style={{
                      width: "80px",
                      padding: "6px 8px",
                      borderRadius: "4px",
                      border: "1px solid rgba(0,0,0,0.23)",
                      fontSize: "14px",
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ mt: 0.5, display: "block", fontSize: "10px" }}
                >
                  {t("tools.image_converter.empty_keeps_original")}
                </Typography>
              </Box>
            </Box>

            {/* 第二行：输出目录和转换按钮 */}
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-end",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              {/* 输出目录 */}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  color="warning.main"
                  sx={{ mb: 0.5, mt: 0.5, display: "block", fontWeight: 500 }}
                >
                  {t("tools.image_converter.output_to")}
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    minWidth: 0,
                  }}
                >
                  <Button
                    variant="outlined"
                    startIcon={<FolderIcon />}
                    onClick={handleSelectDir}
                    sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {outputPath
                      ? t("tools.image_converter.change_dir")
                      : t("tools.image_converter.select_dir")}
                  </Button>
                  <Typography
                    variant="caption"
                    color={outputPath ? "textPrimary" : "textSecondary"}
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                      flex: 1,
                    }}
                    title={outputPath || "未选择目录"}
                  >
                    {outputPath || "未选择目录"}
                  </Typography>
                </Box>
              </Box>

              {/* 转换按钮 */}
              <Box>
                <Button
                  onClick={handleConvertAll}
                  variant="contained"
                  disabled={files.length === 0}
                  sx={{ px: 4, minWidth: 120 }}
                >
                  {t("tools.image_converter.convert")}
                </Button>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* 文件列表 */}
        {files.length > 0 && (
          <Box>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              <Typography variant="subtitle2" color="textSecondary">
                {t("tools.image_converter.files_to_process")} ({files.length})
              </Typography>
              <Button
                variant="text"
                size="small"
                color="error"
                onClick={() => setFiles([])}
              >
                {t("tools.image_converter.clear_list")}
              </Button>
            </Box>
            <Paper
              variant="outlined"
              sx={{ borderRadius: 1, overflow: "hidden" }}
            >
              <List disablePadding>
                {files.map((f, idx) => (
                  <ListItem
                    key={idx}
                    divider={idx !== files.length - 1}
                    sx={{
                      "&:hover": { bgcolor: "action.hover" },
                      py: 1.5,
                    }}
                    secondaryAction={
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => setPreviewUrl(URL.createObjectURL(f))}
                        >
                          {t("tools.image_converter.preview")}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={async () => {
                            const success = await handleConvertOne(f);
                            if (success) {
                              toast.success(
                                t(
                                  "tools.image_converter.convert_success_single",
                                  {
                                    name: f.name,
                                  }
                                )
                              );
                              setFiles((s) => s.filter((file) => file !== f));
                            }
                          }}
                        >
                          {t("tools.image_converter.convert")}
                        </Button>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            setFiles((s) => s.filter((_, i) => i !== idx))
                          }
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    }
                  >
                    <ListItemText
                      primary={f.name}
                      primaryTypographyProps={{
                        variant: "body2",
                        fontWeight: 500,
                      }}
                      secondary={`${(f.size / 1024).toFixed(1)} KB`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>
        )}
      </Box>

      {/* 预览弹窗 */}
      <Dialog
        open={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 0, textAlign: "center", bgcolor: "black" }}>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "80vh",
                display: "block",
                margin: "0 auto",
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </ToolLayout>
  );
}

// helpers for Tauri path
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const res = fr.result as string;
      const comma = res.indexOf(",");
      if (comma >= 0) resolve(res.slice(comma + 1));
      else resolve(res);
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

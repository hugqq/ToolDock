import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Button,
  Paper,
  Stack,
  CircularProgress,
  LinearProgress,
  Slider,
  Card,
  Divider,
} from "../components/mui";
import {
  FileUp,
  FileImage,
  Download,
  FolderArchive,
  X,
  Settings2,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { ToolLayout } from "../components/layout/ToolLayout";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import JSZip from "jszip";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { downloadDir, join } from "@tauri-apps/api/path";
import toast from "react-hot-toast";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

// 配置 pdfjs worker，使得其在本地运行无需下载额外包
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface ConvertedImage {
  pageNum: number;
  blob: Blob;
  url: string;
  filename: string;
}

export default function PdfToImage() {
  const { t } = useTranslation();

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDocument, setPdfDocument] = useState<any>(null); // pdfjsLib.PDFDocumentProxy
  const [pageCount, setPageCount] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [format, setFormat] = useState<string>("image/jpeg");
  const [scale, setScale] = useState<number>(2); // 默认 2x 分辨率
  const [quality, setQuality] = useState<number>(90); // 默认 90% 质量

  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [convertedImages, setConvertedImages] = useState<ConvertedImage[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 清理 URL 对象防内存泄漏
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      convertedImages.forEach((img) => URL.revokeObjectURL(img.url));
    };
  }, [previewUrl, convertedImages]);

  const handleFileChange = async (file: File) => {
    if (!file || file.type !== "application/pdf") {
      toast.error(t("pdf_to_image.error_format", "不支持的文件格式，请选择 PDF 文件"));
      return;
    }
    
    // Reset states
    setConvertedImages([]);
    setPreviewUrl(null);
    setProgress({ current: 0, total: 0 });
    setPdfFile(file);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      setPdfDocument(pdfDoc);
      setPageCount(pdfDoc.numPages);

      // Render page 1 for preview at low scale
      const page = await pdfDoc.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport } as any).promise;
        canvas.toBlob((blob) => {
          if (blob) {
            setPreviewUrl(URL.createObjectURL(blob));
          }
        }, "image/jpeg", 0.8);
      }
    } catch (error) {
      console.error("Failed to load PDF:", error);
      toast.error(t("pdf_to_image.error_load", "PDF 加载失败，请检查文件是否损坏"));
      setPdfFile(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const clearFile = () => {
    setPdfFile(null);
    setPdfDocument(null);
    setPageCount(0);
    setPreviewUrl(null);
    setConvertedImages([]);
    setProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const convertPdf = async () => {
    if (!pdfDocument || pageCount === 0) return;

    setIsConverting(true);
    setProgress({ current: 1, total: pageCount });
    setConvertedImages([]);

    const newImages: ConvertedImage[] = [];
    const baseFilename = pdfFile?.name.replace(/\.[^/.]+$/, "") || "document";
    const ext = format === "image/jpeg" ? "jpg" : "png";

    try {
      for (let i = 1; i <= pageCount; i++) {
        setProgress({ current: i, total: pageCount });
        
        const page = await pdfDocument.getPage(i);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        // Setup white background
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          
          const blob: Blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
              (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
              format,
              quality / 100
            );
          });
          
          newImages.push({
            pageNum: i,
            blob,
            url: URL.createObjectURL(blob),
            filename: `${baseFilename}_page${i}.${ext}`,
          });
        }
      }
      setConvertedImages(newImages);
      toast.success(t("pdf_to_image.convert_success", "转换完成"));
    } catch (error) {
      console.error("Render failed:", error);
      toast.error(t("pdf_to_image.error_render", "页面渲染失败"));
    } finally {
      setIsConverting(false);
    }
  };

  const downloadSingle = async (img: ConvertedImage) => {
    try {
      const dlDir = await downloadDir();
      const defaultPath = await join(dlDir, img.filename);
      
      const savePath = await save({
        defaultPath,
        filters: [{
           name: "Image", 
           extensions: [format === "image/jpeg" ? "jpg" : "png"] 
        }]
      });
      
      if (!savePath) return;
      
      const arrayBuffer = await img.blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await writeFile(savePath, uint8Array);
      
      toast.success(t("common.success", "下载成功"));
    } catch (err) {
      console.error("Single image saving failed:", err);
      toast.error(t("common.error", "下载失败"));
    }
  };

  const downloadAllZip = async () => {
    if (convertedImages.length === 0) return;
    
    try {
      const baseFilename = pdfFile?.name.replace(/\.[^/.]+$/, "") || "document";
      const defaultFileName = `${baseFilename}_images.zip`;
      const dlDir = await downloadDir();
      const defaultPath = await join(dlDir, defaultFileName);
      
      const savePath = await save({
        defaultPath,
        filters: [{ name: "ZIP Archive", extensions: ["zip"] }]
      });
      
      if (!savePath) return;
      
      const toastId = toast.loading(t("pdf_to_image.converting", "打包中..."));
      
      const zip = new JSZip();
      convertedImages.forEach(img => {
        zip.file(img.filename, img.blob);
      });
      
      const zipUint8Array = await zip.generateAsync({ type: "uint8array" });
      
      await writeFile(savePath, zipUint8Array);
      
      toast.success(t("common.success", "下载成功"), { id: toastId });
    } catch(err) {
      console.error("ZIP Generation or saving failed:", err);
      toast.error(t("common.error", "打包下载失败"));
    }
  };

  const progressValue = useMemo(() => {
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  }, [progress]);

  return (
    <ToolLayout title={t("pdf_to_image.name", "PDF 转图片")}>
      <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", pb: 4 }}>
        {!pdfDocument ? (
          /* Step 1: File Selection Area */
          <Stack spacing={3}>
            <Paper
              variant="outlined"
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 2,
                bgcolor: "var(--card-bg)",
                borderColor: "var(--border-color)",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
              }}
            >
              <Stack spacing={1}>
                <Typography variant="h6" fontWeight={800} color="text.primary">
                  {t("pdf_to_image.step1_title", "点击或拖入 PDF 文件")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  选择一个 PDF 后，可预览首页、设置输出格式和清晰度，再转换为图片。
                </Typography>
              </Stack>
            </Paper>

            <Paper
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={handleDrop}
              sx={{
                p: { xs: 5, md: 7 },
                minHeight: 360,
                borderRadius: 2,
                borderStyle: "dashed",
                borderWidth: 2,
                borderColor: "var(--border-color)",
                bgcolor: "var(--card-bg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: "action.hover",
                },
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: 2,
                  bgcolor: "primary.main",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 18px rgba(59, 130, 246, 0.22)",
                }}
              >
                <FileUp size={34} />
              </Box>

              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 0.75 }}>
                  选择 PDF
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  支持拖拽文件到这里，文件只在本机处理。
                </Typography>
              </Box>

              <Button
                variant="contained"
                startIcon={<FileUp size={18} />}
                sx={{ mt: 1, px: 3, borderRadius: 1.5, textTransform: "none" }}
              >
                浏览文件
              </Button>

              <input
                type="file"
                hidden
                accept="application/pdf"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
            </Paper>
          </Stack>
        ) : (
          /* Step 2: Preview & Settings */
          <Stack spacing={3}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 350px" },
                gap: 3,
              }}
            >
              {/* Left: Preview Card */}
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 400,
                  bgcolor: "var(--card-bg)",
                  borderColor: "var(--border-color)",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                }}
              >
                <Box
                  sx={{
                    px: 3,
                    py: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    bgcolor: "var(--bg-main)",
                    borderBottom: "1px solid",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <FileText size={20} className="text-primary" />
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold" noWrap sx={{ maxWidth: 400 }}>
                        {pdfFile?.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t("pdf_to_image.page_count", "共 {{count}} 页", { count: pageCount })}
                      </Typography>
                    </Box>
                  </Stack>
                  <IconButton onClick={clearFile} disabled={isConverting} color="error" size="small">
                    <X size={18} />
                  </IconButton>
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 4,
                    bgcolor: "var(--bg-main)",
                  }}
                >
                  {previewUrl ? (
                    <Box sx={{ position: "relative" }}>
                      <img
                        src={previewUrl}
                        alt="Preview"
                        style={{
                          maxWidth: "100%",
                          maxHeight: 450,
                          borderRadius: "8px",
                          boxShadow: "0 8px 20px rgba(15,23,42,0.10)",
                          border: "1px solid var(--border-color)",
                        }}
                      />
                      <Box
                        sx={{
                          position: "absolute",
                          bottom: 12,
                          right: 12,
                          bgcolor: "rgba(0,0,0,0.6)",
                          color: "white",
                          px: 1.5,
                          py: 0.5,
                          borderRadius: "6px",
                          backdropFilter: "blur(4px)",
                          fontSize: "0.75rem",
                        }}
                      >
                        预览
                      </Box>
                    </Box>
                  ) : (
                    <CircularProgress size={32} />
                  )}
                </Box>
              </Card>

              {/* Right: Settings Card */}
              <Card
                variant="outlined"
                sx={{
                  p: 3,
                  borderRadius: 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  bgcolor: "var(--card-bg)",
                  borderColor: "var(--border-color)",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Settings2 size={18} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    转换设置
                  </Typography>
                </Stack>

                <Divider />

                <Stack spacing={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>输出格式</InputLabel>
                    <Select
                      value={format}
                      label="输出格式"
                      onChange={(e) => setFormat(e.target.value)}
                      disabled={isConverting}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <MenuItem value="image/jpeg">JPEG 高性能</MenuItem>
                      <MenuItem value="image/png">PNG 无损</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small">
                    <InputLabel>清晰度 (DPI)</InputLabel>
                    <Select
                      value={scale}
                      label="清晰度 (DPI)"
                      onChange={(e) => setScale(Number(e.target.value))}
                      disabled={isConverting}
                      sx={{ borderRadius: 1.5 }}
                    >
                      <MenuItem value={1}>1x (72 DPI - 标清)</MenuItem>
                      <MenuItem value={2}>2x (144 DPI - 高清)</MenuItem>
                      <MenuItem value={3}>3x (216 DPI - 超清)</MenuItem>
                      <MenuItem value={4}>4x (288 DPI - 极致)</MenuItem>
                    </Select>
                  </FormControl>

                  {format === "image/jpeg" && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                        压缩质量: {quality}%
                      </Typography>
                      <Slider
                        value={quality}
                        min={10}
                        max={100}
                        step={5}
                        onChange={(_, v) => setQuality(v as number)}
                        disabled={isConverting}
                        size="small"
                      />
                    </Box>
                  )}

                  <Box sx={{ pt: 2, mt: "auto" }}>
                    {isConverting ? (
                      <Stack spacing={1}>
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography variant="caption" fontWeight="bold">
                            处理中... {progress.current}/{progress.total}
                          </Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {progressValue}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={progressValue}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Stack>
                    ) : (
                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={convertPdf}
                        startIcon={<FileImage size={20} />}
                        sx={{
                          py: 1.5,
                          borderRadius: 1.5,
                          textTransform: "none",
                          fontSize: "1rem",
                          boxShadow: "0 6px 14px rgba(59, 130, 246, 0.16)",
                        }}
                      >
                        开始转换
                      </Button>
                    )}
                  </Box>
                </Stack>
              </Card>
            </Box>

            {/* Results Grid */}
            {convertedImages.length > 0 && !isConverting && (
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: "var(--card-bg)",
                  borderColor: "var(--border-color)",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                }}
              >
                <Box
                  sx={{
                    mb: 3,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 2,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CheckCircle2 size={20} className="text-green-500" />
                    <Typography variant="h6" fontWeight="800">
                      转换结果
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ({convertedImages.length} 个文件)
                    </Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<FolderArchive size={18} />}
                    onClick={downloadAllZip}
                    sx={{
                      borderRadius: 1.5,
                      textTransform: "none",
                      px: 3,
                    }}
                  >
                    打包下载所有页面 (ZIP)
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                    gap: 2.5,
                  }}
                >
                  {convertedImages.map((img) => (
                    <Card
                      key={img.pageNum}
                      variant="outlined"
                      sx={{
                        borderRadius: 1.5,
                        overflow: "hidden",
                        transition: "all 0.2s",
                        bgcolor: "var(--card-bg)",
                        borderColor: "var(--border-color)",
                        "&:hover": {
                          borderColor: "primary.main",
                          boxShadow: "0 6px 16px rgba(15,23,42,0.08)",
                        },
                        "&:hover .action-overlay": {
                          opacity: 1,
                        },
                      }}
                    >
                      <Box sx={{ position: "relative", pt: "141%", bgcolor: "var(--bg-main)" }}>
                        <img
                          src={img.url}
                          alt={`Page ${img.pageNum}`}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            padding: "8px",
                          }}
                          loading="lazy"
                        />
                        {/* Overlay on hover */}
                        <Box
                          className="action-overlay"
                          sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: "rgba(0,0,0,0.4)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0,
                            transition: "opacity 0.2s",
                            backdropFilter: "blur(2px)",
                          }}
                        >
                          <IconButton
                            onClick={() => downloadSingle(img)}
                            sx={{
                              bgcolor: "white",
                              color: "primary.main",
                              "&:hover": { bgcolor: "primary.main", color: "white" },
                            }}
                          >
                            <Download size={20} />
                          </IconButton>
                        </Box>
                      </Box>
                      <Box sx={{ py: 1, textAlign: "center", borderTop: "1px solid", borderColor: "var(--border-color)" }}>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary">
                          P.{img.pageNum}
                        </Typography>
                      </Box>
                    </Card>
                  ))}
                </Box>
              </Paper>
            )}
          </Stack>
        )}
      </Box>
    </ToolLayout>
  );
}

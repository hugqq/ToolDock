import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ToolLayout } from "../components/layout/ToolLayout";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from "@mui/material";
import {
  FileCode,
  Save,
  Play,
  Plus,
  FolderOpen,
  Trash2,
  History,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Settings,
  Sparkles,
  Bot,
  X,
  Search,
  Square,
  Activity,
} from "lucide-react";
import { Button } from "../components/mui";
import { useSettingsStore } from "../stores/useSettingsStore";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "react-hot-toast";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { useTheme } from "../components/ThemeContext";
import { Drawer, CircularProgress, Fab } from "@mui/material";
import ReactMarkdown from "react-markdown";

interface BackupInfo {
  path: string;
  filename: string;
  created_at: string;
}

const TEMPLATES = [
  {
    id: "reverse_proxy",
    nameKey: "tools.nginx_editor.template_reverse_proxy",
    template: (domain: string, port: string, target: string) => `server {
    listen ${port || "80"};
    server_name ${domain || "localhost"};

    location / {
        proxy_pass ${target || "http://127.0.0.1:8080"};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`,
  },
  {
    id: "static_site",
    nameKey: "tools.nginx_editor.template_static_site",
    template: (domain: string, port: string, target: string) => `server {
    listen ${port || "80"};
    server_name ${domain || "localhost"};
    root ${target || "C:/www/html"};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }
}`,
  },
  {
    id: "spa",
    nameKey: "tools.nginx_editor.template_spa",
    template: (domain: string, port: string, target: string) => `server {
    listen ${port || "80"};
    server_name ${domain || "localhost"};
    root ${target || "C:/www/dist"};
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}`,
  },
  {
    id: "load_balancer",
    nameKey: "tools.nginx_editor.template_load_balancer",
    template: (
      domain: string,
      port: string,
      _target: string
    ) => `upstream my_app {
    server 127.0.0.1:8081;
    server 127.0.0.1:8082;
}

server {
    listen ${port || "80"};
    server_name ${domain || "localhost"};

    location / {
        proxy_pass http://my_app;
    }
}`,
  },
  {
    id: "security_hardening",
    nameKey: "tools.nginx_editor.template_security_hardening",
    template: (
      domain: string,
      _port: string,
      certPath: string
    ) => `# 安全强化配置
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

    # 隐藏版本号
    server_tokens off;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;

    # SSL 强化
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    server {
        listen 80;
        server_name ${domain || "localhost"};

        # 强制 HTTPS 跳转
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name ${domain || "localhost"};

        # SSL 证书配置
        ssl_certificate ${certPath || "/etc/nginx/ssl/cert.pem"};
        ssl_certificate_key ${certPath || "/etc/nginx/ssl/key.pem"};

        # 安全响应头
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # 禁止目录浏览
        autoindex off;

        # 屏蔽隐藏文件
        location ~ /\. {
            deny all;
            access_log off;
            log_not_found off;
        }

        location ~ /\.env {
            deny all;
        }

        location ~ /\.git {
            deny all;
        }

        location / {
            proxy_pass http://127.0.0.1:8080;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}`,
  },
  {
    id: "performance_optimization",
    nameKey: "tools.nginx_editor.template_performance_optimization",
    template: (domain: string, port: string, _target: string) => `# 性能优化配置
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    # 高效 I/O 配置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;

    # Gzip 压缩（关键性能优化）
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/x-javascript application/xml+rss 
               application/javascript application/json;

    # 连接池
    upstream backend {
        least_conn;
        server 127.0.0.1:8081 max_fails=2 fail_timeout=10s;
        server 127.0.0.1:8082 max_fails=2 fail_timeout=10s;
        keepalive 32;
    }

    server {
        listen ${port || "80"};
        server_name ${domain || "localhost"};

        # 缓存策略
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            
            # 超时配置
            proxy_connect_timeout 5s;
            proxy_send_timeout 10s;
            proxy_read_timeout 10s;
        }
    }
}`,
  },
  {
    id: "routing_enhancement",
    nameKey: "tools.nginx_editor.template_routing_enhancement",
    template: (
      domain: string,
      _port: string,
      target: string
    ) => `# 路由和重定向优化配置
user nginx;
worker_processes auto;

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main_extended '$remote_addr - $remote_user [$time_local] "$request" '
                             '$status $body_bytes_sent "$http_referer" '
                             '"$http_user_agent" "$http_x_forwarded_for" '
                             'rt=$request_time uct="$upstream_connect_time" '
                             'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main_extended;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # HTTP 全站重定向到 HTTPS
    server {
        listen 80;
        server_name ${domain || "localhost"};
        
        # 规范化路径重定向
        location / {
            return 301 https://$server_name$request_uri;
        }
    }

    server {
        listen 443 ssl http2;
        server_name ${domain || "localhost"};

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # 规范化 URL 处理
        location ~ ^(.*)//(.*)$ {
            return 301 $scheme://$server_name$1/$2;
        }

        # API 代理 - 完善代理透传
        location /api/ {
            proxy_pass ${target || "http://127.0.0.1:8080"};
            proxy_http_version 1.1;
            
            # 透传关键请求头
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $server_name;
            proxy_set_header X-Forwarded-Port $server_port;
            
            # 保留原始请求 URI
            proxy_set_header X-Original-URL $scheme://$http_host$request_uri;
            
            # 连接管理
            proxy_set_header Connection "";
            proxy_buffering off;
            proxy_request_buffering off;
        }

        # 静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            root ${target || "C:/www/dist"};
            expires 7d;
        }

        # 健康检查端点
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # 默认路由
        location / {
            proxy_pass ${target || "http://127.0.0.1:8080"};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}`,
  },
];

const NginxEditor: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { nginxPath, setNginxPath, ai, setAiActiveProvider } =
    useSettingsStore();
  const [filePath, setFilePath] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [templateParams, setTemplateParams] = useState({
    domain: "",
    port: "80",
    target: "",
    certPath: "",
  });

  // Template Preview State
  const [previewContent, setPreviewContent] = useState<string>("");
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [insertMode, setInsertMode] = useState<
    "replace" | "append" | "prepend"
  >("append");

  // AI Assistant State
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);

  // Service State
  const [isNginxRunning, setIsNginxRunning] = useState(false);
  const [scannedConfigs, setScannedConfigs] = useState<string[]>([]);
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);

  const checkNginxStatus = async () => {
    try {
      const running = await invoke<boolean>("is_nginx_running");
      setIsNginxRunning(running);
    } catch (error) {
      console.error("Failed to check Nginx status:", error);
    }
  };

  const handleSelectScannedConfig = async (path: string) => {
    try {
      setFilePath(path);
      const data = await invoke<string>("read_nginx_config", { path });
      setContent(data);
      setTestResult(null);
      setIsScanDialogOpen(false);
      toast.success(t("common.success"));
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleStartNginx = async () => {
    if (!filePath) {
      toast.error(t("tools.nginx_editor.select_file"));
      return;
    }
    try {
      await invoke("start_nginx", {
        path: filePath,
        nginxPath: nginxPath || null,
      });
      toast.success(t("tools.nginx_editor.start_success"));
      checkNginxStatus();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleStopNginx = async () => {
    try {
      await invoke("stop_nginx", { nginxPath: nginxPath || null });
      toast.success(t("tools.nginx_editor.stop_success"));
      checkNginxStatus();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleScanConfigs = async () => {
    try {
      const configs = await invoke<string[]>("scan_nginx_configs");
      setScannedConfigs(configs);
      if (configs.length > 0) {
        setIsScanDialogOpen(true);
        toast.success(
          t("tools.nginx_editor.scan_found", { count: configs.length })
        );
      } else {
        toast.error(t("tools.nginx_editor.scan_not_found"));
      }
    } catch (error) {
      toast.error(String(error));
    }
  };

  useEffect(() => {
    checkNginxStatus();
    const timer = setInterval(checkNginxStatus, 5000);

    // 自动扫描并选择第一个配置
    const autoScan = async () => {
      try {
        const configs = await invoke<string[]>("scan_nginx_configs");
        setScannedConfigs(configs);
        if (configs.length > 0 && !filePath) {
          handleSelectScannedConfig(configs[0]);
        }
      } catch (error) {
        console.error("Auto scan failed:", error);
      }
    };
    autoScan();

    return () => clearInterval(timer);
  }, []);

  const handleOpenAiDrawer = () => {
    setIsAiDrawerOpen(true);
    if (!aiResponse) {
      setAiResponse("");
    }
  };

  const handlePerformAiRequest = async () => {
    const activeProvider = ai.activeProvider;
    const providerConfig = ai.providers[activeProvider];

    if (!providerConfig.apiKey) {
      toast.error(t("tools.nginx_editor.ai_config_missing"));
      return;
    }

    setIsAiLoading(true);
    setAiResponse("");

    try {
      const response = await invoke<string>("ask_nginx_ai", {
        provider: activeProvider,
        apiKey: providerConfig.apiKey,
        model: providerConfig.model,
        baseUrl: providerConfig.baseUrl || null,
        content: content,
        error: testResult?.message || t("tools.nginx_editor.ai_no_error"),
      });

      setAiResponse(response);
    } catch (error) {
      setAiResponse(String(error));
      toast.error(String(error));
    } finally {
      setIsAiLoading(false);
    }
  };

  const fetchBackups = async (path: string) => {
    if (!path) return;
    try {
      const list = await invoke<BackupInfo[]>("list_nginx_backups", { path });
      setBackups(list);
    } catch (error) {
      console.error("Failed to fetch backups:", error);
    }
  };

  useEffect(() => {
    if (filePath) {
      fetchBackups(filePath);
    }
  }, [filePath]);

  const handleOpenFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Nginx Config", extensions: ["conf", "txt", "*"] }],
      });
      if (selected && typeof selected === "string") {
        setFilePath(selected);
        const data = await invoke<string>("read_nginx_config", {
          path: selected,
        });
        setContent(data);
        setTestResult(null);
        toast.success(t("common.success"));
      }
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleSaveFile = async () => {
    if (!filePath) {
      const selected = await save({
        filters: [{ name: "Nginx Config", extensions: ["conf"] }],
      });
      if (selected) {
        setFilePath(selected);
      } else {
        return;
      }
    }

    try {
      await invoke("write_nginx_config", { path: filePath, content });
      toast.success(
        t("tools.nginx_editor.save_config") + " " + t("common.success")
      );
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleTestConfig = async () => {
    if (!filePath) {
      toast.error(t("tools.nginx_editor.select_file"));
      return;
    }

    try {
      const result = await invoke<string>("test_nginx_config", {
        path: filePath,
        nginxPath: nginxPath || null,
      });
      setTestResult({ success: true, message: result });
      toast.success(t("tools.nginx_editor.config_valid"));
    } catch (error: any) {
      setTestResult({ success: false, message: String(error) });
      toast.error(t("tools.nginx_editor.config_invalid"));
    }
  };

  const handleCreateBackup = async () => {
    if (!filePath) {
      toast.error(t("tools.nginx_editor.select_file"));
      return;
    }
    try {
      const backupPath = await invoke<string>("create_nginx_backup", {
        path: filePath,
      });
      toast.success(
        t("tools.nginx_editor.backup_success", { path: backupPath })
      );
      fetchBackups(filePath);
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleRestoreBackup = async (backupPath?: string) => {
    if (!filePath) {
      toast.error(t("tools.nginx_editor.select_file"));
      return;
    }
    try {
      let selected = backupPath;
      if (!selected) {
        selected = (await open({
          multiple: false,
          filters: [{ name: "Nginx Backup", extensions: ["bak*"] }],
        })) as string;
      }

      if (selected && typeof selected === "string") {
        await invoke("restore_nginx_backup", {
          path: filePath,
          backupPath: selected,
        });
        const data = await invoke<string>("read_nginx_config", {
          path: filePath,
        });
        setContent(data);
        toast.success(t("tools.nginx_editor.restore_success"));
      }
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleDeleteBackup = async (backupPath: string) => {
    try {
      await invoke("delete_nginx_backup", { backupPath });
      fetchBackups(filePath);
      toast.success(t("common.success"));
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleApplyTemplate = () => {
    const template = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (template) {
      let newContent: string;

      // 根据模板类型选择合适的参数
      if (selectedTemplate === "security_hardening") {
        newContent = template.template(
          templateParams.domain,
          templateParams.port,
          templateParams.certPath
        );
      } else if (selectedTemplate === "routing_enhancement") {
        newContent = template.template(
          templateParams.domain,
          templateParams.port,
          templateParams.target
        );
      } else {
        newContent = template.template(
          templateParams.domain,
          templateParams.port,
          templateParams.target
        );
      }

      // 显示预览而不是直接应用
      setPreviewContent(newContent);
      setIsPreviewDialogOpen(true);
      setIsTemplateDialogOpen(false);
    }
  };

  // 智能插入模板内容
  const handleConfirmTemplateInsert = (
    mode: "replace" | "append" | "prepend"
  ) => {
    const template = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!template) return;

    let finalContent = previewContent;

    switch (mode) {
      case "replace":
        // 替换整个内容
        setContent(finalContent);
        break;
      case "append":
        // 追加到末尾
        setContent((prev) =>
          prev ? prev + "\n\n" + finalContent : finalContent
        );
        break;
      case "prepend":
        // 插入到开头
        setContent((prev) =>
          prev ? finalContent + "\n\n" + prev : finalContent
        );
        break;
    }

    // 重置状态
    setPreviewContent("");
    setIsPreviewDialogOpen(false);
    setInsertMode("append");
    toast.success(t("tools.nginx_editor.template_inserted"));
  };

  const handleSelectNginxPath = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Nginx Executable", extensions: ["exe"] }],
      });
      if (selected && typeof selected === "string") {
        setNginxPath(selected);
        toast.success(t("common.success"));
      }
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <ToolLayout title={t("tools.nginx_editor.name")}>
      <Stack spacing={2} sx={{ height: "100%", p: 2 }}>
        {/* 服务状态与控制卡片 */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 1,
            bgcolor: "background.paper",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderLeft: 6,
            borderLeftColor: isNginxRunning ? "success.main" : "error.main",
          }}
        >
          <Stack direction="row" spacing={3} alignItems="center">
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: 1,
                  bgcolor: isNginxRunning ? "success.main" : "error.main",
                  mr: 1.5,
                  boxShadow: isNginxRunning
                    ? "0 0 12px rgba(76, 175, 80, 0.8)"
                    : "none",
                  animation: isNginxRunning ? "pulse 2s infinite" : "none",
                  "@keyframes pulse": {
                    "0%": { opacity: 1, transform: "scale(1)" },
                    "50%": { opacity: 0.6, transform: "scale(1.2)" },
                    "100%": { opacity: 1, transform: "scale(1)" },
                  },
                }}
              />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {isNginxRunning
                  ? t("tools.nginx_editor.status_running")
                  : t("tools.nginx_editor.status_stopped")}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              {isNginxRunning ? (
                <Button
                  color="error"
                  variant="contained"
                  startIcon={<Square size={18} />}
                  onClick={handleStopNginx}
                  sx={{ borderRadius: 1, px: 3 }}
                >
                  {t("tools.nginx_editor.stop_nginx")}
                </Button>
              ) : (
                <Button
                  color="success"
                  variant="contained"
                  startIcon={<Play size={18} />}
                  onClick={handleStartNginx}
                  sx={{ borderRadius: 1, px: 3 }}
                >
                  {t("tools.nginx_editor.start_nginx")}
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<Search size={18} />}
                onClick={handleScanConfigs}
                sx={{ borderRadius: 1 }}
              >
                {t("tools.nginx_editor.scan_config")}
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title={t("common.settings")}>
              <IconButton
                onClick={() => setIsSettingsDialogOpen(true)}
                sx={{ bgcolor: "action.hover" }}
              >
                <Settings size={20} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>

        {/* 文件操作与工具栏 */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: "background.paper",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              value={filePath}
              placeholder={t("tools.nginx_editor.select_file")}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <FileCode
                    size={18}
                    style={{ marginRight: 8, opacity: 0.6 }}
                  />
                ),
                sx: { borderRadius: 1 },
              }}
            />
            <Button
              variant="outlined"
              startIcon={<FolderOpen size={18} />}
              onClick={handleOpenFile}
              sx={{ minWidth: 100, borderRadius: 1 }}
            >
              {t("common.open")}
            </Button>
            <Button
              variant="contained"
              startIcon={<Save size={18} />}
              onClick={handleSaveFile}
              color="primary"
              sx={{ minWidth: 100, borderRadius: 1 }}
            >
              {t("common.save")}
            </Button>
          </Box>

          <Divider />

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<Plus size={18} />}
              onClick={() => setIsTemplateDialogOpen(true)}
              size="small"
              sx={{ borderRadius: 1 }}
            >
              {t("tools.nginx_editor.insert_template")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<Activity size={18} />}
              onClick={handleTestConfig}
              size="small"
              sx={{ borderRadius: 1 }}
            >
              {t("tools.nginx_editor.test_config")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ShieldCheck size={18} />}
              onClick={handleCreateBackup}
              size="small"
              sx={{ borderRadius: 1 }}
            >
              {t("tools.nginx_editor.backup")}
            </Button>
            <Button
              variant="outlined"
              startIcon={<History size={18} />}
              onClick={() => handleRestoreBackup()}
              size="small"
              sx={{ borderRadius: 1 }}
            >
              {t("tools.nginx_editor.restore")}
            </Button>
          </Box>
        </Paper>

        {/* 错误详情显示 */}
        {testResult && (
          <Alert
            severity={testResult.success ? "success" : "error"}
            icon={
              testResult.success ? (
                <ShieldCheck size={20} />
              ) : (
                <AlertTriangle size={20} />
              )
            }
            sx={{ borderRadius: 1 }}
            action={
              <IconButton
                size="small"
                onClick={() => setTestResult(null)}
                color="inherit"
              >
                <Trash2 size={16} />
              </IconButton>
            }
          >
            <Typography variant="subtitle2" fontWeight="bold">
              {testResult.success
                ? t("tools.nginx_editor.config_valid")
                : t("tools.nginx_editor.config_invalid")}
            </Typography>
            <Typography
              variant="caption"
              component="pre"
              sx={{
                mt: 1,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                fontFamily: "monospace",
                maxHeight: 150,
                overflowY: "auto",
                display: "block",
              }}
            >
              {testResult.message}
            </Typography>
          </Alert>
        )}

        {/* 编辑器区域 */}
        <Box sx={{ flexGrow: 1, display: "flex", gap: 2, minHeight: 0 }}>
          <Paper
            variant="outlined"
            sx={{
              flexGrow: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              borderRadius: 1,
              bgcolor: theme === "dark" ? "#1e1e1e" : "#fff",
            }}
          >
            <CodeMirror
              value={content}
              height="100%"
              theme={theme === "dark" ? vscodeDark : vscodeLight}
              onChange={(value) => setContent(value)}
              placeholder={t("tools.nginx_editor.placeholder")}
              style={{ fontSize: "14px", height: "100%" }}
            />
          </Paper>

          {/* 备份历史侧边栏 */}
          {filePath && (
            <Paper
              variant="outlined"
              sx={{
                width: 280,
                display: "flex",
                flexDirection: "column",
                borderRadius: 1,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "action.hover",
                  borderBottom: 1,
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <History size={18} />
                <Typography variant="subtitle2" fontWeight="bold">
                  {t("tools.nginx_editor.restore")}
                </Typography>
              </Box>
              <List sx={{ flexGrow: 1, overflowY: "auto", p: 0 }}>
                {backups.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: "center", opacity: 0.5 }}>
                    <Typography variant="caption">
                      {t("common.no_results")}
                    </Typography>
                  </Box>
                ) : (
                  backups.map((backup) => (
                    <ListItem
                      key={backup.path}
                      divider
                      sx={{
                        px: 1.5,
                        py: 1,
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <ListItemText
                        primary={backup.filename.split("bak.")[1]}
                        secondary={backup.created_at}
                        primaryTypographyProps={{
                          variant: "caption",
                          fontWeight: "bold",
                          sx: {
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          },
                        }}
                        secondaryTypographyProps={{ variant: "caption" }}
                      />
                      <ListItemSecondaryAction sx={{ right: 8 }}>
                        <Tooltip title={t("tools.nginx_editor.restore")}>
                          <IconButton
                            size="small"
                            onClick={() => handleRestoreBackup(backup.path)}
                            color="primary"
                          >
                            <RotateCcw size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t("common.delete")}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteBackup(backup.path)}
                            color="error"
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))
                )}
              </List>
            </Paper>
          )}
        </Box>
      </Stack>

      <Dialog
        open={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("tools.nginx_editor.insert_template")}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>{t("tools.nginx_editor.insert_template")}</InputLabel>
              <Select
                value={selectedTemplate}
                label={t("tools.nginx_editor.insert_template")}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                {TEMPLATES.map((tmpl) => (
                  <MenuItem key={tmpl.id} value={tmpl.id}>
                    {t(tmpl.nameKey)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label={t("tools.nginx_editor.domain")}
              fullWidth
              value={templateParams.domain}
              onChange={(e) =>
                setTemplateParams({ ...templateParams, domain: e.target.value })
              }
              placeholder="example.com"
            />

            <TextField
              label={t("tools.nginx_editor.port")}
              fullWidth
              value={templateParams.port}
              onChange={(e) =>
                setTemplateParams({ ...templateParams, port: e.target.value })
              }
              placeholder="80"
            />

            {selectedTemplate !== "security_hardening" &&
              selectedTemplate !== "performance_optimization" &&
              selectedTemplate !== "routing_enhancement" && (
                <TextField
                  label={
                    selectedTemplate === "static_site" ||
                    selectedTemplate === "spa"
                      ? t("tools.nginx_editor.root_path")
                      : t("tools.nginx_editor.target_url")
                  }
                  fullWidth
                  value={templateParams.target}
                  onChange={(e) =>
                    setTemplateParams({
                      ...templateParams,
                      target: e.target.value,
                    })
                  }
                  placeholder={
                    selectedTemplate === "static_site" ||
                    selectedTemplate === "spa"
                      ? "C:/www/html"
                      : "http://127.0.0.1:8080"
                  }
                />
              )}

            {selectedTemplate === "security_hardening" && (
              <TextField
                label={t("tools.nginx_editor.certificate_path")}
                fullWidth
                value={templateParams.certPath}
                onChange={(e) =>
                  setTemplateParams({
                    ...templateParams,
                    certPath: e.target.value,
                  })
                }
                placeholder="/etc/nginx/ssl/cert.pem"
              />
            )}

            {selectedTemplate === "routing_enhancement" && (
              <TextField
                label={t("tools.nginx_editor.target_url")}
                fullWidth
                value={templateParams.target}
                onChange={(e) =>
                  setTemplateParams({
                    ...templateParams,
                    target: e.target.value,
                  })
                }
                placeholder="http://127.0.0.1:8080"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setIsTemplateDialogOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="contained" onClick={handleApplyTemplate}>
            {t("tools.nginx_editor.apply")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 模板预览对话框 */}
      <Dialog
        open={isPreviewDialogOpen}
        onClose={() => setIsPreviewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t("tools.nginx_editor.template_preview")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t("tools.nginx_editor.template_preview_desc")}
            </Typography>

            <FormControl fullWidth size="small">
              <InputLabel>{t("tools.nginx_editor.insert_mode")}</InputLabel>
              <Select
                value={insertMode}
                label={t("tools.nginx_editor.insert_mode")}
                onChange={(e) => {
                  setInsertMode(
                    e.target.value as "replace" | "append" | "prepend"
                  );
                }}
              >
                <MenuItem value="replace">
                  {t("tools.nginx_editor.mode_replace")}
                </MenuItem>
                <MenuItem value="append">
                  {t("tools.nginx_editor.mode_append")}
                </MenuItem>
                <MenuItem value="prepend">
                  {t("tools.nginx_editor.mode_prepend")}
                </MenuItem>
              </Select>
            </FormControl>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: theme === "dark" ? "#1e1e1e" : "#f5f5f5",
                maxHeight: 400,
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {previewContent}
            </Paper>

            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                startIcon={<FileCode size={18} />}
                onClick={() => {
                  navigator.clipboard.writeText(previewContent);
                  toast.success(t("common.copy_success"));
                }}
                size="small"
              >
                {t("common.copy")}
              </Button>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="text"
            onClick={() => {
              setIsPreviewDialogOpen(false);
              setPreviewContent("");
              setInsertMode("append");
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleConfirmTemplateInsert(insertMode);
            }}
          >
            {t("tools.nginx_editor.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 扫描配置对话框 */}
      <Dialog
        open={isScanDialogOpen}
        onClose={() => setIsScanDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("tools.nginx_editor.scan_config")}</DialogTitle>
        <DialogContent dividers>
          <List>
            {scannedConfigs.map((path, index) => (
              <ListItem
                key={index}
                component="div"
                onClick={() => handleSelectScannedConfig(path)}
                sx={{
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                  borderRadius: 1,
                }}
              >
                <ListItemText
                  primary={path.split(/[\\/]/).pop()}
                  secondary={path}
                  primaryTypographyProps={{ variant: "subtitle2" }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsScanDialogOpen(false)}>
            {t("common.cancel")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 设置对话框 */}
      <Dialog
        open={isSettingsDialogOpen}
        onClose={() => setIsSettingsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t("common.settings")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="subtitle2">
              {t("tools.nginx_editor.nginx_path_label", {
                defaultValue: "Nginx 执行文件路径 (nginx.exe)",
              })}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                value={nginxPath}
                onChange={(e) => setNginxPath(e.target.value)}
                placeholder="C:\nginx\nginx.exe"
              />
              <Button
                variant="outlined"
                startIcon={<FolderOpen size={18} />}
                onClick={handleSelectNginxPath}
                sx={{ whiteSpace: "nowrap" }}
              >
                {t("common.browse")}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {t("tools.nginx_editor.nginx_path_tip", {
                defaultValue:
                  "如果不设置，将尝试从系统环境变量 (PATH) 中查找 nginx 命令。",
              })}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => setIsSettingsDialogOpen(false)}
          >
            {t("common.close")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Assistant Floating Button */}
      <Fab
        color="primary"
        aria-label="ask-ai"
        sx={{ position: "fixed", bottom: 32, right: 32 }}
        onClick={handleOpenAiDrawer}
      >
        <Sparkles size={24} />
      </Fab>

      {/* AI Assistant Drawer */}
      <Drawer
        anchor="right"
        open={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 500 }, p: 3 },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Bot size={24} />
              <Typography variant="h6">
                {t("tools.nginx_editor.ai_assistant")}
              </Typography>
            </Stack>
            <IconButton onClick={() => setIsAiDrawerOpen(false)}>
              <X size={20} />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ mb: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>{t("common.engine")}</InputLabel>
              <Select
                value={ai.activeProvider}
                label={t("common.engine")}
                onChange={(e) =>
                  setAiActiveProvider(
                    e.target.value as
                      | "deepseek"
                      | "doubao"
                      | "openai"
                      | "siliconflow"
                  )
                }
              >
                <MenuItem value="deepseek">DeepSeek</MenuItem>
                <MenuItem value="siliconflow">SiliconFlow</MenuItem>
                <MenuItem value="openai">OpenAI</MenuItem>
                <MenuItem value="doubao">豆包 (Doubao)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Paper
            variant="outlined"
            sx={{
              flexGrow: 1,
              p: 2,
              bgcolor: theme === "dark" ? "grey.900" : "grey.50",
              overflowY: "auto",
              position: "relative",
              "& .markdown-body": {
                fontSize: "0.875rem",
                lineHeight: 1.6,
                "& pre": {
                  bgcolor: theme === "dark" ? "grey.800" : "grey.200",
                  p: 1.5,
                  borderRadius: 1,
                  overflowX: "auto",
                },
                "& code": {
                  fontFamily: "monospace",
                  bgcolor: theme === "dark" ? "grey.800" : "grey.200",
                  px: 0.5,
                  borderRadius: 0.5,
                },
              },
            }}
          >
            {isAiLoading ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  gap: 2,
                }}
              >
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary">
                  {t("tools.nginx_editor.ai_thinking")}
                </Typography>
              </Box>
            ) : aiResponse ? (
              <Box className="markdown-body">
                <ReactMarkdown>{aiResponse}</ReactMarkdown>
              </Box>
            ) : (
              <Stack spacing={2}>
                <Typography variant="subtitle2" color="primary">
                  {t("tools.nginx_editor.ai_preview_content")}
                </Typography>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Config:
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1,
                      mt: 0.5,
                      maxHeight: 200,
                      overflowY: "auto",
                      bgcolor: theme === "dark" ? "grey.800" : "grey.100",
                    }}
                  >
                    <Typography
                      variant="caption"
                      component="pre"
                      sx={{ fontFamily: "monospace" }}
                    >
                      {content}
                    </Typography>
                  </Paper>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Error:
                  </Typography>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1,
                      mt: 0.5,
                      bgcolor: theme === "dark" ? "grey.800" : "grey.100",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: "monospace" }}
                    >
                      {testResult?.message ||
                        t("tools.nginx_editor.ai_no_error")}
                    </Typography>
                  </Paper>
                </Box>
              </Stack>
            )}
          </Paper>

          <Box sx={{ mt: 2 }}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Sparkles size={18} />}
              onClick={handlePerformAiRequest}
              disabled={isAiLoading}
            >
              {t("tools.nginx_editor.ai_send")}
            </Button>
          </Box>
        </Box>
      </Drawer>
    </ToolLayout>
  );
};

export default NginxEditor;

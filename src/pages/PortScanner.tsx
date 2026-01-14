import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  LinearProgress,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { PlayArrow, Stop, CopyAll, Timer, Dns } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ToolLayout } from "../components/layout/ToolLayout";
import { DataTable } from "../components/shared/DataTable";
import { InstructionsCard } from "../components/shared/InstructionsCard";
import { GridColDef } from "@mui/x-data-grid";
import toast from "react-hot-toast";

interface ScanResult {
  port: number;
  status: string;
  service: string;
}

interface ScanProgress {
  current_port: number;
  total_ports: number;
  scanned_count: number;
  result: ScanResult | null;
}

interface PortScannerPayload {
  task_id: string;
  progress: ScanProgress;
  status: string;
}

const COMMON_PORTS = [
  21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 1433, 1521, 3306, 3389, 5432,
  6379, 8080, 27017,
];

export default function PortScanner() {
  const { t } = useTranslation();
  const [host, setHost] = useState("127.0.0.1");
  const [mode, setMode] = useState("common");
  const [startPort, setStartPort] = useState(1);
  const [endPort, setEndPort] = useState(1024);
  const [customPorts, setCustomPorts] = useState("");
  const [timeout, setTimeoutVal] = useState(1);
  const [concurrency, setConcurrency] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [totalPorts, setTotalPorts] = useState(0);
  const [showOpenOnly, setShowOpenOnly] = useState(true);

  const taskId = "port-scanner-task";

  useEffect(() => {
    const unlisten = listen<PortScannerPayload>(
      "port-scanner-progress",
      (event) => {
        const { task_id, progress, status } = event.payload;
        if (task_id === taskId) {
          if (status === "running") {
            if (progress.result) {
              setResults((prev) => [...prev, progress.result!]);
            }
            setScannedCount(progress.scanned_count);
            setTotalPorts(progress.total_ports);
            setProgress((progress.scanned_count / progress.total_ports) * 100);
          } else if (
            status === "finished" ||
            status === "stopped" ||
            status === "error"
          ) {
            setIsRunning(false);
            if (status === "finished")
              toast.success(t("tools.port_scanner.scan_completed"));
            if (status === "stopped")
              toast.error(t("tools.port_scanner.scan_cancelled"));
          }
        }
      }
    );

    return () => {
      unlisten.then((f) => f());
      invoke("stop_port_scan", { taskId });
    };
  }, [t]);

  const startScan = async () => {
    if (!host) {
      toast.error(t("tools.port_scanner.invalid_host"));
      return;
    }

    let ports: number[] = [];
    if (mode === "common") {
      ports = COMMON_PORTS;
    } else if (mode === "range") {
      if (startPort > endPort) {
        toast.error(t("tools.port_scanner.start_port_greater_than_end"));
        return;
      }
      for (let i = startPort; i <= endPort; i++) {
        ports.push(i);
      }
    } else if (mode === "custom") {
      ports = customPorts
        .split(/[, ]+/)
        .map((p) => parseInt(p.trim()))
        .filter((p) => !isNaN(p) && p > 0 && p <= 65535);
      if (ports.length === 0) {
        toast.error(t("tools.port_scanner.invalid_custom_ports"));
        return;
      }
    }

    if (ports.length > 65536) {
      toast.error(t("tools.port_scanner.port_count_limit"));
      return;
    }

    setResults([]);
    setProgress(0);
    setScannedCount(0);
    setTotalPorts(ports.length);
    setIsRunning(true);

    try {
      await invoke("start_port_scan", {
        taskId,
        host,
        ports,
        timeoutMs: timeout * 1000,
        concurrency,
      });
    } catch (error) {
      toast.error(t("tools.port_scanner.scan_failed", { error }));
      setIsRunning(false);
    }
  };

  const stopScan = async () => {
    await invoke("stop_port_scan", { taskId });
  };

  const columns: GridColDef[] = [
    { field: "port", headerName: t("tools.port_scanner.port"), width: 100 },
    {
      field: "status",
      headerName: t("tools.port_scanner.status"),
      width: 120,
      renderCell: (params) => {
        const status = params.value;
        let color: "success" | "error" | "warning" | "default" = "default";
        if (status === "open") color = "success";
        if (status === "closed") color = "error";
        if (status === "timeout") color = "warning";
        return (
          <Chip
            label={t(`tools.port_scanner.${status}`)}
            color={color}
            size="small"
          />
        );
      },
    },
    { field: "service", headerName: t("tools.port_scanner.service"), flex: 1 },
  ];

  const filteredResults = showOpenOnly
    ? results.filter((r) => r.status === "open")
    : results;

  return (
    <ToolLayout title={t("tools.port_scanner.name")}>
      <Box sx={{ p: 3 }}>
        {/* 使用说明卡片 */}
        <InstructionsCard
          title={t("tools.port_scanner.instructions.title")}
          color="blue"
          steps={[
            {
              title: t("tools.port_scanner.instructions.step1_title"),
              description: t("tools.port_scanner.instructions.step1_desc"),
            },
            {
              title: t("tools.port_scanner.instructions.step2_title"),
              description: t("tools.port_scanner.instructions.step2_desc"),
            },
            {
              title: t("tools.port_scanner.instructions.step3_title"),
              description: t("tools.port_scanner.instructions.step3_desc"),
            },
            {
              title: t("tools.port_scanner.instructions.step4_title"),
              description: t("tools.port_scanner.instructions.step4_desc"),
            },
          ]}
        />

        <Paper sx={{ p: 3, my: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label={t("tools.port_scanner.target_host")}
                placeholder={t("tools.port_scanner.target_host_placeholder")}
                value={host}
                onChange={(e) => setHost(e.target.value)}
                disabled={isRunning}
                InputProps={{
                  startAdornment: (
                    <Dns sx={{ mr: 1, color: "text.secondary" }} />
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                type="number"
                label={t("tools.port_scanner.timeout")}
                value={timeout}
                onChange={(e) => setTimeoutVal(Number(e.target.value))}
                disabled={isRunning}
                InputProps={{
                  startAdornment: (
                    <Timer sx={{ mr: 1, color: "text.secondary" }} />
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                type="number"
                label={t("tools.port_scanner.concurrency")}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                disabled={isRunning}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="subtitle2">
                  {t("tools.port_scanner.scan_mode")}:
                </Typography>
                <ToggleButtonGroup
                  value={mode}
                  exclusive
                  onChange={(_, val) => val && setMode(val)}
                  size="small"
                  disabled={isRunning}
                >
                  <ToggleButton value="common">
                    {t("tools.port_scanner.mode_common")}
                  </ToggleButton>
                  <ToggleButton value="range">
                    {t("tools.port_scanner.mode_range")}
                  </ToggleButton>
                  <ToggleButton value="custom">
                    {t("tools.port_scanner.mode_custom")}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Grid>

            {mode === "range" && (
              <>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t("tools.port_scanner.start_port")}
                    value={startPort}
                    onChange={(e) => setStartPort(Number(e.target.value))}
                    disabled={isRunning}
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t("tools.port_scanner.end_port")}
                    value={endPort}
                    onChange={(e) => setEndPort(Number(e.target.value))}
                    disabled={isRunning}
                  />
                </Grid>
              </>
            )}

            {mode === "custom" && (
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label={t("tools.port_scanner.custom_ports")}
                  placeholder={t("tools.port_scanner.custom_ports_placeholder")}
                  value={customPorts}
                  onChange={(e) => setCustomPorts(e.target.value)}
                  disabled={isRunning}
                />
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <Stack direction="row" spacing={2}>
                {!isRunning ? (
                  <Button
                    variant="contained"
                    startIcon={<PlayArrow />}
                    onClick={startScan}
                    size="large"
                  >
                    {t("tools.port_scanner.start_scan")}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Stop />}
                    onClick={stopScan}
                    size="large"
                  >
                    {t("tools.port_scanner.stop_scan")}
                  </Button>
                )}
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {isRunning && (
          <Box sx={{ mb: 3 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography variant="body2" color="text.secondary">
                {t("tools.port_scanner.scanning")} ({scannedCount}/{totalPorts})
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {Math.round(progress)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        <Paper sx={{ p: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">
              {t("tools.port_scanner.open_ports")} (
              {results.filter((r) => r.status === "open").length})
            </Typography>
            <Stack direction="row" spacing={1}>
              <ToggleButtonGroup
                value={showOpenOnly}
                exclusive
                onChange={(_, val) => val !== null && setShowOpenOnly(val)}
                size="small"
              >
                <ToggleButton value={false}>
                  {t("tools.port_scanner.show_all")}
                </ToggleButton>
                <ToggleButton value={true}>
                  {t("tools.port_scanner.show_open_only")}
                </ToggleButton>
              </ToggleButtonGroup>
              <Tooltip title={t("tools.port_scanner.copy_results")}>
                <IconButton
                  onClick={() => {
                    const text = results
                      .filter((r) => r.status === "open")
                      .map((r) => `${r.port}\t${r.service}`)
                      .join("\n");
                    navigator.clipboard.writeText(text);
                    toast.success(t("common.copy_success"));
                  }}
                >
                  <CopyAll />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
          <DataTable
            rows={filteredResults}
            columns={columns}
            getRowId={(row) => row.port}
            autoHeight
          />
        </Paper>
      </Box>
    </ToolLayout>
  );
}

import { Alert, Chip, IconButton, Tab, Tabs } from "@mui/material";
import { Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { formatResponseBody } from "../../lib/httpDebugger";
import type { HttpDebugResponse } from "../../types/httpDebugger";

export function ResponseViewer({ response }: { response: HttpDebugResponse | null }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"body" | "headers">("body");
  const body = useMemo(
    () => response?.bodyText == null ? null : formatResponseBody(response.bodyText, response.contentType),
    [response],
  );

  if (!response) {
    return (
      <section className="flex min-h-0 items-center justify-center rounded-xl border border-(--border-color) bg-(--card-bg) text-(--text-muted)">
        {t("tools.http_debugger.empty_response")}
      </section>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(tab === "body" ? body?.text ?? "" : response.headers.map((item) => `${item.key}: ${item.value}`).join("\n"));
    toast.success(t("tools.http_debugger.copied"));
  };

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-(--border-color) bg-(--card-bg)">
      <div className="flex flex-wrap items-center gap-2 border-b border-(--border-color) p-3">
        <Chip size="small" color={response.status < 400 ? "success" : "error"} label={`${response.status} ${response.reason}`} />
        <Chip size="small" variant="outlined" label={`${response.durationMs} ms`} />
        <Chip size="small" variant="outlined" label={`${response.sizeBytes} B`} />
        <div className="ml-auto"><IconButton size="small" onClick={copy}><Copy size={16} /></IconButton></div>
      </div>
      {response.truncated && <Alert severity="warning">{t("tools.http_debugger.truncated")}</Alert>}
      {response.binary && <Alert severity="info">{t("tools.http_debugger.binary")}</Alert>}
      {body?.parseWarning && <Alert severity="warning">{t("tools.http_debugger.invalid_response_json")}</Alert>}
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth">
        <Tab value="body" label={t("tools.http_debugger.response_body")} />
        <Tab value="headers" label={`${t("tools.http_debugger.headers")} (${response.headers.length})`} />
      </Tabs>
      <pre className="m-0 flex-1 overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs text-(--text-main)">
        {tab === "body" ? body?.text ?? t("tools.http_debugger.no_body") : response.headers.map((item) => `${item.key}: ${item.value}`).join("\n")}
      </pre>
    </section>
  );
}

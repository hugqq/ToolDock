import {
  Alert,
  Button,
  CircularProgress,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from "@mui/material";
import { Send } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  HttpBodyMode,
  HttpDebugRequest,
  HttpDraftErrors,
  HttpMethod,
} from "../../types/httpDebugger";
import { KeyValueEditor } from "./KeyValueEditor";

interface Props {
  request: HttpDebugRequest;
  errors: HttpDraftErrors;
  sending: boolean;
  onChange: (request: HttpDebugRequest) => void;
  onSend: () => void;
}

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const BODY_MODES: HttpBodyMode[] = ["none", "json", "form", "text"];

export function RequestEditor({ request, errors, sending, onChange, onSend }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"query" | "headers" | "body">("query");
  const set = <K extends keyof HttpDebugRequest>(key: K, value: HttpDebugRequest[K]) =>
    onChange({ ...request, [key]: value });

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-(--border-color) bg-(--card-bg)">
      <div className="grid grid-cols-[120px_1fr_auto] gap-2 border-b border-(--border-color) p-3">
        <TextField
          select
          size="small"
          value={request.method}
          onChange={(event) => set("method", event.target.value as HttpMethod)}
        >
          {METHODS.map((method) => <MenuItem key={method} value={method}>{method}</MenuItem>)}
        </TextField>
        <TextField
          size="small"
          value={request.url}
          error={Boolean(errors.url)}
          placeholder="https://api.example.com/v1/items"
          onChange={(event) => set("url", event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !sending) onSend();
          }}
        />
        <Button variant="contained" disabled={sending} onClick={onSend} startIcon={sending ? <CircularProgress size={15} /> : <Send size={16} />}>
          {t("tools.http_debugger.send")}
        </Button>
      </div>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth">
        <Tab value="query" label={t("tools.http_debugger.query")} />
        <Tab value="headers" label={t("tools.http_debugger.headers")} />
        <Tab value="body" label={t("tools.http_debugger.body")} />
      </Tabs>

      <div className="flex-1 overflow-auto p-4">
        {errors.url && <Alert severity="error" className="mb-3">{t(`tools.http_debugger.errors.${errors.url}`)}</Alert>}
        {tab === "query" && <KeyValueEditor rows={request.query} onChange={(rows) => set("query", rows)} />}
        {tab === "headers" && <KeyValueEditor rows={request.headers} onChange={(rows) => set("headers", rows)} />}
        {tab === "body" && (
          <div className="flex flex-col gap-3">
            <TextField
              select
              size="small"
              label={t("tools.http_debugger.body_type")}
              value={request.bodyMode}
              onChange={(event) => set("bodyMode", event.target.value as HttpBodyMode)}
            >
              {BODY_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>{t(`tools.http_debugger.body_modes.${mode}`)}</MenuItem>
              ))}
            </TextField>
            {request.bodyMode === "form" ? (
              <KeyValueEditor rows={request.formFields} onChange={(rows) => set("formFields", rows)} />
            ) : request.bodyMode !== "none" ? (
              <TextField
                multiline
                minRows={10}
                value={request.bodyText}
                error={Boolean(errors.body)}
                helperText={errors.body ? t(`tools.http_debugger.errors.${errors.body}`) : undefined}
                placeholder={request.bodyMode === "json" ? "{\n  \"name\": \"ToolDock\"\n}" : t("tools.http_debugger.raw_body")}
                onChange={(event) => set("bodyText", event.target.value)}
                slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 13 } } }}
              />
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-(--border-color) p-3">
        <TextField
          size="small"
          type="number"
          label={t("tools.http_debugger.timeout")}
          value={request.timeoutMs}
          error={Boolean(errors.timeout)}
          helperText={errors.timeout ? t("tools.http_debugger.errors.out_of_range") : undefined}
          onChange={(event) => set("timeoutMs", Number(event.target.value))}
        />
      </div>
    </section>
  );
}

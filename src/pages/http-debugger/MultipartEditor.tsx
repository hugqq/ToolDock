import { open } from "@tauri-apps/plugin-dialog";
import { Button, Checkbox, IconButton, MenuItem, TextField } from "@mui/material";
import { FileUp, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createMultipartField } from "../../lib/httpDebugger";
import type {
  HttpMultipartField,
  HttpMultipartFieldKind,
} from "../../types/httpDebugger";

interface Props {
  rows: HttpMultipartField[];
  errors?: Record<string, "field_required" | "file_required">;
  onChange: (rows: HttpMultipartField[]) => void;
}

export function MultipartEditor({ rows, errors, onChange }: Props) {
  const { t } = useTranslation();

  const update = (id: string, patch: Partial<HttpMultipartField>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const remove = (id: string) => {
    const remaining = rows.filter((row) => row.id !== id);
    onChange(remaining.length ? remaining : [createMultipartField()]);
  };

  const chooseFile = async (row: HttpMultipartField) => {
    const selected = await open({ directory: false, multiple: false });
    if (typeof selected !== "string") return;

    update(row.id, {
      filePath: selected,
      fileName: selected.split(/[\\/]/).pop() ?? selected,
    });
  };

  const changeKind = (row: HttpMultipartField, kind: HttpMultipartFieldKind) => {
    update(row.id, { kind, value: "", filePath: "", fileName: "" });
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const error = errors?.[row.id];

        return (
          <div
            key={row.id}
            className="grid grid-cols-[36px_minmax(100px,1fr)_100px_36px] items-start gap-2 rounded-lg border border-(--border-color) p-2"
          >
            <Checkbox
              size="small"
              checked={row.enabled}
              onChange={(event) => update(row.id, { enabled: event.target.checked })}
            />
            <TextField
              size="small"
              disabled={!row.enabled}
              value={row.key}
              error={error === "field_required"}
              helperText={error === "field_required" ? t("tools.http_debugger.errors.field_required") : undefined}
              placeholder={t("tools.http_debugger.key")}
              onChange={(event) => update(row.id, { key: event.target.value })}
            />
            <TextField
              select
              size="small"
              disabled={!row.enabled}
              value={row.kind}
              onChange={(event) => changeKind(row, event.target.value as HttpMultipartFieldKind)}
            >
              <MenuItem value="text">{t("tools.http_debugger.multipart.text")}</MenuItem>
              <MenuItem value="file">{t("tools.http_debugger.multipart.file")}</MenuItem>
            </TextField>
            <IconButton
              size="small"
              aria-label={t("common.delete")}
              onClick={() => remove(row.id)}
            >
              <Trash2 size={16} />
            </IconButton>

            {row.kind === "text" ? (
              <TextField
                className="col-span-2 col-start-2"
                size="small"
                disabled={!row.enabled}
                value={row.value}
                placeholder={t("tools.http_debugger.value")}
                onChange={(event) => update(row.id, { value: event.target.value })}
              />
            ) : (
              <div
                className="col-span-2 col-start-2 flex min-w-0 gap-2"
                title={row.filePath}
              >
                <TextField
                  className="min-w-0 flex-1"
                  size="small"
                  disabled
                  value={row.fileName}
                  error={error === "file_required"}
                  helperText={error === "file_required" ? t("tools.http_debugger.errors.file_required") : undefined}
                  placeholder={t("tools.http_debugger.multipart.no_file")}
                />
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!row.enabled}
                  startIcon={<FileUp size={15} />}
                  onClick={() => void chooseFile(row)}
                >
                  {t("tools.http_debugger.multipart.choose_file")}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="self-start flex items-center gap-1 text-sm text-primary hover:opacity-80"
        onClick={() => onChange([...rows, createMultipartField()])}
      >
        <Plus size={15} /> {t("tools.http_debugger.add_row")}
      </button>
    </div>
  );
}

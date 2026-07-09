import { Checkbox, IconButton, TextField } from "@mui/material";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HttpKeyValue } from "../../types/httpDebugger";

interface Props {
  rows: HttpKeyValue[];
  onChange: (rows: HttpKeyValue[]) => void;
}

function emptyRow(): HttpKeyValue {
  return { id: crypto.randomUUID(), enabled: true, key: "", value: "" };
}

export function KeyValueEditor({ rows, onChange }: Props) {
  const { t } = useTranslation();

  const update = (id: string, value: Partial<HttpKeyValue>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...value } : row)));
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[36px_1fr_1fr_36px] gap-2 items-center">
          <Checkbox
            size="small"
            checked={row.enabled}
            onChange={(event) => update(row.id, { enabled: event.target.checked })}
          />
          <TextField
            size="small"
            value={row.key}
            placeholder={t("tools.http_debugger.key")}
            onChange={(event) => update(row.id, { key: event.target.value })}
          />
          <TextField
            size="small"
            value={row.value}
            placeholder={t("tools.http_debugger.value")}
            onChange={(event) => update(row.id, { value: event.target.value })}
          />
          <IconButton
            size="small"
            aria-label={t("common.delete")}
            onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
          >
            <Trash2 size={16} />
          </IconButton>
        </div>
      ))}
      <button
        type="button"
        className="self-start flex items-center gap-1 text-sm text-primary hover:opacity-80"
        onClick={() => onChange([...rows, emptyRow()])}
      >
        <Plus size={15} /> {t("tools.http_debugger.add_row")}
      </button>
    </div>
  );
}

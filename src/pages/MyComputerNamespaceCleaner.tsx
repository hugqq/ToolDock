import {
  CheckSquare,
  MonitorX,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteMyComputerNamespaceIcons,
  listMyComputerNamespaceBackups,
  MyComputerNamespaceBackup,
  MyComputerNamespaceItem,
  restoreMyComputerNamespaceBackup,
  scanMyComputerNamespaceIcons,
} from "../api/myComputerNamespace";
import { Button } from "../components/mui";
import { useModal } from "../components/ModalContext";
import { ToolLayout } from "../components/layout/ToolLayout";
import { isSuspiciousNamespaceIcon } from "../lib/myComputerNamespace";

type Row = MyComputerNamespaceItem & {
  checked: boolean;
  suspicious: boolean;
};

export default function MyComputerNamespaceCleaner() {
  const { t } = useTranslation();
  const { confirm } = useModal();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState(t("common.ready"));
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupPath, setBackupPath] = useState("");
  const [backups, setBackups] = useState<MyComputerNamespaceBackup[]>([]);

  const selectedRows = useMemo(() => rows.filter((row) => row.checked), [rows]);
  const suspiciousCount = rows.filter((row) => row.suspicious).length;
  const allChecked = rows.length > 0 && rows.every((row) => row.checked);

  const loadBackups = async () => {
    const response = await listMyComputerNamespaceBackups();
    if (response.ok) {
      setBackups(response.data);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    setStatus("正在扫描此电脑图标注册表项...");
    const [response] = await Promise.all([
      scanMyComputerNamespaceIcons(),
      loadBackups(),
    ]);

    if (response.ok) {
      const nextRows = response.data.map((item) => {
        const searchableText = [
          item.display_name,
          item.namespace_value,
          item.clsid_value,
          item.target,
        ]
          .filter(Boolean)
          .join(" ");
        const suspicious = isSuspiciousNamespaceIcon(searchableText);

        return {
          ...item,
          suspicious,
          checked: suspicious,
        };
      });

      setRows(nextRows);
      setStatus(`扫描完成，找到 ${nextRows.length} 个项目`);
    } else {
      setStatus(`扫描失败：${response.message}`);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const toggleAll = () => {
    setRows((current) =>
      current.map((row) => ({ ...row, checked: !allChecked }))
    );
  };

  const toggleRow = (keyName: string) => {
    setRows((current) =>
      current.map((row) =>
        row.key_name === keyName ? { ...row, checked: !row.checked } : row
      )
    );
  };

  const deleteSelected = async () => {
    if (selectedRows.length === 0) return;

    const confirmed = await confirm({
      title: "删除此电脑图标",
      message: `将删除 ${selectedRows.length} 个注册表子项。删除前会自动导出备份，但仍建议确认这些图标确实不需要。`,
      type: "warning",
    });

    if (!confirmed) return;

    setDeleting(true);
    setStatus("正在备份并删除注册表项...");

    const response = await deleteMyComputerNamespaceIcons(
      selectedRows.map((row) => row.key_name)
    );

    if (response.ok) {
      setBackupPath(response.data.backup_path);
      await loadBackups();
      setRows((current) =>
        current.filter(
          (row) => !selectedRows.some((selected) => selected.key_name === row.key_name)
        )
      );
      setStatus(
        `已删除 ${response.data.deleted_count} 个项目，备份已保存：${response.data.backup_path}`
      );
    } else {
      setStatus(`删除失败：${response.message}`);
    }

    setDeleting(false);
  };

  const restoreBackup = async (backup: MyComputerNamespaceBackup) => {
    const confirmed = await confirm({
      title: "恢复此电脑图标",
      message:
        "将导入这份注册表备份，恢复到当时的 NameSpace 状态。恢复后请重新打开“此电脑”查看效果。",
      type: "warning",
    });

    if (!confirmed) return;

    setRestoring(true);
    setStatus("正在恢复注册表备份...");
    const response = await restoreMyComputerNamespaceBackup(backup.path);

    if (response.ok) {
      setStatus("恢复完成，请重新打开“此电脑”查看效果");
      await loadItems();
    } else {
      setStatus(`恢复失败：${response.message}`);
    }

    setRestoring(false);
  };

  const formatBackupTime = (backup: MyComputerNamespaceBackup) => {
    if (!backup.modified_at) return "未知时间";
    return new Date(backup.modified_at).toLocaleString();
  };

  return (
    <ToolLayout
      title={t("tools.my_computer_namespace.name")}
      status={status}
    >
      <div className="flex flex-col gap-5 pb-6">
        {backupPath && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-600 break-all">
            备份文件：{backupPath}
          </div>
        )}

        <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-(--border-color) flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-(--text-main)">备份恢复</h3>
              <p className="text-xs text-(--text-muted) mt-1">
                删除前自动生成的备份可在这里恢复
              </p>
            </div>
            <Button
              variant="outlined"
              size="small"
              onClick={loadBackups}
              disabled={loading || deleting || restoring}
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} />
              刷新备份
            </Button>
          </div>

          {backups.length > 0 ? (
            <div className="divide-y divide-(--border-color)">
              {backups.map((backup) => (
                <div
                  key={backup.path}
                  className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 hover:bg-(--bg-main)"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-(--text-main) truncate">
                      {backup.file_name}
                    </div>
                    <div className="text-xs text-(--text-muted) mt-1 break-all">
                      {formatBackupTime(backup)} · {backup.path}
                    </div>
                  </div>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => restoreBackup(backup)}
                    disabled={loading || deleting || restoring}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw size={16} />
                    恢复
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 text-sm text-(--text-muted)">
              暂无可恢复备份。执行删除后会自动生成备份。
            </div>
          )}
        </div>

        <div className="bg-(--card-bg) rounded-2xl border border-(--border-color) shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-(--border-color) flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-(--text-main)">注册表项目</h3>
              <p className="text-xs text-(--text-muted) mt-1">
                已自动勾选 {suspiciousCount} 个疑似第三方应用项目
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outlined"
                size="small"
                onClick={loadItems}
                disabled={loading || deleting || restoring}
                className="flex items-center gap-2"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                刷新
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={toggleAll}
                disabled={rows.length === 0 || loading || deleting}
                className="flex items-center gap-2"
              >
                {allChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                全选
              </Button>
              <Button
                color="error"
                size="small"
                onClick={deleteSelected}
                disabled={selectedRows.length === 0 || loading || deleting}
                className="flex items-center gap-2"
              >
                <Trash2 size={16} />
                删除选中 ({selectedRows.length})
              </Button>
            </div>
          </div>

          {rows.length > 0 ? (
            <div className="overflow-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-(--bg-main) border-b border-(--border-color)">
                  <tr>
                    <th className="w-12 px-5 py-3"></th>
                    <th className="px-5 py-3 text-xs font-bold text-(--text-muted) uppercase">
                      名称
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-(--text-muted) uppercase">
                      注册表子项
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-(--text-muted) uppercase">
                      识别结果
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border-color)">
                  {rows.map((row) => (
                    <tr key={row.key_name} className="hover:bg-(--bg-main)">
                      <td className="px-5 py-4">
                        <button
                          onClick={() => toggleRow(row.key_name)}
                          disabled={deleting}
                          className="text-primary disabled:opacity-50"
                          title="选择"
                        >
                          {row.checked ? (
                            <CheckSquare size={18} />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-(--text-main)">
                          {row.display_name}
                        </div>
                        {row.target && (
                          <div className="text-xs text-(--text-muted) mt-1 break-all">
                            {row.target}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-(--text-muted)">
                        {row.key_name}
                      </td>
                      <td className="px-5 py-4">
                        {row.suspicious ? (
                          <span className="inline-flex items-center rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-500">
                            疑似第三方图标
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-(--bg-main) px-3 py-1 text-xs font-medium text-(--text-muted)">
                            未自动判断
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <MonitorX size={42} className="text-primary/40 mb-4" />
              <h3 className="font-bold text-(--text-main) mb-2">
                {loading ? "正在扫描..." : "没有找到项目"}
              </h3>
              <p className="text-sm text-(--text-muted)">
                如果刚删除过图标，请重新打开“此电脑”查看效果。
              </p>
            </div>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}

import { invokeWrapper } from "./index";

export interface MyComputerNamespaceItem {
  key_name: string;
  display_name: string;
  namespace_value?: string;
  clsid_value?: string;
  target?: string;
}

export interface DeleteMyComputerNamespaceResult {
  deleted_count: number;
  failed_items: string[];
  backup_path: string;
}

export interface MyComputerNamespaceBackup {
  path: string;
  file_name: string;
  modified_at?: number;
}

export async function scanMyComputerNamespaceIcons() {
  return invokeWrapper<MyComputerNamespaceItem[]>(
    "scan_my_computer_namespace_icons"
  );
}

export async function deleteMyComputerNamespaceIcons(keyNames: string[]) {
  return invokeWrapper<DeleteMyComputerNamespaceResult>(
    "delete_my_computer_namespace_icons",
    { keyNames }
  );
}

export async function listMyComputerNamespaceBackups() {
  return invokeWrapper<MyComputerNamespaceBackup[]>(
    "list_my_computer_namespace_backups"
  );
}

export async function restoreMyComputerNamespaceBackup(backupPath: string) {
  return invokeWrapper<void>("restore_my_computer_namespace_backup", {
    backupPath,
  });
}

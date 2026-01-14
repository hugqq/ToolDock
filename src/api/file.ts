import { invokeWrapper } from "./index";
import { PkgManagerStatus } from "../types";

export interface FolderInfo {
  path: string;
  name: string;
  size: number;
  is_dir: boolean;
}

export async function scanFolderSize(path: string) {
  return invokeWrapper<FolderInfo[]>("scan_folder_size", { path });
}

export async function stopScan() {
  return invokeWrapper<void>("stop_scan");
}

export async function deleteItem(path: string) {
  return invokeWrapper<void>("delete_item", { path });
}

export async function scanNodeModules(path: string) {
  return invokeWrapper<FolderInfo[]>("scan_node_modules", { path });
}

export async function deleteNodeModules(path: string) {
  return invokeWrapper<void>("delete_node_modules", { path });
}

export interface NvmVersion {
  version: string;
  is_current: boolean;
}

export async function listNvmVersions() {
  return invokeWrapper<NvmVersion[]>("list_nvm_versions");
}

export async function useNvmVersion(version: string) {
  return invokeWrapper<void>("use_nvm_version", { version });
}

export async function installNvmVersion(version: string) {
  return invokeWrapper<void>("install_nvm_version", { version });
}

export async function uninstallNvmVersion(version: string) {
  return invokeWrapper<void>("uninstall_nvm_version", { version });
}

export async function pnpmInstall(path: string) {
  return invokeWrapper<void>("pnpm_install", { path });
}

export async function pkgInstall(path: string, command: string) {
  return invokeWrapper<void>("pkg_install", { path, command });
}

export async function checkPkgManagers() {
  return invokeWrapper<PkgManagerStatus>("check_pkg_managers");
}

export interface CleanItem {
  name: string;
  path: string;
  size: number;
  category: string;
  requires_admin: boolean;
}

export interface ScanResult {
  items: CleanItem[];
  total_size: number;
  recycle_bin_size: number;
}

export interface DeleteResult {
  deleted_size: number;
  deleted_count: number;
  failed_count: number;
  failed_paths: string[];
}

export async function scanCleanableFiles() {
  return invokeWrapper<ScanResult>("scan_cleanable_files");
}

export async function cleanFiles(paths: string[]) {
  return invokeWrapper<DeleteResult>("clean_files", { paths });
}

export async function emptyRecycleBin() {
  return invokeWrapper<void>("empty_recycle_bin");
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

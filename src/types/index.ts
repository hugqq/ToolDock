export interface PkgManagerStatus {
  npm: boolean;
  pnpm: boolean;
  yarn: boolean;
  bun: boolean;
  deno: boolean;
}

export interface Candidate {
  pid: number;
  name?: string;
  exe_path?: string;
  window_title?: string;
  visible?: boolean;
  score?: number;
}

export interface ModuleInfo {
  name?: string;
  path?: string;
}

export interface DriverInfo {
  name?: string;
  path?: string;
}

export interface ProcessInfo {
  pid: number;
  name?: string;
  exe_path?: string;
  cmd?: string;
}

export interface DiagnosticPackage {
  processes: ProcessInfo[];
  modules: ModuleInfo[];
  drivers: DriverInfo[];
  ports: any[];
  windows: Candidate[];
  event_log_json?: string;
}

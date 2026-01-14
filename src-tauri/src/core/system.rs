use crate::errors::{AppError, AppResult};
use crate::models::system::{
    CpuInfo, DiskInfo, DiskSpeedResult, GpuInfo, MemoryInfo, NetworkInfo, OsInfo, RamStickInfo,
    SensorInfo, SystemInfo, WifiInfo,
};
use serde_json;
use std::ffi::OsStr;
use std::fs::OpenOptions;
use std::io::{Read, Seek, SeekFrom, Write};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::process::CommandExt;
use std::ptr;
use std::time::Instant;
use sysinfo::{Components, Disks, Networks, RefreshKind, System};
use winapi::shared::minwindef::{DWORD, UINT};
use winapi::shared::winerror::ERROR_SUCCESS;
use winapi::um::restartmanager::*;

/// 获取系统详细信息
pub fn get_system_info() -> AppResult<SystemInfo> {
    let mut sys = System::new_with_specifics(RefreshKind::everything());

    // 等待一小段时间以获取准确的 CPU 使用率
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let os_info = OsInfo {
        name: System::name().unwrap_or_default(),
        version: System::os_version().unwrap_or_default(),
        kernel_version: System::kernel_version().unwrap_or_default(),
        hostname: System::host_name().unwrap_or_default(),
    };

    let cpu_info = CpuInfo {
        model: sys
            .cpus()
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_default(),
        cores: sys.cpus().len(),
        usage: sys.global_cpu_usage(),
    };

    let memory_info = MemoryInfo {
        total: sys.total_memory(),
        used: sys.used_memory(),
        free: sys.free_memory(),
        sticks: get_ram_sticks(),
    };

    let gpus = get_gpu_info();
    let sensors = get_sensor_info();

    let usage_times = get_disk_usage_times();
    let disks = Disks::new_with_refreshed_list();
    let disk_infos = disks
        .iter()
        .map(|d| {
            let mount_point = d.mount_point().to_string_lossy().to_string();
            let usage_time = usage_times.get(&mount_point).cloned();
            DiskInfo {
                name: d.name().to_string_lossy().to_string(),
                disk_type: format!("{:?}", d.kind()),
                total: d.total_space(),
                available: d.available_space(),
                mount_point,
                usage_time,
            }
        })
        .collect();

    let networks = Networks::new_with_refreshed_list();
    let network_infos = networks
        .iter()
        .map(|(name, data)| NetworkInfo {
            name: name.clone(),
            ip: data
                .ip_networks()
                .iter()
                .map(|ip| ip.to_string())
                .collect::<Vec<_>>()
                .join(", "),
            mac: data.mac_address().to_string(),
        })
        .collect();

    let public_ip = get_public_ip();
    let proxy_ip = get_proxy_info();
    let wifi = get_current_wifi_info();

    Ok(SystemInfo {
        os: os_info,
        cpu: cpu_info,
        memory: memory_info,
        gpus,
        sensors,
        disks: disk_infos,
        networks: network_infos,
        wifi,
        public_ip,
        proxy_ip,
        uptime: System::uptime(),
    })
}

fn get_gpu_info() -> Vec<GpuInfo> {
    let mut gpus = Vec::new();

    // 使用 PowerShell 脚本统一获取显卡信息
    // 1. 从注册表获取 DirectX 适配器信息 (名称, LUID, 总显存)
    // 2. 从性能计数器获取实时显存占用，并通过 LUID 进行精确匹配
    let combined_output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-NoLogo",
            "-ExecutionPolicy", "Bypass",
            "-WindowStyle", "Hidden",
            "-Command",
            r#"
            $res = @()
            # 获取非虚拟显卡的 DirectX 适配器信息
            $dx = Get-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\DirectX\*' | Where-Object { $_.Description -ne 'Microsoft Basic Render Driver' -and $_.AdapterLuid -ne $null }
            # 获取显存性能计数器
            $counters = Get-Counter '\GPU Adapter Memory(*)\Dedicated Usage' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CounterSamples
            foreach ($adapter in $dx) {
                $usage = 0
                # 将 LUID 转换为十六进制格式以匹配性能计数器路径 (例如 0x0000f255)
                $luidHex = "0x{0:x8}" -f $adapter.AdapterLuid
                foreach ($c in $counters) {
                    if ($c.Path -like "*$luidHex*") {
                        $usage = $c.CookedValue
                        break
                    }
                }
                $res += [PSCustomObject]@{
                    name = $adapter.Description
                    total = $adapter.DedicatedVideoMemory
                    used = $usage
                }
            }
            $res | ConvertTo-Json
            "#
        ])
        .creation_flags(0x08000000 | 0x00000200)
        .output();

    if let Ok(output) = combined_output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
            let items = if json.is_array() {
                json.as_array().unwrap().clone()
            } else if json.is_object() {
                vec![json]
            } else {
                vec![]
            };

            for item in items {
                gpus.push(GpuInfo {
                    name: item["name"].as_str().unwrap_or("Unknown GPU").to_string(),
                    memory_total: item["total"].as_u64().unwrap_or(0),
                    memory_used: item["used"].as_u64().unwrap_or(0),
                    temperature: None,
                    fan_speed: None,
                });
            }
        }
    }

    // 3. 如果是 NVIDIA GPU，尝试使用 nvidia-smi 获取温度和风扇 (覆盖显存信息以获取更高精度)
    if gpus
        .iter()
        .any(|g| g.name.to_lowercase().contains("nvidia"))
    {
        let output = std::process::Command::new("nvidia-smi")
            .args([
                "--query-gpu=name,memory.total,memory.used,temperature.gpu,fan.speed",
                "--format=csv,noheader,nounits",
            ])
            .creation_flags(0x08000000)
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                if parts.len() >= 5 {
                    let smi_name = parts[0].to_lowercase();
                    if let Some(gpu) = gpus.iter_mut().find(|g| {
                        let g_name = g.name.to_lowercase();
                        g_name.contains(&smi_name)
                            || smi_name.contains(&g_name)
                            || g_name.contains("nvidia")
                    }) {
                        // nvidia-smi 返回的是 MiB，转换为 Bytes
                        let total_bytes = parts[1].parse::<u64>().unwrap_or(0) * 1024 * 1024;
                        let used_bytes = parts[2].parse::<u64>().unwrap_or(0) * 1024 * 1024;

                        if total_bytes > 0 {
                            gpu.memory_total = total_bytes;
                        }
                        // 只有当 nvidia-smi 返回非零使用量时才覆盖，因为有时它在休眠时返回 0
                        if used_bytes > 0 {
                            gpu.memory_used = used_bytes;
                        }

                        gpu.temperature = parts[3].parse::<f32>().ok();
                        gpu.fan_speed = parts[4].parse::<u32>().ok();
                    }
                }
            }
        }
    }

    // 去重：根据显卡名称和总显存进行去重，保留显存使用量最大的那个条目
    let mut unique_gpus: Vec<GpuInfo> = Vec::new();
    for gpu in gpus {
        if let Some(existing) = unique_gpus
            .iter_mut()
            .find(|g| g.name == gpu.name && g.memory_total == gpu.memory_total)
        {
            // 如果找到重复的，保留显存使用量较大的那个（通常更准确）
            if gpu.memory_used > existing.memory_used {
                existing.memory_used = gpu.memory_used;
            }
            // 合并温度和风扇信息
            if existing.temperature.is_none() && gpu.temperature.is_some() {
                existing.temperature = gpu.temperature;
            }
            if existing.fan_speed.is_none() && gpu.fan_speed.is_some() {
                existing.fan_speed = gpu.fan_speed;
            }
        } else {
            unique_gpus.push(gpu);
        }
    }

    unique_gpus
}

fn get_sensor_info() -> SensorInfo {
    let mut cpu_temp: Option<f32> = None;
    let mut mb_temp: Option<f32> = None;

    // 尝试使用 sysinfo 获取温度
    let components = Components::new_with_refreshed_list();
    for component in components.iter() {
        let label = component.label().to_lowercase();
        if label.contains("cpu") || label.contains("core") || label.contains("package") {
            if let Some(temp) = component.temperature() {
                cpu_temp = Some(temp);
            }
        } else if label.contains("motherboard")
            || label.contains("mainboard")
            || label.contains("temp")
        {
            if let Some(temp) = component.temperature() {
                mb_temp = Some(temp);
            }
        }
    }

    // 如果 sysinfo 没拿到，尝试 PowerShell (需要管理员权限)
    if cpu_temp.is_none() {
        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-NoLogo",
                "-ExecutionPolicy", "Bypass",
                "-WindowStyle", "Hidden",
                "-Command", 
                "Get-CimInstance -Namespace root/wmi -ClassName MsAcpi_ThermalZoneTemperature | Select-Object -ExpandProperty CurrentTemperature"
            ])
            .creation_flags(0x08000000 | 0x00000200)
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if let Ok(temp_raw) = stdout.parse::<f32>() {
                // WMI 返回的是 0.1 开尔文
                cpu_temp = Some((temp_raw / 10.0) - 273.15);
            }
        }
    }

    SensorInfo { cpu_temp, mb_temp }
}

fn get_public_ip() -> Option<String> {
    // 使用 reqwest blocking 客户端在同步上下文中请求，避免被安全软件拦截
    // 注意：此函数必须在 spawn_blocking 或同步上下文中调用
    let result = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .ok()?
        .get("https://api.ipify.org")
        .send()
        .ok()?
        .text()
        .ok()?;

    if !result.is_empty() {
        Some(result.trim().to_string())
    } else {
        None
    }
}

fn get_proxy_info() -> Option<String> {
    // 检查注册表中的代理设置
    let output = std::process::Command::new("reg")
        .args([
            "query",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
            "/v",
            "ProxyServer",
        ])
        .creation_flags(0x08000000)
        .output();

    if let Ok(output) = output {
        let result = String::from_utf8_lossy(&output.stdout);
        // 结果格式通常为: ProxyServer    REG_SZ    127.0.0.1:7890
        if let Some(line) = result.lines().find(|l| l.contains("ProxyServer")) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                return Some(parts[2].to_string());
            }
        }
    }
    None
}

fn get_ram_sticks() -> Vec<RamStickInfo> {
    let script = "Get-CimInstance Win32_PhysicalMemory | Select-Object Manufacturer, Speed, Capacity, SMBIOSMemoryType | ConvertTo-Json";
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-NoLogo",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            script,
        ])
        .creation_flags(0x08000000 | 0x00000200)
        .output();

    if let Ok(output) = output {
        let json_str = String::from_utf8_lossy(&output.stdout);
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
            let items = if val.is_array() {
                val.as_array().unwrap().clone()
            } else if val.is_object() {
                vec![val]
            } else {
                vec![]
            };

            return items
                .iter()
                .map(|item| {
                    let manufacturer = item["Manufacturer"]
                        .as_str()
                        .unwrap_or("Unknown")
                        .trim()
                        .to_string();
                    let speed = item["Speed"].as_u64().unwrap_or(0) as u32;
                    let capacity = item["Capacity"].as_u64().unwrap_or(0);
                    let type_code = item["SMBIOSMemoryType"].as_u64().unwrap_or(0);

                    let memory_type = match type_code {
                        20 => "DDR",
                        21 => "DDR2",
                        24 => "DDR3",
                        26 => "DDR4",
                        34 => "DDR5",
                        _ => "Unknown",
                    }
                    .to_string();

                    RamStickInfo {
                        manufacturer,
                        speed,
                        capacity,
                        memory_type,
                    }
                })
                .collect();
        }
    }
    vec![]
}

/// 寻找占用指定文件的进程 PID 列表
pub fn find_occupying_processes(file_path: &str) -> AppResult<Vec<u32>> {
    // 1. 规范化路径 (处理长路径前缀和斜杠)
    let mut target_path = file_path.trim_start_matches(r"\\?\").replace("/", "\\");

    // 2. 如果是快捷方式 (.lnk)，尝试解析其真实目标路径
    if target_path.to_lowercase().ends_with(".lnk") {
        let script = format!(
            "$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut('{}'); $shortcut.TargetPath",
            target_path.replace("'", "''")
        );
        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-NoLogo",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &script,
            ])
            .creation_flags(0x08000000 | 0x00000200)
            .output();

        if let Ok(output) = output {
            let resolved = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !resolved.is_empty() {
                target_path = resolved;
            }
        }
    }

    let mut session_handle: DWORD = 0;
    let mut session_key = [0u16; CCH_RM_SESSION_KEY + 1];

    // 3. 开始会话
    let res = unsafe { RmStartSession(&mut session_handle, 0, session_key.as_mut_ptr()) };

    if res != ERROR_SUCCESS {
        return Err(AppError::Internal(format!(
            "RmStartSession failed with error {}",
            res
        )));
    }

    // 确保会话最后关闭
    let _guard = scopeguard::guard(session_handle, |h| {
        unsafe { RmEndSession(h) };
    });

    // 4. 注册资源
    let wide_path: Vec<u16> = OsStr::new(&target_path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut paths = [wide_path.as_ptr()];

    let res = unsafe {
        RmRegisterResources(
            session_handle,
            1,
            paths.as_mut_ptr(),
            0,
            ptr::null_mut(),
            0,
            ptr::null_mut(),
        )
    };

    if res != ERROR_SUCCESS {
        return Err(AppError::Internal(format!(
            "RmRegisterResources failed with error {}",
            res
        )));
    }

    // 5. 获取占用列表
    let mut n_proc_info_needed: UINT = 0;
    let mut n_proc_info: UINT = 0;
    let mut reboot_reasons: DWORD = 0;

    // 第一次调用获取所需大小
    let res = unsafe {
        RmGetList(
            session_handle,
            &mut n_proc_info_needed,
            &mut n_proc_info,
            ptr::null_mut(),
            &mut reboot_reasons,
        )
    };

    if res != ERROR_SUCCESS && res != winapi::shared::winerror::ERROR_MORE_DATA {
        // 如果 RM 失败，我们依然继续尝试 PowerShell 方式
    } else if n_proc_info_needed > 0 {
        n_proc_info = n_proc_info_needed;
        let mut proc_info =
            vec![unsafe { std::mem::zeroed::<RM_PROCESS_INFO>() }; n_proc_info as usize];

        let res = unsafe {
            RmGetList(
                session_handle,
                &mut n_proc_info_needed,
                &mut n_proc_info,
                proc_info.as_mut_ptr(),
                &mut reboot_reasons,
            )
        };

        if res == ERROR_SUCCESS {
            let pids: Vec<u32> = proc_info
                .iter()
                .take(n_proc_info as usize)
                .map(|p| p.Process.dwProcessId)
                .collect();
            // 如果已经通过 RM 找到了 PID，可以直接返回，或者继续合并 PowerShell 的结果
            if !pids.is_empty() {
                return Ok(pids);
            }
        }
    }

    let mut pids: Vec<u32> = Vec::new();

    // 6. 兜底方案：如果是 .exe 文件，检查是否有进程正在运行该路径
    if target_path.to_lowercase().ends_with(".exe") {
        // 使用更健壮的 PowerShell 查询，同时匹配路径和文件名
        let filename = std::path::Path::new(&target_path)
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("");

        let script = format!(
            "Get-Process | Where-Object {{ $_.Path -eq '{}' -or $_.Name -eq '{}' -or $_.ProcessName -eq '{}' }} | Select-Object -ExpandProperty Id",
            target_path.replace("'", "''"),
            filename.replace(".exe", ""),
            filename.replace(".exe", "")
        );

        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-NoLogo",
                "-ExecutionPolicy",
                "Bypass",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &script,
            ])
            .creation_flags(0x08000000 | 0x00000200)
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if let Ok(pid) = line.trim().parse::<u32>() {
                    if !pids.contains(&pid) {
                        pids.push(pid);
                    }
                }
            }
        }
    }

    Ok(pids)
}

/// 检查当前是否以管理员权限运行
pub fn is_admin() -> bool {
    // 直接声明 Windows API，避免 winapi 库路径问题
    #[link(name = "shell32")]
    extern "system" {
        fn IsUserAnAdmin() -> i32;
    }
    unsafe { IsUserAnAdmin() != 0 }
}

/// 测试磁盘读写速度
pub fn test_disk_speed(mount_point: &str) -> AppResult<DiskSpeedResult> {
    // 确保路径以分隔符结尾，避免 Windows 下 C:file 这种相对路径问题
    let base_path = if mount_point.ends_with('\\') || mount_point.ends_with('/') {
        mount_point.to_string()
    } else {
        format!("{}\\", mount_point)
    };

    let test_file_path = std::path::Path::new(&base_path).join(".tooldock_speed_test");

    // 50MB 用于顺序测试 (减少大小以加快反馈)
    let seq_size = 50 * 1024 * 1024;
    let data = vec![0u8; 1024 * 1024]; // 1MB 缓冲区

    // 顺序写入
    let start = Instant::now();
    {
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&test_file_path)
            .map_err(|e| {
                tracing::error!("Failed to create test file at {:?}: {}", test_file_path, e);
                AppError::Internal(format!(
                    "无法创建测试文件: {}。请尝试以管理员身份运行，或检查磁盘权限。",
                    e
                ))
            })?;
        for _ in 0..50 {
            file.write_all(&data)
                .map_err(|e| AppError::Internal(format!("写入失败: {}", e)))?;
        }
        file.sync_all()
            .map_err(|e| AppError::Internal(format!("同步失败: {}", e)))?;
    }
    let seq_write_speed = (seq_size as f64 / 1024.0 / 1024.0) / start.elapsed().as_secs_f64();

    // 顺序读取
    let start = Instant::now();
    {
        let mut file = OpenOptions::new()
            .read(true)
            .open(&test_file_path)
            .map_err(|e| AppError::Internal(format!("无法打开测试文件进行读取: {}", e)))?;
        let mut buffer = vec![0u8; 1024 * 1024];
        while file
            .read(&mut buffer)
            .map_err(|e| AppError::Internal(format!("读取失败: {}", e)))?
            > 0
        {}
    }
    let seq_read_speed = (seq_size as f64 / 1024.0 / 1024.0) / start.elapsed().as_secs_f64();

    // 4K 随机测试 (5MB 总量, 1280 次操作)
    let rand_ops = 1280;
    let block_size = 4096;
    let mut rand_data = vec![0u8; block_size];

    // 随机写入
    let start = Instant::now();
    {
        let mut file = OpenOptions::new()
            .write(true)
            .open(&test_file_path)
            .map_err(|e| AppError::Internal(format!("无法打开测试文件进行随机写入: {}", e)))?;
        for i in 0..rand_ops {
            let offset = (i * block_size) as u64;
            file.seek(SeekFrom::Start(offset))
                .map_err(|e| AppError::Internal(format!("Seek 失败: {}", e)))?;
            file.write_all(&rand_data)
                .map_err(|e| AppError::Internal(format!("随机写入失败: {}", e)))?;
        }
        file.sync_all()
            .map_err(|e| AppError::Internal(format!("同步失败: {}", e)))?;
    }
    let rand_write_speed =
        (rand_ops as f64 * block_size as f64 / 1024.0 / 1024.0) / start.elapsed().as_secs_f64();

    // 随机读取
    let start = Instant::now();
    {
        let mut file = OpenOptions::new()
            .read(true)
            .open(&test_file_path)
            .map_err(|e| AppError::Internal(format!("无法打开测试文件进行随机读取: {}", e)))?;
        for i in 0..rand_ops {
            let offset = (i * block_size) as u64;
            file.seek(SeekFrom::Start(offset))
                .map_err(|e| AppError::Internal(format!("Seek 失败: {}", e)))?;
            file.read_exact(&mut rand_data)
                .map_err(|e| AppError::Internal(format!("随机读取失败: {}", e)))?;
        }
    }
    let rand_read_speed =
        (rand_ops as f64 * block_size as f64 / 1024.0 / 1024.0) / start.elapsed().as_secs_f64();

    // 清理
    let _ = std::fs::remove_file(&test_file_path);

    Ok(DiskSpeedResult {
        seq_read: seq_read_speed,
        seq_write: seq_write_speed,
        rand_4k_read: rand_read_speed,
        rand_4k_write: rand_write_speed,
    })
}

fn get_disk_usage_times() -> std::collections::HashMap<String, u64> {
    let mut map = std::collections::HashMap::new();
    let script = "Get-PhysicalDisk | Select-Object DeviceId, PowerOnHours | ConvertTo-Json";
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-NoLogo",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            script,
        ])
        .creation_flags(0x08000000 | 0x00000200)
        .output();

    if let Ok(output) = output {
        let json_str = String::from_utf8_lossy(&output.stdout);
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
            let items = if val.is_array() {
                val.as_array().unwrap().clone()
            } else if val.is_object() {
                vec![val]
            } else {
                vec![]
            };

            for item in items {
                let device_id = item["DeviceId"].as_str().unwrap_or_default().to_string();
                let hours = item["PowerOnHours"].as_u64().unwrap_or(0);
                if !device_id.is_empty() {
                    map.insert(device_id, hours);
                }
            }
        }
    }

    let script = "Get-Partition | Where-Object DriveLetter -ne '' | Select-Object DriveLetter, DiskNumber | ConvertTo-Json";
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-NoLogo",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-Command",
            script,
        ])
        .creation_flags(0x08000000 | 0x00000200)
        .output();

    let mut drive_to_disk = std::collections::HashMap::new();
    if let Ok(output) = output {
        let json_str = String::from_utf8_lossy(&output.stdout);
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
            let items = if val.is_array() {
                val.as_array().unwrap().clone()
            } else if val.is_object() {
                vec![val]
            } else {
                vec![]
            };
            for item in items {
                let letter = item["DriveLetter"].as_str().unwrap_or_default().to_string();
                let disk_num = item["DiskNumber"].as_u64().unwrap_or(0).to_string();
                if !letter.is_empty() {
                    drive_to_disk.insert(format!("{}:\\", letter), disk_num);
                }
            }
        }
    }

    let mut result = std::collections::HashMap::new();
    for (mount, disk_id) in drive_to_disk {
        if let Some(&hours) = map.get(&disk_id) {
            result.insert(mount, hours);
        }
    }

    result
}

/// 获取当前连接的WiFi信息（SSID和密码）
fn get_current_wifi_info() -> Option<WifiInfo> {
    // 1. 获取当前连接的WiFi SSID
    let ssid_output = std::process::Command::new("netsh")
        .args(["wlan", "show", "interfaces"])
        .creation_flags(0x08000000)
        .output()
        .ok()?;

    let ssid_text = String::from_utf8_lossy(&ssid_output.stdout);
    let mut current_ssid = None;
    let mut signal = None;
    let mut auth = None;

    for line in ssid_text.lines() {
        let line = line.trim();
        if line.starts_with("SSID") && !line.contains("BSSID") {
            if let Some(ssid) = line.split(':').nth(1) {
                current_ssid = Some(ssid.trim().to_string());
            }
        } else if line.starts_with("Signal") || line.starts_with("信号") {
            if let Some(sig_str) = line.split(':').nth(1) {
                let sig_str = sig_str.trim().replace("%", "");
                signal = sig_str.parse::<u8>().ok();
            }
        } else if line.starts_with("Authentication") || line.starts_with("身份验证") {
            if let Some(auth_str) = line.split(':').nth(1) {
                auth = Some(auth_str.trim().to_string());
            }
        }
    }

    let ssid = current_ssid?;

    // 2. 获取WiFi密码
    let password_output = std::process::Command::new("netsh")
        .args([
            "wlan",
            "show",
            "profile",
            &format!("name={}", ssid),
            "key=clear",
        ])
        .creation_flags(0x08000000)
        .output()
        .ok()?;

    let password_text = String::from_utf8_lossy(&password_output.stdout);
    let mut password = None;

    for line in password_text.lines() {
        let line = line.trim();
        // 匹配 "Key Content" 或 "关键内容"
        if line.contains("Key Content") || line.contains("关键内容") {
            if let Some(pwd) = line.split(':').nth(1) {
                password = Some(pwd.trim().to_string());
                break;
            }
        }
    }

    Some(WifiInfo {
        ssid,
        password,
        signal,
        auth,
    })
}

mod scopeguard {
    pub struct Guard<T, F: FnOnce(T)> {
        val: Option<T>,
        drop_fn: Option<F>,
    }

    impl<T, F: FnOnce(T)> Drop for Guard<T, F> {
        fn drop(&mut self) {
            if let (Some(val), Some(drop_fn)) = (self.val.take(), self.drop_fn.take()) {
                drop_fn(val);
            }
        }
    }

    pub fn guard<T, F: FnOnce(T)>(val: T, drop_fn: F) -> Guard<T, F> {
        Guard {
            val: Some(val),
            drop_fn: Some(drop_fn),
        }
    }
}

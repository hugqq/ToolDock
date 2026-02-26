; ToolDock Custom NSIS Installer Hooks
; Tauri v2 NSIS installer customization

!include "LogicLib.nsh"

; Pre-install hook - runs BEFORE files are copied
!macro NSIS_HOOK_PREINSTALL
  ; Check if ToolDock is running
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq tooldock.exe" /NH'
  Pop $0
  Pop $1

  StrCpy $2 $1 12
  ${If} $2 != "INFO: No ta"
    ; Process is running - ask user
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到 ToolDock 正在运行。$\n$\n点击 确定 将自动关闭程序并继续安装。$\n点击 取消 退出安装程序。" IDOK DoKill
    Quit

    DoKill:
      ; Force kill the process
      nsExec::ExecToLog 'taskkill /F /IM "tooldock.exe"'
      nsExec::ExecToLog 'taskkill /F /IM "ToolDock.exe"'
      Sleep 2000
  ${EndIf}

  ; Clean up old cache and log files
  RMDir /r "$LOCALAPPDATA\tooldock\cache"
  RMDir /r "$LOCALAPPDATA\tooldock\logs"
!macroend

; Post-install hook - runs after files are copied
!macro NSIS_HOOK_POSTINSTALL
  ; Nothing needed here for now
!macroend

; Uninstall callback
!macro customUninstall
  ; Check if running during uninstall
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ToolDock.exe" /NH'
  Pop $0
  Pop $1

  StrCpy $2 $1 12
  ${If} $2 != "INFO: No ta"
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "ToolDock 正在运行。$\n$\n必须先关闭程序才能卸载。$\n点击 确定 将自动关闭。" IDOK DoUninstallClose
    Quit

    DoUninstallClose:
      DetailPrint "正在关闭 ToolDock..."
      nsExec::ExecToLog 'taskkill /F /IM "ToolDock.exe"'
      nsExec::ExecToLog 'taskkill /F /IM "tooldock.exe"'
      Sleep 2000
  ${EndIf}

  ; Remove application data
  DetailPrint "正在删除应用数据..."
  RMDir /r "$LOCALAPPDATA\tooldock"
  RMDir /r "$APPDATA\tooldock"
!macroend

; Function to check and close ToolDock
Function CheckAndCloseToolDock
  ; Check for both possible process names (ToolDock.exe and tooldock.exe)
  StrCpy $3 "0" ; Flag to track if process found

  ; Check ToolDock.exe
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ToolDock.exe" /NH'
  Pop $0
  Pop $1
  StrCpy $2 $1 12
  ${If} $2 != "INFO: No ta"
    StrCpy $3 "1"
  ${EndIf}

  ; Check tooldock.exe (lowercase)
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq tooldock.exe" /NH'
  Pop $0
  Pop $1
  StrCpy $2 $1 12
  ${If} $2 != "INFO: No ta"
    StrCpy $3 "1"
  ${EndIf}

  ${If} $3 == "1"
    ; Process is running - ask user
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到 ToolDock 正在运行。$\n$\n点击 确定 将自动关闭程序并继续安装。$\n点击 取消 手动关闭后再安装。" /SD IDOK IDOK DoClose
    ; User clicked Cancel
    MessageBox MB_OK "安装已取消。请关闭 ToolDock 后重新运行安装程序。"
    Quit

    DoClose:
      ; Force close both possible process names
      nsExec::ExecToLog 'taskkill /F /IM "ToolDock.exe" 2>nul'
      nsExec::ExecToLog 'taskkill /F /IM "tooldock.exe" 2>nul'
      Sleep 2000

      ; Verify both are closed
      StrCpy $3 "0"

      nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ToolDock.exe" /NH'
      Pop $0
      Pop $1
      StrCpy $2 $1 12
      ${If} $2 != "INFO: No ta"
        StrCpy $3 "1"
      ${EndIf}

      nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq tooldock.exe" /NH'
      Pop $0
      Pop $1
      StrCpy $2 $1 12
      ${If} $2 != "INFO: No ta"
        StrCpy $3 "1"
      ${EndIf}

      ${If} $3 == "1"
        MessageBox MB_OK|MB_ICONSTOP "无法关闭 ToolDock 进程。请手动关闭后重试。"
        Quit
      ${EndIf}
  ${EndIf}
FunctionEnd

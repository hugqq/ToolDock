; ToolDock Custom NSIS Installer Hooks
; Tauri v2 NSIS installer customization

!include "LogicLib.nsh"

; Init callback - called when installer starts
!macro customInit
  Call CheckAndCloseToolDock
!macroend

; Pre-install callback
!macro customInstall
  ; Clean up old cache and log files
  DetailPrint "清理旧文件..."
  RMDir /r "$LOCALAPPDATA\tooldock\cache"
  RMDir /r "$LOCALAPPDATA\tooldock\logs"
!macroend

; Uninstall callback
!macro customUninstall
  ; Check if running during uninstall
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ToolDock.exe" /NH'
  Pop $0
  Pop $1
  
  ${StrContains} $2 "ToolDock.exe" $1
  ${If} $2 != ""
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
      "ToolDock 正在运行。$\n$\n必须先关闭程序才能卸载。$\n点击"确定"将自动关闭。" \
      IDOK DoUninstallClose
      Quit
    
    DoUninstallClose:
      DetailPrint "正在关闭 ToolDock..."
      nsExec::ExecToLog 'taskkill /F /IM "ToolDock.exe"'
      Sleep 2000
  ${EndIf}
  
  ; Remove application data
  DetailPrint "正在删除应用数据..."
  RMDir /r "$LOCALAPPDATA\tooldock"
  RMDir /r "$APPDATA\tooldock"
!macroend

; Function to check and close ToolDock
Function CheckAndCloseToolDock
  ; Try to find running ToolDock.exe process
  nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ToolDock.exe" /NH'
  Pop $0 ; Return code
  Pop $1 ; Output
  
  ; Check if process exists in output
  ${StrContains} $2 "ToolDock.exe" $1
  ${If} $2 != ""
    ; Process is running - ask user
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
      "检测到 ToolDock 正在运行。$\n$\n点击"确定"将自动关闭程序并继续安装。$\n点击"取消"手动关闭后再安装。" \
      /SD IDOK \
      IDOK DoClose
      ; User clicked Cancel
      MessageBox MB_OK "安装已取消。请关闭 ToolDock 后重新运行安装程序。"
      Quit
    
    DoClose:
      ; Try graceful shutdown first (sends WM_CLOSE)
      nsExec::ExecToLog 'taskkill /IM "ToolDock.exe"'
      Sleep 3000
      
      ; Check if still running
      nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ToolDock.exe" /NH'
      Pop $0
      Pop $1
      ${StrContains} $2 "ToolDock.exe" $1
      
      ${If} $2 != ""
        ; Still running - force close
        nsExec::ExecToLog 'taskkill /F /IM "ToolDock.exe"'
        Sleep 2000
        
        ; Final verification
        nsExec::ExecToStack 'tasklist /FI "IMAGENAME eq ToolDock.exe" /NH'
        Pop $0
        Pop $1
        ${StrContains} $2 "ToolDock.exe" $1
        
        ${If} $2 != ""
          MessageBox MB_OK|MB_ICONSTOP "无法关闭 ToolDock 进程。请手动关闭后重试。"
          Quit
        ${EndIf}
      ${EndIf}
  ${EndIf}
FunctionEnd
FunctionEnd

; String contains function helper
!macro _StrContains OUT STR1 STR2
!macro _StrContains OUT STR1 STR2
  Push "${STR1}"
  Push "${STR2}"
  Call StrContains
  Pop ${OUT}
!macroend
!define StrContains "!insertmacro _StrContains"

Function StrContains
  Exch $R1 ; STR2
  Exch
  Exch $R2 ; STR1
  Push $R3
  Push $R4
  Push $R5
  
  StrCpy $R3 $R2
  StrCpy $R5 -1
  
  ${Do}
    IntOp $R5 $R5 + 1
    StrCpy $R4 $R3 ${NSIS_MAX_STRLEN} $R5
    ${If} $R4 == ""
      StrCpy $R1 ""
      Goto Done
    ${EndIf}
    ${If} $R4 == $R1
      StrCpy $R1 $R4
      Goto Done
    ${EndIf}
  ${Loop}
  
  Done:
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Exch $R1
FunctionEnd


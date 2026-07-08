; ToolDock custom NSIS installer hooks.
; Close the running app before copying or removing files so overwrite updates can continue.

!include "LogicLib.nsh"

!macro NSIS_HOOK_PREINSTALL
  Call CloseToolDockBeforeFileOperation

  ; Clean up old cache and log files.
  RMDir /r "$LOCALAPPDATA\tooldock\cache"
  RMDir /r "$LOCALAPPDATA\tooldock\logs"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; Nothing needed here for now.
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Call un.CloseToolDockBeforeFileOperation
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove application data after files are removed.
  DetailPrint "正在删除应用数据..."
  RMDir /r "$LOCALAPPDATA\tooldock"
  RMDir /r "$APPDATA\tooldock"
!macroend

Function IsToolDockRunning
  StrCpy $3 "0"

  nsExec::ExecToStack 'cmd /C tasklist /FI "IMAGENAME eq ToolDock.exe" /NH | find /I "ToolDock.exe" >NUL'
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $3 "1"
  ${EndIf}

  nsExec::ExecToStack 'cmd /C tasklist /FI "IMAGENAME eq tooldock.exe" /NH | find /I "tooldock.exe" >NUL'
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $3 "1"
  ${EndIf}
FunctionEnd

Function un.IsToolDockRunning
  StrCpy $3 "0"

  nsExec::ExecToStack 'cmd /C tasklist /FI "IMAGENAME eq ToolDock.exe" /NH | find /I "ToolDock.exe" >NUL'
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $3 "1"
  ${EndIf}

  nsExec::ExecToStack 'cmd /C tasklist /FI "IMAGENAME eq tooldock.exe" /NH | find /I "tooldock.exe" >NUL'
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $3 "1"
  ${EndIf}
FunctionEnd

Function un.WaitForToolDockExit
  StrCpy $4 0

  ${Do}
    Call un.IsToolDockRunning
    ${If} $3 == "0"
      Return
    ${EndIf}

    Sleep 500
    IntOp $4 $4 + 1
  ${LoopUntil} $4 >= 10
FunctionEnd

Function un.CloseToolDockBeforeFileOperation
  Call un.IsToolDockRunning
  ${If} $3 == "0"
    Return
  ${EndIf}

  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到 ToolDock 正在运行。$\n$\n点击 确定 将自动关闭程序并继续卸载。$\n点击 取消 退出卸载程序。" IDOK DoClose
  Quit

  DoClose:
    DetailPrint "正在关闭 ToolDock..."

    ; Try a normal close first, then force-close any remaining tray/background process.
    nsExec::ExecToLog 'cmd /C taskkill /T /IM "ToolDock.exe" >NUL 2>NUL'
    nsExec::ExecToLog 'cmd /C taskkill /T /IM "tooldock.exe" >NUL 2>NUL'
    Call un.WaitForToolDockExit

    Call un.IsToolDockRunning
    ${If} $3 == "1"
      nsExec::ExecToLog 'cmd /C taskkill /F /T /IM "ToolDock.exe" >NUL 2>NUL'
      nsExec::ExecToLog 'cmd /C taskkill /F /T /IM "tooldock.exe" >NUL 2>NUL'
      Call un.WaitForToolDockExit
    ${EndIf}

    Call un.IsToolDockRunning
    ${If} $3 == "1"
      MessageBox MB_OK|MB_ICONSTOP "无法关闭 ToolDock 进程。请手动退出 ToolDock，或以管理员身份重新运行卸载程序。"
      Quit
    ${EndIf}
FunctionEnd

Function WaitForToolDockExit
  StrCpy $4 0

  ${Do}
    Call IsToolDockRunning
    ${If} $3 == "0"
      Return
    ${EndIf}

    Sleep 500
    IntOp $4 $4 + 1
  ${LoopUntil} $4 >= 10
FunctionEnd

Function CloseToolDockBeforeFileOperation
  Call IsToolDockRunning
  ${If} $3 == "0"
    Return
  ${EndIf}

  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "检测到 ToolDock 正在运行。$\n$\n点击 确定 将自动关闭程序并继续安装。$\n点击 取消 退出安装程序。" IDOK DoClose
  Quit

  DoClose:
    DetailPrint "正在关闭 ToolDock..."

    ; Try a normal close first, then force-close any remaining tray/background process.
    nsExec::ExecToLog 'cmd /C taskkill /T /IM "ToolDock.exe" >NUL 2>NUL'
    nsExec::ExecToLog 'cmd /C taskkill /T /IM "tooldock.exe" >NUL 2>NUL'
    Call WaitForToolDockExit

    Call IsToolDockRunning
    ${If} $3 == "1"
      nsExec::ExecToLog 'cmd /C taskkill /F /T /IM "ToolDock.exe" >NUL 2>NUL'
      nsExec::ExecToLog 'cmd /C taskkill /F /T /IM "tooldock.exe" >NUL 2>NUL'
      Call WaitForToolDockExit
    ${EndIf}

    Call IsToolDockRunning
    ${If} $3 == "1"
      MessageBox MB_OK|MB_ICONSTOP "无法关闭 ToolDock 进程。请手动退出 ToolDock，或以管理员身份重新运行安装程序。"
      Quit
    ${EndIf}
FunctionEnd

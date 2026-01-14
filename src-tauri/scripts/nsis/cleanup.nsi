; Pre-install cleanup script for ToolDock
; This script runs before the new version is installed

!macro CUSTOM_PRE_INSTALL
  ; Close running ToolDock process if exists
  nsExec::ExecToLog 'taskkill /f /im "ToolDock.exe"'
  Sleep 500
  
  ; Remove old installation files that might cause conflicts
  ; Clear old cache and temporary files
  RMDir /r "$LOCALAPPDATA\tooldock\cache"
  RMDir /r "$LOCALAPPDATA\tooldock\logs"
  
  ; Remove old WebView2 user data (optional - uncomment if needed)
  ; RMDir /r "$LOCALAPPDATA\tooldock\EBWebView"
  
  ; Clear old config if major version upgrade (optional)
  ; Delete "$LOCALAPPDATA\tooldock\config.json"
!macroend

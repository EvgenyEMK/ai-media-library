; Installer customization:
; - Installer proposes a default DB/app-data folder.
; - User can click Yes (Next) to keep default, or No to browse/change.
; - Selected app-data path is persisted to:
;   %APPDATA%\AI Media Library\install-config.ini
; - App startup reads this value and sets Electron userData accordingly.

!macro customInstall
  StrCpy $0 "$APPDATA\AI Media Library"
  ReadINIStr $4 "$APPDATA\AI Media Library\install-config.ini" "Paths" "UserDataPath"
  StrCmp $4 "" try_legacy use_config
try_legacy:
  ReadINIStr $4 "$APPDATA\EMK Desktop Media\install-config.ini" "Paths" "UserDataPath"
  StrCmp $4 "" open_done use_config
use_config:
  StrCpy $0 "$4"
open_done:
  MessageBox MB_YESNO|MB_ICONQUESTION "Application data folder (database, settings)$\r$\n$\r$\n$0$\r$\n$\r$\nSelect 'No' to change this folder." IDYES +4
  nsDialogs::SelectFolderDialog "Application data folder (database, settings)" "$0"
  Pop $1
  StrCmp $1 error 0 +2
  StrCpy $1 "$0"
  StrCmp $1 "" 0 +2
  StrCpy $1 "$0"

  CreateDirectory "$1"
  CreateDirectory "$APPDATA\AI Media Library"
  WriteINIStr "$APPDATA\AI Media Library\install-config.ini" "Paths" "UserDataPath" "$1"
!macroend

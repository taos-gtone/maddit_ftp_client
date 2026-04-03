!macro customInit
  ${IfNot} ${UAC_IsInnerInstance}
    MessageBox MB_YESNO|MB_ICONQUESTION "\
Maddit FTP Client는 무료 프로그램이며,$\n\
프로그램 내 광고가 표시됩니다.$\n$\n\
광고 노출에 동의하시겠습니까?" IDYES +2
    Abort
  ${EndIf}
!macroend

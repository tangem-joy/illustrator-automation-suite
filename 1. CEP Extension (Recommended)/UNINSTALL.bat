@echo off
title Automation Suite Pro - Uninstaller
color 0C
echo.
echo  ==============================================================
echo   ⚡ AUTOMATION SUITE PRO - Uninstaller
echo  ==============================================================
echo.

set "INSTALL_DIR=%APPDATA%\Adobe\CEP\extensions\AI_Automation_Suite"

if exist "%INSTALL_DIR%" (
    echo  [*] Removing extension from %INSTALL_DIR%...
    rmdir /s /q "%INSTALL_DIR%"
    echo  [OK] Extension removed successfully.
) else (
    echo  [!] Extension is not currently installed.
)

echo.
echo  Restart Adobe Illustrator to apply changes.
echo.
pause

@echo off
title Automation Suite Pro - Installer
color 0B
echo.
echo  ==============================================================
echo   ⚡ AUTOMATION SUITE PRO - Adobe Illustrator CEP Extension
echo   All-in-One: Quality Solve + BG Remover + Auto Page Resizer + Icon Set Maker
echo  ==============================================================
echo.

:: Check Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Please run as Administrator!
    echo  [!] Right-click this file and select "Run as administrator"
    echo.
    pause
    exit /b 1
)

:: Enable CEP debug mode across all versions (CSXS 7 to 18)
echo  [1/3] Enabling Adobe CEP Extension Mode...
for /L %%i in (7,1,18) do (
    reg add "HKEY_CURRENT_USER\Software\Adobe\CSXS.%%i" /v PlayerDebugMode /t REG_SZ /d "1" /f >nul 2>&1
)
echo  [OK] System configured for Adobe CC.

:: Set install folder
set "INSTALL_DIR=%APPDATA%\Adobe\CEP\extensions\AI_Automation_Suite"

echo  [2/3] Installing extension to:
echo        %INSTALL_DIR%
echo.

:: Remove old version if exists
if exist "%INSTALL_DIR%" (
    echo  [*] Removing older version...
    rmdir /s /q "%INSTALL_DIR%"
)

:: Copy extension files
mkdir "%INSTALL_DIR%" >nul 2>&1
xcopy /s /e /y "%~dp0*" "%INSTALL_DIR%\" >nul 2>&1

if %errorLevel% neq 0 (
    echo  [ERROR] Installation failed! Please ensure Adobe Illustrator is closed.
    pause
    exit /b 1
)

echo  [OK] Extension installed successfully!
echo.
echo  [3/3] Done!
echo.
echo  ==============================================================
echo   NEXT STEPS:
echo  ==============================================================
echo.
echo   1. Restart Adobe Illustrator (if open).
echo   2. Go to: Window ^> Extensions ^> Automation Suite Pro
echo   3. Enter your License Key when prompted to activate!
echo.
echo  ==============================================================
echo.
pause

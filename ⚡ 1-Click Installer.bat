@echo off
title Automation Suite Pro - 1-Click Installer
color 0B
echo.
echo  ==============================================================
echo   ⚡ AUTOMATION SUITE PRO - Automated 1-Click Setup
echo  ==============================================================
echo.

:: Check Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!] Administrator privileges required.
    echo  [!] Launching Administrator prompt...
    powershell -Command "Start-Process cmd -ArgumentList '/c ""%~dp01. CEP Extension (Recommended)\INSTALL.bat""' -Verb RunAs"
    exit /b
)

call "%~dp01. CEP Extension (Recommended)\INSTALL.bat"

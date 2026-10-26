@echo off
title ChurchReel Studio
setlocal

set "APP_DIR=%~dp0public\index.html"

:: Launch in Native Edge App Window (built into Windows 10 & Windows 11)
where msedge >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start "" msedge --app="file:///%APP_DIR:\=/%" --window-size=1440,900
    exit /b 0
)

if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="file:///%APP_DIR:\=/%" --window-size=1440,900
    exit /b 0
)

if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="file:///%APP_DIR:\=/%" --window-size=1440,900
    exit /b 0
)

:: Fallback to Chrome App Window or Default Browser
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="file:///%APP_DIR:\=/%" --window-size=1440,900
    exit /b 0
)

start "" "%APP_DIR%"

@echo off

REM Check if running as administrator
NET SESSION >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo Running as administrator
) ELSE (
    echo Please run this script as an administrator
    pause
    exit
)

@REM Installing Node
winget install Schniz.fnm

fnm use --install-if-missing 20

@REM Installing Playwright
npm install playwright
npx playwright install
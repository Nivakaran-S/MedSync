@echo off
title MedSync Local Dev Launcher
color 0A

echo ============================================
echo   MedSync Local Dev Launcher (No Docker)
echo ============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Download from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found:
node --version

:: Check .env
if not exist .env (
    echo.
    echo [WARN] .env not found. Copying .env.local as .env...
    copy .env.local .env >nul
    echo [INFO] Edit .env and set your MONGO_URI before continuing!
    echo        - For Atlas: replace MONGO_URI with your connection string
    echo        - For local MongoDB: keep as mongodb://localhost:27017/medsync
    echo.
    pause
)

echo.
echo [Step 1/3] Installing dependencies (first run only)...
echo.

:: Install backend deps
for %%s in (auth patient-management doctor-management appointment telemedicine payment notification ai-symptom-checker) do (
    if exist "backend\services\%%s\package.json" (
        if not exist "backend\services\%%s\node_modules" (
            echo   Installing: %%s
            cd "backend\services\%%s"
            call npm install --silent 2>nul
            cd ..\..\..
        ) else (
            echo   [cached] %%s
        )
    )
)

:: Install frontend deps
if not exist "frontend\node_modules" (
    echo   Installing: frontend
    cd frontend
    call npm install --silent 2>nul
    cd ..
) else (
    echo   [cached] frontend
)

echo.
echo [Step 2/3] Starting backend services...
echo.

:: Start each backend service in its own window
start "Auth Service :5000" cmd /k "cd backend\services\auth && node server.js"
timeout /t 3 /nobreak >nul

start "Patient Management :3001" cmd /k "cd backend\services\patient-management && node server.js"
start "Doctor Management :3002" cmd /k "cd backend\services\doctor-management && node server.js"
start "Appointment :3003" cmd /k "cd backend\services\appointment && node server.js"
start "Telemedicine :3004" cmd /k "cd backend\services\telemedicine && node server.js"
start "Payment :3005" cmd /k "cd backend\services\payment && node server.js"
start "AI Symptom Checker :3007" cmd /k "cd backend\services\ai-symptom-checker && node server.js"
start "Notification :3006" cmd /k "cd backend\services\notification && node src\server.js"

echo   Started 8 backend services in separate windows.
echo.

echo [Step 3/3] Starting frontend...
echo.
timeout /t 5 /nobreak >nul
start "Frontend :3000" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================
echo   MedSync is starting up!
echo ============================================
echo.
echo   Frontend:       http://localhost:3000
echo   Auth:           http://localhost:5000
echo   Patient:        http://localhost:3001
echo   Doctor:         http://localhost:3002
echo   Appointment:    http://localhost:3003
echo   Telemedicine:   http://localhost:3004
echo   Payment:        http://localhost:3005
echo   Notification:   http://localhost:3006
echo   AI Symptom:     http://localhost:3007
echo.
echo   Admin login:    admin@medsync.com / admin123
echo.
echo   [!] Close this window to see individual service logs.
echo   [!] To stop: close all the CMD windows that opened.
echo.
pause

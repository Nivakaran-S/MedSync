@echo off
echo 🚀 Setting up MedSync Project...

docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker first.
    pause
    exit /b 1
)

docker compose version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose v2 is not available. Install a recent Docker Desktop.
    pause
    exit /b 1
)

if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env >nul
    echo ⚠️  Edit .env with real credentials before continuing:
    echo    - JWT_SECRET
    echo    - ADMIN_EMAIL / ADMIN_PASSWORD (required)
    echo    - GEMINI_API_KEY, STRIPE_*, AGORA_*, EMAIL_*, TWILIO_*
)

echo 🏗️  Building and starting services (healthcheck-gated)...
docker compose up -d --build --wait
if %errorlevel% neq 0 (
    docker compose up -d --build
    timeout /t 45 /nobreak >nul
)

echo.
echo ✅ Services should be running!
echo.
echo 🌐 Access URLs:
echo    Frontend:           http://localhost:3000
echo    Auth:               http://localhost:5000
echo    Patient:            http://localhost:3001
echo    Doctor:             http://localhost:3002
echo    Appointment:        http://localhost:3003
echo    Telemedicine:       http://localhost:3004
echo    Payment:            http://localhost:3005
echo    Notification:       http://localhost:3006
echo    AI Symptom Checker: http://localhost:3007
echo.
echo 📊 Logs:  docker compose logs -f [service-name]
echo 🛑 Stop:  docker compose down
echo.
echo 🔐 Login at http://localhost:3000 — admin credentials come from .env
echo    (ADMIN_EMAIL / ADMIN_PASSWORD, seeded into the auth DB on first boot)
pause

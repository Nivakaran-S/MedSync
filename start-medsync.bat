@echo off
echo 🚀 Initializing MedSync Cloud-Native Healthcare Platform...

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

if not exist .env (
    echo ⚠️  .env not found — copying .env.example to .env
    copy .env.example .env >nul
)

echo 📦 Building images and starting services (waiting for healthchecks)...
docker compose up -d --build --wait
if %errorlevel% neq 0 (
    echo ⚠️  --wait failed or not supported; falling back to 45s grace period.
    docker compose up -d --build
    timeout /t 45 /nobreak >nul
)

echo --------------------------------------------------------
echo ✅ MedSync is now online!
echo --------------------------------------------------------
echo 🌐 Frontend:      http://localhost:3000
echo 🛡️ Auth:          http://localhost:5000
echo 👤 Patient:       http://localhost:3001
echo 👨‍⚕️ Doctor:        http://localhost:3002
echo 📅 Appointment:   http://localhost:3003
echo 💊 Telemedicine:  http://localhost:3004
echo 💳 Payment:       http://localhost:3005
echo 📨 Notification:  http://localhost:3006
echo 🤖 AI Symptom:    http://localhost:3007
echo --------------------------------------------------------
echo 🔑 Admin creds come from .env (ADMIN_EMAIL / ADMIN_PASSWORD)
echo 📊 Live logs: docker compose logs -f
pause

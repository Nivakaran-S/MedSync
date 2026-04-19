#!/bin/bash

echo "🚀 Setting up MedSync Project..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose v2 is not available. Install a recent Docker Desktop / Compose plugin."
    exit 1
fi

if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Edit .env with real credentials before continuing:"
    echo "   - JWT_SECRET (openssl rand -base64 48)"
    echo "   - ADMIN_EMAIL / ADMIN_PASSWORD (required — admin login depends on this)"
    echo "   - GEMINI_API_KEY, STRIPE_*, AGORA_*, EMAIL_*, TWILIO_* as needed"
fi

echo "🏗️  Building and starting services (healthcheck-gated)..."
if ! docker compose up -d --build --wait; then
    docker compose up -d --build
    sleep 45
fi

echo "✅ Services should be running!"
echo
echo "🌐 Access URLs:"
echo "   Frontend:           http://localhost:3000"
echo "   Auth:               http://localhost:5000"
echo "   Patient:            http://localhost:3001"
echo "   Doctor:             http://localhost:3002"
echo "   Appointment:        http://localhost:3003"
echo "   Telemedicine:       http://localhost:3004"
echo "   Payment:            http://localhost:3005"
echo "   Notification:       http://localhost:3006"
echo "   AI Symptom Checker: http://localhost:3007"
echo
echo "📊 Logs:  docker compose logs -f [service-name]"
echo "🛑 Stop:  docker compose down"
echo
echo "🔐 Login at http://localhost:3000 — admin credentials come from .env"
echo "   (ADMIN_EMAIL / ADMIN_PASSWORD, seeded into the auth DB on first boot)"

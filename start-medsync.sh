#!/bin/bash

# MedSync Startup Script (Distributed Systems Assignment 1)

set -e

echo "🚀 Initializing MedSync Cloud-Native Healthcare Platform..."

if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

if [ ! -f .env ]; then
    echo "⚠️  .env not found — copying .env.example → .env (edit values before running for real)."
    cp .env.example .env
fi

echo "📦 Building images and starting services (waiting for healthchecks)..."
# --wait blocks until every service with a healthcheck reports healthy.
if ! docker compose up -d --build --wait; then
    echo "⚠️  '--wait' not supported or a service failed health check; falling back to a 45s grace period."
    docker compose up -d --build
    sleep 45
fi

echo "--------------------------------------------------------"
echo "✅ MedSync is now online!"
echo "--------------------------------------------------------"
echo "🌐 Frontend:        http://localhost:3000"
echo "🛡️ Auth Service:    http://localhost:5000"
echo "👤 Patient:         http://localhost:3001"
echo "👨‍⚕️ Doctor:          http://localhost:3002"
echo "📅 Appointment:     http://localhost:3003"
echo "💊 Telemedicine:    http://localhost:3004"
echo "💳 Payment:         http://localhost:3005"
echo "📨 Notification:    http://localhost:3006"
echo "🤖 AI Symptom:      http://localhost:3007"
echo "--------------------------------------------------------"
echo "🔑 Admin creds come from .env (ADMIN_EMAIL / ADMIN_PASSWORD)"
echo "📊 Live logs: docker compose logs -f"

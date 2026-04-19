# MedSync: AI-Enabled Smart Healthcare Platform

MedSync is a cloud-native healthcare ecosystem built with a microservices architecture. It streamlines patient-doctor interactions through AI-driven diagnostics, real-time telemedicine, and secure payment processing.

Implementation for **SE3020 – Distributed Systems Assignment 1 (2026)**.

---

## 🏛️ System Architecture

MedSync consists of **8 backend microservices** and a **Next.js frontend**, all containerized.

| Service | Port | Role |
| :--- | :--- | :--- |
| **Auth** | 5000 | Unified JWT login/registration + admin seeding |
| **Patient Management** | 3001 | Digital health records, document uploads |
| **Doctor Management** | 3002 | Doctor profiles, verification, analytics |
| **Appointment** | 3003 | Booking engine with specialty search |
| **Telemedicine** | 3004 | Agora-powered video sessions + Redis signaling |
| **Payment** | 3005 | Stripe Checkout integration |
| **Notification** | 3006 | Event-driven email/SMS via Kafka |
| **AI Symptom Checker** | 3007 | Preliminary diagnostics via Google Gemini |
| **Frontend** | 3000 | Next.js 16 + React 19 dashboard |

Shared infrastructure: MongoDB, Redis, Kafka, Zookeeper — all provisioned by Compose/k8s.

---

## 🛠️ Technology Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| **Backend** | Node.js 20, Express, Mongoose, kafkajs |
| **Data** | MongoDB 6, Redis 7 |
| **Messaging** | Apache Kafka (Confluent 7.4) |
| **Infra** | Docker Compose, Kubernetes (Kustomize) |
| **External APIs** | Stripe, Agora, Google Gemini, Twilio, Nodemailer |

---

## ⚙️ Configuration (Centralized `.env`)

**One `.env` file at the repo root drives the entire stack** — Compose injects it into every service via `env_file: ./.env`, including the frontend's `NEXT_PUBLIC_*` variables.

1. Copy the template: `cp .env.example .env` (the startup scripts do this automatically if missing).
2. Fill in API keys:
    * `JWT_SECRET` — generate with `openssl rand -base64 48`
    * `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/)
    * `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — [Stripe Dashboard](https://dashboard.stripe.com/)
    * `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` — [Agora Console](https://console.agora.io/)
    * `EMAIL_USER` / `EMAIL_PASS` — Gmail app password
    * `TWILIO_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` — optional; SMS falls back to console log without them
    * `ADMIN_EMAIL` / `ADMIN_PASSWORD` — seeded into auth DB on first boot

No per-service `.env` files are needed or supported.

---

## 🚀 One-Command Deployment

### Option A — Docker Compose (local dev)
* **Windows:** double-click `start-medsync.bat`
* **Linux/Mac:** `chmod +x start-medsync.sh && ./start-medsync.sh`

The script spins up MongoDB, Redis, Kafka+Zookeeper, all 8 services, and the frontend. Health checks gate dependency startup so no sleep hacks.

### Option B — Kubernetes
1. Edit [`k8s/secrets.yaml`](k8s/secrets.yaml) and replace the placeholder `JWT_SECRET` with a real value.
2. Ensure a cluster is running (Docker Desktop k8s or Minikube).
3. Deploy: `./run-k8s.sh` (or `run-k8s.bat`) — this runs `kubectl apply -k k8s/`.
4. Map `127.0.0.1 medsync.local` in your hosts file.
5. Browse: `http://medsync.local`.

---

## 🔑 Login

| Role | Credentials | Dashboard |
| :--- | :--- | :--- |
| **Admin** | From `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) | `/admin` |
| **Doctor** | Register first at `/register` | `/doctor` |
| **Patient** | Register first at `/register` | `/patient` |

---

## 📋 Assignment Deliverables Checklist

- [x] **8 microservices**, all containerized
- [x] **Advanced tech**: Kafka event bus, Redis cache, Gemini AI, Stripe, Agora
- [x] **Kubernetes manifests** with Ingress, Secrets, and health-gated dependencies
- [x] **Unified JWT auth** via dedicated auth service
- [x] **Centralized config** — single root `.env`
- [x] **Startup scripts** for both Compose and k8s

---

*Developed for SE3020 Distributed Systems (BSc Information Technology).*

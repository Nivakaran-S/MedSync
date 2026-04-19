#!/bin/bash

# MedSync Kubernetes Deployment Script

set -e

echo "🚀 Starting MedSync Orchestration on Kubernetes..."

if ! command -v kubectl &> /dev/null; then
    echo "❌ Error: kubectl could not be found. Please install it to proceed."
    exit 1
fi

if grep -q "REPLACE_WITH_STRONG_RANDOM_STRING" k8s/secrets.yaml 2>/dev/null; then
    echo "❌ k8s/secrets.yaml still contains the placeholder JWT_SECRET."
    echo "   Edit it first — the auth pod will crash-loop without a real value."
    echo "   Generate one with: openssl rand -base64 48"
    exit 1
fi

echo "📦 Applying manifests from k8s/..."
kubectl apply -k k8s/

echo "⏳ Waiting for deployments to roll out (up to 3 minutes)..."
kubectl rollout status deployment --all -n medsync --timeout=180s || true

echo "--------------------------------------------------------"
echo "✅ Deployment ready!"
echo "--------------------------------------------------------"
kubectl get pods -n medsync
echo "--------------------------------------------------------"
echo "🌐 Access the platform via: http://medsync.local"
echo "📝 Map 'medsync.local' to your cluster's ingress IP in /etc/hosts."
echo "🔎 Run 'kubectl get all -n medsync' to check detailed status."
echo "--------------------------------------------------------"

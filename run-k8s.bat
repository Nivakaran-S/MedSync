@echo off
echo 🚀 Starting MedSync Orchestration on Kubernetes...

where kubectl >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: kubectl could not be found. Please install it to proceed.
    pause
    exit /b 1
)

findstr /C:"REPLACE_WITH_STRONG_RANDOM_STRING" k8s\secrets.yaml >nul 2>&1
if %errorlevel% equ 0 (
    echo ❌ k8s\secrets.yaml still contains the placeholder JWT_SECRET.
    echo    Edit it first — the auth pod will crash-loop without a real value.
    pause
    exit /b 1
)

echo 📦 Applying manifests from k8s/...
kubectl apply -k k8s/

echo ⏳ Waiting for deployments to roll out (up to 3 minutes)...
kubectl rollout status deployment --all -n medsync --timeout=180s

echo --------------------------------------------------------
echo ✅ Deployment ready!
echo --------------------------------------------------------
kubectl get pods -n medsync
echo --------------------------------------------------------
echo 🌐 Access the platform via: http://medsync.local
echo 📝 Map "medsync.local" in C:\Windows\System32\drivers\etc\hosts to your ingress IP.
echo 🔎 Run "kubectl get all -n medsync" to check detailed status.
echo --------------------------------------------------------
pause

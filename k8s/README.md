# MedSync Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the MedSync healthcare microservices platform.

## Prerequisites

- Kubernetes cluster (minikube, k3s, EKS, GKE, AKS, etc.)
- kubectl configured to access your cluster
- Docker registry access (if using private registry)

## Deployment Order

1. **Create Namespace**
   ```bash
   kubectl apply -f namespace.yaml
   ```

2. **Deploy Zookeeper**
   ```bash
   kubectl apply -f zookeeper/
   ```

3. **Deploy Kafka**
   ```bash
   kubectl apply -f kafka/
   ```

4. **Deploy Microservices**
   ```bash
   kubectl apply -f patient-management/
   kubectl apply -f doctor-management/
   kubectl apply -f appointment/
   kubectl apply -f telemedicine/
   kubectl apply -f payment/
   kubectl apply -f notification/
   kubectl apply -f ai-symptom-checker/
   ```

5. **Deploy Ingress** (optional, requires Ingress controller)
   ```bash
   kubectl apply -f ingress.yaml
   ```

## Building and Pushing Images

Before deploying, build and push Docker images for each service:

```bash
# Build images
docker build -t patient-management:latest ./backend/services/patient-management
docker build -t doctor-management:latest ./backend/services/doctor-management
# ... repeat for all services

# Push to registry (if using remote registry)
docker tag patient-management:latest your-registry/patient-management:latest
docker push your-registry/patient-management:latest
# ... repeat for all services
```

Update the image names in deployment.yaml files if using a different registry.

## Service URLs

Once deployed, services are accessible via:

- Patient Management: http://medsync.local/api/patient
- Doctor Management: http://medsync.local/api/doctor
- Appointment: http://medsync.local/api/appointment
- Telemedicine: http://medsync.local/api/telemedicine
- Payment: http://medsync.local/api/payment
- Notification: http://medsync.local/api/notification
- AI Symptom Checker: http://medsync.local/api/ai

## Monitoring

Check pod status:
```bash
kubectl get pods -n medsync
```

Check service status:
```bash
kubectl get services -n medsync
```

View logs:
```bash
kubectl logs -n medsync deployment/patient-management
```

## Scaling

Scale individual services:
```bash
kubectl scale deployment patient-management --replicas=3 -n medsync
```

## Cleanup

Remove all resources:
```bash
kubectl delete namespace medsync
```
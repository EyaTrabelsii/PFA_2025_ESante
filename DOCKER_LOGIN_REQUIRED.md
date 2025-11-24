# 🐳 Docker Authentication Required

## ⚠️ Issue
Docker is requiring authentication to pull images. You need to either:

### Option 1: Login to Docker Hub (Recommended)
```powershell
docker login
```
Enter your Docker Hub credentials when prompted.

### Option 2: Use Local Installations

If you don't want to use Docker, you can install MongoDB, Redis, and Kafka locally:

#### Install MongoDB (Windows)
1. Download from: https://www.mongodb.com/try/download/community
2. Install and run as service
3. Default port: 27017

#### Install Redis (Windows)
1. Download from: https://github.com/tporadowski/redis/releases
2. Extract and run redis-server.exe
3. Default port: 6379

#### Install Kafka (Windows)
1. Download from: https://kafka.apache.org/downloads
2. Extract and follow quick start guide
3. Default port: 9092

### Option 3: Skip Docker for Now

You can start the services without Kafka (some features won't work):

1. Comment out Kafka connections in the code
2. Use MongoDB and Redis locally
3. Test basic functionality

---

## Quick Fix: Login to Docker

```powershell
# Login to Docker Hub
docker login

# Then try again
cd C:\Users\Eya\PFA_2025\backend
docker-compose up -d
```

---

## Alternative: Start Services Without Docker

If MongoDB and Redis are already installed locally, you can start the Node.js services directly:

```powershell
# Start all services
cd C:\Users\Eya\PFA_2025\backend
.\start-all-services.ps1
```

The services will try to connect to:
- MongoDB: localhost:27017
- Redis: localhost:6379
- Kafka: localhost:9092 (optional)

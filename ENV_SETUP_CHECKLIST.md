# ✅ Environment Setup Checklist

**Date Created:** November 5, 2025  
**Status:** All `.env` files created - Action required for email setup

---

## 🎉 What's Been Done

✅ **All 9 `.env` files created** in the correct locations:
- `backend/services/auth-service/.env`
- `backend/services/user-service/.env`
- `backend/services/rdv-service/.env`
- `backend/services/medical-records-service/.env`
- `backend/services/referral-service/.env`
- `backend/services/messaging-service/.env`
- `backend/services/notification-service/.env`
- `backend/services/audit-service/.env`
- `backend/api-gateway/.env`

✅ **JWT Secrets** - Already configured with your existing secret
✅ **AWS Credentials** - Already configured (AKIAVAF2YK7I2NIQVNRM)
✅ **OneSignal Keys** - Already configured (App ID: c337b164-017f-48ed-9b27-a2c7d90dee46)
✅ **MongoDB Configuration** - Local Docker setup (admin:password@localhost:27017)
✅ **Redis Configuration** - Local setup (localhost:6379)
✅ **Kafka Configuration** - Local setup (localhost:9092)
✅ **`.gitignore`** - Verified, already ignoring `.env` files

---

## ⚠️ ACTION REQUIRED: Gmail Configuration

**You need to add your Gmail credentials in 2 files:**

### 1. Auth Service (`backend/services/auth-service/.env`)
Replace these lines:
```env
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
```

### 2. Notification Service (`backend/services/notification-service/.env`)
Replace these lines:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
```

### 📧 How to Get Gmail App Password:

1. **Go to:** https://myaccount.google.com/security
2. **Enable 2-Step Verification** (if not already enabled)
3. **Go to:** App Passwords (search for it)
4. **Select:**
   - App: Mail
   - Device: Other (Custom name) → "E-Santé Backend"
5. **Click Generate**
6. **Copy the 16-character password** (format: xxxx xxxx xxxx xxxx)
7. **Paste it** in both `.env` files above (remove spaces)

**Example:**
```env
SMTP_USER=youremail@gmail.com
SMTP_PASS=abcdwxyzefgh1234
EMAIL_USER=youremail@gmail.com
EMAIL_PASSWORD=abcdwxyzefgh1234
```

---

## 🚀 Next Steps to Start Services

### 1. Start Infrastructure (Docker)
```powershell
cd backend
docker-compose up -d
docker-compose -f docker-compose.kafka.yml up -d
```

**This starts:**
- MongoDB (port 27017)
- Redis (port 6379)
- Kafka + Zookeeper (ports 9092, 2181)

### 2. Verify Docker Containers
```powershell
docker ps
```
You should see 4 containers running.

### 3. Install Dependencies (if not already done)
```powershell
# From backend directory
cd services/auth-service
npm install
cd ../user-service
npm install
# ... repeat for all services

# Or use the shared package install
cd backend/shared
npm install
```

### 4. Start All Services
```powershell
# From backend directory
.\start-all-services.ps1
```

**OR start individually:**
```powershell
# Terminal 1 - API Gateway
cd backend/api-gateway
npm start

# Terminal 2 - Auth Service
cd backend/services/auth-service
npm start

# Terminal 3 - User Service
cd backend/services/user-service
npm start

# Continue for all 8 services...
```

### 5. Test Health Check
```powershell
curl http://localhost:3000/health
```

---

## 🔍 Verify Environment Variables

Run this command to check if `.env` files exist:
```powershell
Get-ChildItem -Path backend -Filter .env -Recurse | Select-Object FullName
```

You should see 9 `.env` files listed.

---

## 🛠️ Troubleshooting

### If MongoDB connection fails:
```powershell
# Check if MongoDB container is running
docker ps | findstr mongo

# Check logs
docker logs pfa_2025-mongo-1
```

### If Kafka connection fails:
```powershell
# Check Kafka containers
docker ps | findstr kafka

# Restart Kafka
docker-compose -f docker-compose.kafka.yml restart
```

### If a service won't start:
1. Check the service logs for errors
2. Verify the `.env` file exists in that service directory
3. Make sure MongoDB and Kafka are running
4. Check for port conflicts (another service using the same port)

---

## 📋 Final Checklist

- [ ] Added Gmail credentials to `auth-service/.env`
- [ ] Added Gmail credentials to `notification-service/.env`
- [ ] Started Docker containers (MongoDB, Redis, Kafka)
- [ ] Verified containers are running (`docker ps`)
- [ ] Installed npm dependencies in all services
- [ ] Started all 8 microservices
- [ ] Started API Gateway
- [ ] Tested health check endpoint
- [ ] All services responding on their ports (3001-3008)

---

## 🎯 Service Ports Reference

| Port | Service | Status Check |
|------|---------|--------------|
| 3000 | API Gateway | http://localhost:3000/health |
| 3001 | Auth Service | http://localhost:3001/health |
| 3002 | User Service | http://localhost:3002/health |
| 3003 | RDV Service | http://localhost:3003/health |
| 3004 | Medical Records | http://localhost:3004/health |
| 3005 | Referral Service | http://localhost:3005/health |
| 3006 | Messaging Service | http://localhost:3006/health |
| 3007 | Notification Service | http://localhost:3007/health |
| 3008 | Audit Service | http://localhost:3008/health |

---

## 🔐 Security Notes

✅ All `.env` files are in `.gitignore` - They won't be committed
✅ Secrets are stored locally only
⚠️ Remember to use different secrets in production
⚠️ Never share your `.env` files publicly

---

## 📞 Need Help?

If services fail to start:
1. Check this checklist
2. Review `backend/START_SERVICES.md`
3. Check `backend/DOCKER_SETUP.md`
4. Review service-specific logs

---

**Created:** November 5, 2025  
**Last Updated:** November 5, 2025  
**Next Action:** Add Gmail credentials, then start services!

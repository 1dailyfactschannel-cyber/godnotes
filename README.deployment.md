# GodNotes Production Deployment Guide

## 🚀 Quick Deployment

1. **Clone repository to production server:**
```bash
git clone https://github.com/yourusername/godnotes.git
cd godnotes
```

2. **Configure environment:**
```bash
# Edit production environment variables
nano .env.production
```

3. **Deploy:**
```bash
chmod +x deploy.sh
./deploy.sh
```

## 🔄 Data Migration from Appwrite

### Prerequisites
1. Ensure PostgreSQL is running on 89.208.14.253:5433
2. Update Appwrite credentials in `.env.production`

### Migration Steps

1. **Install migration dependencies:**
```bash
cd scripts
npm install
```

2. **Run migration:**
```bash
npm run migrate
```

3. **Customize collections mapping** in `migrate-appwrite-to-postgres.js`:
```javascript
const collectionsMap = [
  { appwriteId: 'your_collection_id', postgresTable: 'your_table_name' },
  // Add your collections here
];
```

## 📁 Files Created

- `docker-compose.prod.yml` - Production Docker Compose configuration
- `.env.production` - Production environment variables
- `deploy.sh` - Automated deployment script
- `README.deployment.md` - This guide
- `scripts/migrate-appwrite-to-postgres.js` - Migration script
- `scripts/package.json` - Migration dependencies

## 🔧 Services Deployed

- **PostgreSQL**: Port 5433 (database)
- **PgAdmin**: Port 5050 (database management UI)

## 🔐 Security Notes

1. Change all default passwords in `.env.production`
2. Set strong `SESSION_SECRET`
3. Configure firewall rules to restrict access
4. Enable SSL/TLS for production use

## 🔄 Update Process

```bash
git pull origin main
./deploy.sh
```

## 📊 Monitoring

Check container status:
```bash
docker-compose -f docker-compose.prod.yml ps
```

View logs:
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## 💾 Backup Strategy

Backups directory is mounted at `./backups` - implement regular backup jobs here.

## ⚠️ Troubleshooting

If deployment fails:
1. Check Docker daemon is running
2. Verify port 5433 and 5050 are available
3. Review container logs: `docker logs godnotes-postgres`
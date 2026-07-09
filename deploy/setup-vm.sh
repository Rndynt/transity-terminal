#!/bin/bash
# Setup script untuk GCP e2-micro (Ubuntu/Debian)
# Jalankan sekali setelah VM baru dibuat:
#   bash setup-vm.sh

set -e

echo "=== 1. Update system ==="
sudo apt-get update && sudo apt-get upgrade -y

echo "=== 2. Install Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== 3. Install PM2 (process manager) ==="
sudo npm install -g pm2

echo "=== 4. Install Nginx ==="
sudo apt-get install -y nginx

echo "=== 5. Install Certbot (Let's Encrypt SSL) ==="
sudo apt-get install -y certbot python3-certbot-nginx

echo "=== 6. Buat direktori app ==="
sudo mkdir -p /opt/transity-api
sudo chown $USER:$USER /opt/transity-api

echo ""
echo "✅ Setup VM selesai."
echo ""
echo "Langkah selanjutnya:"
echo "  1. git clone https://github.com/Rndynt/transity-terminal.git /opt/transity-api"
echo "  2. Copy deploy/.env.production ke /opt/transity-api/.env"
echo "  3. cd /opt/transity-api && npm ci --omit=dev"
echo "  4. npm run build:api"
echo "  5. pm2 start deploy/pm2.config.js"
echo "  6. pm2 startup && pm2 save  (auto-start setelah reboot)"
echo "  7. Setup nginx: sudo cp deploy/nginx.conf /etc/nginx/sites-available/transity-api"
echo "     sudo ln -s /etc/nginx/sites-available/transity-api /etc/nginx/sites-enabled/"
echo "     sudo nginx -t && sudo systemctl reload nginx"
echo "  8. SSL: sudo certbot --nginx -d api.yourdomain.com"

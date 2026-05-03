# AWS Deployment Guide - Telegram-Kiro-Bot

## Overview
Panduan lengkap untuk deploy Telegram-Kiro-Bot ke AWS EC2/Lightsail menggunakan SSH.

## Prerequisites

### 1. AWS Instance Requirements
- **OS**: Ubuntu 22.04 LTS
- **Instance Type**: t3.medium atau lebih besar (minimum 2GB RAM)
- **Storage**: 20GB SSD minimum
- **Security Group**: Port 22 (SSH) terbuka

### 2. Local Requirements
- SSH client (PuTTY untuk Windows atau terminal untuk Linux/Mac)
- Private key (.pem file) untuk AWS instance
- File project yang sudah dikonfigurasi

## Step 1: Persiapan AWS Instance

### Connect ke AWS Instance
```bash
# Ganti dengan IP dan key file Anda
ssh -i "your-key.pem" ubuntu@your-aws-ip

# Atau jika menggunakan alias
ssh aws-agent
```

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Node.js v20 LTS
```bash
# Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### Install PM2 Process Manager
```bash
sudo npm install -g pm2
pm2 --version
```

### Install Kiro CLI
```bash
# Download and install Kiro CLI
curl -fsSL https://install.kiro.ai | bash

# Add to PATH (add to ~/.bashrc for permanent)
export PATH="$HOME/.local/bin:$PATH"
source ~/.bashrc

# Verify installation
kiro --version
```

## Step 2: Upload Project Files

### Option A: Using SCP (Recommended)
```bash
# From your local machine, upload the entire project
scp -i "your-key.pem" -r ./bridge ubuntu@your-aws-ip:~/
scp -i "your-key.pem" -r ./workspace ubuntu@your-aws-ip:~/

# Or if using rsync (more efficient)
rsync -avz -e "ssh -i your-key.pem" ./bridge ubuntu@your-aws-ip:~/
rsync -avz -e "ssh -i your-key.pem" ./workspace ubuntu@your-aws-ip:~/
```

### Option B: Using Git (Alternative)
```bash
# On AWS instance
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

## Step 3: Configure Environment

### Create Production .env File
```bash
# On AWS instance
cd ~/bridge
cp .env.example .env
nano .env
```

### Update .env for AWS Environment
```bash
# Required - Update these values
BOT_TOKEN=your-telegram-bot-token
ALLOWED_USERS=your-telegram-user-id
KIRO_CLI_PATH=/home/ubuntu/.local/bin/kiro
WORKSPACE_PATH=/home/ubuntu/workspace

# MCP Tokens
GITHUB_TOKEN=your-github-token
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
VERCEL_TOKEN=your-vercel-token

# Optional
NOTIFY_CHAT_ID=your-telegram-chat-id
LOG_DIR=./logs
LOG_MAX_SIZE_MB=10
LOG_RETAIN_DAYS=7
PROGRESS_INTERVAL_SEC=30
```

### Set Correct Permissions
```bash
chmod 600 .env
chmod +x ../workspace/.kiro/agents/*.json
```

## Step 4: Install Dependencies

```bash
cd ~/bridge
npm install --production
```

## Step 5: Test Configuration

### Run Connection Test
```bash
node test-connections.js
```

Expected output:
```
🎉 All connections successful! System ready to deploy.
```

### Test Bridge Startup
```bash
# Test startup (will exit after few seconds)
timeout 10s node index.js
```

## Step 6: Deploy with PM2

### Start Application
```bash
cd ~/bridge
pm2 start ecosystem.config.js
```

### Verify Deployment
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs devmosel-bridge

# Check system logs
tail -f logs/system.log
```

### Configure PM2 Auto-Start
```bash
# Generate startup script
pm2 startup

# Save current PM2 processes
pm2 save
```

## Step 7: Configure Firewall (Optional)

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22

# Allow outbound HTTPS (for API calls)
sudo ufw allow out 443
sudo ufw allow out 80

# Check status
sudo ufw status
```

## Step 8: Monitoring & Maintenance

### PM2 Commands
```bash
# View status
pm2 status

# View logs
pm2 logs devmosel-bridge

# Restart application
pm2 restart devmosel-bridge

# Stop application
pm2 stop devmosel-bridge

# Delete from PM2
pm2 delete devmosel-bridge

# Monitor in real-time
pm2 monit
```

### Log Management
```bash
# View system logs
tail -f ~/bridge/logs/system.log

# View agent logs
tail -f ~/bridge/logs/agent-backend.log

# Rotate logs manually
pm2 flush
```

### System Monitoring
```bash
# Check system resources
htop
df -h
free -h

# Check network connections
netstat -tulpn | grep node
```

## Step 9: Testing Deployment

### Test Telegram Bot
1. Open Telegram
2. Message your bot: `@devmosel_code_bot`
3. Send test command: `/agents`
4. Should receive response with agent status

### Test Agent Commands
```bash
# Test individual agent
/agent backend "create a simple hello world function"

# Test broadcast
/all "check system status"

# Check logs
/logs backend
```

## Troubleshooting

### Common Issues

#### 1. Kiro CLI Not Found
```bash
# Check if Kiro is installed
which kiro
kiro --version

# If not found, reinstall
curl -fsSL https://install.kiro.ai | bash
source ~/.bashrc
```

#### 2. Permission Denied
```bash
# Fix file permissions
chmod 755 ~/bridge/index.js
chmod 600 ~/bridge/.env
```

#### 3. Port Already in Use
```bash
# Check what's using the port
sudo netstat -tulpn | grep :3000

# Kill process if needed
sudo kill -9 <PID>
```

#### 4. Memory Issues
```bash
# Check memory usage
free -h

# If low memory, add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 5. Agent Crashes
```bash
# Check agent logs
pm2 logs devmosel-bridge

# Check system logs
tail -f ~/bridge/logs/system.log

# Restart if needed
pm2 restart devmosel-bridge
```

### Log Locations
- **PM2 Logs**: `~/.pm2/logs/`
- **System Logs**: `~/bridge/logs/system.log`
- **Agent Logs**: `~/bridge/logs/agent-*.log`

## Security Best Practices

### 1. Environment Variables
```bash
# Never commit .env to git
echo ".env" >> .gitignore

# Secure .env file
chmod 600 .env
```

### 2. SSH Security
```bash
# Disable password authentication (key-only)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart ssh
```

### 3. Firewall
```bash
# Only allow necessary ports
sudo ufw allow 22    # SSH
sudo ufw deny 80     # HTTP (not needed)
sudo ufw deny 443    # HTTPS (not needed for incoming)
```

### 4. Updates
```bash
# Regular system updates
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
cd ~/bridge && npm audit fix
```

## Backup & Recovery

### Backup Important Files
```bash
# Create backup directory
mkdir -p ~/backups

# Backup configuration
cp ~/bridge/.env ~/backups/.env.backup
cp -r ~/workspace/.kiro ~/backups/kiro-config-backup

# Backup logs (optional)
tar -czf ~/backups/logs-$(date +%Y%m%d).tar.gz ~/bridge/logs/
```

### Recovery Process
```bash
# Restore configuration
cp ~/backups/.env.backup ~/bridge/.env
cp -r ~/backups/kiro-config-backup ~/workspace/.kiro

# Restart services
pm2 restart devmosel-bridge
```

## Performance Optimization

### 1. System Optimization
```bash
# Increase file descriptor limits
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf
```

### 2. PM2 Optimization
```bash
# Update ecosystem.config.js for production
# Set max_memory_restart: "500M"
# Set node_args: "--max-old-space-size=512"
```

### 3. Log Rotation
```bash
# Configure logrotate for application logs
sudo nano /etc/logrotate.d/telegram-kiro-bot
```

## Deployment Checklist

- [ ] AWS instance running Ubuntu 22.04 LTS
- [ ] Node.js v20 installed
- [ ] PM2 installed globally
- [ ] Kiro CLI installed and in PATH
- [ ] Project files uploaded
- [ ] .env configured with production values
- [ ] Dependencies installed
- [ ] Connection test passed
- [ ] PM2 startup configured
- [ ] Firewall configured
- [ ] Telegram bot tested
- [ ] Agent commands tested
- [ ] Monitoring setup
- [ ] Backup strategy in place

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs devmosel-bridge`
2. Check system logs: `tail -f ~/bridge/logs/system.log`
3. Verify configuration: `node test-connections.js`
4. Restart services: `pm2 restart devmosel-bridge`

---

**Deployment completed successfully! Your Telegram-Kiro-Bot is now running on AWS.** 🚀
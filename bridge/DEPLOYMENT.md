# PM2 Deployment Guide for Devmosel Bridge

This guide covers deploying the Telegram-Kiro-Bot Bridge application on AWS Lightsail using PM2 for process management and 24/7 availability.

## System Requirements

- **Operating System**: Ubuntu 22.04 LTS
- **Node.js**: v20 LTS
- **PM2**: Latest version
- **Memory**: Minimum 1GB RAM (2GB recommended)
- **Storage**: Minimum 10GB available space

## Prerequisites

### 1. AWS Lightsail Instance Setup

1. Create an Ubuntu 22.04 LTS instance on AWS Lightsail
2. Configure security groups to allow:
   - SSH (port 22) from your IP
   - HTTP (port 80) if needed for health checks
   - HTTPS (port 443) if needed for webhooks
3. Connect to your instance via SSH

### 2. System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential build tools
sudo apt install -y curl wget git build-essential
```

## Installation Steps

### 1. Install Node.js v20 LTS

```bash
# Install Node.js using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show compatible npm version
```

### 2. Install PM2 Globally

```bash
# Install PM2 process manager
sudo npm install -g pm2

# Verify PM2 installation
pm2 --version

# Setup PM2 startup script (runs PM2 on system boot)
pm2 startup
# Follow the instructions shown by the command above
```

### 3. Clone and Setup Application

```bash
# Clone the repository
git clone <your-repository-url> /home/ubuntu/devmosel-bridge
cd /home/ubuntu/devmosel-bridge

# Install dependencies
cd bridge
npm install

# Create logs directory
mkdir -p logs
```

### 4. Environment Configuration

Create the environment file with your credentials:

```bash
# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env
```

Configure the following required variables in `bridge/.env`:

```bash
# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
ALLOWED_USERS=123456789,987654321  # Comma-separated Telegram user IDs
NOTIFY_CHAT_ID=123456789           # Chat ID for notifications (optional)

# System Paths
KIRO_CLI_PATH=/usr/local/bin/kiro-cli
WORKSPACE_PATH=/home/ubuntu/devmosel-bridge/workspace

# MCP Server Tokens
GITHUB_TOKEN=ghp_your_github_token_here
VERCEL_TOKEN=your_vercel_token_here                    # Optional
SUPABASE_URL=https://your-project.supabase.co         # Optional
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_key   # Optional

# Logging Configuration (Optional - defaults shown)
LOG_DIR=./logs
LOG_MAX_SIZE_MB=10
LOG_RETAIN_DAYS=7
PROGRESS_INTERVAL_SEC=30
```

### 5. Install Kiro CLI

```bash
# Install Kiro CLI (adjust URL/method as needed)
# This step depends on how Kiro CLI is distributed
# Example:
sudo npm install -g @kiro/cli
# or
curl -L https://github.com/kiro/cli/releases/latest/download/kiro-linux -o /usr/local/bin/kiro-cli
sudo chmod +x /usr/local/bin/kiro-cli
```

### 6. Setup Workspace Configuration

Ensure your workspace has the required configuration files:

```bash
# Create workspace directory structure
mkdir -p /home/ubuntu/devmosel-bridge/workspace/.kiro/{agents,settings}

# Verify agent configuration files exist
ls -la /home/ubuntu/devmosel-bridge/workspace/.kiro/agents/
# Should show: backend.json, frontend.json, testing.json, devops.json, reviewer.json

# Verify MCP configuration exists
ls -la /home/ubuntu/devmosel-bridge/workspace/.kiro/settings/
# Should show: mcp.json
```

## PM2 Deployment Commands

### Starting the Application

```bash
# Navigate to bridge directory
cd /home/ubuntu/devmosel-bridge/bridge

# Start application with PM2
pm2 start ecosystem.config.js

# Verify application is running
pm2 status
pm2 logs devmosel-bridge
```

### Managing the Application

```bash
# View application status
pm2 status

# View real-time logs
pm2 logs devmosel-bridge

# View specific log files
pm2 logs devmosel-bridge --lines 50

# Restart the application
pm2 restart devmosel-bridge

# Stop the application
pm2 stop devmosel-bridge

# Delete the application from PM2
pm2 delete devmosel-bridge

# Reload application (zero-downtime restart)
pm2 reload devmosel-bridge
```

### Monitoring and Debugging

```bash
# Monitor CPU and memory usage
pm2 monit

# View detailed application info
pm2 show devmosel-bridge

# View error logs only
pm2 logs devmosel-bridge --err

# View application metrics
pm2 web  # Opens web interface on port 9615
```

## Log File Management

### Log File Locations

The application creates several log files in the `bridge/logs/` directory:

- **System Logs**:
  - `system.log` - PM2 stdout logs
  - `system-error.log` - PM2 stderr logs
  - `system-combined.log` - Combined PM2 logs

- **Agent Logs** (created by the application):
  - `agent-backend.log` - Backend agent activity
  - `agent-frontend.log` - Frontend agent activity
  - `agent-testing.log` - Testing agent activity
  - `agent-devops.log` - DevOps agent activity
  - `agent-reviewer.log` - Reviewer agent activity

### Log Rotation

The application automatically rotates logs when they reach 10MB (configurable via `LOG_MAX_SIZE_MB`). Rotated logs are kept for 7 days (configurable via `LOG_RETAIN_DAYS`).

### Manual Log Management

```bash
# View recent system logs
tail -f /home/ubuntu/devmosel-bridge/bridge/logs/system.log

# View recent error logs
tail -f /home/ubuntu/devmosel-bridge/bridge/logs/system-error.log

# View agent-specific logs
tail -f /home/ubuntu/devmosel-bridge/bridge/logs/agent-backend.log

# Archive old logs manually
cd /home/ubuntu/devmosel-bridge/bridge/logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz *.log
```

## Automatic Startup Configuration

### Save PM2 Configuration

After starting your application successfully:

```bash
# Save current PM2 processes
pm2 save

# This ensures your application starts automatically after system reboot
```

### Verify Startup Configuration

```bash
# Test the startup script
sudo systemctl status pm2-ubuntu  # Replace 'ubuntu' with your username

# Manually test startup
pm2 resurrect
```

## Health Checks and Monitoring

### Application Health

The Bridge application provides several ways to verify it's working:

1. **PM2 Status**: `pm2 status` should show the app as "online"
2. **Log Monitoring**: Check logs for startup messages and agent initialization
3. **Telegram Test**: Send a test message to your bot to verify connectivity

### Automated Health Checks

You can set up a simple health check script:

```bash
# Create health check script
cat > /home/ubuntu/health-check.sh << 'EOF'
#!/bin/bash
if pm2 list | grep -q "devmosel-bridge.*online"; then
    echo "Bridge is running"
    exit 0
else
    echo "Bridge is not running, attempting restart..."
    pm2 restart devmosel-bridge
    exit 1
fi
EOF

chmod +x /home/ubuntu/health-check.sh

# Add to crontab for periodic checks (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/ubuntu/health-check.sh >> /home/ubuntu/health-check.log 2>&1") | crontab -
```

## Troubleshooting

### Common Issues

1. **Application Won't Start**:
   ```bash
   # Check PM2 logs
   pm2 logs devmosel-bridge
   
   # Check environment variables
   pm2 show devmosel-bridge
   
   # Verify .env file exists and has correct permissions
   ls -la /home/ubuntu/devmosel-bridge/bridge/.env
   ```

2. **Agents Not Connecting**:
   ```bash
   # Verify Kiro CLI is installed and accessible
   which kiro-cli
   kiro-cli --version
   
   # Check workspace configuration
   ls -la /home/ubuntu/devmosel-bridge/workspace/.kiro/
   ```

3. **High Memory Usage**:
   ```bash
   # Monitor memory usage
   pm2 monit
   
   # Restart if memory usage is too high
   pm2 restart devmosel-bridge
   ```

4. **Log Files Growing Too Large**:
   ```bash
   # Check log sizes
   du -sh /home/ubuntu/devmosel-bridge/bridge/logs/*
   
   # Manually rotate logs if needed
   pm2 flush devmosel-bridge
   ```

### Emergency Recovery

If the application is completely unresponsive:

```bash
# Force stop all PM2 processes
pm2 kill

# Restart PM2 daemon
pm2 resurrect

# If that fails, restart the entire system
sudo reboot
```

## Security Considerations

1. **File Permissions**:
   ```bash
   # Secure the .env file
   chmod 600 /home/ubuntu/devmosel-bridge/bridge/.env
   
   # Ensure logs directory is writable
   chmod 755 /home/ubuntu/devmosel-bridge/bridge/logs
   ```

2. **Firewall Configuration**:
   ```bash
   # Configure UFW if needed
   sudo ufw allow ssh
   sudo ufw enable
   ```

3. **Regular Updates**:
   ```bash
   # Keep system updated
   sudo apt update && sudo apt upgrade -y
   
   # Update Node.js dependencies
   cd /home/ubuntu/devmosel-bridge/bridge
   npm audit fix
   ```

## Performance Optimization

### PM2 Configuration Tuning

For better performance, you can adjust the PM2 configuration in `ecosystem.config.js`:

- Increase `max_memory_restart` if you have more RAM available
- Adjust `restart_delay` based on your application's startup time
- Modify `max_restarts` based on your reliability requirements

### System-Level Optimizations

```bash
# Increase file descriptor limits
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize Node.js garbage collection (already configured in ecosystem.config.js)
# --max-old-space-size=512 limits memory usage to 512MB
```

This deployment guide ensures your Telegram-Kiro-Bot Bridge runs reliably on AWS Lightsail with proper monitoring, logging, and recovery mechanisms.
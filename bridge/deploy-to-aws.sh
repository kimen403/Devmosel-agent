#!/bin/bash

# Telegram-Kiro-Bot AWS Deployment Script
# Usage: ./deploy-to-aws.sh [aws-host] [key-file]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_HOST=${1:-"aws-agent"}  # Default to aws-agent alias
KEY_FILE=${2:-""}           # Optional key file
PROJECT_DIR=$(pwd)
REMOTE_USER="ubuntu"
REMOTE_HOME="/home/ubuntu"

echo -e "${BLUE}🚀 Telegram-Kiro-Bot AWS Deployment Script${NC}"
echo "=================================================="

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to run SSH commands
run_ssh() {
    local cmd="$1"
    if [ -n "$KEY_FILE" ]; then
        ssh -i "$KEY_FILE" "$REMOTE_USER@$AWS_HOST" "$cmd"
    else
        ssh "$REMOTE_USER@$AWS_HOST" "$cmd"
    fi
}

# Function to upload files
upload_files() {
    local src="$1"
    local dest="$2"
    if [ -n "$KEY_FILE" ]; then
        rsync -avz --delete -e "ssh -i $KEY_FILE" "$src" "$REMOTE_USER@$AWS_HOST:$dest"
    else
        rsync -avz --delete -e ssh "$src" "$REMOTE_USER@$AWS_HOST:$dest"
    fi
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check if .env exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it first."
    exit 1
fi

# Check if workspace exists
if [ ! -d "../workspace" ]; then
    print_error "../workspace directory not found."
    exit 1
fi

print_status "Prerequisites check passed"

# Test SSH connection
echo -e "${BLUE}🔗 Testing SSH connection...${NC}"
if run_ssh "echo 'SSH connection successful'"; then
    print_status "SSH connection established"
else
    print_error "SSH connection failed. Check your connection settings."
    exit 1
fi

# Update system packages
echo -e "${BLUE}📦 Updating system packages...${NC}"
run_ssh "sudo apt update && sudo apt upgrade -y"
print_status "System packages updated"

# Install Node.js v20
echo -e "${BLUE}📦 Installing Node.js v20...${NC}"
run_ssh "
    # Check if Node.js v20 is already installed
    if node --version 2>/dev/null | grep -q '^v20'; then
        echo 'Node.js v20 already installed'
    else
        echo 'Installing Node.js v20...'
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
"
print_status "Node.js v20 installed"

# Install PM2
echo -e "${BLUE}📦 Installing PM2...${NC}"
run_ssh "
    if command -v pm2 >/dev/null 2>&1; then
        echo 'PM2 already installed'
    else
        echo 'Installing PM2...'
        sudo npm install -g pm2
    fi
"
print_status "PM2 installed"

# Install Kiro CLI
echo -e "${BLUE}📦 Installing Kiro CLI...${NC}"
run_ssh "
    if command -v kiro >/dev/null 2>&1; then
        echo 'Kiro CLI already installed'
    else
        echo 'Installing Kiro CLI...'
        curl -fsSL https://install.kiro.ai | bash
        echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc
        source ~/.bashrc
    fi
"
print_status "Kiro CLI installed"

# Create directories
echo -e "${BLUE}📁 Creating directories...${NC}"
run_ssh "mkdir -p ~/bridge ~/workspace ~/backups"
print_status "Directories created"

# Upload project files
echo -e "${BLUE}📤 Uploading project files...${NC}"
upload_files "./" "$REMOTE_HOME/bridge/"
upload_files "../workspace/" "$REMOTE_HOME/"
print_status "Project files uploaded"

# Update .env for AWS environment
echo -e "${BLUE}⚙️  Updating environment configuration...${NC}"
run_ssh "
    cd ~/bridge
    
    # Update paths for AWS environment
    sed -i 's|KIRO_CLI_PATH=.*|KIRO_CLI_PATH=/home/ubuntu/.local/bin/kiro|' .env
    sed -i 's|WORKSPACE_PATH=.*|WORKSPACE_PATH=/home/ubuntu/workspace|' .env
    
    # Set correct permissions
    chmod 600 .env
    chmod 755 index.js
"
print_status "Environment configuration updated"

# Install dependencies
echo -e "${BLUE}📦 Installing Node.js dependencies...${NC}"
run_ssh "cd ~/bridge && npm install --production"
print_status "Dependencies installed"

# Test configuration
echo -e "${BLUE}🧪 Testing configuration...${NC}"
if run_ssh "cd ~/bridge && timeout 10s node test-connections.js"; then
    print_status "Configuration test passed"
else
    print_warning "Configuration test had issues. Check the output above."
fi

# Stop existing PM2 processes
echo -e "${BLUE}🛑 Stopping existing processes...${NC}"
run_ssh "pm2 delete devmosel-bridge 2>/dev/null || true"
print_status "Existing processes stopped"

# Start application with PM2
echo -e "${BLUE}🚀 Starting application...${NC}"
run_ssh "cd ~/bridge && pm2 start ecosystem.config.js"
print_status "Application started with PM2"

# Configure PM2 startup
echo -e "${BLUE}⚙️  Configuring PM2 startup...${NC}"
run_ssh "
    pm2 startup | grep 'sudo env' | bash || true
    pm2 save
"
print_status "PM2 startup configured"

# Verify deployment
echo -e "${BLUE}✅ Verifying deployment...${NC}"
sleep 5  # Wait for application to start

if run_ssh "pm2 status | grep -q 'online'"; then
    print_status "Application is running"
else
    print_error "Application failed to start. Check PM2 logs."
    run_ssh "pm2 logs devmosel-bridge --lines 20"
    exit 1
fi

# Create backup
echo -e "${BLUE}💾 Creating backup...${NC}"
run_ssh "
    cd ~/backups
    cp ~/bridge/.env .env.backup-\$(date +%Y%m%d-%H%M%S)
    tar -czf kiro-config-backup-\$(date +%Y%m%d-%H%M%S).tar.gz -C ~/workspace .kiro/
"
print_status "Backup created"

# Final status
echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Deployment Summary:${NC}"
run_ssh "
    echo '• Node.js version:' \$(node --version)
    echo '• PM2 status:'
    pm2 status
    echo '• Application logs (last 5 lines):'
    tail -5 ~/bridge/logs/system.log 2>/dev/null || echo 'No logs yet'
"

echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "• Check status: ssh $AWS_HOST 'pm2 status'"
echo "• View logs: ssh $AWS_HOST 'pm2 logs devmosel-bridge'"
echo "• Restart app: ssh $AWS_HOST 'pm2 restart devmosel-bridge'"
echo "• System logs: ssh $AWS_HOST 'tail -f ~/bridge/logs/system.log'"

echo ""
echo -e "${GREEN}✅ Your Telegram-Kiro-Bot is now running on AWS!${NC}"
echo -e "${BLUE}🤖 Test it by messaging your bot on Telegram${NC}"
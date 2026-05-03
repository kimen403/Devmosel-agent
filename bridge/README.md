# Telegram-Kiro-Bot

A multi-agent orchestration platform that bridges Telegram messaging with five specialized Kiro CLI agents running in parallel. This system enables mobile-first development workflows where developers send prompts via Telegram and receive coordinated responses from specialized AI agents.

## Overview

The Telegram-Kiro-Bot system consists of:

- **Bridge Application**: Node.js application that manages agent lifecycle and communication
- **5 Specialized Agents**: Backend, Frontend, Testing, DevOps, and Reviewer agents
- **Telegram Interface**: Command-based interaction via Telegram Bot API
- **MCP Integration**: Agents connect to GitHub, Supabase, and Vercel via Model Context Protocol

## System Requirements

- **Operating System**: Ubuntu 22.04 LTS (recommended)
- **Node.js**: v20 LTS or higher
- **PM2**: Process manager for production deployment
- **Kiro CLI**: Latest version installed and accessible
- **Memory**: Minimum 4GB RAM (8GB recommended for 5 parallel agents)
- **Storage**: 10GB free space for logs and workspace

## Installation

### 1. System Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js v20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Verify installations
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
pm2 --version   # Should show 5.x.x
```

### 2. Kiro CLI Installation

```bash
# Install Kiro CLI (replace with actual installation method)
# This is a placeholder - update with real Kiro CLI installation steps
curl -sSL https://install.kiro.dev | bash
export PATH="$PATH:$HOME/.kiro/bin"

# Verify installation
kiro-cli --version
```

### 3. Project Setup

```bash
# Clone or create project directory
mkdir -p /home/ubuntu/telegram-kiro-bot
cd /home/ubuntu/telegram-kiro-bot

# Copy bridge application files
# (Assuming you have the bridge/ directory with all modules)

# Install Node.js dependencies
cd bridge
npm install

# Create environment configuration
cp .env.example .env
```

### 4. Environment Configuration

Edit `bridge/.env` with your actual values:

```bash
nano bridge/.env
```

Fill in all required variables (see [Environment Variables](#environment-variables) section below).

### 5. Workspace Setup

```bash
# Create workspace directory structure
mkdir -p /home/ubuntu/workspace/.kiro/{agents,settings}

# Copy agent configurations (see Agent Configuration section)
# Copy MCP server configuration (see MCP Configuration section)
```

## Configuration

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram bot token from @BotFather | `1234567890:ABCdef...` |
| `ALLOWED_USERS` | Comma-separated Telegram user IDs | `123456789,987654321` |
| `KIRO_CLI_PATH` | Full path to Kiro CLI executable | `/usr/local/bin/kiro-cli` |
| `WORKSPACE_PATH` | Path to workspace directory | `/home/ubuntu/workspace` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxx` |

#### MCP Server Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `SUPABASE_URL` | Supabase project URL | Backend, Testing agents |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Backend, Testing agents |
| `VERCEL_TOKEN` | Vercel API token | Frontend, DevOps agents |

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTIFY_CHAT_ID` | - | Telegram chat ID for notifications |
| `LOG_DIR` | `./logs` | Directory for log files |
| `LOG_MAX_SIZE_MB` | `10` | Max log file size before rotation |
| `LOG_RETAIN_DAYS` | `7` | Days to retain old log files |
| `PROGRESS_INTERVAL_SEC` | `30` | Progress notification interval |

### Telegram Bot Setup

1. **Create Bot with BotFather**:
   ```
   1. Message @BotFather on Telegram
   2. Send /newbot
   3. Follow instructions to choose name and username
   4. Copy the bot token to BOT_TOKEN in .env
   ```

2. **Get Your User ID**:
   ```
   1. Message @userinfobot on Telegram
   2. Copy your user ID to ALLOWED_USERS in .env
   ```

3. **Get Chat ID for Notifications** (optional):
   ```
   1. Create a group or use existing chat
   2. Add your bot to the chat
   3. Send a message, then visit:
      https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
   4. Find chat.id in the response
   5. Add to NOTIFY_CHAT_ID in .env
   ```

### Agent Configuration

Create agent configuration files in `workspace/.kiro/agents/`:

#### Backend Agent (`backend.json`)
```json
{
  "name": "backend",
  "description": "Backend development specialist with database and API expertise",
  "systemPrompt": "You are a backend development expert specializing in Node.js, databases, and API design. You have access to GitHub for code management and Supabase for database operations.",
  "tools": [
    "readFile",
    "fsWrite",
    "strReplace",
    "executePwsh",
    "grepSearch"
  ],
  "mcpServers": ["github", "supabase"]
}
```

#### Frontend Agent (`frontend.json`)
```json
{
  "name": "frontend",
  "description": "Frontend development specialist with UI/UX expertise",
  "systemPrompt": "You are a frontend development expert specializing in React, Vue, and modern web technologies. You have access to GitHub for code management and Vercel for deployments.",
  "tools": [
    "readFile",
    "fsWrite",
    "strReplace",
    "executePwsh",
    "grepSearch"
  ],
  "mcpServers": ["github", "vercel"]
}
```

#### Testing Agent (`testing.json`)
```json
{
  "name": "testing",
  "description": "Quality assurance specialist with testing expertise",
  "systemPrompt": "You are a testing expert specializing in unit tests, integration tests, and quality assurance. You have access to GitHub for code management and Supabase for database testing.",
  "tools": [
    "readFile",
    "fsWrite",
    "strReplace",
    "executePwsh",
    "grepSearch"
  ],
  "mcpServers": ["github", "supabase"]
}
```

#### DevOps Agent (`devops.json`)
```json
{
  "name": "devops",
  "description": "DevOps specialist with deployment and infrastructure expertise",
  "systemPrompt": "You are a DevOps expert specializing in CI/CD, infrastructure, and deployment automation. You have access to GitHub for code management and Vercel for deployments.",
  "tools": [
    "readFile",
    "fsWrite",
    "strReplace",
    "executePwsh",
    "grepSearch"
  ],
  "mcpServers": ["github", "vercel"]
}
```

#### Reviewer Agent (`reviewer.json`)
```json
{
  "name": "reviewer",
  "description": "Code review specialist with best practices expertise",
  "systemPrompt": "You are a code review expert specializing in code quality, best practices, and security. You have access to GitHub for code management and review workflows.",
  "tools": [
    "readFile",
    "fsWrite",
    "strReplace",
    "executePwsh",
    "grepSearch"
  ],
  "mcpServers": ["github"]
}
```

### MCP Server Configuration

Create MCP configuration at `workspace/.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-supabase"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}"
      }
    },
    "vercel": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-vercel"],
      "env": {
        "VERCEL_TOKEN": "${VERCEL_TOKEN}"
      }
    }
  }
}
```

## Deployment

### PM2 Deployment

1. **Start the application**:
   ```bash
   cd bridge
   pm2 start ecosystem.config.js
   ```

2. **Check status**:
   ```bash
   pm2 status
   pm2 logs devmosel-bridge
   ```

3. **Setup auto-restart on boot**:
   ```bash
   pm2 startup
   pm2 save
   ```

### Manual Deployment

For development or testing:

```bash
cd bridge
node index.js
```

## Usage

### Available Commands

#### Single Agent Commands
- `/agent <name> <prompt>` - Send prompt to specific agent
  - Example: `/agent backend implement user authentication`
  - Valid agents: `backend`, `frontend`, `testing`, `devops`, `reviewer`

#### Broadcast Commands
- `/all <prompt>` - Send prompt to all 5 agents in parallel
  - Example: `/all update all dependencies to latest versions`

#### Status Commands
- `/agents` - List all agents and their current status
- `/status` - Show detailed agent states
- `/logs <name>` - Show recent logs for specific agent
  - Example: `/logs backend`

#### Control Commands
- `/cancel <name>` - Cancel running task for specific agent
  - Example: `/cancel frontend`

#### Default Behavior
- Plain text messages are routed to the `backend` agent by default
- Example: `"Fix the login bug"` → routed to backend agent

### Command Examples

```
# Route to specific agent
/agent frontend create a responsive navbar component

# Broadcast to all agents
/all review the codebase for security vulnerabilities

# Check agent status
/agents

# View recent logs
/logs backend

# Cancel long-running task
/cancel devops

# Default routing (goes to backend)
implement JWT authentication
```

### Notifications

If `NOTIFY_CHAT_ID` is configured, you'll receive automatic notifications:

- ✅ `[backend] selesai dalam 45 detik` - Task completed
- ❌ `[frontend] gagal: Connection timeout` - Task failed
- ⏳ `[testing] masih berjalan... (60s)` - Progress update
- 🔄 `[devops] reconnecting...` - Agent crashed and reconnecting
- ✅ `Semua 5 agent selesai dalam 120 detik` - Broadcast completed

## Monitoring and Logs

### Log Files

- **System logs**: `logs/system.log`, `logs/system-error.log`
- **Agent logs**: `logs/agent-<name>.log` (one per agent)
- **PM2 logs**: `~/.pm2/logs/devmosel-bridge-out.log`, `~/.pm2/logs/devmosel-bridge-error.log`

### Log Rotation

- Logs rotate automatically when files reach 10MB
- Old logs are retained for 7 days by default
- Configure via `LOG_MAX_SIZE_MB` and `LOG_RETAIN_DAYS`

### Monitoring Commands

```bash
# PM2 monitoring
pm2 status
pm2 monit
pm2 logs devmosel-bridge --lines 100

# System logs
tail -f logs/system.log
tail -f logs/agent-backend.log

# Check agent states via Telegram
/agents
/status
```

## Troubleshooting

### Common Issues

#### Bot Not Responding
1. Check PM2 status: `pm2 status`
2. Check logs: `pm2 logs devmosel-bridge`
3. Verify BOT_TOKEN in .env
4. Ensure bot is started with @BotFather

#### Agent Crashes
1. Check agent logs: `tail -f logs/agent-<name>.log`
2. Verify KIRO_CLI_PATH is correct
3. Check MCP server configurations
4. Verify workspace permissions

#### MCP Connection Issues
1. Verify tokens in .env file
2. Check network connectivity
3. Verify MCP server packages are available
4. Check agent configuration files

#### Permission Denied
1. Check file permissions: `ls -la bridge/`
2. Verify workspace directory permissions
3. Ensure PM2 runs with correct user

### Debug Mode

Enable debug logging by setting environment variable:

```bash
export DEBUG=telegram-kiro-bot:*
pm2 restart devmosel-bridge
```

### Health Checks

```bash
# Check if all agents are responding
/agents

# Test single agent
/agent backend echo "test message"

# Test broadcast
/all echo "broadcast test"
```

## Security Considerations

- Never commit `.env` file to version control
- Use strong, unique tokens for all services
- Regularly rotate API tokens
- Limit `ALLOWED_USERS` to trusted developers only
- Monitor logs for suspicious activity
- Keep system and dependencies updated

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Submit pull request with detailed description

## License

[Add your license information here]

## Support

For issues and questions:
1. Check this README and troubleshooting section
2. Review system logs and agent logs
3. Test with minimal configuration
4. Create issue with detailed error information

---

**Note**: This system requires active Kiro CLI agents and proper MCP server configurations. Ensure all dependencies are installed and configured before deployment.
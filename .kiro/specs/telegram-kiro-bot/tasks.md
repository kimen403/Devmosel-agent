# Implementation Plan: Telegram-Kiro-Bot

## Overview

This implementation plan creates a Node.js Bridge application that connects Telegram Bot API with 5 parallel Kiro CLI agents. The system enables mobile-first development workflows where developers send prompts via Telegram and receive coordinated responses from specialized AI agents running on AWS Lightsail.

The implementation follows a modular architecture with clear separation of concerns: Telegram communication, agent lifecycle management, ACP protocol handling, logging, and notifications. All code will be written in JavaScript (Node.js) with proper error handling and graceful degradation.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Create `bridge/` directory with package.json
  - Install dependencies: `node-telegram-bot-api`, `dotenv`, `winston` for logging
  - Create directory structure: `bridge/`, `logs/`, `workspace/.kiro/agents/`, `workspace/.kiro/settings/`
  - Create `.gitignore` to exclude `.env`, `node_modules/`, and `logs/`
  - _Requirements: 12.1, 12.2, 16.3_

- [x] 2. Implement Logger module
  - [x] 2.1 Create `bridge/logger.js` with NDJSON logging
    - Implement `log(entry)` method that writes JSON-per-line to agent-specific log files
    - Implement `queryLogs(agentName, limit)` method to retrieve last N log entries
    - Implement `flush()` method for graceful shutdown
    - Support log entry types: prompt, tool_call, response_complete, agent_crash
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_
  
  - [x] 2.2 Implement log rotation
    - Check file size before each write operation
    - Rotate log files when they reach LOG_MAX_SIZE_MB (default 10MB)
    - Implement `cleanOldLogs()` to delete logs older than LOG_RETAIN_DAYS (default 7 days)
    - _Requirements: 7.6_
  
  - [ ]* 2.3 Write unit tests for Logger module
    - Test log entry writing and file creation
    - Test log rotation when file size exceeds limit
    - Test old log cleanup based on retention policy
    - Test queryLogs retrieval with limit parameter
    - _Requirements: 7.1, 7.6_

- [x] 3. Implement ACP_Client module
  - [x] 3.1 Create `bridge/acp-client.js` with JSON-RPC 2.0 client
    - Implement `sendPrompt(agentName, prompt)` method that sends session/prompt requests
    - Implement stdio message parsing with newline-delimited JSON handling
    - Implement response chunk collection and aggregation
    - Implement request/response correlation using request IDs
    - Set `autoApprove: true` in all session/prompt requests
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  
  - [x] 3.2 Implement error handling and propagation
    - Parse JSON-RPC error responses and propagate to Agent_Manager
    - Handle malformed JSON messages gracefully with logging
    - Implement timeout handling for requests that don't receive responses
    - _Requirements: 5.5_
  
  - [ ]* 3.3 Write unit tests for ACP_Client module
    - Test JSON-RPC request formatting and ID generation
    - Test response chunk collection and aggregation
    - Test error response handling and propagation
    - Mock stdio streams for testing
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Agent_Manager module
  - [x] 5.1 Create `bridge/agent-manager.js` with agent lifecycle management
    - Implement `initialize()` method to spawn 5 Kiro CLI child processes
    - Load agent configurations from `.kiro/agents/<name>.json`
    - Load MCP configuration from `.kiro/settings/mcp.json`
    - Spawn child processes using `spawn(KIRO_CLI_PATH, ['acp'])` with proper environment variables
    - Initialize agent state map with all agents in `idle` state
    - _Requirements: 2.1, 2.2, 2.5, 12.3, 12.4_
  
  - [x] 5.2 Implement single agent dispatch
    - Implement `dispatch(agentName, prompt, context)` method
    - Check agent state is `idle` before dispatching
    - Transition agent state to `busy` before sending prompt
    - Call ACP_Client.sendPrompt() and await response
    - Transition agent state back to `idle` after completion
    - Log prompt dispatch and response completion events
    - _Requirements: 2.2, 2.3, 7.2, 7.4_
  
  - [x] 5.3 Implement parallel broadcast execution
    - Implement `broadcastPrompt(prompt, context)` method
    - Check all 5 agents are `idle` before broadcasting
    - Use `Promise.allSettled()` to dispatch to all agents concurrently
    - Track individual agent completion status
    - Return BroadcastResult with successful/failed agent lists and total duration
    - _Requirements: 6.1, 6.2, 6.3, 6.6_
  
  - [x] 5.4 Implement crash detection and recovery
    - Register `exit` event handler on each child process
    - Detect unexpected exits (non-zero exit codes)
    - Log crash events with agent name, exit code, and signal
    - Wait 3000ms before spawning replacement process
    - Track reconnect attempts per agent (max 10 attempts)
    - Mark agent as `unavailable` after 10 failed reconnect attempts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 5.5 Implement task cancellation
    - Implement `cancelTask(agentName)` method
    - Send SIGTERM to the agent's child process
    - Transition agent state to `idle` after cancellation
    - Spawn new child process to replace cancelled agent
    - _Requirements: 4.8_
  
  - [x] 5.6 Implement graceful shutdown
    - Implement `shutdown()` method
    - Send cancellation signals to all `busy` agents
    - Wait up to 10 seconds for agents to terminate gracefully
    - Force-terminate any remaining processes after timeout
    - _Requirements: 14.1, 14.2, 14.4_
  
  - [x] 5.7 Implement agent state queries
    - Implement `getAgentState(agentName)` method
    - Implement `getAllAgentStates()` method returning Map of all states
    - _Requirements: 4.5, 4.6_
  
  - [ ]* 5.8 Write unit tests for Agent_Manager module
    - Test agent spawning and initialization
    - Test single agent dispatch with state transitions
    - Test parallel broadcast execution
    - Test crash detection and recovery logic
    - Test graceful shutdown sequence
    - Mock child_process.spawn for testing
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.4, 6.1, 14.1_

- [x] 6. Implement Notifier module
  - [x] 6.1 Create `bridge/notifier.js` with Telegram notification sending
    - Implement `send(message)` method to send messages to NOTIFY_CHAT_ID
    - Implement `sendCompletion(agentName, durationSeconds)` with success format
    - Implement `sendError(agentName, error)` with error format
    - Implement `sendProgress(agentName, elapsedSeconds)` with progress format
    - Implement `sendBroadcastSummary(result)` with broadcast completion format
    - Handle missing NOTIFY_CHAT_ID gracefully (log warning, disable notifications)
    - _Requirements: 8.1, 8.2, 8.5, 8.6_
  
  - [x] 6.2 Implement progress tracking
    - Implement `startProgressTracking(agentName)` method
    - Use setInterval to send progress updates every PROGRESS_INTERVAL_SEC seconds
    - Implement `stopProgressTracking(agentName)` to clear interval
    - Track elapsed time and include in progress messages
    - _Requirements: 8.3, 8.4_
  
  - [ ]* 6.3 Write unit tests for Notifier module
    - Test notification message formatting for all types
    - Test progress tracking interval behavior
    - Test graceful handling of missing NOTIFY_CHAT_ID
    - Mock Telegram API calls for testing
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Telegram_Adapter module
  - [x] 8.1 Create `bridge/telegram.js` with Bot API integration
    - Initialize TelegramBot with BOT_TOKEN and long polling enabled
    - Implement `start()` method to begin polling
    - Implement `stop()` method to stop polling and cleanup
    - Implement `sendMessage(chatId, text)` with message splitting for >4096 chars
    - Implement `sendTypingIndicator(chatId)` using sendChatAction
    - _Requirements: 1.3, 15.1, 15.2, 15.4_
  
  - [x] 8.2 Implement authentication
    - Load ALLOWED_USERS from environment variable as comma-separated list
    - Implement `authenticateMessage(message)` to verify sender user ID
    - Silently ignore messages from unauthorized users (no response)
    - Exit with error if ALLOWED_USERS is missing or empty at startup
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [x] 8.3 Implement command parsing
    - Parse `/agent <name> <prompt>` command and extract agent name and prompt
    - Parse `/all <prompt>` command and extract prompt
    - Parse `/agents`, `/status`, `/logs <name>`, `/cancel <name>` commands
    - Route plain text messages to backend agent as default
    - Validate agent names and reply with error for unrecognized names
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_
  
  - [x] 8.4 Implement command handlers
    - Implement `/agent` handler: route to Agent_Manager.dispatch()
    - Implement `/all` handler: route to Agent_Manager.broadcastPrompt()
    - Implement `/agents` and `/status` handlers: query Agent_Manager.getAllAgentStates()
    - Implement `/logs` handler: query Logger.queryLogs() and format response
    - Implement `/cancel` handler: call Agent_Manager.cancelTask()
    - Handle errors from Agent_Manager and send error messages to user
    - _Requirements: 4.2, 4.4, 4.5, 4.6, 4.7, 4.8, 15.3, 15.5_
  
  - [x] 8.5 Implement response delivery
    - Send agent responses back to originating chat
    - Split responses exceeding 4096 characters into multiple messages
    - Send typing indicators every 5 seconds while agent is processing
    - Send error messages when agent tasks fail
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  
  - [ ]* 8.6 Write unit tests for Telegram_Adapter module
    - Test authentication logic with allowed and disallowed users
    - Test command parsing for all command types
    - Test message splitting for long responses
    - Test error handling for invalid commands
    - Mock TelegramBot API for testing
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 15.1, 15.2_

- [ ] 9. Implement Bridge main application
  - [x] 9.1 Create `bridge/index.js` with initialization sequence
    - Load environment variables from `bridge/.env` using dotenv
    - Validate required environment variables: BOT_TOKEN, ALLOWED_USERS, KIRO_CLI_PATH, WORKSPACE_PATH
    - Exit with error if required variables are missing
    - Initialize Logger module
    - Initialize Agent_Manager and call initialize()
    - Initialize Telegram_Adapter and call start()
    - Initialize Notifier module
    - _Requirements: 12.1, 12.2, 1.4, 9.5_
  
  - [x] 9.2 Implement signal handlers for graceful shutdown
    - Register SIGTERM handler to call Agent_Manager.shutdown()
    - Register SIGINT handler to call Agent_Manager.shutdown()
    - Call Logger.flush() before process exit
    - Call Telegram_Adapter.stop() before process exit
    - _Requirements: 14.1, 14.3, 14.5_
  
  - [x] 9.3 Wire Telegram_Adapter to Agent_Manager
    - Connect Telegram command handlers to Agent_Manager methods
    - Pass context (chatId, userId, messageId) with each dispatch
    - Connect Agent_Manager completion events to Notifier
    - Connect Agent_Manager completion events to Telegram_Adapter for response delivery
    - _Requirements: 4.2, 4.4, 8.1, 8.6, 15.1_
  
  - [x] 9.4 Implement security measures
    - Never log token or secret values (BOT_TOKEN, GITHUB_TOKEN, etc.)
    - Never include tokens in Telegram messages
    - Validate Telegram updates originate from Bot API
    - _Requirements: 16.1, 16.2, 16.5_
  
  - [ ]* 9.5 Write integration tests for Bridge application
    - Test full flow: Telegram message → Agent dispatch → Response delivery
    - Test broadcast command with all agents
    - Test crash recovery flow
    - Test graceful shutdown sequence
    - Use test doubles for external services
    - _Requirements: 4.2, 4.4, 6.1, 3.1, 14.1_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Create agent configuration files
  - [x] 11.1 Create backend agent configuration
    - Create `workspace/.kiro/agents/backend.json`
    - Define name, description, systemPrompt, tools list, mcpServers: ["github", "supabase"]
    - _Requirements: 2.5, 9.1, 11.1, 11.2, 11.3_
  
  - [x] 11.2 Create frontend agent configuration
    - Create `workspace/.kiro/agents/frontend.json`
    - Define name, description, systemPrompt, tools list, mcpServers: ["github", "vercel"]
    - _Requirements: 2.5, 10.1, 10.2_
  
  - [x] 11.3 Create testing agent configuration
    - Create `workspace/.kiro/agents/testing.json`
    - Define name, description, systemPrompt, tools list, mcpServers: ["github", "supabase"]
    - _Requirements: 2.5, 11.4_
  
  - [x] 11.4 Create devops agent configuration
    - Create `workspace/.kiro/agents/devops.json`
    - Define name, description, systemPrompt, tools list, mcpServers: ["github", "vercel"]
    - _Requirements: 2.5, 10.1, 10.2, 10.3_
  
  - [x] 11.5 Create reviewer agent configuration
    - Create `workspace/.kiro/agents/reviewer.json`
    - Define name, description, systemPrompt, tools list, mcpServers: ["github"]
    - _Requirements: 2.5, 9.1, 9.2, 9.3, 9.4_

- [x] 12. Create MCP server configuration
  - [x] 12.1 Create global MCP configuration file
    - Create `workspace/.kiro/settings/mcp.json`
    - Define GitHub MCP server with GITHUB_TOKEN environment variable
    - Define Supabase MCP server with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
    - Define Vercel MCP server with VERCEL_TOKEN environment variable
    - _Requirements: 12.4, 9.1, 9.5, 10.1, 10.4, 11.1, 11.5_
  
  - [x] 12.2 Validate MCP token environment variables at startup
    - Check GITHUB_TOKEN is present, exit with error if missing
    - Check VERCEL_TOKEN is present, log warning if missing (optional for some agents)
    - Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are present, log warning if missing
    - _Requirements: 9.5, 10.4, 11.5_

- [x] 13. Create PM2 deployment configuration
  - [x] 13.1 Create `bridge/ecosystem.config.js` for PM2
    - Set app name to `devmosel-bridge`
    - Set script to `bridge/index.js`
    - Set watch: false, restart_delay: 3000, max_restarts: 10
    - Configure stdout/stderr logs to `./logs/system.log` and `./logs/system-error.log`
    - Set Node.js version requirement to v20 LTS
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_
  
  - [x] 13.2 Create deployment documentation
    - Document PM2 installation steps for Ubuntu 22.04 LTS
    - Document environment variable setup in `bridge/.env`
    - Document how to start/stop/restart the Bridge using PM2
    - Document log file locations and rotation behavior
    - _Requirements: 13.1, 13.6_

- [x] 14. Create example .env file and documentation
  - [x] 14.1 Create `bridge/.env.example` template
    - Include all required environment variables with placeholder values
    - Include all optional environment variables with default values
    - Add comments explaining each variable's purpose
    - _Requirements: 12.1, 12.2, 12.6_
  
  - [x] 14.2 Create README.md with setup instructions
    - Document system requirements (Node.js v20, Ubuntu 22.04)
    - Document installation steps (npm install, .env setup, PM2 deployment)
    - Document Telegram bot setup (BotFather, token generation)
    - Document agent configuration and MCP server setup
    - Document command usage and examples
    - _Requirements: 12.1, 12.2, 13.1, 13.6_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- All code will be written in JavaScript (Node.js) as selected by the user
- The system uses JSON-RPC 2.0 over stdio for ACP protocol communication
- All 5 agents run as parallel child processes managed by the Bridge
- Security is enforced through authentication, credential protection, and workspace isolation

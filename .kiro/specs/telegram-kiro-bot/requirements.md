# Requirements Document

## Introduction

Devmosel-Agent-Team adalah sistem multi-agent berbasis Kiro CLI yang terhubung ke Telegram sebagai antarmuka kontrol utama. Developer mengirim prompt dari perangkat mobile melalui Telegram, dan sistem mendistribusikan pekerjaan ke 5 agent Kiro yang berjalan secara paralel di AWS Lightsail — masing-masing dengan peran spesifik (backend, frontend, testing, devops, reviewer).

Sistem ini terdiri dari sebuah Node.js Bridge yang dikelola oleh PM2, yang menjembatani Telegram Bot dengan 5 proses Kiro CLI child process melalui protokol ACP (Agent Client Protocol) berbasis JSON-RPC 2.0 over stdio. Setiap agent memiliki akses ke MCP Server yang relevan (GitHub, Vercel, Supabase) sesuai perannya.

---

## Glossary

- **Bridge**: Node.js application (PM2-managed) yang menjadi inti sistem — menerima pesan Telegram, mendistribusikan ke agent, dan mengirim notifikasi balik.
- **Telegram_Adapter**: Modul dalam Bridge (`telegram.js`) yang menangani koneksi polling ke Telegram Bot API, parsing command, dan pengiriman pesan.
- **Agent_Manager**: Modul dalam Bridge (`agent-manager.js`) yang mengelola lifecycle 5 agent Kiro CLI child process secara paralel.
- **ACP_Client**: Modul dalam Bridge (`acp-client.js`) yang mengimplementasikan komunikasi JSON-RPC 2.0 over stdio ke setiap Kiro CLI process.
- **Agent**: Satu instance Kiro CLI child process dengan peran spesifik — salah satu dari: `backend`, `frontend`, `testing`, `devops`, `reviewer`.
- **MCP_Server**: Model Context Protocol server eksternal yang digunakan agent untuk berinteraksi dengan layanan pihak ketiga (GitHub, Vercel, Supabase).
- **Logger**: Modul dalam Bridge (`logger.js`) yang menulis log aktivitas agent ke file JSON per agent.
- **Notifier**: Modul dalam Bridge (`notifier.js`) yang mengirim notifikasi status ke Telegram chat.
- **PM2**: Process manager Node.js yang menjaga Bridge berjalan 24/7 dan menangani restart otomatis.
- **ALLOWED_USERS**: Daftar Telegram user ID yang diizinkan mengirim command ke sistem.
- **NOTIFY_CHAT_ID**: Telegram chat ID tujuan pengiriman notifikasi status dari Notifier.
- **ACP**: Agent Client Protocol — protokol komunikasi JSON-RPC 2.0 over stdio antara Bridge dan Kiro CLI process.
- **Workspace**: Direktori codebase yang dikerjakan oleh agent (`workspace/`), berisi konfigurasi `.kiro/`.
- **Session**: Satu siklus interaksi antara Bridge dan Agent untuk menyelesaikan satu prompt/task.

---

## Requirements

### Requirement 1: Authentication and Access Control

**User Story:** As a developer, I want only authorized Telegram users to control the agents, so that the system is protected from unauthorized access.

#### Acceptance Criteria

1. WHEN a Telegram message is received, THE Telegram_Adapter SHALL verify that the sender's user ID is present in the ALLOWED_USERS list before processing the message.
2. IF a message is received from a user ID not in ALLOWED_USERS, THEN THE Telegram_Adapter SHALL silently ignore the message without sending any response.
3. THE Bridge SHALL load the ALLOWED_USERS list from the environment variable at startup and support multiple user IDs as a comma-separated string.
4. WHEN the ALLOWED_USERS environment variable is missing or empty at startup, THE Bridge SHALL log an error to system.log and exit with a non-zero exit code.

---

### Requirement 2: Agent Lifecycle Management

**User Story:** As a developer, I want the system to manage 5 Kiro CLI agent processes automatically, so that agents are always ready to receive tasks without manual intervention.

#### Acceptance Criteria

1. WHEN the Bridge starts, THE Agent_Manager SHALL spawn 5 Kiro CLI child processes — one for each agent role: `backend`, `frontend`, `testing`, `devops`, `reviewer`.
2. THE Agent_Manager SHALL maintain each agent's state as either `idle` or `busy` at all times.
3. WHEN an agent completes a task, THE Agent_Manager SHALL transition that agent's state from `busy` to `idle`.
4. WHEN the Bridge receives a shutdown signal (SIGTERM or SIGINT), THE Agent_Manager SHALL gracefully terminate all 5 agent child processes before the Bridge exits.
5. THE Agent_Manager SHALL load each agent's configuration from `.kiro/agents/<name>.json` in the Workspace directory, including name, description, system prompt, tools list, and mcpServers config.

---

### Requirement 3: Agent Crash Recovery

**User Story:** As a developer, I want the system to automatically recover from individual agent crashes, so that one failing agent does not bring down the entire Bridge or other agents.

#### Acceptance Criteria

1. WHEN a Kiro CLI child process exits unexpectedly, THE Agent_Manager SHALL detect the crash and initiate a reconnect sequence for that specific agent without restarting the Bridge or other agents.
2. WHEN an agent crash is detected, THE Notifier SHALL send a reconnect notification to NOTIFY_CHAT_ID with the message format: `🔄 [<agent_name>] reconnecting...`
3. WHEN an agent crash is detected, THE Logger SHALL write a log entry with `type: "agent_crash"`, the error message, and `action: "reconnecting"`.
4. WHEN reconnecting a crashed agent, THE Agent_Manager SHALL wait 3000ms before spawning a new child process for that agent.
5. IF an agent fails to restart after 10 consecutive attempts, THEN THE Agent_Manager SHALL mark that agent as `unavailable` and notify NOTIFY_CHAT_ID with an error message.

---

### Requirement 4: Telegram Command Routing

**User Story:** As a developer, I want to send commands from my phone via Telegram to control specific agents or all agents, so that I can direct work to the right specialist.

#### Acceptance Criteria

1. WHEN a plain text message (non-command) is received from an ALLOWED_USER, THE Telegram_Adapter SHALL route the message as a prompt to the `backend` agent as the default agent.
2. WHEN the command `/agent <name> <prompt>` is received, THE Telegram_Adapter SHALL route the prompt to the agent matching `<name>`, where `<name>` is one of: `backend`, `frontend`, `testing`, `devops`, `reviewer`.
3. IF the `/agent` command is received with an unrecognized agent name, THEN THE Telegram_Adapter SHALL reply with an error message listing the valid agent names.
4. WHEN the command `/all <prompt>` is received, THE Telegram_Adapter SHALL broadcast the prompt to all 5 agents in parallel.
5. WHEN the command `/agents` is received, THE Telegram_Adapter SHALL reply with a list of all 5 agents and their current state (`idle` or `busy`).
6. WHEN the command `/status` is received, THE Telegram_Adapter SHALL reply with the current state of all 5 agents.
7. WHEN the command `/logs <name>` is received, THE Telegram_Adapter SHALL reply with the last 20 lines of the log file for the specified agent.
8. WHEN the command `/cancel <name>` is received, THE Agent_Manager SHALL terminate the current task of the specified agent and transition that agent's state to `idle`.
9. IF the `/cancel` command is received for an agent that is currently `idle`, THEN THE Telegram_Adapter SHALL reply with a message indicating the agent has no running task.

---

### Requirement 5: ACP Protocol Communication

**User Story:** As a developer, I want the Bridge to communicate with Kiro CLI agents using the ACP protocol, so that prompts and responses are exchanged reliably.

#### Acceptance Criteria

1. THE ACP_Client SHALL communicate with each Kiro CLI child process using JSON-RPC 2.0 messages over stdio.
2. WHEN a prompt is dispatched to an agent, THE ACP_Client SHALL send a `session/prompt` JSON-RPC request to the corresponding Kiro CLI process.
3. WHEN the Kiro CLI process streams response chunks, THE ACP_Client SHALL collect all chunks until the response is complete.
4. WHEN a complete response is received from an agent, THE ACP_Client SHALL return the full response text to the Agent_Manager.
5. IF a JSON-RPC response contains an error object, THEN THE ACP_Client SHALL propagate the error to the Agent_Manager for handling.
6. THE ACP_Client SHALL operate in auto-approve mode, automatically approving all tool call requests from the Kiro CLI process without requiring user confirmation.

---

### Requirement 6: Parallel Execution

**User Story:** As a developer, I want the `/all` command to run all 5 agents simultaneously, so that I can apply changes across the entire codebase in parallel.

#### Acceptance Criteria

1. WHEN the `/all <prompt>` command is received, THE Agent_Manager SHALL dispatch the prompt to all 5 agents concurrently using `Promise.allSettled()`.
2. WHILE a parallel execution is in progress, THE Agent_Manager SHALL track the completion status of each individual agent independently.
3. WHEN all 5 agents have completed their tasks (regardless of success or failure), THE Notifier SHALL send a broadcast completion notification to NOTIFY_CHAT_ID.
4. WHEN all 5 agents complete successfully, THE Notifier SHALL send the message: `✅ Semua 5 agent selesai dalam <X> detik`.
5. IF one or more agents fail during a parallel execution, THEN THE Notifier SHALL include the failure details per agent in the completion summary notification.
6. WHEN the `/all` command is received while any agent is already `busy`, THE Telegram_Adapter SHALL reply with a message indicating which agents are currently busy and cannot accept new tasks.

---

### Requirement 7: Per-Agent Logging

**User Story:** As a developer, I want all agent activity to be logged in structured JSON format per agent, so that I can audit and debug agent behavior.

#### Acceptance Criteria

1. THE Logger SHALL write all log entries in JSON-per-line (NDJSON) format to a dedicated file per agent at `logs/agent-<name>.log`.
2. WHEN a prompt is dispatched to an agent, THE Logger SHALL write a log entry with fields: `ts` (ISO 8601), `level: "info"`, `agent`, `type: "prompt"`, `from` (Telegram user ID), and `text` (the prompt text).
3. WHEN an agent makes a tool call, THE Logger SHALL write a log entry with fields: `ts`, `level: "info"`, `agent`, `type: "tool_call"`, `tool`, and `path`.
4. WHEN an agent completes a response, THE Logger SHALL write a log entry with fields: `ts`, `level: "info"`, `agent`, `type: "response_complete"`, `duration_ms`, and `chars`.
5. WHEN an agent crashes, THE Logger SHALL write a log entry with fields: `ts`, `level: "error"`, `agent`, `type: "agent_crash"`, `message`, and `action`.
6. THE Logger SHALL rotate log files when a file reaches 10MB in size, retaining logs for the last 7 days.
7. THE Bridge SHALL write its own system-level logs to `logs/system.log` and error logs to `logs/system-error.log`.

---

### Requirement 8: Notification System

**User Story:** As a developer, I want to receive Telegram notifications about agent task outcomes and progress, so that I stay informed without actively polling the system.

#### Acceptance Criteria

1. WHEN an agent completes a task successfully, THE Notifier SHALL send a message to NOTIFY_CHAT_ID with the format: `✅ [<agent_name>] selesai dalam <X> detik`.
2. WHEN an agent task fails with an error, THE Notifier SHALL send a message to NOTIFY_CHAT_ID with the format: `❌ [<agent_name>] gagal: <error_message>`.
3. WHILE an agent task is running and has been running for a multiple of PROGRESS_INTERVAL_SEC seconds, THE Notifier SHALL send a progress message to NOTIFY_CHAT_ID with the format: `⏳ [<agent_name>] masih berjalan... (<X>s)`.
4. THE Notifier SHALL load PROGRESS_INTERVAL_SEC from the environment variable, defaulting to 30 seconds if not set.
5. WHEN the NOTIFY_CHAT_ID environment variable is missing at startup, THE Bridge SHALL log a warning and disable the Notifier service without exiting.
6. THE Notifier SHALL send the full agent response text as a follow-up Telegram message after the completion notification.

---

### Requirement 9: GitHub MCP Integration

**User Story:** As a developer, I want all agents to interact with GitHub repositories through the GitHub MCP, so that agents can read code, commit changes, and create pull requests.

#### Acceptance Criteria

1. THE Agent_Manager SHALL configure the GitHub MCP server for all 5 agents using the `GITHUB_TOKEN` environment variable.
2. WHEN an agent is instructed to read repository content, THE Agent SHALL use the GitHub MCP to retrieve file contents and repository structure.
3. WHEN an agent is instructed to commit changes, THE Agent SHALL use the GitHub MCP to create commits in the target repository.
4. WHEN an agent is instructed to create a pull request, THE Agent SHALL use the GitHub MCP to open a PR with the specified title, description, and branch.
5. IF the GITHUB_TOKEN environment variable is missing at startup, THEN THE Bridge SHALL log an error and exit with a non-zero exit code.

---

### Requirement 10: Vercel MCP Integration

**User Story:** As a developer, I want the devops and frontend agents to interact with Vercel through the Vercel MCP, so that deployments can be triggered and monitored programmatically.

#### Acceptance Criteria

1. THE Agent_Manager SHALL configure the Vercel MCP server exclusively for the `devops` and `frontend` agents using the `VERCEL_TOKEN` environment variable.
2. WHEN the `devops` agent is instructed to deploy, THE Agent SHALL use the Vercel MCP to trigger a project deployment.
3. WHEN the `devops` agent is instructed to check build status, THE Agent SHALL use the Vercel MCP to retrieve build logs for the specified project.
4. IF the VERCEL_TOKEN environment variable is missing at startup, THEN THE Bridge SHALL log a warning indicating that Vercel MCP will be unavailable for devops and frontend agents.

---

### Requirement 11: Supabase MCP Integration

**User Story:** As a developer, I want the backend and testing agents to interact with Supabase through the Supabase MCP, so that database schema and data can be managed programmatically.

#### Acceptance Criteria

1. THE Agent_Manager SHALL configure the Supabase MCP server exclusively for the `backend` and `testing` agents using the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.
2. WHEN the `backend` agent is instructed to query the database, THE Agent SHALL use the Supabase MCP to execute SQL queries against the Supabase project.
3. WHEN the `backend` agent is instructed to update the schema, THE Agent SHALL use the Supabase MCP to apply schema migrations.
4. WHEN the `testing` agent is instructed to verify data, THE Agent SHALL use the Supabase MCP to read database state and RLS policies.
5. IF either SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing at startup, THEN THE Bridge SHALL log a warning indicating that Supabase MCP will be unavailable for backend and testing agents.

---

### Requirement 12: Configuration Management

**User Story:** As a developer, I want all system configuration to be managed through environment variables and agent JSON config files, so that the system is portable and easy to reconfigure.

#### Acceptance Criteria

1. THE Bridge SHALL load all configuration from a `.env` file located at `bridge/.env` at startup.
2. THE Bridge SHALL require the following environment variables to be present at startup: `BOT_TOKEN`, `ALLOWED_USERS`, `KIRO_CLI_PATH`, `WORKSPACE_PATH`.
3. THE Agent_Manager SHALL load each agent's configuration from `.kiro/agents/<name>.json` within the WORKSPACE_PATH directory.
4. THE Bridge SHALL load the global MCP server configuration from `.kiro/settings/mcp.json` within the WORKSPACE_PATH directory.
5. WHEN an agent config file is missing or malformed, THE Agent_Manager SHALL log an error for that specific agent and skip spawning it, without preventing other agents from starting.
6. THE Bridge SHALL support the following optional environment variables with documented defaults: `LOG_DIR` (default: `./logs`), `LOG_MAX_SIZE_MB` (default: `10`), `LOG_RETAIN_DAYS` (default: `7`), `PROGRESS_INTERVAL_SEC` (default: `30`).

---

### Requirement 13: PM2 Deployment and Process Management

**User Story:** As a developer, I want the Bridge to run continuously on AWS Lightsail managed by PM2, so that the system is available 24/7 and recovers automatically from unexpected crashes.

#### Acceptance Criteria

1. THE Bridge SHALL be deployable as a PM2 application using an `ecosystem.config.js` file with app name `devmosel-bridge`.
2. THE PM2 configuration SHALL set `watch: false`, `restart_delay: 3000`, and `max_restarts: 10`.
3. THE PM2 configuration SHALL direct stdout logs to `./logs/system.log` and stderr logs to `./logs/system-error.log`.
4. WHEN the Bridge process crashes unexpectedly, PM2 SHALL automatically restart it after 3000ms.
5. IF the Bridge crashes more than 10 times consecutively, THEN PM2 SHALL stop attempting to restart and mark the process as errored.
6. THE Bridge SHALL be compatible with Node.js v20 LTS running on Ubuntu 22.04 LTS.

---

### Requirement 14: Graceful Shutdown

**User Story:** As a developer, I want the Bridge to shut down cleanly when stopped, so that no agent tasks are left in an inconsistent state.

#### Acceptance Criteria

1. WHEN the Bridge receives a SIGTERM signal, THE Bridge SHALL initiate a graceful shutdown sequence.
2. WHEN graceful shutdown is initiated, THE Agent_Manager SHALL send a cancellation signal to all currently `busy` agents before terminating their child processes.
3. WHEN graceful shutdown is initiated, THE Logger SHALL flush all pending log entries to disk before the process exits.
4. WHEN graceful shutdown is initiated, THE Bridge SHALL complete the shutdown sequence within 10 seconds, after which it SHALL force-terminate any remaining child processes.
5. WHEN the Bridge receives a SIGINT signal, THE Bridge SHALL follow the same graceful shutdown sequence as for SIGTERM.

---

### Requirement 15: Agent Response Delivery

**User Story:** As a developer, I want agent responses to be delivered back to me via Telegram, so that I can see the results of each task on my phone.

#### Acceptance Criteria

1. WHEN an agent produces a response, THE Telegram_Adapter SHALL send the response text back to the originating Telegram chat.
2. WHEN an agent response exceeds 4096 characters (Telegram message limit), THE Telegram_Adapter SHALL split the response into multiple sequential messages.
3. WHEN an agent task fails, THE Telegram_Adapter SHALL send an error message to the originating chat describing the failure.
4. WHILE an agent is processing a task, THE Telegram_Adapter SHALL send a typing indicator to the originating chat every 5 seconds to indicate activity.
5. WHEN the `/logs <name>` command is received for a non-existent agent name, THE Telegram_Adapter SHALL reply with an error message listing valid agent names.

---

### Requirement 16: Security

**User Story:** As a developer, I want the system to protect sensitive credentials and prevent unauthorized access, so that API tokens and infrastructure are not exposed.

#### Acceptance Criteria

1. THE Bridge SHALL never log the values of any environment variables containing tokens, keys, or secrets (BOT_TOKEN, GITHUB_TOKEN, VERCEL_TOKEN, SUPABASE_SERVICE_ROLE_KEY).
2. THE Bridge SHALL never include token or secret values in any Telegram message sent to any chat.
3. THE Bridge SHALL store all secrets exclusively in the `bridge/.env` file, which SHALL be excluded from version control via `.gitignore`.
4. WHEN an agent task involves reading or writing files, THE Agent_Manager SHALL restrict agent file access to within the WORKSPACE_PATH directory.
5. THE Telegram_Adapter SHALL validate that all incoming Telegram updates originate from the Telegram Bot API before processing them.

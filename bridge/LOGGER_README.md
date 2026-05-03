# Logger Module

The Logger module provides structured NDJSON logging for the Telegram-Kiro-Bot Bridge application.

## Features

- **NDJSON Format**: Each log entry is a single JSON object per line
- **Agent-Specific Files**: Logs are written to `logs/agent-<name>.log`
- **Automatic Rotation**: Log files are rotated when they reach the configured size limit
- **Log Retention**: Old rotated logs are automatically cleaned up after the retention period
- **Query Interface**: Retrieve recent log entries for any agent
- **Graceful Shutdown**: Flush and close all log streams cleanly

## Requirements Implemented

- **7.1**: NDJSON format to agent-specific files (`logs/agent-<name>.log`)
- **7.2**: Log prompt entries with fields: `ts`, `level`, `agent`, `type`, `from`, `text`
- **7.3**: Log tool_call entries with fields: `ts`, `level`, `agent`, `type`, `tool`, `path`
- **7.4**: Log response_complete entries with fields: `ts`, `level`, `agent`, `type`, `duration_ms`, `chars`
- **7.5**: Log agent_crash entries with fields: `ts`, `level`, `agent`, `type`, `message`, `action`
- **7.7**: Support for system-level logs (handled by Bridge application)

## Configuration

The Logger module uses the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_DIR` | `./logs` | Directory for log files |
| `LOG_MAX_SIZE_MB` | `10` | Maximum log file size before rotation (MB) |
| `LOG_RETAIN_DAYS` | `7` | Number of days to retain rotated logs |

## Usage

### Initialize Logger

```javascript
const Logger = require('./logger');
const logger = new Logger();
```

### Log Entries

#### Prompt Entry
```javascript
logger.log({
  level: 'info',
  agent: 'backend',
  type: 'prompt',
  from: '123456789',
  text: 'Implement user authentication'
});
```

#### Tool Call Entry
```javascript
logger.log({
  level: 'info',
  agent: 'backend',
  type: 'tool_call',
  tool: 'fsWrite',
  path: 'src/auth.js'
});
```

#### Response Complete Entry
```javascript
logger.log({
  level: 'info',
  agent: 'backend',
  type: 'response_complete',
  duration_ms: 45633,
  chars: 2847
});
```

#### Agent Crash Entry
```javascript
logger.log({
  level: 'error',
  agent: 'backend',
  type: 'agent_crash',
  message: 'Exit code 1, signal null',
  action: 'reconnecting'
});
```

### Query Logs

Retrieve the last N log entries for an agent:

```javascript
const recentLogs = logger.queryLogs('backend', 20);
// Returns array of log entries, most recent first
```

### Graceful Shutdown

Flush all pending writes and close streams:

```javascript
await logger.flush();
```

## Log Entry Format

All log entries include these base fields:

- `ts`: ISO 8601 timestamp (auto-generated if not provided)
- `level`: Log level (`info`, `warn`, `error`)
- `agent`: Agent name
- `type`: Entry type (`prompt`, `tool_call`, `response_complete`, `agent_crash`)

Additional fields depend on the entry type (see examples above).

## Log Rotation

- Log files are automatically rotated when they reach `LOG_MAX_SIZE_MB`
- Rotated files are named: `agent-<name>.log.<ISO-timestamp>`
- Old rotated logs are cleaned up after `LOG_RETAIN_DAYS`

## Example Log File

```
{"level":"info","agent":"backend","type":"prompt","from":"123456789","text":"Implement user authentication","ts":"2025-01-15T10:30:45.123Z"}
{"level":"info","agent":"backend","type":"tool_call","tool":"fsWrite","path":"src/auth.js","ts":"2025-01-15T10:30:47.456Z"}
{"level":"info","agent":"backend","type":"response_complete","duration_ms":45633,"chars":2847,"ts":"2025-01-15T10:31:30.789Z"}
```

## Integration with Bridge

The Logger module is used throughout the Bridge application:

1. **Agent_Manager**: Logs prompts, responses, and crashes
2. **ACP_Client**: Logs tool calls
3. **Telegram_Adapter**: Can query logs for `/logs` command

See `logger-example.js` for complete usage examples.

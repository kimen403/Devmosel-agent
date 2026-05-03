# Crash Recovery Flow Diagram

## Overview

This document illustrates the crash detection and recovery flow implemented in Task 5.4.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Running Normally                       │
│                         (state: idle)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Agent crashes
                             │ (exit code ≠ 0)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Exit Event Triggered                          │
│                                                                   │
│  childProcess.on('exit', (code, signal) => {                    │
│    if (code !== 0) { /* crash detected */ }                     │
│  })                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Log Crash Event                               │
│                                                                   │
│  logger.log({                                                    │
│    level: 'error',                                               │
│    agent: agentName,                                             │
│    type: 'agent_crash',                                          │
│    message: 'Agent exited: code=X, signal=Y',                   │
│    action: 'reconnecting',                                       │
│    attempt: N                                                    │
│  })                                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Check Reconnect Attempts                            │
│                                                                   │
│  attempts = reconnectAttempts.get(agentName)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
    attempts < 10                    attempts >= 10
                │                         │
                ▼                         ▼
┌───────────────────────────┐  ┌──────────────────────────────┐
│  Send Reconnect Notice    │  │  Mark Agent Unavailable      │
│                           │  │                              │
│  🔄 [agent] reconnecting  │  │  state = 'unavailable'       │
└────────────┬──────────────┘  │                              │
             │                  │  ❌ [agent] gagal restart    │
             │                  │  setelah 10 percobaan        │
             ▼                  └──────────────────────────────┘
┌───────────────────────────┐            │
│  Increment Attempt Count  │            │
│                           │            │
│  attempts++               │            │
└────────────┬──────────────┘            │
             │                            │
             ▼                            │
┌───────────────────────────┐            │
│  Wait 3000ms              │            │
│                           │            │
│  setTimeout(() => {       │            │
│    spawnAgent()           │            │
│  }, 3000)                 │            │
└────────────┬──────────────┘            │
             │                            │
             ▼                            │
┌───────────────────────────┐            │
│  Spawn New Agent Process  │            │
│                           │            │
│  - Load agent config      │            │
│  - Load MCP config        │            │
│  - spawn(kiro, ['acp'])   │            │
│  - Setup crash recovery   │            │
└────────────┬──────────────┘            │
             │                            │
    ┌────────┴────────┐                  │
    │                 │                  │
  Success           Failure              │
    │                 │                  │
    ▼                 ▼                  │
┌─────────┐  ┌──────────────────┐       │
│ Reset   │  │ Log Reconnect    │       │
│ Counter │  │ Failed           │       │
│         │  │                  │       │
│ attempts│  │ (Will retry on   │       │
│ = 0     │  │  next crash)     │       │
└─────────┘  └──────────────────┘       │
    │                                    │
    ▼                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Ready                                  │
│                   (state: idle)                                  │
└─────────────────────────────────────────────────────────────────┘
```

## State Transitions

### Normal Operation
```
idle → busy → idle → busy → idle ...
```

### Crash and Recovery
```
idle → [CRASH] → [reconnecting] → idle
```

### Multiple Crashes
```
idle → [CRASH 1] → [reconnecting] → idle
     → [CRASH 2] → [reconnecting] → idle
     → [CRASH 3] → [reconnecting] → idle
     ...
     → [CRASH 10] → [reconnecting] → idle
     → [CRASH 11] → unavailable (permanent)
```

## Timeline Example

```
T+0s    : Agent running normally (state: idle)
T+10s   : Agent crashes (exit code 1)
T+10s   : Crash detected, logged, notification sent
T+10s   : Reconnect attempt counter: 0 → 1
T+13s   : New agent spawned (after 3000ms delay)
T+13s   : New agent ready (state: idle)
T+13s   : Reconnect counter reset: 1 → 0
```

## Code Flow

### 1. Agent Spawning
```javascript
spawnAgent(agentName, mcpConfig)
  ├─ Load agent config
  ├─ spawn(kiroCliPath, ['acp'])
  ├─ Register with ACP client
  ├─ Set state to 'idle'
  ├─ Reset reconnect attempts to 0
  └─ setupCrashRecovery(agentName, child)
```

### 2. Crash Detection
```javascript
setupCrashRecovery(agentName, childProcess)
  └─ childProcess.on('exit', (code, signal) => {
       if (code !== 0) {
         ├─ Get current attempts
         ├─ Log crash event
         │
         ├─ if (attempts < MAX_RECONNECT_ATTEMPTS)
         │    ├─ Send reconnect notification
         │    ├─ Increment attempts
         │    └─ setTimeout(() => {
         │         └─ spawnAgent(agentName, mcpConfig)
         │       }, 3000)
         │
         └─ else
              ├─ Set state to 'unavailable'
              ├─ Send error notification
              └─ Log unavailable event
       }
     })
```

## Key Features

### 1. Isolation
- Each agent has independent crash tracking
- One agent's crash doesn't affect others
- Bridge process continues running

### 2. Persistence
- Up to 10 reconnect attempts per agent
- 3-second delay between attempts
- Automatic recovery without manual intervention

### 3. Observability
- All crashes logged with details
- Telegram notifications for each event
- Attempt counter visible in logs

### 4. Graceful Degradation
- After 10 failures, agent marked unavailable
- System continues with remaining agents
- Clear notification of permanent failure

## Testing Scenarios

### Scenario 1: Transient Failure
```
Agent crashes → Reconnects successfully → Continues working
Result: ✅ Recovered automatically
```

### Scenario 2: Persistent Failure
```
Agent crashes → Reconnects → Crashes again → ... (10 times)
Result: ❌ Marked unavailable after 10 attempts
```

### Scenario 3: Intermittent Failures
```
Agent works → Crashes → Recovers → Works for hours → Crashes again
Result: ✅ Gets fresh 10 attempts after successful recovery
```

### Scenario 4: Multiple Agent Crashes
```
Backend crashes → Reconnecting
Frontend crashes → Reconnecting (independent)
Both recover successfully
Result: ✅ Both agents operational
```

## Monitoring

### Log Entries to Watch

**Crash Event:**
```json
{
  "ts": "2026-05-02T22:24:49.140Z",
  "level": "error",
  "agent": "backend",
  "type": "agent_crash",
  "message": "Agent exited unexpectedly: code=1, signal=null",
  "action": "reconnecting",
  "attempt": 1
}
```

**Successful Reconnection:**
```json
{
  "ts": "2026-05-02T22:24:52.150Z",
  "level": "info",
  "agent": "backend",
  "type": "agent_reconnected",
  "message": "Agent reconnected successfully after crash",
  "attempt": 1
}
```

**Agent Unavailable:**
```json
{
  "ts": "2026-05-02T22:30:15.500Z",
  "level": "error",
  "agent": "backend",
  "type": "agent_unavailable",
  "message": "Agent marked as unavailable after 10 failed reconnect attempts"
}
```

### Telegram Notifications

**Reconnecting:**
```
🔄 [backend] reconnecting...
```

**Unavailable:**
```
❌ [backend] gagal restart setelah 10 percobaan
```

## Configuration

### Environment Variables
- `KIRO_CLI_PATH`: Path to Kiro CLI executable
- `WORKSPACE_PATH`: Path to workspace directory
- `NOTIFY_CHAT_ID`: Telegram chat for notifications

### Constants
- `MAX_RECONNECT_ATTEMPTS`: 10 (hardcoded)
- `RECONNECT_DELAY_MS`: 3000 (hardcoded)

## Conclusion

The crash recovery system provides robust, automatic recovery from agent failures while maintaining system stability and providing clear observability through logs and notifications.

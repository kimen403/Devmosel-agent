const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ACPClient = require('./acp-client');

/**
 * Agent_Manager module for managing lifecycle of 5 Kiro CLI child processes
 * Implements Requirements 2.1, 2.2, 2.5, 12.3, 12.4
 */
class AgentManager {
  constructor(logger, notifier) {
    this.logger = logger;
    this.notifier = notifier;
    this.acpClient = new ACPClient(logger);
    
    // Agent state map: agentName -> AgentState
    this.agentStates = new Map();
    
    // Agent process map: agentName -> ChildProcess
    this.agentProcesses = new Map();
    
    // Agent names
    this.agentNames = ['backend', 'frontend', 'testing', 'devops', 'reviewer'];
    
    // Crash recovery tracking
    this.reconnectAttempts = new Map(); // agentName -> attempt count
    this.MAX_RECONNECT_ATTEMPTS = 10;
    
    // Setup ACP client event handlers
    this.setupACPEventHandlers();
  }

  /**
   * Initialize and spawn all 5 Kiro CLI agents
   * Implements Requirement 2.1
   * @returns {Promise<void>}
   */
  async initialize() {
    this.logger.log({
      level: 'info',
      agent: 'system',
      type: 'agent_manager_init',
      message: 'Initializing Agent Manager and spawning 5 agents'
    });

    // Load MCP configuration once (shared by all agents)
    const mcpConfig = this.loadMCPConfig();

    // Spawn all agents
    const spawnPromises = this.agentNames.map(agentName => 
      this.spawnAgent(agentName, mcpConfig)
    );

    // Wait for all agents to spawn
    const results = await Promise.allSettled(spawnPromises);

    // Check results
    const successful = [];
    const failed = [];

    results.forEach((result, index) => {
      const agentName = this.agentNames[index];
      if (result.status === 'fulfilled') {
        successful.push(agentName);
      } else {
        failed.push({ agent: agentName, error: result.reason.message });
        this.logger.log({
          level: 'error',
          agent: agentName,
          type: 'spawn_failed',
          message: result.reason.message
        });
      }
    });

    this.logger.log({
      level: 'info',
      agent: 'system',
      type: 'agent_manager_ready',
      message: `Agent Manager initialized: ${successful.length} agents spawned, ${failed.length} failed`,
      successful,
      failed
    });

    if (successful.length > 0) {
      this.notifier?.send(`✅ Agent Manager ready: ${successful.length}/${this.agentNames.length} agents spawned`);
    }

    if (failed.length > 0) {
      this.notifier?.send(`⚠️ Failed to spawn agents: ${failed.map(f => f.agent).join(', ')}`);
    }
  }

  /**
   * Load MCP configuration from .kiro/settings/mcp.json
   * Implements Requirement 12.4
   * @returns {Object} MCP configuration object
   */
  loadMCPConfig() {
    const workspacePath = process.env.WORKSPACE_PATH;
    if (!workspacePath) {
      throw new Error('WORKSPACE_PATH environment variable not set');
    }

    const mcpConfigPath = path.join(workspacePath, '.kiro/settings/mcp.json');

    try {
      const configContent = fs.readFileSync(mcpConfigPath, 'utf8');
      const config = JSON.parse(configContent);

      // Substitute environment variables in MCP config
      const processedConfig = this.substituteEnvVars(config);

      this.logger.log({
        level: 'info',
        agent: 'system',
        type: 'mcp_config_loaded',
        message: `Loaded MCP configuration from ${mcpConfigPath}`,
        servers: Object.keys(processedConfig.mcpServers || {})
      });

      return processedConfig;
    } catch (err) {
      this.logger.log({
        level: 'error',
        agent: 'system',
        type: 'mcp_config_error',
        message: `Failed to load MCP configuration: ${err.message}`,
        path: mcpConfigPath
      });
      throw new Error(`Failed to load MCP configuration from ${mcpConfigPath}: ${err.message}`);
    }
  }

  /**
   * Load agent configuration from .kiro/agents/<name>.json
   * Implements Requirement 2.5, 12.3
   * @param {string} agentName - Agent name
   * @returns {Object} Agent configuration object
   */
  loadAgentConfig(agentName) {
    const workspacePath = process.env.WORKSPACE_PATH;
    const configPath = path.join(workspacePath, '.kiro/agents', `${agentName}.json`);

    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configContent);

      this.logger.log({
        level: 'info',
        agent: agentName,
        type: 'agent_config_loaded',
        message: `Loaded agent configuration from ${configPath}`,
        mcpServers: config.mcpServers || []
      });

      return {
        name: config.name,
        description: config.description,
        systemPrompt: config.systemPrompt,
        tools: config.tools,
        mcpServers: config.mcpServers
      };
    } catch (err) {
      this.logger.log({
        level: 'error',
        agent: agentName,
        type: 'agent_config_error',
        message: `Failed to load agent configuration: ${err.message}`,
        path: configPath
      });
      throw new Error(`Failed to load agent configuration for ${agentName}: ${err.message}`);
    }
  }

  /**
   * Spawn a single Kiro CLI agent child process
   * Implements Requirement 2.1
   * @param {string} agentName - Agent name
   * @param {Object} mcpConfig - MCP configuration object
   * @returns {Promise<void>}
   */
  async spawnAgent(agentName, mcpConfig) {
    try {
      // Load agent configuration
      const agentConfig = this.loadAgentConfig(agentName);

      // Get Kiro CLI path
      const kiroCliPath = process.env.KIRO_CLI_PATH;
      if (!kiroCliPath) {
        throw new Error('KIRO_CLI_PATH environment variable not set');
      }

      const workspacePath = process.env.WORKSPACE_PATH;

      // Spawn child process
      const child = spawn(kiroCliPath, ['acp'], {
        cwd: workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          KIRO_AGENT_NAME: agentName,
          KIRO_AGENT_CONFIG: JSON.stringify(agentConfig),
          KIRO_MCP_CONFIG: JSON.stringify(mcpConfig)
        }
      });

      // Store process reference
      this.agentProcesses.set(agentName, child);

      // Register with ACP client
      this.acpClient.registerAgent(agentName, child);

      // Initialize agent state to idle (Requirement 2.2)
      this.agentStates.set(agentName, {
        name: agentName,
        state: 'idle',
        currentTask: null,
        lastActivity: Date.now(),
        reconnectAttempts: 0,
        processId: child.pid
      });

      // Reset reconnect attempts
      this.reconnectAttempts.set(agentName, 0);

      // Setup crash recovery
      this.setupCrashRecovery(agentName, child);

      this.logger.log({
        level: 'info',
        agent: agentName,
        type: 'agent_spawned',
        message: `Agent spawned successfully`,
        pid: child.pid
      });

    } catch (err) {
      this.logger.log({
        level: 'error',
        agent: agentName,
        type: 'spawn_error',
        message: `Failed to spawn agent: ${err.message}`
      });
      throw err;
    }
  }

  /**
   * Setup crash detection and recovery for an agent
   * Implements Requirement 3.1, 3.2, 3.3, 3.4, 3.5
   * @param {string} agentName - Agent name
   * @param {ChildProcess} childProcess - Child process
   */
  setupCrashRecovery(agentName, childProcess) {
    childProcess.on('exit', (code, signal) => {
      // Only handle unexpected exits (code !== 0)
      if (code !== 0) {
        const attempts = this.reconnectAttempts.get(agentName) || 0;

        this.logger.log({
          level: 'error',
          agent: agentName,
          type: 'agent_crash',
          message: `Agent exited unexpectedly: code=${code}, signal=${signal}`,
          action: 'reconnecting',
          attempt: attempts + 1
        });

        // Check if we should attempt reconnect
        if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
          // Send reconnect notification (Requirement 3.2)
          this.notifier?.send(`🔄 [${agentName}] reconnecting...`);

          // Increment reconnect attempts
          this.reconnectAttempts.set(agentName, attempts + 1);

          // Wait 3000ms before reconnecting (Requirement 3.4)
          setTimeout(async () => {
            try {
              const mcpConfig = this.loadMCPConfig();
              await this.spawnAgent(agentName, mcpConfig);
              
              this.logger.log({
                level: 'info',
                agent: agentName,
                type: 'agent_reconnected',
                message: `Agent reconnected successfully after crash`,
                attempt: attempts + 1
              });
            } catch (err) {
              this.logger.log({
                level: 'error',
                agent: agentName,
                type: 'reconnect_failed',
                message: `Failed to reconnect agent: ${err.message}`,
                attempt: attempts + 1
              });
            }
          }, 3000);
        } else {
          // Max reconnect attempts reached (Requirement 3.5)
          this.agentStates.set(agentName, {
            ...this.agentStates.get(agentName),
            state: 'unavailable'
          });

          this.notifier?.send(`❌ [${agentName}] gagal restart setelah ${this.MAX_RECONNECT_ATTEMPTS} percobaan`);

          this.logger.log({
            level: 'error',
            agent: agentName,
            type: 'agent_unavailable',
            message: `Agent marked as unavailable after ${this.MAX_RECONNECT_ATTEMPTS} failed reconnect attempts`
          });
        }
      }
    });
  }

  /**
   * Setup ACP client event handlers
   */
  setupACPEventHandlers() {
    this.acpClient.on('agentError', ({ agentName, error }) => {
      this.logger.log({
        level: 'error',
        agent: agentName,
        type: 'agent_error',
        message: error
      });
    });

    this.acpClient.on('agentExit', ({ agentName, code, signal }) => {
      // Update agent state
      const state = this.agentStates.get(agentName);
      if (state) {
        state.lastActivity = Date.now();
      }
    });
  }

  /**
   * Dispatch a prompt to a specific agent
   * @param {string} agentName - Agent name
   * @param {string} prompt - Prompt text
   * @param {Object} context - Context object with chatId, userId, messageId
   * @returns {Promise<string>} Agent response
   */
  async dispatch(agentName, prompt, context) {
    // Check if agent exists
    const state = this.agentStates.get(agentName);
    if (!state) {
      throw new Error(`Agent ${agentName} not found`);
    }

    // Check if agent is available
    if (state.state === 'unavailable') {
      throw new Error(`Agent ${agentName} is unavailable`);
    }

    // Check if agent is busy
    if (state.state === 'busy') {
      throw new Error(`Agent ${agentName} is currently busy`);
    }

    // Set agent state to busy
    state.state = 'busy';
    state.currentTask = {
      prompt,
      startTime: Date.now(),
      context
    };
    state.lastActivity = Date.now();

    // Log prompt dispatch
    this.logger.log({
      level: 'info',
      agent: agentName,
      type: 'prompt',
      from: context.userId,
      text: prompt
    });

    try {
      // Send prompt via ACP client
      const response = await this.acpClient.sendPrompt(agentName, prompt);

      // Calculate duration
      const duration = Date.now() - state.currentTask.startTime;

      // Log response complete
      this.logger.log({
        level: 'info',
        agent: agentName,
        type: 'response_complete',
        duration_ms: duration,
        chars: response.length
      });

      // Transition agent state to idle (Requirement 2.3)
      state.state = 'idle';
      state.currentTask = null;
      state.lastActivity = Date.now();

      return response;
    } catch (err) {
      // Log error
      this.logger.log({
        level: 'error',
        agent: agentName,
        type: 'dispatch_error',
        message: err.message
      });

      // Transition agent state to idle
      state.state = 'idle';
      state.currentTask = null;
      state.lastActivity = Date.now();

      throw err;
    }
  }

  /**
   * Broadcast a prompt to all agents in parallel
   * @param {string} prompt - Prompt text
   * @param {Object} context - Context object
   * @returns {Promise<Object>} Broadcast result with successful/failed agents
   */
  async broadcastPrompt(prompt, context) {
    const startTime = Date.now();

    // Check all agents are idle
    for (const name of this.agentNames) {
      const state = this.agentStates.get(name);
      if (!state || state.state !== 'idle') {
        throw new Error(`Agent ${name} is currently ${state?.state || 'unknown'}`);
      }
    }

    // Dispatch to all agents in parallel
    const results = await Promise.allSettled(
      this.agentNames.map(name => this.dispatch(name, prompt, context))
    );

    const duration = Date.now() - startTime;

    // Categorize results
    const successful = [];
    const failed = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(this.agentNames[index]);
      } else {
        failed.push({
          agent: this.agentNames[index],
          error: result.reason.message
        });
      }
    });

    return { successful, failed, duration };
  }

  /**
   * Cancel a running task for an agent
   * Implements Requirement 4.8
   * @param {string} agentName - Agent name
   * @returns {Promise<void>}
   */
  async cancelTask(agentName) {
    const state = this.agentStates.get(agentName);
    if (!state) {
      throw new Error(`Agent ${agentName} not found`);
    }

    if (state.state !== 'busy') {
      throw new Error(`Agent ${agentName} has no running task`);
    }

    this.logger.log({
      level: 'info',
      agent: agentName,
      type: 'task_cancelling',
      message: 'Cancelling task and restarting agent'
    });

    // Get the child process
    const childProcess = this.agentProcesses.get(agentName);
    if (!childProcess) {
      throw new Error(`Agent ${agentName} process not found`);
    }

    // Cancel pending requests in ACP client
    this.acpClient.cancelPendingRequests(agentName);

    // Unregister from ACP client
    this.acpClient.unregisterAgent(agentName);

    // Send SIGTERM to the agent's child process
    childProcess.kill('SIGTERM');

    // Wait for process to exit (with timeout)
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if not exited after 2 seconds
        if (!childProcess.killed) {
          childProcess.kill('SIGKILL');
        }
        resolve();
      }, 2000);

      childProcess.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // Transition agent state to idle
    state.state = 'idle';
    state.currentTask = null;
    state.lastActivity = Date.now();

    this.logger.log({
      level: 'info',
      agent: agentName,
      type: 'task_cancelled',
      message: 'Task cancelled, spawning new agent process'
    });

    // Spawn new child process to replace cancelled agent
    try {
      const mcpConfig = this.loadMCPConfig();
      await this.spawnAgent(agentName, mcpConfig);

      this.logger.log({
        level: 'info',
        agent: agentName,
        type: 'agent_replaced',
        message: 'New agent process spawned after cancellation'
      });
    } catch (err) {
      this.logger.log({
        level: 'error',
        agent: agentName,
        type: 'spawn_after_cancel_failed',
        message: `Failed to spawn new agent after cancellation: ${err.message}`
      });
      
      // Mark agent as unavailable if spawn fails
      state.state = 'unavailable';
      throw new Error(`Failed to spawn new agent after cancellation: ${err.message}`);
    }
  }

  /**
   * Get agent state
   * @param {string} agentName - Agent name
   * @returns {string} Agent state: 'idle', 'busy', 'unavailable'
   */
  getAgentState(agentName) {
    const state = this.agentStates.get(agentName);
    return state ? state.state : 'unavailable';
  }

  /**
   * Get all agent states
   * @returns {Map<string, Object>} Map of agent name to state object
   */
  getAllAgentStates() {
    return new Map(this.agentStates);
  }

  /**
   * Graceful shutdown - terminate all agent child processes
   * Implements Requirements 14.1, 14.2, 14.4
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.logger.log({
      level: 'info',
      agent: 'system',
      type: 'agent_manager_shutdown',
      message: 'Shutting down Agent Manager and terminating all agents'
    });

    // Send cancellation signals to all busy agents (Requirement 14.1)
    const busyAgents = [];
    for (const [agentName, state] of this.agentStates.entries()) {
      if (state.state === 'busy') {
        busyAgents.push(agentName);
        
        // Cancel pending requests in ACP client
        this.acpClient.cancelPendingRequests(agentName);
        
        // Get the child process and send SIGTERM
        const childProcess = this.agentProcesses.get(agentName);
        if (childProcess && !childProcess.killed) {
          childProcess.kill('SIGTERM');
          
          this.logger.log({
            level: 'info',
            agent: agentName,
            type: 'cancellation_signal_sent',
            message: 'Sent SIGTERM to busy agent during shutdown'
          });
        }
      }
    }

    if (busyAgents.length > 0) {
      this.logger.log({
        level: 'info',
        agent: 'system',
        type: 'busy_agents_cancelled',
        message: `Sent cancellation signals to ${busyAgents.length} busy agents: ${busyAgents.join(', ')}`
      });
    }

    // Wait up to 10 seconds for all agents to terminate gracefully (Requirement 14.2)
    const SHUTDOWN_TIMEOUT_MS = 10000;
    const shutdownStartTime = Date.now();

    const terminatePromises = [];

    for (const [agentName, child] of this.agentProcesses.entries()) {
      terminatePromises.push(
        new Promise((resolve) => {
          // Unregister from ACP client
          this.acpClient.unregisterAgent(agentName);

          // If process is not already being killed, send SIGTERM
          if (!child.killed) {
            child.kill('SIGTERM');
          }

          // Wait for exit
          const exitHandler = () => {
            this.logger.log({
              level: 'info',
              agent: agentName,
              type: 'agent_terminated',
              message: 'Agent terminated gracefully during shutdown'
            });
            resolve();
          };

          child.once('exit', exitHandler);
        })
      );
    }

    // Race between all processes terminating and the 10-second timeout
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(resolve, SHUTDOWN_TIMEOUT_MS);
    });

    await Promise.race([
      Promise.all(terminatePromises),
      timeoutPromise
    ]);

    const elapsedTime = Date.now() - shutdownStartTime;

    // Force-terminate any remaining processes after timeout (Requirement 14.4)
    const remainingProcesses = [];
    for (const [agentName, child] of this.agentProcesses.entries()) {
      // Check if process is still running (exitCode is null means not exited yet)
      if (child.exitCode === null) {
        remainingProcesses.push(agentName);
        child.kill('SIGKILL');
        
        this.logger.log({
          level: 'warn',
          agent: agentName,
          type: 'agent_force_terminated',
          message: 'Agent force-terminated with SIGKILL after timeout'
        });
      }
    }

    if (remainingProcesses.length > 0) {
      this.logger.log({
        level: 'warn',
        agent: 'system',
        type: 'force_termination',
        message: `Force-terminated ${remainingProcesses.length} agents after ${elapsedTime}ms: ${remainingProcesses.join(', ')}`
      });
    }

    this.logger.log({
      level: 'info',
      agent: 'system',
      type: 'agent_manager_shutdown_complete',
      message: `All agents terminated in ${elapsedTime}ms`
    });
  }

  /**
   * Substitute environment variables in configuration object
   * Replaces ${VAR_NAME} with process.env.VAR_NAME
   * @param {Object} obj - Configuration object
   * @returns {Object} Processed configuration object
   */
  substituteEnvVars(obj) {
    if (typeof obj === 'string') {
      // Replace ${VAR_NAME} with environment variable value
      return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        return process.env[varName] || match;
      });
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.substituteEnvVars(item));
    } else if (typeof obj === 'object' && obj !== null) {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteEnvVars(value);
      }
      return result;
    }
    return obj;
  }
}

module.exports = AgentManager;

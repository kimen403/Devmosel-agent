const EventEmitter = require('events');

/**
 * ACP_Client module for JSON-RPC 2.0 communication with Kiro CLI agents over stdio
 * Implements Requirements 5.1, 5.2, 5.3, 5.4, 5.6
 */
class ACPClient extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.agents = new Map(); // agentName -> { process, buffer, pendingRequests }
  }

  /**
   * Register a Kiro CLI child process for an agent
   * @param {string} agentName - Agent name
   * @param {ChildProcess} childProcess - Spawned Kiro CLI process
   */
  registerAgent(agentName, childProcess) {
    const agentData = {
      process: childProcess,
      buffer: '',
      pendingRequests: new Map() // requestId -> { resolve, reject, chunks }
    };

    this.agents.set(agentName, agentData);
    this.setupStdioHandlers(agentName, childProcess);
  }

  /**
   * Unregister an agent (cleanup)
   * @param {string} agentName - Agent name
   */
  unregisterAgent(agentName) {
    const agent = this.agents.get(agentName);
    if (agent) {
      // Reject all pending requests
      for (const [requestId, pending] of agent.pendingRequests.entries()) {
        pending.reject(new Error(`Agent ${agentName} unregistered`));
      }
      agent.pendingRequests.clear();
      this.agents.delete(agentName);
    }
  }

  /**
   * Send a prompt to an agent using JSON-RPC 2.0 session/prompt request
   * @param {string} agentName - Agent name
   * @param {string} prompt - Prompt text
   * @returns {Promise<string>} Full response text
   */
  async sendPrompt(agentName, prompt) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not registered`);
    }

    // Generate unique request ID
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Build JSON-RPC 2.0 request
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'session/prompt',
      params: {
        prompt,
        autoApprove: true // Auto-approve all tool calls (Requirement 5.6)
      }
    };

    // Write request to agent's stdin
    try {
      agent.process.stdin.write(JSON.stringify(request) + '\n');
    } catch (err) {
      throw new Error(`Failed to write to agent ${agentName} stdin: ${err.message}`);
    }

    // Wait for response
    return new Promise((resolve, reject) => {
      agent.pendingRequests.set(requestId, {
        resolve,
        reject,
        chunks: []
      });

      // Set timeout for request (5 minutes)
      const timeout = setTimeout(() => {
        const pending = agent.pendingRequests.get(requestId);
        if (pending) {
          agent.pendingRequests.delete(requestId);
          reject(new Error(`Request timeout for agent ${agentName} after 5 minutes`));
        }
      }, 5 * 60 * 1000);

      // Clear timeout when request completes
      const originalResolve = resolve;
      const originalReject = reject;

      agent.pendingRequests.get(requestId).resolve = (result) => {
        clearTimeout(timeout);
        originalResolve(result);
      };

      agent.pendingRequests.get(requestId).reject = (error) => {
        clearTimeout(timeout);
        originalReject(error);
      };
    });
  }

  /**
   * Setup stdio handlers for newline-delimited JSON messages
   * @param {string} agentName - Agent name
   * @param {ChildProcess} childProcess - Child process
   */
  setupStdioHandlers(agentName, childProcess) {
    const agent = this.agents.get(agentName);

    // Handle stdout data (JSON-RPC responses)
    childProcess.stdout.on('data', (data) => {
      agent.buffer += data.toString();

      // Process complete JSON-RPC messages (newline-delimited)
      const lines = agent.buffer.split('\n');
      agent.buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.handleMessage(agentName, message);
          } catch (err) {
            if (this.logger) {
              this.logger.log({
                level: 'error',
                agent: agentName,
                type: 'parse_error',
                message: `Failed to parse JSON-RPC message: ${err.message}`,
                line: line.substring(0, 200) // Log first 200 chars
              });
            }
          }
        }
      }
    });

    // Handle stderr (log errors)
    childProcess.stderr.on('data', (data) => {
      const errorText = data.toString();
      if (this.logger) {
        this.logger.log({
          level: 'error',
          agent: agentName,
          type: 'stderr',
          message: errorText
        });
      }
      this.emit('agentError', { agentName, error: errorText });
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      // Reject all pending requests for this agent
      for (const [requestId, pending] of agent.pendingRequests.entries()) {
        pending.reject(new Error(`Agent ${agentName} exited with code ${code}, signal ${signal}`));
      }
      agent.pendingRequests.clear();
      
      this.emit('agentExit', { agentName, code, signal });
    });
  }

  /**
   * Handle a JSON-RPC message from an agent
   * @param {string} agentName - Agent name
   * @param {Object} message - Parsed JSON-RPC message
   */
  handleMessage(agentName, message) {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    // Validate JSON-RPC 2.0 format
    if (message.jsonrpc !== '2.0' || !message.id) {
      if (this.logger) {
        this.logger.log({
          level: 'warn',
          agent: agentName,
          type: 'invalid_message',
          message: 'Received message without valid JSON-RPC 2.0 format'
        });
      }
      return;
    }

    const pending = agent.pendingRequests.get(message.id);
    if (!pending) {
      // Response for unknown request ID - might be late or duplicate
      return;
    }

    // Handle error response
    if (message.error) {
      pending.reject(new Error(message.error.message || 'Unknown JSON-RPC error'));
      agent.pendingRequests.delete(message.id);
      return;
    }

    // Handle result response
    if (message.result) {
      const result = message.result;

      // Handle streaming chunks
      if (result.type === 'chunk') {
        pending.chunks.push(result.content || '');
      }
      // Handle complete response
      else if (result.type === 'complete') {
        const fullResponse = pending.chunks.join('') + (result.content || '');
        pending.resolve(fullResponse);
        agent.pendingRequests.delete(message.id);
      }
      // Handle single response (non-streaming)
      else if (typeof result === 'string') {
        pending.resolve(result);
        agent.pendingRequests.delete(message.id);
      }
      // Handle object response
      else if (result.content) {
        const fullResponse = pending.chunks.join('') + result.content;
        pending.resolve(fullResponse);
        agent.pendingRequests.delete(message.id);
      }
      // Unknown result format
      else {
        pending.resolve(JSON.stringify(result));
        agent.pendingRequests.delete(message.id);
      }
    }
  }

  /**
   * Check if an agent is registered and ready
   * @param {string} agentName - Agent name
   * @returns {boolean}
   */
  isReady(agentName) {
    const agent = this.agents.get(agentName);
    return agent && agent.process && !agent.process.killed;
  }

  /**
   * Cancel all pending requests for an agent
   * @param {string} agentName - Agent name
   */
  cancelPendingRequests(agentName) {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    for (const [requestId, pending] of agent.pendingRequests.entries()) {
      pending.reject(new Error(`Request cancelled for agent ${agentName}`));
    }
    agent.pendingRequests.clear();
  }

  /**
   * Get count of pending requests for an agent
   * @param {string} agentName - Agent name
   * @returns {number}
   */
  getPendingRequestCount(agentName) {
    const agent = this.agents.get(agentName);
    return agent ? agent.pendingRequests.size : 0;
  }
}

module.exports = ACPClient;

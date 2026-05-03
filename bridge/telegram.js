const TelegramBot = require('node-telegram-bot-api');

/**
 * Telegram_Adapter Module
 * 
 * Handles Telegram Bot API integration with long polling, message sending,
 * and typing indicators. Manages message splitting for long responses.
 * Implements authentication to restrict access to authorized users only.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 15.1, 15.2, 15.4
 */
class TelegramAdapter {
  constructor(token, allowedUsers) {
    if (!token) {
      throw new Error('BOT_TOKEN is required');
    }
    
    // Validate ALLOWED_USERS at startup (Requirement 1.4)
    if (!allowedUsers || typeof allowedUsers !== 'string' || allowedUsers.trim() === '') {
      console.error('ALLOWED_USERS environment variable is missing or empty');
      process.exit(1);
    }
    
    this.token = token;
    this.bot = null;
    this.isPolling = false;
    
    // Parse ALLOWED_USERS as comma-separated list (Requirement 1.3)
    this.allowedUsers = allowedUsers
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    if (this.allowedUsers.length === 0) {
      console.error('ALLOWED_USERS contains no valid user IDs');
      process.exit(1);
    }
    
    console.log(`Telegram authentication enabled for ${this.allowedUsers.length} user(s)`);
  }

  /**
   * Authenticate incoming message against ALLOWED_USERS list
   * Requirements: 1.1, 1.2
   * 
   * @param {object} message - Telegram message object
   * @returns {boolean} - true if user is authorized, false otherwise
   */
  authenticateMessage(message) {
    if (!message || !message.from || !message.from.id) {
      return false;
    }
    
    const userId = message.from.id.toString();
    const isAuthorized = this.allowedUsers.includes(userId);
    
    // Requirement 1.2: Silently ignore unauthorized messages (no response)
    if (!isAuthorized) {
      console.log(`Unauthorized message from user ${userId} - silently ignored`);
    }
    
    return isAuthorized;
  }

  /**
   * Initialize and start long polling
   * Requirements: 1.3
   */
  async start() {
    if (this.isPolling) {
      console.warn('Telegram polling is already active');
      return;
    }

    try {
      // Initialize bot with long polling enabled
      this.bot = new TelegramBot(this.token, {
        polling: {
          interval: 300,
          autoStart: true,
          params: {
            timeout: 10
          }
        }
      });

      this.isPolling = true;
      console.log('Telegram Bot polling started successfully');

      // Set up error handler for polling errors
      this.bot.on('polling_error', (error) => {
        console.error('Telegram polling error:', error.message);
      });

    } catch (error) {
      console.error('Failed to start Telegram Bot:', error.message);
      throw error;
    }
  }

  /**
   * Stop polling and cleanup
   * Requirements: 1.3
   */
  async stop() {
    if (!this.bot || !this.isPolling) {
      return;
    }

    try {
      await this.bot.stopPolling();
      this.isPolling = false;
      console.log('Telegram Bot polling stopped');
    } catch (error) {
      console.error('Error stopping Telegram Bot:', error.message);
      throw error;
    }
  }

  /**
   * Send message to chat with automatic splitting for messages >4096 chars
   * Requirements: 15.1, 15.2
   * 
   * @param {string|number} chatId - Telegram chat ID
   * @param {string} text - Message text to send
   */
  async sendMessage(chatId, text) {
    if (!this.bot) {
      throw new Error('Telegram Bot is not initialized. Call start() first.');
    }

    if (!chatId) {
      throw new Error('chatId is required');
    }

    if (!text || typeof text !== 'string') {
      throw new Error('text must be a non-empty string');
    }

    const MAX_MESSAGE_LENGTH = 4096;

    try {
      // If message fits in one chunk, send it directly
      if (text.length <= MAX_MESSAGE_LENGTH) {
        await this.bot.sendMessage(chatId, text);
        return;
      }

      // Split message into chunks
      const chunks = this._splitMessage(text, MAX_MESSAGE_LENGTH);
      
      // Send each chunk sequentially
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const prefix = chunks.length > 1 ? `[${i + 1}/${chunks.length}] ` : '';
        await this.bot.sendMessage(chatId, prefix + chunk);
        
        // Small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await this._sleep(100);
        }
      }
    } catch (error) {
      console.error('Error sending message to chat', chatId, ':', error.message);
      throw error;
    }
  }

  /**
   * Send typing indicator to chat
   * Requirements: 15.4
   * 
   * @param {string|number} chatId - Telegram chat ID
   */
  async sendTypingIndicator(chatId) {
    if (!this.bot) {
      throw new Error('Telegram Bot is not initialized. Call start() first.');
    }

    if (!chatId) {
      throw new Error('chatId is required');
    }

    try {
      await this.bot.sendChatAction(chatId, 'typing');
    } catch (error) {
      console.error('Error sending typing indicator to chat', chatId, ':', error.message);
      // Don't throw - typing indicator failure shouldn't break the flow
    }
  }

  /**
   * Split message into chunks that respect the maximum length
   * Tries to split at newlines to preserve formatting
   * 
   * @private
   * @param {string} text - Text to split
   * @param {number} maxLength - Maximum length per chunk
   * @returns {string[]} Array of message chunks
   */
  _splitMessage(text, maxLength) {
    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to find a good split point (newline) within the max length
      let splitIndex = maxLength;
      const lastNewline = remaining.lastIndexOf('\n', maxLength);
      
      if (lastNewline > maxLength * 0.5) {
        // If we found a newline in the latter half, split there
        splitIndex = lastNewline + 1;
      } else {
        // Otherwise, try to split at a space
        const lastSpace = remaining.lastIndexOf(' ', maxLength);
        if (lastSpace > maxLength * 0.5) {
          splitIndex = lastSpace + 1;
        }
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex);
    }

    return chunks;
  }

  /**
   * Sleep helper for rate limiting
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse incoming message and extract command information
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9
   * 
   * @param {object} message - Telegram message object
   * @returns {object|null} - Parsed command object or null if not authenticated
   */
  parseCommand(message) {
    // Authenticate first (Requirement 1.1)
    if (!this.authenticateMessage(message)) {
      return null;
    }

    const text = message.text || '';
    const chatId = message.chat.id;
    const userId = message.from.id;
    const messageId = message.message_id;

    const context = {
      chatId,
      userId: userId.toString(),
      messageId: messageId.toString(),
      timestamp: Date.now()
    };

    // Check if message starts with a command
    if (text.startsWith('/')) {
      return this._parseSlashCommand(text, context);
    } else {
      // Plain text message - route to backend agent as default (Requirement 4.1)
      return {
        type: 'agent',
        agentName: 'backend',
        prompt: text,
        context
      };
    }
  }

  /**
   * Parse slash commands
   * @private
   * 
   * @param {string} text - Message text starting with /
   * @param {object} context - Message context
   * @returns {object} - Parsed command object
   */
  _parseSlashCommand(text, context) {
    // Extract command and arguments
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case '/agent':
        return this._parseAgentCommand(args, context);
      
      case '/all':
        return this._parseAllCommand(args, context);
      
      case '/agents':
      case '/status':
        return {
          type: command.substring(1), // Remove leading /
          context
        };
      
      case '/logs':
        return this._parseLogsCommand(args, context);
      
      case '/cancel':
        return this._parseCancelCommand(args, context);
      
      default:
        return {
          type: 'error',
          message: `Unknown command: ${command}. Available commands: /agent, /all, /agents, /status, /logs, /cancel`,
          context
        };
    }
  }

  /**
   * Parse /agent <name> <prompt> command
   * Requirements: 4.2, 4.3
   * @private
   */
  _parseAgentCommand(args, context) {
    const validAgents = ['backend', 'frontend', 'testing', 'devops', 'reviewer'];

    if (args.length < 2) {
      return {
        type: 'error',
        message: 'Usage: /agent <name> <prompt>\nValid agent names: ' + validAgents.join(', '),
        context
      };
    }

    const agentName = args[0].toLowerCase();
    const prompt = args.slice(1).join(' ');

    // Validate agent name (Requirement 4.3)
    if (!validAgents.includes(agentName)) {
      return {
        type: 'error',
        message: `Unrecognized agent name: ${agentName}\nValid agent names: ${validAgents.join(', ')}`,
        context
      };
    }

    return {
      type: 'agent',
      agentName,
      prompt,
      context
    };
  }

  /**
   * Parse /all <prompt> command
   * Requirements: 4.4
   * @private
   */
  _parseAllCommand(args, context) {
    if (args.length === 0) {
      return {
        type: 'error',
        message: 'Usage: /all <prompt>',
        context
      };
    }

    const prompt = args.join(' ');

    return {
      type: 'all',
      prompt,
      context
    };
  }

  /**
   * Parse /logs <name> command
   * Requirements: 4.7
   * @private
   */
  _parseLogsCommand(args, context) {
    const validAgents = ['backend', 'frontend', 'testing', 'devops', 'reviewer'];

    if (args.length === 0) {
      return {
        type: 'error',
        message: 'Usage: /logs <name>\nValid agent names: ' + validAgents.join(', '),
        context
      };
    }

    const agentName = args[0].toLowerCase();

    // Validate agent name
    if (!validAgents.includes(agentName)) {
      return {
        type: 'error',
        message: `Unrecognized agent name: ${agentName}\nValid agent names: ${validAgents.join(', ')}`,
        context
      };
    }

    return {
      type: 'logs',
      agentName,
      context
    };
  }

  /**
   * Parse /cancel <name> command
   * Requirements: 4.8, 4.9
   * @private
   */
  _parseCancelCommand(args, context) {
    const validAgents = ['backend', 'frontend', 'testing', 'devops', 'reviewer'];

    if (args.length === 0) {
      return {
        type: 'error',
        message: 'Usage: /cancel <name>\nValid agent names: ' + validAgents.join(', '),
        context
      };
    }

    const agentName = args[0].toLowerCase();

    // Validate agent name
    if (!validAgents.includes(agentName)) {
      return {
        type: 'error',
        message: `Unrecognized agent name: ${agentName}\nValid agent names: ${validAgents.join(', ')}`,
        context
      };
    }

    return {
      type: 'cancel',
      agentName,
      context
    };
  }

  /**
   * Get the bot instance (for event listeners)
   * @returns {TelegramBot|null}
   */
  getBot() {
    return this.bot;
  }

  /**
   * Set up command handlers with Agent_Manager and Logger
   * Requirements: 4.2, 4.4, 4.5, 4.6, 4.7, 4.8, 15.3, 15.5
   * 
   * @param {object} agentManager - Agent_Manager instance
   * @param {object} logger - Logger instance
   */
  setupCommandHandlers(agentManager, logger) {
    if (!this.bot) {
      throw new Error('Telegram Bot is not initialized. Call start() first.');
    }

    this.agentManager = agentManager;
    this.logger = logger;

    // Set up message handler
    this.bot.on('message', async (message) => {
      try {
        // Parse command
        const command = this.parseCommand(message);

        // If authentication failed, parseCommand returns null (Requirement 1.2)
        if (!command) {
          return;
        }

        // Handle error commands (invalid syntax)
        if (command.type === 'error') {
          await this.sendMessage(command.context.chatId, command.message);
          return;
        }

        // Route to appropriate handler
        await this.handleCommand(command);
      } catch (error) {
        console.error('Error handling message:', error);
        
        // Send error message to user (Requirement 15.3)
        try {
          await this.sendMessage(
            message.chat.id,
            `❌ Error: ${error.message}`
          );
        } catch (sendError) {
          console.error('Failed to send error message:', sendError);
        }
      }
    });

    console.log('Command handlers set up successfully');
  }

  /**
   * Route command to appropriate handler
   * @private
   * 
   * @param {object} command - Parsed command object
   */
  async handleCommand(command) {
    switch (command.type) {
      case 'agent':
        await this.handleAgentCommand(command);
        break;
      
      case 'all':
        await this.handleAllCommand(command);
        break;
      
      case 'agents':
      case 'status':
        await this.handleStatusCommand(command);
        break;
      
      case 'logs':
        await this.handleLogsCommand(command);
        break;
      
      case 'cancel':
        await this.handleCancelCommand(command);
        break;
      
      default:
        await this.sendMessage(
          command.context.chatId,
          `Unknown command type: ${command.type}`
        );
    }
  }

  /**
   * Handle /agent <name> <prompt> command
   * Requirements: 4.2, 15.3, 15.4
   * @private
   */
  async handleAgentCommand(command) {
    const { agentName, prompt, context } = command;

    try {
      // Send typing indicator (Requirement 15.4)
      await this.sendTypingIndicator(context.chatId);

      // Start typing indicator interval (every 5 seconds)
      const typingInterval = setInterval(async () => {
        try {
          await this.sendTypingIndicator(context.chatId);
        } catch (err) {
          // Ignore typing indicator errors
        }
      }, 5000);

      try {
        // Dispatch to Agent_Manager (Requirement 4.2)
        const response = await this.agentManager.dispatch(agentName, prompt, context);

        // Stop typing indicator
        clearInterval(typingInterval);

        // Send response back to user (Requirement 15.1)
        await this.sendMessage(context.chatId, response);
      } finally {
        // Ensure typing indicator is stopped
        clearInterval(typingInterval);
      }
    } catch (error) {
      // Handle errors from Agent_Manager (Requirement 15.3)
      console.error(`Error dispatching to agent ${agentName}:`, error);
      await this.sendMessage(
        context.chatId,
        `❌ [${agentName}] Error: ${error.message}`
      );
    }
  }

  /**
   * Handle /all <prompt> command
   * Requirements: 4.4, 15.3, 15.4
   * @private
   */
  async handleAllCommand(command) {
    const { prompt, context } = command;

    try {
      // Send typing indicator
      await this.sendTypingIndicator(context.chatId);

      // Start typing indicator interval
      const typingInterval = setInterval(async () => {
        try {
          await this.sendTypingIndicator(context.chatId);
        } catch (err) {
          // Ignore typing indicator errors
        }
      }, 5000);

      try {
        // Broadcast to all agents (Requirement 4.4)
        const result = await this.agentManager.broadcastPrompt(prompt, context);

        // Stop typing indicator
        clearInterval(typingInterval);

        // Format and send summary
        const durationSec = Math.round(result.duration / 1000);
        let summary = `✅ Broadcast complete in ${durationSec} seconds\n\n`;
        summary += `Successful: ${result.successful.length}/${this.agentManager.agentNames.length}\n`;
        
        if (result.successful.length > 0) {
          summary += `✅ ${result.successful.join(', ')}\n`;
        }
        
        if (result.failed.length > 0) {
          summary += `\n❌ Failed:\n`;
          result.failed.forEach(f => {
            summary += `  • ${f.agent}: ${f.error}\n`;
          });
        }

        await this.sendMessage(context.chatId, summary);
      } finally {
        clearInterval(typingInterval);
      }
    } catch (error) {
      // Handle errors from Agent_Manager (Requirement 15.3)
      console.error('Error broadcasting to agents:', error);
      await this.sendMessage(
        context.chatId,
        `❌ Broadcast error: ${error.message}`
      );
    }
  }

  /**
   * Handle /agents and /status commands
   * Requirements: 4.5, 4.6
   * @private
   */
  async handleStatusCommand(command) {
    const { context } = command;

    try {
      // Query Agent_Manager for all agent states (Requirements 4.5, 4.6)
      const agentStates = this.agentManager.getAllAgentStates();

      // Format status message
      let statusMessage = '📊 Agent Status:\n\n';

      for (const [agentName, state] of agentStates) {
        const stateEmoji = {
          'idle': '✅',
          'busy': '⏳',
          'unavailable': '❌'
        }[state.state] || '❓';

        statusMessage += `${stateEmoji} ${agentName}: ${state.state}`;

        // Add current task info if busy
        if (state.state === 'busy' && state.currentTask) {
          const elapsed = Math.round((Date.now() - state.currentTask.startTime) / 1000);
          statusMessage += ` (${elapsed}s)`;
        }

        statusMessage += '\n';
      }

      await this.sendMessage(context.chatId, statusMessage);
    } catch (error) {
      console.error('Error querying agent states:', error);
      await this.sendMessage(
        context.chatId,
        `❌ Error querying agent status: ${error.message}`
      );
    }
  }

  /**
   * Handle /logs <name> command
   * Requirements: 4.7, 15.5
   * @private
   */
  async handleLogsCommand(command) {
    const { agentName, context } = command;

    try {
      // Query Logger for recent logs (Requirement 4.7)
      const logEntries = this.logger.queryLogs(agentName, 20);

      if (logEntries.length === 0) {
        await this.sendMessage(
          context.chatId,
          `📋 No logs found for agent: ${agentName}`
        );
        return;
      }

      // Format log entries
      let logsMessage = `📋 Last ${logEntries.length} log entries for ${agentName}:\n\n`;

      logEntries.forEach((entry, index) => {
        const timestamp = new Date(entry.ts).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour12: false
        });

        const levelEmoji = {
          'info': 'ℹ️',
          'warn': '⚠️',
          'error': '❌'
        }[entry.level] || '📝';

        logsMessage += `${levelEmoji} [${timestamp}] ${entry.type}`;

        // Add relevant details based on type
        if (entry.type === 'prompt' && entry.text) {
          const preview = entry.text.length > 50 
            ? entry.text.substring(0, 50) + '...' 
            : entry.text;
          logsMessage += `: "${preview}"`;
        } else if (entry.type === 'tool_call' && entry.tool) {
          logsMessage += `: ${entry.tool}`;
          if (entry.path) {
            logsMessage += ` (${entry.path})`;
          }
        } else if (entry.type === 'response_complete' && entry.duration_ms) {
          logsMessage += `: ${Math.round(entry.duration_ms / 1000)}s`;
        } else if (entry.type === 'agent_crash' && entry.message) {
          logsMessage += `: ${entry.message}`;
        }

        logsMessage += '\n';
      });

      await this.sendMessage(context.chatId, logsMessage);
    } catch (error) {
      console.error(`Error querying logs for agent ${agentName}:`, error);
      await this.sendMessage(
        context.chatId,
        `❌ Error querying logs: ${error.message}`
      );
    }
  }

  /**
   * Handle /cancel <name> command
   * Requirements: 4.8, 4.9
   * @private
   */
  async handleCancelCommand(command) {
    const { agentName, context } = command;

    try {
      // Check agent state first
      const agentState = this.agentManager.getAgentState(agentName);

      // If agent is idle, inform user (Requirement 4.9)
      if (agentState === 'idle') {
        await this.sendMessage(
          context.chatId,
          `ℹ️ Agent ${agentName} has no running task to cancel`
        );
        return;
      }

      // Call Agent_Manager.cancelTask() (Requirement 4.8)
      await this.agentManager.cancelTask(agentName);

      await this.sendMessage(
        context.chatId,
        `✅ Task cancelled for agent: ${agentName}`
      );
    } catch (error) {
      // Handle errors from Agent_Manager
      console.error(`Error cancelling task for agent ${agentName}:`, error);
      await this.sendMessage(
        context.chatId,
        `❌ Error cancelling task: ${error.message}`
      );
    }
  }
}

module.exports = TelegramAdapter;

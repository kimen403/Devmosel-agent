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
   * @param {object} options - Additional options (parse_mode, reply_markup, etc.)
   */
  async sendMessage(chatId, text, options = {}) {
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
        await this.bot.sendMessage(chatId, text, options);
        return;
      }

      // Split message into chunks
      const chunks = this._splitMessage(text, MAX_MESSAGE_LENGTH);
      
      // Send each chunk sequentially
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const prefix = chunks.length > 1 ? `[${i + 1}/${chunks.length}] ` : '';
        
        // Only apply options to the first chunk to avoid duplicate keyboards
        const chunkOptions = i === 0 ? options : { parse_mode: options.parse_mode };
        
        await this.bot.sendMessage(chatId, prefix + chunk, chunkOptions);
        
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
      case '/start':
      case '/help':
        return {
          type: 'help',
          context
        };
      
      case '/menu':
        return {
          type: 'menu',
          context
        };
      
      case '/agent':
        return this._parseAgentCommand(args, context);
      
      // Shortcut commands for agents
      case '/be':
      case '/backend':
        return this._parseShortcutCommand('backend', args, context);
      
      case '/fe':
      case '/frontend':
        return this._parseShortcutCommand('frontend', args, context);
      
      case '/test':
      case '/testing':
        return this._parseShortcutCommand('testing', args, context);
      
      case '/ops':
      case '/devops':
        return this._parseShortcutCommand('devops', args, context);
      
      case '/review':
      case '/reviewer':
        return this._parseShortcutCommand('reviewer', args, context);
      
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
          message: `❌ Perintah tidak dikenal: ${command}\n\nKetik /help untuk melihat daftar perintah yang tersedia.`,
          context
        };
    }
  }

  /**
   * Parse shortcut agent commands like /be, /fe, etc.
   * @private
   */
  _parseShortcutCommand(agentName, args, context) {
    if (args.length === 0) {
      return {
        type: 'error',
        message: `📝 Penggunaan: /${agentName === 'backend' ? 'be' : agentName === 'frontend' ? 'fe' : agentName === 'testing' ? 'test' : agentName === 'devops' ? 'ops' : 'review'} <prompt>\n\nContoh: /${agentName === 'backend' ? 'be' : agentName === 'frontend' ? 'fe' : agentName === 'testing' ? 'test' : agentName === 'devops' ? 'ops' : 'review'} buat API untuk login user`,
        context
      };
    }

    const prompt = args.join(' ');

    return {
      type: 'agent',
      agentName,
      prompt,
      context
    };
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
        message: `📝 Penggunaan: /agent <nama> <prompt>\n\n🤖 Agent yang tersedia:\n• backend - Pengembangan backend dan API\n• frontend - Pengembangan frontend dan UI\n• testing - Testing dan quality assurance\n• devops - Deployment dan infrastructure\n• reviewer - Code review dan best practices\n\n💡 Tip: Gunakan shortcut /be, /fe, /test, /ops, /review`,
        context
      };
    }

    const agentName = args[0].toLowerCase();
    const prompt = args.slice(1).join(' ');

    // Validate agent name (Requirement 4.3)
    if (!validAgents.includes(agentName)) {
      return {
        type: 'error',
        message: `❌ Agent tidak dikenal: ${agentName}\n\n🤖 Agent yang tersedia:\n• backend - Pengembangan backend dan API\n• frontend - Pengembangan frontend dan UI\n• testing - Testing dan quality assurance\n• devops - Deployment dan infrastructure\n• reviewer - Code review dan best practices`,
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
        message: '📝 Penggunaan: /all <prompt>\n\nContoh: /all review semua kode untuk keamanan',
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
        message: `📝 Penggunaan: /logs <nama>\n\n🤖 Agent yang tersedia:\n• ${validAgents.join('\n• ')}\n\nContoh: /logs backend`,
        context
      };
    }

    const agentName = args[0].toLowerCase();

    // Validate agent name
    if (!validAgents.includes(agentName)) {
      return {
        type: 'error',
        message: `❌ Agent tidak dikenal: ${agentName}\n\n🤖 Agent yang tersedia:\n• ${validAgents.join('\n• ')}`,
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
        message: `📝 Penggunaan: /cancel <nama>\n\n🤖 Agent yang tersedia:\n• ${validAgents.join('\n• ')}\n\nContoh: /cancel backend`,
        context
      };
    }

    const agentName = args[0].toLowerCase();

    // Validate agent name
    if (!validAgents.includes(agentName)) {
      return {
        type: 'error',
        message: `❌ Agent tidak dikenal: ${agentName}\n\n🤖 Agent yang tersedia:\n• ${validAgents.join('\n• ')}`,
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

    // Set up callback query handler for inline keyboards
    this.bot.on('callback_query', async (callbackQuery) => {
      try {
        // Authenticate callback query
        if (!this.authenticateMessage(callbackQuery.message)) {
          await this.bot.answerCallbackQuery(callbackQuery.id);
          return;
        }

        await this.handleCallbackQuery(callbackQuery);
      } catch (error) {
        console.error('Error handling callback query:', error);
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: `❌ Error: ${error.message}`,
          show_alert: true
        });
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
      case 'help':
        await this.handleHelpCommand(command);
        break;
      
      case 'menu':
        await this.handleMenuCommand(command);
        break;
      
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
          `❌ Tipe perintah tidak dikenal: ${command.type}`
        );
    }
  }

  /**
   * Handle /help and /start commands
   * @private
   */
  async handleHelpCommand(command) {
    const { context } = command;

    const helpMessage = `🤖 *Telegram Kiro Bot - Panduan Penggunaan*

*📋 PERINTAH UTAMA:*

*🎯 Kirim ke Agent Tertentu:*
• \`/agent <nama> <prompt>\` - Kirim perintah ke agent tertentu
• \`/be <prompt>\` - Shortcut untuk backend agent
• \`/fe <prompt>\` - Shortcut untuk frontend agent  
• \`/test <prompt>\` - Shortcut untuk testing agent
• \`/ops <prompt>\` - Shortcut untuk devops agent
• \`/review <prompt>\` - Shortcut untuk reviewer agent

*📢 Broadcast:*
• \`/all <prompt>\` - Kirim ke semua 5 agent sekaligus

*📊 Monitoring:*
• \`/agents\` atau \`/status\` - Lihat status semua agent
• \`/logs <nama>\` - Lihat log agent tertentu

*⚙️ Kontrol:*
• \`/cancel <nama>\` - Batalkan task yang sedang berjalan
• \`/menu\` - Tampilkan menu interaktif
• \`/help\` - Tampilkan panduan ini

*🤖 AGENT YANG TERSEDIA:*
• *backend* - Pengembangan backend, API, database
• *frontend* - Pengembangan frontend, UI/UX
• *testing* - Testing, quality assurance
• *devops* - Deployment, infrastructure, CI/CD
• *reviewer* - Code review, best practices

*💡 CONTOH PENGGUNAAN:*
• \`/be buat API untuk login user\`
• \`/fe buat komponen navbar responsive\`
• \`/all review kode untuk keamanan\`
• \`implementasi JWT auth\` (otomatis ke backend)

*📝 CATATAN:*
• Pesan tanpa command otomatis dikirim ke backend agent
• Gunakan /menu untuk interface yang lebih mudah`;

    await this.sendMessage(context.chatId, helpMessage, { parse_mode: 'Markdown' });
  }

  /**
   * Handle /menu command with inline keyboard
   * @private
   */
  async handleMenuCommand(command) {
    const { context } = command;

    const menuMessage = `🤖 *Kiro Bot - Menu Utama*

Pilih agent atau aksi yang ingin Anda gunakan:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔧 Backend', callback_data: 'select_backend' },
          { text: '🎨 Frontend', callback_data: 'select_frontend' }
        ],
        [
          { text: '🧪 Testing', callback_data: 'select_testing' },
          { text: '⚙️ DevOps', callback_data: 'select_devops' }
        ],
        [
          { text: '👁️ Reviewer', callback_data: 'select_reviewer' },
          { text: '📢 Broadcast All', callback_data: 'select_all' }
        ],
        [
          { text: '📊 Status Agent', callback_data: 'show_status' },
          { text: '📋 Logs', callback_data: 'show_logs_menu' }
        ],
        [
          { text: '❌ Cancel Tasks', callback_data: 'cancel_menu' },
          { text: '❓ Help', callback_data: 'show_help' }
        ]
      ]
    };

    try {
      await this.bot.sendMessage(context.chatId, menuMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error sending menu:', error);
      await this.sendMessage(context.chatId, menuMessage);
    }
  }

  /**
   * Handle callback queries from inline keyboards
   * @private
   */
  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString();
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;

    // Answer the callback query first
    await this.bot.answerCallbackQuery(callbackQuery.id);

    const context = {
      chatId,
      userId,
      messageId: messageId.toString(),
      timestamp: Date.now()
    };

    switch (data) {
      case 'select_backend':
      case 'select_frontend':
      case 'select_testing':
      case 'select_devops':
      case 'select_reviewer':
        await this.handleAgentSelection(data.replace('select_', ''), context);
        break;
      
      case 'select_all':
        await this.handleBroadcastSelection(context);
        break;
      
      case 'show_status':
        await this.handleStatusCommand({ context });
        break;
      
      case 'show_logs_menu':
        await this.handleLogsMenuSelection(context);
        break;
      
      case 'cancel_menu':
        await this.handleCancelMenuSelection(context);
        break;
      
      case 'show_help':
        await this.handleHelpCommand({ context });
        break;
      
      default:
        // Handle logs selection (logs_backend, logs_frontend, etc.)
        if (data.startsWith('logs_')) {
          const agentName = data.replace('logs_', '');
          await this.handleLogsCommand({ agentName, context });
        }
        // Handle cancel selection (cancel_backend, cancel_frontend, etc.)
        else if (data.startsWith('cancel_')) {
          const agentName = data.replace('cancel_', '');
          await this.handleCancelCommand({ agentName, context });
        }
        else {
          await this.sendMessage(chatId, `❌ Callback tidak dikenal: ${data}`);
        }
    }
  }

  /**
   * Handle agent selection from menu
   * @private
   */
  async handleAgentSelection(agentName, context) {
    const agentEmojis = {
      backend: '🔧',
      frontend: '🎨',
      testing: '🧪',
      devops: '⚙️',
      reviewer: '👁️'
    };

    const agentDescriptions = {
      backend: 'Pengembangan backend, API, dan database',
      frontend: 'Pengembangan frontend, UI/UX, dan komponen',
      testing: 'Testing, quality assurance, dan debugging',
      devops: 'Deployment, infrastructure, dan CI/CD',
      reviewer: 'Code review dan best practices'
    };

    const message = `${agentEmojis[agentName]} *${agentName.toUpperCase()} Agent Dipilih*

${agentDescriptions[agentName]}

💬 Silakan kirim pesan Anda untuk agent ini, atau gunakan:
• \`/${agentName === 'backend' ? 'be' : agentName === 'frontend' ? 'fe' : agentName === 'testing' ? 'test' : agentName === 'devops' ? 'ops' : 'review'} <prompt>\`

📝 Contoh: \`/${agentName === 'backend' ? 'be' : agentName === 'frontend' ? 'fe' : agentName === 'testing' ? 'test' : agentName === 'devops' ? 'ops' : 'review'} buat komponen login\``;

    await this.sendMessage(context.chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Handle broadcast selection from menu
   * @private
   */
  async handleBroadcastSelection(context) {
    const message = `📢 *Broadcast ke Semua Agent*

Pesan Anda akan dikirim ke semua 5 agent secara bersamaan:
• 🔧 Backend
• 🎨 Frontend  
• 🧪 Testing
• ⚙️ DevOps
• 👁️ Reviewer

💬 Silakan kirim pesan Anda, atau gunakan:
• \`/all <prompt>\`

📝 Contoh: \`/all review kode untuk keamanan\``;

    await this.sendMessage(context.chatId, message, { parse_mode: 'Markdown' });
  }

  /**
   * Handle logs menu selection
   * @private
   */
  async handleLogsMenuSelection(context) {
    const message = `📋 *Pilih Agent untuk Melihat Logs*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔧 Backend', callback_data: 'logs_backend' },
          { text: '🎨 Frontend', callback_data: 'logs_frontend' }
        ],
        [
          { text: '🧪 Testing', callback_data: 'logs_testing' },
          { text: '⚙️ DevOps', callback_data: 'logs_devops' }
        ],
        [
          { text: '👁️ Reviewer', callback_data: 'logs_reviewer' }
        ]
      ]
    };

    try {
      await this.bot.sendMessage(context.chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error sending logs menu:', error);
      await this.sendMessage(context.chatId, message);
    }
  }

  /**
   * Handle cancel menu selection
   * @private
   */
  async handleCancelMenuSelection(context) {
    const message = `❌ *Pilih Agent untuk Membatalkan Task*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔧 Backend', callback_data: 'cancel_backend' },
          { text: '🎨 Frontend', callback_data: 'cancel_frontend' }
        ],
        [
          { text: '🧪 Testing', callback_data: 'cancel_testing' },
          { text: '⚙️ DevOps', callback_data: 'cancel_devops' }
        ],
        [
          { text: '👁️ Reviewer', callback_data: 'cancel_reviewer' }
        ]
      ]
    };

    try {
      await this.bot.sendMessage(context.chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('Error sending cancel menu:', error);
      await this.sendMessage(context.chatId, message);
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
        let summary = `✅ *Broadcast Selesai* dalam ${durationSec} detik\n\n`;
        summary += `📊 *Hasil:* ${result.successful.length}/${this.agentManager.agentNames.length} berhasil\n\n`;
        
        if (result.successful.length > 0) {
          summary += `✅ *Berhasil:*\n`;
          result.successful.forEach(agent => {
            const emoji = {
              backend: '🔧',
              frontend: '🎨', 
              testing: '🧪',
              devops: '⚙️',
              reviewer: '👁️'
            }[agent] || '🤖';
            summary += `  ${emoji} ${agent}\n`;
          });
        }
        
        if (result.failed.length > 0) {
          summary += `\n❌ *Gagal:*\n`;
          result.failed.forEach(f => {
            const emoji = {
              backend: '🔧',
              frontend: '🎨',
              testing: '🧪', 
              devops: '⚙️',
              reviewer: '👁️'
            }[f.agent] || '🤖';
            summary += `  ${emoji} ${f.agent}: ${f.error}\n`;
          });
        }

        await this.sendMessage(context.chatId, summary, { parse_mode: 'Markdown' });
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
      let statusMessage = '📊 *Status Agent Kiro Bot*\n\n';

      const agentEmojis = {
        backend: '🔧',
        frontend: '🎨',
        testing: '🧪',
        devops: '⚙️',
        reviewer: '👁️'
      };

      for (const [agentName, state] of agentStates) {
        const stateEmoji = {
          'idle': '✅',
          'busy': '⏳',
          'unavailable': '❌'
        }[state.state] || '❓';

        const agentEmoji = agentEmojis[agentName] || '🤖';
        
        statusMessage += `${stateEmoji} ${agentEmoji} *${agentName.toUpperCase()}*: `;

        if (state.state === 'idle') {
          statusMessage += 'Siap menerima tugas';
        } else if (state.state === 'busy' && state.currentTask) {
          const elapsed = Math.round((Date.now() - state.currentTask.startTime) / 1000);
          statusMessage += `Sedang bekerja (${elapsed}s)`;
        } else if (state.state === 'unavailable') {
          statusMessage += 'Tidak tersedia';
        } else {
          statusMessage += state.state;
        }

        statusMessage += '\n';
      }

      statusMessage += '\n💡 Gunakan /menu untuk akses cepat atau /help untuk panduan';

      await this.sendMessage(context.chatId, statusMessage, { parse_mode: 'Markdown' });
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
          `📋 Tidak ada log untuk agent: *${agentName}*`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const agentEmojis = {
        backend: '🔧',
        frontend: '🎨',
        testing: '🧪',
        devops: '⚙️',
        reviewer: '👁️'
      };

      // Format log entries
      let logsMessage = `📋 *Log ${agentEmojis[agentName] || '🤖'} ${agentName.toUpperCase()}*\n`;
      logsMessage += `_${logEntries.length} entri terakhir_\n\n`;

      logEntries.forEach((entry, index) => {
        const timestamp = new Date(entry.ts).toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour12: false,
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });

        const levelEmoji = {
          'info': 'ℹ️',
          'warn': '⚠️',
          'error': '❌'
        }[entry.level] || '📝';

        logsMessage += `${levelEmoji} \`${timestamp}\` `;

        // Add relevant details based on type
        if (entry.type === 'prompt' && entry.text) {
          const preview = entry.text.length > 40 
            ? entry.text.substring(0, 40) + '...' 
            : entry.text;
          logsMessage += `*Prompt:* "${preview}"`;
        } else if (entry.type === 'tool_call' && entry.tool) {
          logsMessage += `*Tool:* ${entry.tool}`;
          if (entry.path) {
            logsMessage += ` (${entry.path})`;
          }
        } else if (entry.type === 'response_complete' && entry.duration_ms) {
          logsMessage += `*Selesai:* ${Math.round(entry.duration_ms / 1000)}s`;
        } else if (entry.type === 'agent_crash' && entry.message) {
          logsMessage += `*Crash:* ${entry.message}`;
        } else {
          logsMessage += `*${entry.type}*`;
          if (entry.message) {
            const preview = entry.message.length > 30 
              ? entry.message.substring(0, 30) + '...' 
              : entry.message;
            logsMessage += `: ${preview}`;
          }
        }

        logsMessage += '\n';
      });

      await this.sendMessage(context.chatId, logsMessage, { parse_mode: 'Markdown' });
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

      const agentEmojis = {
        backend: '🔧',
        frontend: '🎨',
        testing: '🧪',
        devops: '⚙️',
        reviewer: '👁️'
      };

      const emoji = agentEmojis[agentName] || '🤖';

      // If agent is idle, inform user (Requirement 4.9)
      if (agentState === 'idle') {
        await this.sendMessage(
          context.chatId,
          `ℹ️ ${emoji} Agent *${agentName}* tidak memiliki task yang sedang berjalan`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Call Agent_Manager.cancelTask() (Requirement 4.8)
      await this.agentManager.cancelTask(agentName);

      await this.sendMessage(
        context.chatId,
        `✅ ${emoji} Task dibatalkan untuk agent: *${agentName}*`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      // Handle errors from Agent_Manager
      console.error(`Error cancelling task for agent ${agentName}:`, error);
      await this.sendMessage(
        context.chatId,
        `❌ Error membatalkan task: ${error.message}`
      );
    }
  }
}

module.exports = TelegramAdapter;

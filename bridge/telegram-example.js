/**
 * Example usage of Telegram_Adapter module
 * 
 * This demonstrates how to use the TelegramAdapter class to:
 * - Initialize and start the bot
 * - Send messages (including long messages that get split)
 * - Send typing indicators
 * - Stop the bot gracefully
 * 
 * To run this example:
 * 1. Create a .env file with BOT_TOKEN=your_bot_token
 * 2. Run: node telegram-example.js
 */

require('dotenv').config();
const TelegramAdapter = require('./telegram');

async function main() {
  // Check if BOT_TOKEN is available
  if (!process.env.BOT_TOKEN) {
    console.error('Error: BOT_TOKEN environment variable is required');
    console.error('Please create a .env file with BOT_TOKEN=your_bot_token');
    process.exit(1);
  }

  // Check if ALLOWED_USERS is available
  if (!process.env.ALLOWED_USERS) {
    console.error('Error: ALLOWED_USERS environment variable is required');
    console.error('Please add ALLOWED_USERS=your_user_id to your .env file');
    console.error('You can find your user ID by messaging @userinfobot on Telegram');
    process.exit(1);
  }

  console.log('Initializing Telegram Bot...');
  const adapter = new TelegramAdapter(process.env.BOT_TOKEN, process.env.ALLOWED_USERS);

  try {
    // Start the bot
    await adapter.start();
    console.log('Bot is now running. Send a message to test it.');

    // Get the bot instance to set up message handlers
    const bot = adapter.getBot();

    // Handle incoming messages
    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      console.log(`Received message from ${chatId}: ${text}`);

      // Authenticate the message (Requirement 1.1, 1.2)
      if (!adapter.authenticateMessage(msg)) {
        // Silently ignore unauthorized messages
        return;
      }

      // Send typing indicator
      await adapter.sendTypingIndicator(chatId);

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test different response types based on command
      if (text === '/short') {
        await adapter.sendMessage(chatId, 'This is a short message.');
      } 
      else if (text === '/long') {
        // Generate a long message that will be split
        const longMessage = 'This is a very long message. '.repeat(300) + 
                          '\n\nThis message exceeds 4096 characters and will be automatically split into multiple messages.';
        await adapter.sendMessage(chatId, longMessage);
      }
      else if (text === '/typing') {
        // Send typing indicator multiple times
        for (let i = 0; i < 5; i++) {
          await adapter.sendTypingIndicator(chatId);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        await adapter.sendMessage(chatId, 'Done typing!');
      }
      else {
        // Echo the message back
        await adapter.sendMessage(chatId, `You said: ${text}`);
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down bot...');
      await adapter.stop();
      console.log('Bot stopped successfully');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down bot...');
      await adapter.stop();
      console.log('Bot stopped successfully');
      process.exit(0);
    });

    console.log('\nBot is ready! Try these commands:');
    console.log('  /short  - Send a short message');
    console.log('  /long   - Send a long message (will be split)');
    console.log('  /typing - Show typing indicator for 5 seconds');
    console.log('  Any other text will be echoed back');
    console.log('\nPress Ctrl+C to stop the bot');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

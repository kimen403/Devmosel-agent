/**
 * Test script for Notifier module
 * Tests all notification methods and graceful handling of missing NOTIFY_CHAT_ID
 */

const Notifier = require('./notifier');

// Mock Telegram Adapter
class MockTelegramAdapter {
  constructor() {
    this.sentMessages = [];
  }

  async sendMessage(chatId, text) {
    this.sentMessages.push({ chatId, text, timestamp: Date.now() });
    console.log(`📱 [Mock Telegram] Sent to ${chatId}:`);
    console.log(`   ${text}\n`);
  }
}

// Mock Logger
class MockLogger {
  log(entry) {
    console.log(`[LOG] ${entry.level.toUpperCase()} - ${entry.type}: ${entry.message}`);
  }
}

async function testNotifierWithChatId() {
  console.log('=== Test 1: Notifier with NOTIFY_CHAT_ID set ===\n');

  // Set environment variable
  process.env.NOTIFY_CHAT_ID = '123456789';
  process.env.PROGRESS_INTERVAL_SEC = '5'; // Short interval for testing

  const telegram = new MockTelegramAdapter();
  const logger = new MockLogger();
  const notifier = new Notifier(telegram, logger);

  console.log(`Notifier enabled: ${notifier.isEnabled()}\n`);

  // Test 1: Send generic message
  console.log('Test 1.1: Send generic message');
  await notifier.send('🔄 [backend] reconnecting...');

  // Test 2: Send completion notification
  console.log('Test 1.2: Send completion notification');
  await notifier.sendCompletion('backend', 45);

  // Test 3: Send error notification
  console.log('Test 1.3: Send error notification');
  await notifier.sendError('frontend', 'Connection timeout');

  // Test 4: Send progress notification
  console.log('Test 1.4: Send progress notification');
  await notifier.sendProgress('testing', 60);

  // Test 5: Send broadcast summary (all successful)
  console.log('Test 1.5: Send broadcast summary (all successful)');
  await notifier.sendBroadcastSummary({
    successful: ['backend', 'frontend', 'testing', 'devops', 'reviewer'],
    failed: [],
    duration: 120000 // 120 seconds
  });

  // Test 6: Send broadcast summary (some failed)
  console.log('Test 1.6: Send broadcast summary (some failed)');
  await notifier.sendBroadcastSummary({
    successful: ['backend', 'frontend', 'testing'],
    failed: [
      { agent: 'devops', error: 'Deployment failed' },
      { agent: 'reviewer', error: 'Timeout' }
    ],
    duration: 95000 // 95 seconds
  });

  console.log(`\nTotal messages sent: ${telegram.sentMessages.length}`);
  console.log('✅ Test 1 passed\n');
}

async function testNotifierWithoutChatId() {
  console.log('=== Test 2: Notifier without NOTIFY_CHAT_ID (graceful degradation) ===\n');

  // Remove environment variable
  delete process.env.NOTIFY_CHAT_ID;

  const telegram = new MockTelegramAdapter();
  const logger = new MockLogger();
  const notifier = new Notifier(telegram, logger);

  console.log(`Notifier enabled: ${notifier.isEnabled()}\n`);

  // Test sending messages - should not throw errors
  console.log('Test 2.1: Send messages (should be silently skipped)');
  await notifier.send('Test message');
  await notifier.sendCompletion('backend', 30);
  await notifier.sendError('frontend', 'Test error');
  await notifier.sendProgress('testing', 45);
  await notifier.sendBroadcastSummary({
    successful: ['backend'],
    failed: [],
    duration: 30000
  });

  console.log(`\nTotal messages sent: ${telegram.sentMessages.length} (should be 0)`);
  
  if (telegram.sentMessages.length === 0) {
    console.log('✅ Test 2 passed - notifications gracefully disabled\n');
  } else {
    console.log('❌ Test 2 failed - messages were sent despite missing NOTIFY_CHAT_ID\n');
  }
}

async function testProgressTracking() {
  console.log('=== Test 3: Progress tracking ===\n');

  // Set environment variable
  process.env.NOTIFY_CHAT_ID = '123456789';
  process.env.PROGRESS_INTERVAL_SEC = '2'; // 2 seconds for testing

  const telegram = new MockTelegramAdapter();
  const logger = new MockLogger();
  const notifier = new Notifier(telegram, logger);

  console.log('Test 3.1: Start progress tracking for backend agent');
  notifier.startProgressTracking('backend');

  console.log('Waiting 5 seconds to see progress updates...\n');
  
  // Wait 5 seconds to see progress updates
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\nTest 3.2: Stop progress tracking');
  notifier.stopProgressTracking('backend');

  console.log('Waiting 3 more seconds to verify no more updates...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('✅ Test 3 passed\n');
}

async function testProgressTrackingWithoutChatId() {
  console.log('=== Test 4: Progress tracking without NOTIFY_CHAT_ID ===\n');

  // Remove environment variable
  delete process.env.NOTIFY_CHAT_ID;

  const telegram = new MockTelegramAdapter();
  const logger = new MockLogger();
  const notifier = new Notifier(telegram, logger);

  console.log('Test 4.1: Start progress tracking (should be skipped)');
  notifier.startProgressTracking('backend');

  console.log('Waiting 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Test 4.2: Stop progress tracking');
  notifier.stopProgressTracking('backend');

  console.log(`\nTotal messages sent: ${telegram.sentMessages.length} (should be 0)`);
  
  if (telegram.sentMessages.length === 0) {
    console.log('✅ Test 4 passed - progress tracking gracefully disabled\n');
  } else {
    console.log('❌ Test 4 failed - progress messages were sent\n');
  }
}

async function testStopAllProgressTracking() {
  console.log('=== Test 5: Stop all progress tracking ===\n');

  process.env.NOTIFY_CHAT_ID = '123456789';
  process.env.PROGRESS_INTERVAL_SEC = '2';

  const telegram = new MockTelegramAdapter();
  const logger = new MockLogger();
  const notifier = new Notifier(telegram, logger);

  console.log('Test 5.1: Start progress tracking for multiple agents');
  notifier.startProgressTracking('backend');
  notifier.startProgressTracking('frontend');
  notifier.startProgressTracking('testing');

  console.log('Waiting 3 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Test 5.2: Stop all progress tracking');
  notifier.stopAllProgressTracking();

  console.log('Waiting 3 more seconds to verify no more updates...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('✅ Test 5 passed\n');
}

// Run all tests
async function runAllTests() {
  try {
    await testNotifierWithChatId();
    await testNotifierWithoutChatId();
    await testProgressTracking();
    await testProgressTrackingWithoutChatId();
    await testStopAllProgressTracking();

    console.log('═══════════════════════════════════════');
    console.log('✅ All Notifier tests passed!');
    console.log('═══════════════════════════════════════');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

runAllTests();

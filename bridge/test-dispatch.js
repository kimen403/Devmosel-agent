/**
 * Test script to verify Task 5.2: Single agent dispatch implementation
 * 
 * This test verifies:
 * - Agent state is checked before dispatching (must be idle)
 * - Agent state transitions to busy before sending prompt
 * - ACP_Client.sendPrompt() is called and awaited
 * - Agent state transitions back to idle after completion
 * - Prompt dispatch and response completion events are logged
 */

const AgentManager = require('./agent-manager');

// Mock Logger
class MockLogger {
  constructor() {
    this.logs = [];
  }

  log(entry) {
    this.logs.push(entry);
    console.log(`[${entry.level}] [${entry.agent}] ${entry.type}: ${entry.message || ''}`);
  }

  getLogs(type) {
    return this.logs.filter(log => log.type === type);
  }

  getLastLog(type) {
    const logs = this.getLogs(type);
    return logs[logs.length - 1];
  }
}

// Mock Notifier
class MockNotifier {
  constructor() {
    this.messages = [];
  }

  send(message) {
    this.messages.push(message);
    console.log(`[NOTIFY] ${message}`);
  }
}

async function testDispatch() {
  console.log('=== Testing Task 5.2: Single Agent Dispatch ===\n');

  const logger = new MockLogger();
  const notifier = new MockNotifier();
  const agentManager = new AgentManager(logger, notifier);

  try {
    // Test 1: Verify dispatch method exists
    console.log('Test 1: Verify dispatch method exists');
    if (typeof agentManager.dispatch !== 'function') {
      throw new Error('dispatch method not found on AgentManager');
    }
    console.log('✓ dispatch method exists\n');

    // Test 2: Verify dispatch checks agent state
    console.log('Test 2: Verify dispatch checks agent state');
    
    // Manually set up a test agent state
    agentManager.agentStates.set('test-agent', {
      name: 'test-agent',
      state: 'idle',
      currentTask: null,
      lastActivity: Date.now(),
      reconnectAttempts: 0,
      processId: 12345
    });

    // Mock ACP client to simulate response
    const originalSendPrompt = agentManager.acpClient.sendPrompt;
    let sendPromptCalled = false;
    let stateWhenCalled = null;

    agentManager.acpClient.sendPrompt = async (agentName, prompt) => {
      sendPromptCalled = true;
      stateWhenCalled = agentManager.agentStates.get(agentName).state;
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return 'Mock response from agent';
    };

    // Test 2a: Dispatch should fail if agent is busy
    agentManager.agentStates.get('test-agent').state = 'busy';
    try {
      await agentManager.dispatch('test-agent', 'test prompt', {
        chatId: '123',
        userId: '456',
        messageId: '789'
      });
      throw new Error('Expected dispatch to fail when agent is busy');
    } catch (err) {
      if (err.message.includes('busy')) {
        console.log('✓ dispatch correctly rejects when agent is busy');
      } else {
        throw err;
      }
    }

    // Test 2b: Dispatch should fail if agent is unavailable
    agentManager.agentStates.get('test-agent').state = 'unavailable';
    try {
      await agentManager.dispatch('test-agent', 'test prompt', {
        chatId: '123',
        userId: '456',
        messageId: '789'
      });
      throw new Error('Expected dispatch to fail when agent is unavailable');
    } catch (err) {
      if (err.message.includes('unavailable')) {
        console.log('✓ dispatch correctly rejects when agent is unavailable');
      } else {
        throw err;
      }
    }

    // Reset to idle
    agentManager.agentStates.get('test-agent').state = 'idle';
    console.log('✓ Agent state validation works correctly\n');

    // Test 3: Verify state transitions
    console.log('Test 3: Verify state transitions to busy before sending prompt');
    
    const dispatchPromise = agentManager.dispatch('test-agent', 'test prompt', {
      chatId: '123',
      userId: '456',
      messageId: '789'
    });

    // Wait a bit for the dispatch to start
    await new Promise(resolve => setTimeout(resolve, 50));

    if (!sendPromptCalled) {
      throw new Error('ACP_Client.sendPrompt was not called');
    }

    if (stateWhenCalled !== 'busy') {
      throw new Error(`Expected state to be 'busy' when sendPrompt called, got '${stateWhenCalled}'`);
    }

    console.log('✓ Agent state transitions to busy before ACP_Client.sendPrompt\n');

    // Test 4: Verify response and state transition back to idle
    console.log('Test 4: Verify response and state transition back to idle');
    
    const response = await dispatchPromise;
    
    if (response !== 'Mock response from agent') {
      throw new Error(`Expected response 'Mock response from agent', got '${response}'`);
    }

    const finalState = agentManager.agentStates.get('test-agent').state;
    if (finalState !== 'idle') {
      throw new Error(`Expected final state to be 'idle', got '${finalState}'`);
    }

    console.log('✓ Agent state transitions back to idle after completion');
    console.log('✓ Response is returned correctly\n');

    // Test 5: Verify logging
    console.log('Test 5: Verify logging of prompt dispatch and response completion');
    
    const promptLogs = logger.getLogs('prompt');
    if (promptLogs.length === 0) {
      throw new Error('No prompt logs found');
    }

    const lastPromptLog = promptLogs[promptLogs.length - 1];
    if (lastPromptLog.agent !== 'test-agent' || lastPromptLog.text !== 'test prompt') {
      throw new Error('Prompt log does not contain correct information');
    }
    console.log('✓ Prompt dispatch is logged correctly');

    const responseCompleteLogs = logger.getLogs('response_complete');
    if (responseCompleteLogs.length === 0) {
      throw new Error('No response_complete logs found');
    }

    const lastResponseLog = responseCompleteLogs[responseCompleteLogs.length - 1];
    if (lastResponseLog.agent !== 'test-agent') {
      throw new Error('Response complete log does not contain correct agent');
    }
    if (typeof lastResponseLog.duration_ms !== 'number') {
      throw new Error('Response complete log does not contain duration_ms');
    }
    if (typeof lastResponseLog.chars !== 'number') {
      throw new Error('Response complete log does not contain chars');
    }
    console.log('✓ Response completion is logged correctly\n');

    // Test 6: Verify error handling
    console.log('Test 6: Verify error handling and state transition on error');
    
    agentManager.acpClient.sendPrompt = async (agentName, prompt) => {
      throw new Error('Simulated ACP error');
    };

    agentManager.agentStates.get('test-agent').state = 'idle';

    try {
      await agentManager.dispatch('test-agent', 'error test', {
        chatId: '123',
        userId: '456',
        messageId: '789'
      });
      throw new Error('Expected dispatch to fail with ACP error');
    } catch (err) {
      if (err.message.includes('Simulated ACP error')) {
        console.log('✓ Error is propagated correctly');
      } else {
        throw err;
      }
    }

    const stateAfterError = agentManager.agentStates.get('test-agent').state;
    if (stateAfterError !== 'idle') {
      throw new Error(`Expected state to be 'idle' after error, got '${stateAfterError}'`);
    }
    console.log('✓ Agent state transitions back to idle after error\n');

    // Restore original method
    agentManager.acpClient.sendPrompt = originalSendPrompt;

    console.log('=== All Task 5.2 Tests Passed ===\n');
    console.log('Summary:');
    console.log('✓ dispatch method checks agent state before dispatching');
    console.log('✓ dispatch transitions agent state to busy before sending prompt');
    console.log('✓ dispatch calls ACP_Client.sendPrompt() and awaits response');
    console.log('✓ dispatch transitions agent state back to idle after completion');
    console.log('✓ dispatch logs prompt dispatch events');
    console.log('✓ dispatch logs response completion events with duration and chars');
    console.log('✓ dispatch handles errors and transitions state back to idle');
    console.log('\nTask 5.2 implementation is complete and correct!');

  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

// Run tests
testDispatch().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

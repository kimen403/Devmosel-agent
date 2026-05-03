/**
 * Test script for Task 5.5: Task Cancellation
 * 
 * This script verifies that:
 * 1. cancelTask sends SIGTERM to the agent's child process
 * 2. Agent state transitions to idle after cancellation
 * 3. A new child process is spawned to replace the cancelled agent
 * 4. The new agent is ready to accept tasks
 */

const AgentManager = require('./agent-manager');
const Logger = require('./logger');

// Mock notifier
const mockNotifier = {
  send: (message) => console.log(`[NOTIFIER] ${message}`)
};

async function testTaskCancellation() {
  console.log('=== Task 5.5: Task Cancellation Test ===\n');

  // Initialize logger
  const logger = new Logger();

  // Initialize Agent Manager
  const agentManager = new AgentManager(logger, mockNotifier);

  try {
    // Step 1: Initialize agents
    console.log('Step 1: Initializing Agent Manager...');
    await agentManager.initialize();
    console.log('✓ Agent Manager initialized\n');

    // Wait a bit for agents to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Check initial state
    console.log('Step 2: Checking initial agent states...');
    const initialStates = agentManager.getAllAgentStates();
    for (const [name, state] of initialStates) {
      console.log(`  ${name}: ${state.state} (PID: ${state.processId})`);
    }
    console.log('');

    // Step 3: Dispatch a long-running task to backend agent
    console.log('Step 3: Dispatching a task to backend agent...');
    const testPrompt = 'Please analyze the entire codebase and provide a detailed report. Take your time.';
    const context = {
      chatId: 'test-chat',
      userId: 'test-user',
      messageId: 'test-msg-1'
    };

    // Start dispatch in background (don't await)
    const dispatchPromise = agentManager.dispatch('backend', testPrompt, context)
      .then(response => {
        console.log('  Task completed normally (unexpected)');
        return { completed: true, response };
      })
      .catch(error => {
        console.log(`  Task failed/cancelled: ${error.message}`);
        return { completed: false, error: error.message };
      });

    // Wait a bit to ensure task is running
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Check agent is busy
    console.log('\nStep 4: Verifying agent is busy...');
    const busyState = agentManager.getAgentState('backend');
    console.log(`  backend state: ${busyState}`);
    if (busyState !== 'busy') {
      throw new Error('Agent should be busy but is not');
    }
    console.log('✓ Agent is busy\n');

    // Get the PID before cancellation
    const stateBeforeCancel = agentManager.getAllAgentStates().get('backend');
    const pidBeforeCancel = stateBeforeCancel.processId;
    console.log(`  PID before cancellation: ${pidBeforeCancel}`);

    // Step 5: Cancel the task
    console.log('\nStep 5: Cancelling the task...');
    await agentManager.cancelTask('backend');
    console.log('✓ Task cancelled\n');

    // Step 6: Verify agent state is idle
    console.log('Step 6: Verifying agent state after cancellation...');
    const stateAfterCancel = agentManager.getAgentState('backend');
    console.log(`  backend state: ${stateAfterCancel}`);
    if (stateAfterCancel !== 'idle') {
      throw new Error(`Agent should be idle but is ${stateAfterCancel}`);
    }
    console.log('✓ Agent state is idle\n');

    // Step 7: Verify new process was spawned
    console.log('Step 7: Verifying new process was spawned...');
    const stateAfterSpawn = agentManager.getAllAgentStates().get('backend');
    const pidAfterCancel = stateAfterSpawn.processId;
    console.log(`  PID after cancellation: ${pidAfterCancel}`);
    
    if (pidBeforeCancel === pidAfterCancel) {
      throw new Error('New process should have different PID');
    }
    console.log('✓ New process spawned with different PID\n');

    // Step 8: Verify new agent can accept tasks
    console.log('Step 8: Verifying new agent can accept tasks...');
    const newTaskPrompt = 'What is 2 + 2?';
    const newContext = {
      chatId: 'test-chat',
      userId: 'test-user',
      messageId: 'test-msg-2'
    };

    try {
      const response = await agentManager.dispatch('backend', newTaskPrompt, newContext);
      console.log(`  Response received (${response.length} chars)`);
      console.log('✓ New agent can accept and process tasks\n');
    } catch (error) {
      throw new Error(`New agent failed to process task: ${error.message}`);
    }

    // Wait for original dispatch to complete
    const dispatchResult = await dispatchPromise;
    console.log(`Original task result: ${dispatchResult.completed ? 'completed' : 'cancelled'}`);

    // Step 9: Final state check
    console.log('\nStep 9: Final state check...');
    const finalStates = agentManager.getAllAgentStates();
    for (const [name, state] of finalStates) {
      console.log(`  ${name}: ${state.state} (PID: ${state.processId})`);
    }

    console.log('\n=== All Tests Passed ✓ ===\n');

    // Cleanup
    console.log('Cleaning up...');
    await agentManager.shutdown();
    console.log('✓ Cleanup complete');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error(error.stack);
    
    // Cleanup on error
    try {
      await agentManager.shutdown();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
    
    process.exit(1);
  }
}

// Run the test
testTaskCancellation().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

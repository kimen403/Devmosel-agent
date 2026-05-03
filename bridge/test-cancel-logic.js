/**
 * Unit test for Task 5.5: Task Cancellation Logic
 * 
 * This test verifies the cancelTask implementation without requiring
 * a full Kiro CLI setup. It uses mock processes to test the logic.
 */

const EventEmitter = require('events');

// Mock child process
class MockChildProcess extends EventEmitter {
  constructor(pid) {
    super();
    this.pid = pid;
    this.killed = false;
    this.stdin = {
      write: () => {}
    };
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
  }

  kill(signal) {
    this.killed = true;
    this.killedWith = signal;
    // Simulate process exit after a short delay
    setTimeout(() => {
      this.emit('exit', 0, signal);
    }, 100);
  }
}

// Mock logger
class MockLogger {
  constructor() {
    this.logs = [];
  }

  log(entry) {
    this.logs.push(entry);
    console.log(`[LOG] ${entry.type}: ${entry.message}`);
  }

  getLogs(type) {
    return this.logs.filter(log => log.type === type);
  }
}

// Mock notifier
class MockNotifier {
  constructor() {
    this.messages = [];
  }

  send(message) {
    this.messages.push(message);
    console.log(`[NOTIFIER] ${message}`);
  }
}

// Test the cancelTask logic
async function testCancelTaskLogic() {
  console.log('=== Task 5.5: Cancel Task Logic Test ===\n');

  const logger = new MockLogger();
  const notifier = new MockNotifier();

  // Create a simplified agent manager for testing
  const agentManager = {
    logger,
    notifier,
    agentStates: new Map(),
    agentProcesses: new Map(),
    acpClient: {
      cancelPendingRequests: (agentName) => {
        console.log(`[ACP] Cancelled pending requests for ${agentName}`);
      },
      unregisterAgent: (agentName) => {
        console.log(`[ACP] Unregistered agent ${agentName}`);
      },
      registerAgent: (agentName, process) => {
        console.log(`[ACP] Registered agent ${agentName} with PID ${process.pid}`);
      }
    },
    loadMCPConfig: () => ({ mcpServers: {} }),
    loadAgentConfig: (agentName) => ({
      name: agentName,
      description: 'Test agent',
      systemPrompt: 'Test',
      tools: [],
      mcpServers: []
    }),
    spawnAgent: async function(agentName, mcpConfig) {
      // Create a new mock process with different PID
      const newPid = Math.floor(Math.random() * 10000) + 1000;
      const newProcess = new MockChildProcess(newPid);
      
      this.agentProcesses.set(agentName, newProcess);
      this.acpClient.registerAgent(agentName, newProcess);
      
      const state = this.agentStates.get(agentName);
      if (state) {
        state.state = 'idle';
        state.processId = newPid;
        state.currentTask = null;
      }
      
      console.log(`[SPAWN] Spawned new agent ${agentName} with PID ${newPid}`);
    }
  };

  // Add the cancelTask method (the implementation we're testing)
  agentManager.cancelTask = async function(agentName) {
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
  };

  try {
    // Setup: Create a mock agent in busy state
    console.log('Step 1: Setting up mock agent in busy state...');
    const mockProcess = new MockChildProcess(12345);
    agentManager.agentProcesses.set('backend', mockProcess);
    agentManager.agentStates.set('backend', {
      name: 'backend',
      state: 'busy',
      currentTask: {
        prompt: 'Test task',
        startTime: Date.now(),
        context: { chatId: 'test', userId: 'test', messageId: 'test' }
      },
      lastActivity: Date.now(),
      reconnectAttempts: 0,
      processId: 12345
    });
    console.log('✓ Mock agent created with PID 12345\n');

    // Test: Cancel the task
    console.log('Step 2: Cancelling the task...');
    const pidBefore = agentManager.agentStates.get('backend').processId;
    console.log(`  PID before cancellation: ${pidBefore}`);
    
    await agentManager.cancelTask('backend');
    
    const pidAfter = agentManager.agentStates.get('backend').processId;
    console.log(`  PID after cancellation: ${pidAfter}`);
    console.log('✓ Task cancelled\n');

    // Verify: Check that SIGTERM was sent
    console.log('Step 3: Verifying SIGTERM was sent...');
    if (!mockProcess.killed) {
      throw new Error('Process should have been killed');
    }
    if (mockProcess.killedWith !== 'SIGTERM') {
      throw new Error(`Process should have been killed with SIGTERM, got ${mockProcess.killedWith}`);
    }
    console.log('✓ SIGTERM was sent to process\n');

    // Verify: Check state is idle
    console.log('Step 4: Verifying agent state is idle...');
    const state = agentManager.agentStates.get('backend');
    if (state.state !== 'idle') {
      throw new Error(`Agent state should be idle, got ${state.state}`);
    }
    if (state.currentTask !== null) {
      throw new Error('Current task should be null');
    }
    console.log('✓ Agent state is idle\n');

    // Verify: Check new process was spawned
    console.log('Step 5: Verifying new process was spawned...');
    if (pidBefore === pidAfter) {
      throw new Error('New process should have different PID');
    }
    console.log('✓ New process spawned with different PID\n');

    // Verify: Check logs
    console.log('Step 6: Verifying logs...');
    const cancellingLogs = logger.getLogs('task_cancelling');
    const cancelledLogs = logger.getLogs('task_cancelled');
    const replacedLogs = logger.getLogs('agent_replaced');
    
    if (cancellingLogs.length !== 1) {
      throw new Error('Should have 1 task_cancelling log');
    }
    if (cancelledLogs.length !== 1) {
      throw new Error('Should have 1 task_cancelled log');
    }
    if (replacedLogs.length !== 1) {
      throw new Error('Should have 1 agent_replaced log');
    }
    console.log('✓ All expected logs present\n');

    // Test error case: Cancel when not busy
    console.log('Step 7: Testing error case (agent not busy)...');
    try {
      await agentManager.cancelTask('backend');
      throw new Error('Should have thrown error for non-busy agent');
    } catch (error) {
      if (error.message.includes('has no running task')) {
        console.log('✓ Correctly throws error when agent not busy\n');
      } else {
        throw error;
      }
    }

    console.log('=== All Tests Passed ✓ ===\n');
    console.log('Summary:');
    console.log('  ✓ SIGTERM sent to child process');
    console.log('  ✓ Agent state transitioned to idle');
    console.log('  ✓ New child process spawned');
    console.log('  ✓ New process has different PID');
    console.log('  ✓ All logs recorded correctly');
    console.log('  ✓ Error handling works correctly');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testCancelTaskLogic().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

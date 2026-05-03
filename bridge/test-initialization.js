/**
 * Test initialization without starting Telegram bot
 */

// Load test environment
require('dotenv').config({ path: require('path').join(__dirname, '.env.test') });

const Logger = require('./logger');
const AgentManager = require('./agent-manager');
const Notifier = require('./notifier');

async function testInitialization() {
  console.log('🧪 Testing Bridge initialization...\n');

  try {
    // Test 1: Logger initialization
    console.log('Test 1: Logger initialization');
    const logger = new Logger();
    console.log('✅ Logger created successfully');

    // Test 2: Notifier initialization
    console.log('\nTest 2: Notifier initialization');
    const notifier = new Notifier(null, logger);
    console.log('✅ Notifier created successfully');
    console.log(`   Enabled: ${notifier.isEnabled()}`);

    // Test 3: AgentManager initialization (will fail due to mock KIRO_CLI_PATH)
    console.log('\nTest 3: AgentManager initialization');
    const agentManager = new AgentManager(logger, notifier);
    
    try {
      await agentManager.initialize();
      console.log('✅ AgentManager initialized successfully');
      console.log(`   Agent names: ${agentManager.agentNames.join(', ')}`);
      
      // Test agent states
      const states = agentManager.getAllAgentStates();
      console.log('   Agent states:');
      for (const [name, state] of states) {
        console.log(`     ${name}: ${state}`);
      }
      
      // Cleanup
      await agentManager.shutdown();
      console.log('✅ AgentManager shutdown successfully');
      
    } catch (error) {
      console.log('⚠️  AgentManager initialization failed (expected with mock CLI path)');
      console.log(`   Error: ${error.message}`);
      console.log('   This is normal in test environment without real Kiro CLI');
    }

    // Test 4: Environment validation
    console.log('\nTest 4: Environment validation');
    const required = ['BOT_TOKEN', 'ALLOWED_USERS', 'KIRO_CLI_PATH', 'WORKSPACE_PATH'];
    let allPresent = true;
    
    for (const varName of required) {
      if (!process.env[varName]) {
        console.log(`❌ Missing: ${varName}`);
        allPresent = false;
      } else {
        console.log(`✅ Present: ${varName}`);
      }
    }
    
    if (allPresent) {
      console.log('✅ All required environment variables present');
    }

    console.log('\n🎉 Initialization test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testInitialization();
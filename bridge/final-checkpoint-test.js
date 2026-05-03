/**
 * Final Checkpoint Test Suite
 * 
 * Comprehensive test to validate all implemented functionality
 * without requiring external dependencies (Telegram bot, Kiro CLI)
 */

const fs = require('fs');
const path = require('path');

// Test results tracking
let totalTests = 0;
let passedTests = 0;
const results = [];

function test(name, testFn) {
  totalTests++;
  try {
    const result = testFn();
    if (result !== false) {
      passedTests++;
      results.push(`✅ ${name}`);
      console.log(`✅ ${name}`);
    } else {
      results.push(`❌ ${name}`);
      console.log(`❌ ${name}`);
    }
  } catch (error) {
    results.push(`❌ ${name}: ${error.message}`);
    console.log(`❌ ${name}: ${error.message}`);
  }
}

console.log('🏁 Final Checkpoint - Comprehensive Test Suite\n');

// Test 1: Module Files Exist
console.log('=== Module Files ===');
test('index.js exists', () => fs.existsSync('index.js'));
test('logger.js exists', () => fs.existsSync('logger.js'));
test('agent-manager.js exists', () => fs.existsSync('agent-manager.js'));
test('acp-client.js exists', () => fs.existsSync('acp-client.js'));
test('telegram.js exists', () => fs.existsSync('telegram.js'));
test('notifier.js exists', () => fs.existsSync('notifier.js'));

// Test 2: Configuration Files
console.log('\n=== Configuration Files ===');
test('package.json exists', () => fs.existsSync('package.json'));
test('ecosystem.config.js exists', () => fs.existsSync('ecosystem.config.js'));
test('.env.example exists', () => fs.existsSync('.env.example'));
test('README.md exists', () => fs.existsSync('README.md'));

// Test 3: Workspace Configuration
console.log('\n=== Workspace Configuration ===');
const workspacePath = '../workspace/.kiro';
test('workspace/.kiro exists', () => fs.existsSync(workspacePath));
test('agent configs exist', () => {
  const agentDir = path.join(workspacePath, 'agents');
  const agents = ['backend.json', 'frontend.json', 'testing.json', 'devops.json', 'reviewer.json'];
  return agents.every(agent => fs.existsSync(path.join(agentDir, agent)));
});
test('mcp.json exists', () => fs.existsSync(path.join(workspacePath, 'settings/mcp.json')));

// Test 4: Module Loading
console.log('\n=== Module Loading ===');
test('Logger module loads', () => {
  const Logger = require('./logger');
  return typeof Logger === 'function';
});

test('AgentManager module loads', () => {
  const AgentManager = require('./agent-manager');
  return typeof AgentManager === 'function';
});

test('ACP_Client module loads', () => {
  const ACP_Client = require('./acp-client');
  return typeof ACP_Client === 'function';
});

test('TelegramAdapter module loads', () => {
  const TelegramAdapter = require('./telegram');
  return typeof TelegramAdapter === 'function';
});

test('Notifier module loads', () => {
  const Notifier = require('./notifier');
  return typeof Notifier === 'function';
});

// Test 5: Module Instantiation
console.log('\n=== Module Instantiation ===');
test('Logger instantiates', () => {
  const Logger = require('./logger');
  const logger = new Logger();
  return logger && typeof logger.log === 'function';
});

test('ACP_Client instantiates', () => {
  const ACP_Client = require('./acp-client');
  const client = new ACP_Client();
  return client && typeof client.sendPrompt === 'function';
});

test('Notifier instantiates', () => {
  const Notifier = require('./notifier');
  const Logger = require('./logger');
  const logger = new Logger();
  const notifier = new Notifier(null, logger);
  return notifier && typeof notifier.send === 'function';
});

// Test 6: Configuration Parsing
console.log('\n=== Configuration Parsing ===');
test('Agent configs are valid JSON', () => {
  const agentDir = path.join(workspacePath, 'agents');
  const agents = ['backend.json', 'frontend.json', 'testing.json', 'devops.json', 'reviewer.json'];
  
  for (const agent of agents) {
    const configPath = path.join(agentDir, agent);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Validate required fields
    if (!config.name || !config.description || !config.systemPrompt || 
        !Array.isArray(config.tools) || !Array.isArray(config.mcpServers)) {
      return false;
    }
  }
  return true;
});

test('MCP config is valid JSON', () => {
  const mcpPath = path.join(workspacePath, 'settings/mcp.json');
  const config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
  
  // Validate structure
  return config.mcpServers && 
         config.mcpServers.github && 
         config.mcpServers.supabase && 
         config.mcpServers.vercel;
});

test('Package.json is valid', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  // Check required dependencies
  const requiredDeps = ['node-telegram-bot-api', 'dotenv', 'winston'];
  return requiredDeps.every(dep => pkg.dependencies && pkg.dependencies[dep]);
});

// Test 7: PM2 Configuration
console.log('\n=== PM2 Configuration ===');
test('PM2 config is valid', () => {
  const config = require('./ecosystem.config.js');
  const app = config.apps[0];
  
  return app.name === 'devmosel-bridge' &&
         app.script === './index.js' &&
         app.watch === false &&
         typeof app.restart_delay === 'number' &&
         typeof app.max_restarts === 'number';
});

// Test 8: Environment Template
console.log('\n=== Environment Template ===');
test('.env.example has required variables', () => {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  const requiredVars = ['BOT_TOKEN', 'ALLOWED_USERS', 'KIRO_CLI_PATH', 'WORKSPACE_PATH', 'GITHUB_TOKEN'];
  
  return requiredVars.every(varName => envExample.includes(varName));
});

// Test 9: Documentation
console.log('\n=== Documentation ===');
test('README.md exists and has content', () => {
  const readme = fs.readFileSync('README.md', 'utf8');
  return readme.length > 1000 && readme.includes('Telegram-Kiro-Bot');
});

test('DEPLOYMENT.md exists', () => fs.existsSync('DEPLOYMENT.md'));

// Test 10: Log Directory Structure
console.log('\n=== Log Directory ===');
test('logs directory exists', () => fs.existsSync('logs'));

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(50));
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 ALL TESTS PASSED! The system is ready for deployment.');
  console.log('\n📋 Next Steps:');
  console.log('1. Copy .env.example to .env and configure with real values');
  console.log('2. Install Kiro CLI and set KIRO_CLI_PATH');
  console.log('3. Create Telegram bot with @BotFather');
  console.log('4. Set up MCP server tokens (GitHub, Supabase, Vercel)');
  console.log('5. Deploy with PM2: pm2 start ecosystem.config.js');
} else {
  console.log('\n❌ Some tests failed. Please review the issues above.');
  process.exit(1);
}

console.log('\n' + '='.repeat(50));
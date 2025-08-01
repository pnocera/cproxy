#!/usr/bin/env node

/**
 * Simple test script for the MCP proxy server
 * Tests basic functionality and configuration loading
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const TEST_CONFIG = './mcp-config.json';
const BUILD_OUTPUT = './dist/simple-mcp-server.js';

async function testConfigValidation() {
  console.log('🧪 Testing configuration validation...');
  
  if (!existsSync(TEST_CONFIG)) {
    console.error('❌ Test configuration file not found:', TEST_CONFIG);
    return false;
  }
  
  try {
    const { ConfigManager } = await import('../dist/mcp-config.js');
    const config = ConfigManager.load(TEST_CONFIG);
    
    console.log('✅ Configuration loaded successfully');
    console.log('   Server:', config.server.name, 'v' + config.server.version);
    console.log('   Providers:', config.providers.length);
    console.log('   Routing:', config.routing.strategy);
    
    return true;
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.message);
    return false;
  }
}

async function testServerStart() {
  console.log('🚀 Testing MCP server startup...');
  
  if (!existsSync(BUILD_OUTPUT)) {
    console.error('❌ MCP server build output not found:', BUILD_OUTPUT);
    console.log('   Run: npm run build');
    return false;
  }
  
  return new Promise((resolve) => {
    const serverProcess = spawn('node', [BUILD_OUTPUT, TEST_CONFIG], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });
    
    let output = '';
    let errorOutput = '';
    
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Give the server time to start
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
      
      if (output.includes('MCP proxy server started successfully')) {
        console.log('✅ MCP server started successfully');
        console.log('   Output:', output.trim().split('\\n')[0]);
        resolve(true);
      } else {
        console.error('❌ MCP server failed to start');
        console.error('   stdout:', output.trim());
        console.error('   stderr:', errorOutput.trim());
        resolve(false);
      }
    }, 3000);
    
    serverProcess.on('error', (error) => {
      console.error('❌ Failed to start server process:', error.message);
      resolve(false);
    });
  });
}

async function testDependencies() {
  console.log('📦 Testing dependencies...');
  
  try {
    // Test MCP SDK import
    await import('@modelcontextprotocol/sdk/server/index.js');
    console.log('✅ @modelcontextprotocol/sdk imported successfully');
    
    // Test Zod import
    const { z } = await import('zod');
    console.log('✅ zod imported successfully');
    
    // Test basic Zod schema
    const schema = z.object({ test: z.string() });
    schema.parse({ test: 'hello' });
    console.log('✅ Zod schema validation working');
    
    return true;
  } catch (error) {
    console.error('❌ Dependency test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🎯 Running MCP Server Tests\\n');
  
  const tests = [
    { name: 'Dependencies', fn: testDependencies },
    { name: 'Configuration', fn: testConfigValidation },
    { name: 'Server Startup', fn: testServerStart }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\\n--- ${test.name} Test ---`);
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ ${test.name} test threw an error:`, error.message);
      failed++;
    }
  }
  
  console.log('\\n📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\\n🎉 All tests passed! The MCP server is ready to use.');
  } else {
    console.log('\\n⚠️  Some tests failed. Please check the errors above.');
  }
  
  return failed === 0;
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    });
}

export { runTests, testConfigValidation, testServerStart, testDependencies };
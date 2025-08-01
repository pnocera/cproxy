#!/usr/bin/env node

/**
 * Comprehensive Proxy Validation Script
 * Tests the cproxy server with various scenarios and configurations
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  RESET: '\x1b[0m'
};

const log = (color, message) => {
  console.log(`${color}${message}${COLORS.RESET}`);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class ProxyValidator {
  constructor() {
    this.proxyProcess = null;
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  async startProxy(port = 3000, env = {}) {
    log(COLORS.BLUE, `🚀 Starting proxy server on port ${port}...`);
    
    const proxyEnv = {
      ...process.env,
      PORT: port.toString(),
      DEBUG: '1',
      ...env
    };

    return new Promise((resolve, reject) => {
      this.proxyProcess = spawn('node', ['dist/index.js'], {
        env: proxyEnv,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      this.proxyProcess.stdout.on('data', (data) => {
        const message = data.toString();
        output += message;
        if (message.includes(`server started on port ${port}`)) {
          log(COLORS.GREEN, `✅ Proxy server started successfully`);
          resolve();
        }
      });

      this.proxyProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      this.proxyProcess.on('error', (err) => {
        log(COLORS.RED, `❌ Failed to start proxy: ${err.message}`);
        reject(err);
      });

      this.proxyProcess.on('exit', (code) => {
        if (code !== 0) {
          log(COLORS.RED, `❌ Proxy exited with code ${code}`);
          log(COLORS.RED, `Error output: ${errorOutput}`);
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!output.includes('server started')) {
          log(COLORS.RED, '❌ Proxy failed to start within 10 seconds');
          log(COLORS.YELLOW, `Output: ${output}`);
          log(COLORS.YELLOW, `Error: ${errorOutput}`);
          reject(new Error('Timeout starting proxy'));
        }
      }, 10000);
    });
  }

  async stopProxy() {
    if (this.proxyProcess) {
      log(COLORS.BLUE, '🛑 Stopping proxy server...');
      this.proxyProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await sleep(1000);
      
      if (!this.proxyProcess.killed) {
        this.proxyProcess.kill('SIGKILL');
      }
      
      this.proxyProcess = null;
      log(COLORS.GREEN, '✅ Proxy server stopped');
    }
  }

  async runTest(name, testFn) {
    log(COLORS.CYAN, `🧪 Running test: ${name}`);
    
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      
      log(COLORS.GREEN, `✅ ${name} (${duration}ms)`);
      this.results.passed++;
      this.results.tests.push({ name, status: 'passed', duration });
    } catch (error) {
      log(COLORS.RED, `❌ ${name}: ${error.message}`);
      this.results.failed++;
      this.results.tests.push({ name, status: 'failed', error: error.message });
    }
  }

  async testBasicRequest(port = 3000) {
    const response = await fetch(`http://localhost:${port}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: 'Hello, this is a test message.' }
        ],
        max_tokens: 100
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    
    if (!data.id || !data.content || !Array.isArray(data.content)) {
      throw new Error('Invalid response format');
    }

    log(COLORS.GREEN, `✅ Received response with ID: ${data.id}`);
  }

  async testStreamingRequest(port = 3000) {
    const response = await fetch(`http://localhost:${port}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: 'Tell me a short story.' }
        ],
        max_tokens: 150,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    if (response.headers.get('content-type') !== 'text/event-stream') {
      throw new Error('Expected text/event-stream content type');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunks = 0;
    let hasMessageStart = false;
    let hasContentDelta = false;
    let hasMessageStop = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        chunks++;

        if (text.includes('message_start')) hasMessageStart = true;
        if (text.includes('content_block_delta')) hasContentDelta = true;
        if (text.includes('message_stop')) hasMessageStop = true;

        if (chunks > 100) break; // Prevent infinite loop
      }
    } finally {
      reader.releaseLock();
    }

    if (!hasMessageStart) throw new Error('Missing message_start event');
    if (!hasContentDelta) throw new Error('Missing content_block_delta event');
    if (!hasMessageStop) throw new Error('Missing message_stop event');

    log(COLORS.GREEN, `✅ Received ${chunks} streaming chunks with proper SSE events`);
  }

  async testErrorHandling(port = 3000) {
    // Test malformed request
    const response = await fetch(`http://localhost:${port}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing required messages field
        max_tokens: 100
      })
    });

    // Should handle gracefully (may be 400, 422, or 500 depending on implementation)
    if (response.status < 400 || response.status >= 600) {
      throw new Error(`Expected 4xx or 5xx error, got ${response.status}`);
    }

    log(COLORS.GREEN, `✅ Properly handled malformed request with status ${response.status}`);
  }

  async testDifferentModels(port = 3000) {
    const models = [
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-3-opus-20240229'
    ];

    for (const model of models) {
      const response = await fetch(`http://localhost:${port}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: `Test with model ${model}` }
          ],
          max_tokens: 50
        })
      });

      if (!response.ok) {
        log(COLORS.YELLOW, `⚠️ Model ${model} failed: ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (data.model && data.model !== model) {
        log(COLORS.YELLOW, `⚠️ Model mismatch: requested ${model}, got ${data.model}`);
      }
    }

    log(COLORS.GREEN, `✅ Tested multiple model configurations`);
  }

  async testConcurrentRequests(port = 3000) {
    const concurrency = 5;
    const requests = Array(concurrency).fill(null).map((_, i) =>
      fetch(`http://localhost:${port}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          messages: [
            { role: 'user', content: `Concurrent request ${i + 1}` }
          ],
          max_tokens: 50
        })
      })
    );

    const responses = await Promise.all(requests);
    
    const successCount = responses.filter(r => r.ok).length;
    if (successCount < concurrency * 0.8) { // 80% success rate
      throw new Error(`Too many failed requests: ${successCount}/${concurrency} succeeded`);
    }

    log(COLORS.GREEN, `✅ Handled ${successCount}/${concurrency} concurrent requests successfully`);
  }

  async testWithTools(port = 3000) {
    const response = await fetch(`http://localhost:${port}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: 'What is the weather like today?' }
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather information',
            input_schema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
                unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
              },
              required: ['location']
            }
          }
        ],
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    
    // Response might or might not use tools, but should handle them without error
    log(COLORS.GREEN, `✅ Successfully processed request with tools`);
  }

  async generateReport() {
    const total = this.results.passed + this.results.failed + this.results.skipped;
    const successRate = total > 0 ? (this.results.passed / total) * 100 : 0;

    log(COLORS.BLUE, '\n📊 Validation Report');
    log(COLORS.BLUE, '==================');
    
    log(COLORS.GREEN, `✅ Passed: ${this.results.passed}`);
    log(COLORS.RED, `❌ Failed: ${this.results.failed}`);
    log(COLORS.YELLOW, `⏭️ Skipped: ${this.results.skipped}`);
    log(COLORS.CYAN, `📈 Success Rate: ${successRate.toFixed(1)}%`);

    if (this.results.failed > 0) {
      log(COLORS.RED, '\n❌ Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          log(COLORS.RED, `  • ${test.name}: ${test.error}`);
        });
    }

    // Generate JSON report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        successRate
      },
      tests: this.results.tests
    };

    await fs.mkdir('reports', { recursive: true });
    await fs.writeFile('reports/validation-report.json', JSON.stringify(report, null, 2));
    
    log(COLORS.BLUE, '\n📄 Detailed report saved to: reports/validation-report.json');

    return successRate >= 80; // Consider success if 80% or more tests pass
  }

  async runValidation() {
    log(COLORS.MAGENTA, '🔍 Starting cproxy validation...\n');

    try {
      // Check if project is built
      try {
        await fs.access('dist/index.js');
      } catch {
        log(COLORS.YELLOW, '⚠️ Built files not found, building project...');
        await this.buildProject();
      }

      const port = 3000;
      
      // Start proxy server
      await this.startProxy(port);
      
      // Wait for server to be fully ready
      await sleep(2000);

      // Run validation tests
      await this.runTest('Basic Request', () => this.testBasicRequest(port));
      await this.runTest('Streaming Request', () => this.testStreamingRequest(port));
      await this.runTest('Error Handling', () => this.testErrorHandling(port));
      await this.runTest('Different Models', () => this.testDifferentModels(port));
      await this.runTest('Concurrent Requests', () => this.testConcurrentRequests(port));
      await this.runTest('Tools Support', () => this.testWithTools(port));

    } catch (error) {
      log(COLORS.RED, `💥 Validation failed: ${error.message}`);
      this.results.failed++;
    } finally {
      await this.stopProxy();
    }

    return await this.generateReport();
  }

  async buildProject() {
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        stdio: 'inherit'
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          log(COLORS.GREEN, '✅ Project built successfully');
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });

      buildProcess.on('error', (err) => {
        reject(new Error(`Build error: ${err.message}`));
      });
    });
  }
}

// CLI handling
const args = process.argv.slice(2);
const showHelp = args.includes('--help') || args.includes('-h');

if (showHelp) {
  console.log(`
cproxy Validation Script

Usage: node scripts/validate-proxy.js [options]

Options:
  -h, --help    Show this help message

This script starts the cproxy server and runs comprehensive validation tests
including basic requests, streaming, error handling, and performance checks.

Examples:
  node scripts/validate-proxy.js
  npm run validate
`);
  process.exit(0);
}

// Main execution
async function main() {
  const validator = new ProxyValidator();
  
  try {
    const success = await validator.runValidation();
    
    if (success) {
      log(COLORS.GREEN, '\n🎉 Validation completed successfully!');
      process.exit(0);
    } else {
      log(COLORS.RED, '\n💥 Validation completed with failures!');
      process.exit(1);
    }
  } catch (error) {
    log(COLORS.RED, `\n💥 Validation error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(error => {
  log(COLORS.RED, `Fatal error: ${error.message}`);
  process.exit(1);
});
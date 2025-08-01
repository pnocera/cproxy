# MCP Proxy Server

An advanced Model Context Protocol (MCP) proxy server built with TypeScript, providing configurable provider routing, comprehensive error handling, and structured logging.

## Features

- **MCP Protocol Compliance**: Full implementation of the Model Context Protocol specification
- **Provider Routing**: Configurable routing strategies (round-robin, least-load, priority)
- **Health Monitoring**: Automatic health checks with provider failover
- **Structured Logging**: JSON and text logging with multiple levels
- **Error Handling**: Comprehensive error handling with proper MCP error codes
- **Configuration Management**: Flexible configuration via files and environment variables
- **TypeScript**: Full type safety with comprehensive type definitions

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the MCP Server

```bash
npm run build
```

### 3. Create Configuration

Copy the example configuration and customize it for your providers:

```bash
cp mcp-config.example.json mcp-config.json
```

Edit `mcp-config.json` with your provider configurations:

```json
{
  "providers": [
    {
      "name": "openai",
      "baseUrl": "https://api.openai.com",
      "apiKey": "your-openai-api-key",
      "enabled": true
    }
  ]
}
```

### 4. Start the MCP Server

```bash
npm run start:mcp
```

Or run in development mode with hot reload:

```bash
npm run dev:mcp
```

## Configuration

### File-Based Configuration

The server looks for configuration files in the following order:

1. Path provided as command line argument
2. `MCP_CONFIG_PATH` environment variable
3. `./mcp-config.json`
4. `./config/mcp.json`
5. `~/.config/cproxy/mcp.json`

### Environment Variables

Core server settings:
- `MCP_SERVER_NAME`: Server name (default: "cproxy-mcp")
- `MCP_SERVER_VERSION`: Server version (default: "1.0.0")
- `MCP_SERVER_PORT`: Server port (default: 3001)
- `MCP_SERVER_HOST`: Server host (default: "localhost")

Routing configuration:
- `MCP_ROUTING_STRATEGY`: Routing strategy (`round-robin`, `least-load`, `priority`)
- `MCP_ROUTING_FALLBACK`: Enable fallback to other providers (true/false)
- `MCP_HEALTH_CHECK_ENABLED`: Enable health checks (true/false)
- `MCP_HEALTH_CHECK_INTERVAL`: Health check interval in ms (default: 30000)
- `MCP_HEALTH_CHECK_TIMEOUT`: Health check timeout in ms (default: 5000)

Logging configuration:
- `MCP_LOG_LEVEL`: Log level (`debug`, `info`, `warn`, `error`)
- `MCP_LOG_FORMAT`: Log format (`json`, `text`)
- `MCP_LOG_FILE`: Log file path (optional)

Simple provider setup:
- `MCP_PROVIDER_URL`: Single provider base URL
- `MCP_PROVIDER_NAME`: Provider name (default: "default")
- `MCP_PROVIDER_API_KEY`: Provider API key
- `MCP_PROVIDER_TIMEOUT`: Request timeout in ms
- `MCP_PROVIDER_RETRIES`: Number of retries

### Configuration Schema

```typescript
interface MCPConfig {
  server: {
    name: string;
    version: string;
    port: number;
    host: string;
  };
  providers: Array<{
    name: string;
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    timeout?: number;
    retries?: number;
    enabled: boolean;
  }>;
  routing: {
    strategy: 'round-robin' | 'priority' | 'least-load';
    fallback: boolean;
    healthCheck: {
      enabled: boolean;
      interval: number;
      timeout: number;
    };
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    file?: string;
  };
}
```

## Provider Routing Strategies

### Round Robin
Distributes requests evenly across all healthy providers in rotation.

```json
{
  "routing": {
    "strategy": "round-robin"
  }
}
```

### Least Load
Routes requests to the provider with the lowest current load (based on request count and error rate).

```json
{
  "routing": {
    "strategy": "least-load"
  }
}
```

### Priority
Routes requests to providers based on their order in the configuration (first provider has highest priority).

```json
{
  "routing": {
    "strategy": "priority"
  }
}
```

## Health Monitoring

The server continuously monitors provider health with configurable intervals:

- **Health Checks**: Periodic ping requests to verify provider availability
- **Automatic Failover**: Unhealthy providers are temporarily removed from rotation
- **Recovery Detection**: Providers are re-enabled when they become healthy again

## Error Handling

The server implements comprehensive error handling with proper MCP error codes:

- `PARSE_ERROR` (-32700): JSON parsing errors
- `INVALID_REQUEST` (-32600): Invalid MCP request format
- `METHOD_NOT_FOUND` (-32601): Unsupported MCP method
- `INVALID_PARAMS` (-32602): Invalid method parameters
- `INTERNAL_ERROR` (-32603): Server internal errors
- `PROVIDER_ERROR` (-32000): Provider-specific errors
- `PROVIDER_UNAVAILABLE` (-32001): No healthy providers available
- `TIMEOUT_ERROR` (-32002): Request timeout
- `RATE_LIMIT_ERROR` (-32003): Rate limiting errors

## Logging

### Log Levels
- `debug`: Detailed debugging information
- `info`: General operational messages
- `warn`: Warning conditions
- `error`: Error conditions

### Log Formats

**JSON Format** (default):
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "Request completed",
  "context": {
    "requestId": "req_123",
    "provider": "openai",
    "duration": 150
  }
}
```

**Text Format**:
```
[2024-01-01T12:00:00.000Z] INFO: Request completed {"requestId":"req_123","provider":"openai","duration":150}
```

## MCP Methods Supported

- `initialize`: Server initialization
- `initialized`: Initialization confirmation
- `ping`: Health check ping
- `resources/list`: List available resources
- `resources/read`: Read specific resource
- `tools/list`: List available tools
- `tools/call`: Execute tool calls
- `prompts/list`: List available prompts
- `prompts/get`: Get specific prompt
- `logging/setLevel`: Change log level

## API Usage

### Using as MCP Server

The server implements the standard MCP protocol and can be used with any MCP-compatible client:

```bash
# Start the server
npm run start:mcp

# The server listens on stdio for MCP requests
echo '{"jsonrpc":"2.0","id":1,"method":"ping"}' | npm run start:mcp
```

### Programmatic Usage

```typescript
import { MCPProxyServer } from './src/mcp-proxy.js';

const server = new MCPProxyServer('./config/mcp.json');
await server.start();

// Get server metrics
const metrics = server.getMetrics();
console.log(`Total requests: ${metrics.totalRequests}`);

// Get provider stats
const providers = server.getProviderStats();
for (const [name, provider] of providers) {
  console.log(`${name}: ${provider.requestCount} requests`);
}
```

## Build Scripts

- `npm run build`: Build both proxy and MCP servers
- `npm run build:mcp`: Build only MCP server
- `npm run start:mcp`: Start the MCP server
- `npm run dev:mcp`: Development mode with hot reload
- `npm run build:exe:mcp`: Build MCP server executable
- `npm run typecheck`: TypeScript type checking

## Development

### Project Structure

```
src/
├── mcp-types.ts      # Type definitions
├── mcp-server.ts     # Core server implementation
├── mcp-config.ts     # Configuration management
├── mcp-logger.ts     # Logging system
└── mcp-proxy.ts      # Entry point
```

### Adding New Providers

1. Add provider configuration to `mcp-config.json`
2. The server automatically detects and loads new providers
3. Health checks ensure provider availability

### Custom Routing Strategies

Extend the routing system by implementing new strategies in `mcp-server.ts`:

```typescript
private customRouting(context: RoutingContext): RoutingResult {
  // Your custom routing logic
  return { provider, reason: 'custom-strategy' };
}
```

## Testing

```bash
# Type checking
npm run typecheck

# Build verification
npm run build

# Test MCP server with example config
MCP_PROVIDER_URL=http://localhost:8080 npm run start:mcp
```

## Troubleshooting

### Common Issues

1. **Dependencies not found**: Run `npm install` or `bun install`
2. **Build failures**: Check TypeScript version compatibility
3. **Provider connection errors**: Verify provider URLs and API keys
4. **Health check failures**: Adjust timeout settings in configuration

### Debug Mode

Enable debug logging to see detailed operation information:

```bash
MCP_LOG_LEVEL=debug npm run start:mcp
```

### Log Analysis

Monitor the log file for patterns:

```bash
# Watch logs in real-time
tail -f ./logs/mcp-proxy.log

# Search for errors
grep -i error ./logs/mcp-proxy.log
```

## License

MIT - see LICENSE file for details.
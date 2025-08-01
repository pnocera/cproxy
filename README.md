# CProxy

A TypeScript proxy server that converts Anthropic Claude API requests to OpenAI-compatible format.

## Installation

```bash
npm install -g @pnocera/cproxy
```

## Usage

```bash
# Start HTTP proxy server
cproxy --port 3000

# Start MCP server
cproxy --mcp
```

## Configuration

Set environment variables:

```bash
OPENROUTER_API_KEY=your_key_here
ANTHROPIC_PROXY_BASE_URL=https://openrouter.ai/api
```

## API

Send Anthropic-format requests to `http://localhost:3000/v1/messages`

Example:
```json
{
  "model": "claude-3-sonnet-20240229",
  "max_tokens": 1000,
  "messages": [
    {"role": "user", "content": "Hello"}
  ]
}
```

## MCP Mode

For Claude Code integration:

```bash
# Start MCP server
cproxy --mcp
```

The MCP server uses the same configuration as the HTTP proxy.

## License

MIT
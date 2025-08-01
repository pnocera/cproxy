# CProxy

A TypeScript proxy server that converts Anthropic Claude API requests to OpenAI-compatible format.

## Features

- TypeScript with comprehensive type definitions
- Server-Sent Events (SSE) streaming support
- Function calling and tool usage
- OpenRouter, Anthropic, and OpenAI-compatible API support
- Environment-based configuration
- Comprehensive type checking and validation
- Self-contained executable builds

## Installation

### From npm (Recommended)

```bash
# Install globally as a CLI tool
npm install -g @pnocera/cproxy

# Or install locally in your project
npm install @pnocera/cproxy
```

### From Source

```bash
# Clone and build from source
git clone https://github.com/pnocera/cproxy
cd cproxy
bun install
bun run build
```

## Development

```bash
# Development with hot reload
bun run dev

# Type checking
bun run typecheck

# Build for production
bun run build

# Run built application
bun start
```

## Executable Builds

Create standalone executables that include the Bun runtime:

```bash
# Single executable for current platform
bun run build:exe

# Optimized executable with sourcemaps
bun run build:exe:optimized

# All platforms (Linux, macOS, Windows)
bun run build:exe:advanced

# Docker-based consistent build
bun run build:exe:docker
```

Executables are approximately 100MB and require no external dependencies.

## Environment Variables

```bash
# Optional: Custom API base URL (defaults to OpenRouter)
ANTHROPIC_PROXY_BASE_URL=https://api.openai.com

# Required if using OpenRouter or similar services
OPENROUTER_API_KEY=your_key_here

# Optional: Custom models
REASONING_MODEL=google/gemini-2.0-pro-exp-02-05:free
COMPLETION_MODEL=google/gemini-2.0-pro-exp-02-05:free

# Optional: Server configuration
PORT=3000
DEBUG=1
```

## API Usage

Send requests to `/v1/messages` with Anthropic Claude format:

```typescript
const response = await fetch('http://localhost:3000/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-3-sonnet-20240229',
    messages: [
      {
        role: 'user',
        content: 'Hello, how are you?'
      }
    ],
    max_tokens: 1000,
    stream: true // Optional: enable streaming
  })
});
```

## Type Definitions

The server includes comprehensive TypeScript types for:

- Anthropic API request/response formats
- OpenAI API request/response formats
- Streaming event types
- Tool calling interfaces
- Configuration types

## Architecture

```
src/
├── index.ts      # Main server implementation
└── types.ts      # Comprehensive type definitions

dist/             # Compiled JavaScript output
├── index.js
├── index.d.ts
└── types.d.ts
```

## Scripts

- `bun run build` - Compile TypeScript to JavaScript
- `bun run dev` - Development mode with hot reload
- `bun run typecheck` - Type checking without compilation
- `bun run clean` - Remove build artifacts
- `bun start` - Run compiled server
- `bun run build:exe` - Create standalone executable
- `bun run build:exe:advanced` - Build executables for all platforms

## NPM Publishing

### For Maintainers

To publish a new version to npm:

```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Build and validate
npm run prepublishOnly

# 3. Test the package contents
npm run pack

# 4. Publish to npm
npm publish

# 5. Push version tag to GitHub
git push origin main --tags
```

### Package Contents

The npm package includes only the necessary files:
- `dist/` - Compiled JavaScript and type definitions
- `README.md` - Documentation
- `LICENSE` - MIT license
- `package.json` - Package metadata

Source TypeScript files, development tools, and executables are excluded via `.npmignore`.

### Version Management

This project follows [Semantic Versioning](https://semver.org/):
- **PATCH** (1.3.1): Bug fixes and small improvements
- **MINOR** (1.4.0): New features, backward compatible
- **MAJOR** (2.0.0): Breaking changes

### CLI Usage After Installation

Once installed via npm, use the `cproxy` command:

```bash
# Start the proxy server
cproxy

# Or use npx without global installation
npx @pnocera/cproxy
```

The binary is automatically available in your PATH when installed globally.

## License

MIT
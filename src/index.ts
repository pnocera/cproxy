#!/usr/bin/env node

/**
 * cproxy - TypeScript Proxy Server
 * Converted from JavaScript to TypeScript by Hive Mind Collective Intelligence
 * 
 * A simple proxy server with streaming support and API transformation capabilities.
 * Supports Anthropic Claude API format with OpenAI backend compatibility.
 */

import Fastify from 'fastify';
import { TextDecoder } from 'util';
import type {
  ProxyConfig,
  ProxyRequest,
  ProxyReply,
  AnthropicRequest,
  AnthropicResponse,
  AnthropicContent,
  AnthropicMessage,
  AnthropicTool,
  OpenAIRequest,
  OpenAIResponse,
  OpenAIMessage,
  OpenAITool,
  OpenAIToolCall,
  SSEEventType,
  SSEEvent,
  FinishReason,
  AnthropicStopReason,
  ContentNormalizer,
  StopReasonMapper,
  SchemaProcessor,
  SSESender,
  DebugLogger,
  StreamingState
} from './types.js';

import {
  DEFAULT_MODEL,
  DEFAULT_BASE_URL,
  DEFAULT_PORT,
  EXCLUDED_TOOLS
} from './types.js';

// ==================== CLI ARGUMENT PARSING ====================

/**
 * Parse command line arguments
 */
const parseCliArgs = (): { port?: number; help?: boolean } => {
  const args = process.argv.slice(2);
  const parsed: { port?: number; help?: boolean } = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--port' || arg === '-p') {
      const portValue = args[i + 1];
      if (portValue && !isNaN(parseInt(portValue, 10))) {
        parsed.port = parseInt(portValue, 10);
        i++; // Skip the next argument since we consumed it
      } else {
        console.error('Error: --port requires a valid number');
        process.exit(1);
      }
    }
  }
  
  return parsed;
};

/**
 * Display help message
 */
const showHelp = (): void => {
  console.log(`
cproxy - TypeScript Proxy Server
A simple proxy server with streaming support and API transformation capabilities.

Usage: npx @pnocera/cproxy [options]

Options:
  -p, --port <number>    Port to run the server on (default: 3000)
  -h, --help             Show this help message

Environment Variables:
  PORT                   Port to run the server on
  ANTHROPIC_PROXY_BASE_URL   Base URL for the proxy target
  OPENROUTER_API_KEY     API key for OpenRouter
  REASONING_MODEL        Model to use for reasoning tasks
  COMPLETION_MODEL       Model to use for completion tasks
  DEBUG                  Enable debug logging

Examples:
  npx @pnocera/cproxy --port 8080
  PORT=3001 npx @pnocera/cproxy
  DEBUG=1 npx @pnocera/cproxy --port 3001
`);
};

const cliArgs = parseCliArgs();

// Show help and exit if requested
if (cliArgs.help) {
  showHelp();
  process.exit(0);
}

// ==================== CONFIGURATION ====================

const env = process.env;

const config: ProxyConfig = {
  baseUrl: env['ANTHROPIC_PROXY_BASE_URL'] || DEFAULT_BASE_URL,
  requiresApiKey: !env['ANTHROPIC_PROXY_BASE_URL'],
  key: env['ANTHROPIC_PROXY_BASE_URL'] ? null : (env['OPENROUTER_API_KEY'] || null),
  model: DEFAULT_MODEL,
  models: {
    reasoning: env['REASONING_MODEL'] || DEFAULT_MODEL,
    completion: env['COMPLETION_MODEL'] || DEFAULT_MODEL,
  }
};

// Determine port: CLI arg > ENV var > DEFAULT
const serverPort = cliArgs.port || parseInt(env['PORT'] || DEFAULT_PORT.toString(), 10);

// ==================== FASTIFY INITIALIZATION ====================

const fastify = Fastify({
  logger: true
});

// ==================== UTILITY FUNCTIONS ====================

/**
 * Debug logging function - only logs when DEBUG environment variable is set
 */
const debug: DebugLogger = (...args: any[]): void => {
  if (!env['DEBUG']) return;
  console.log(...args);
};

/**
 * Helper function to send SSE events and flush immediately
 */
const sendSSE: SSESender = (reply: ProxyReply, event: SSEEventType, data: SSEEvent): void => {
  const sseMessage = `event: ${event}\n` +
    `data: ${JSON.stringify(data)}\n\n`;
  reply.raw.write(sseMessage);
  
  // Flush if the flush method is available
  if (typeof (reply.raw as any).flush === 'function') {
    (reply.raw as any).flush();
  }
};

/**
 * Map OpenAI finish reasons to Anthropic stop reasons
 */
const mapStopReason: StopReasonMapper = (finishReason: FinishReason): AnthropicStopReason => {
  switch (finishReason) {
    case 'tool_calls': return 'tool_use';
    case 'stop': return 'end_turn';
    case 'length': return 'max_tokens';
    default: return 'end_turn';
  }
};

/**
 * Helper to normalize a message's content
 * If content is a string, return it directly
 * If it's an array (of objects with text property), join them
 */
const normalizeContent: ContentNormalizer = (content: string | any[]): string | null => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item: any) => item.text || item.content || '')
      .filter(Boolean)
      .join(' ') || null;
  }
  return null;
};

/**
 * Helper function to recursively traverse JSON schema and remove format: 'uri'
 */
const removeUriFormat: SchemaProcessor = (schema: any): any => {
  if (!schema || typeof schema !== 'object') return schema;

  // If this is a string type with uri format, remove the format
  if (schema.type === 'string' && schema.format === 'uri') {
    const { format, ...rest } = schema;
    return rest;
  }

  // Handle array of schemas (like in anyOf, allOf, oneOf)
  if (Array.isArray(schema)) {
    return schema.map((item: any) => removeUriFormat(item));
  }

  // Recursively process all properties
  const result: any = {};
  for (const key in schema) {
    if (key === 'properties' && typeof schema[key] === 'object') {
      result[key] = {};
      for (const propKey in schema[key]) {
        result[key][propKey] = removeUriFormat(schema[key][propKey]);
      }
    } else if (key === 'items' && typeof schema[key] === 'object') {
      result[key] = removeUriFormat(schema[key]);
    } else if (key === 'additionalProperties' && typeof schema[key] === 'object') {
      result[key] = removeUriFormat(schema[key]);
    } else if (['anyOf', 'allOf', 'oneOf'].includes(key) && Array.isArray(schema[key])) {
      result[key] = schema[key].map((item: any) => removeUriFormat(item));
    } else {
      result[key] = removeUriFormat(schema[key]);
    }
  }
  return result;
};

// ==================== MAIN ROUTE HANDLER ====================

fastify.post<{ Body: AnthropicRequest }>('/v1/messages', async (request: ProxyRequest, reply: ProxyReply): Promise<AnthropicResponse | { error: string } | void> => {
  try {
    const payload: AnthropicRequest = request.body;

    // Build messages array for the OpenAI payload
    // Start with system messages if provided
    const messages: OpenAIMessage[] = [];
    
    if (payload.system && Array.isArray(payload.system)) {
      payload.system.forEach(sysMsg => {
        const normalized = normalizeContent((sysMsg.text || sysMsg.content) || '');
        if (normalized) {
          messages.push({
            role: 'system',
            content: normalized
          });
        }
      });
    }

    // Then add user (or other) messages
    if (payload.messages && Array.isArray(payload.messages)) {
      payload.messages.forEach((msg: AnthropicMessage) => {
        const toolCalls: OpenAIToolCall[] = (Array.isArray(msg.content) ? msg.content : [])
          .filter((item: any) => item.type === 'tool_use')
          .map((toolCall: any) => ({
            id: toolCall.id,
            function: {
              type: 'function',
              id: toolCall.id,
              function: {
                name: toolCall.name,
                parameters: toolCall.input,
              },
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.input),
            },
          }));

        const newMsg: OpenAIMessage = { role: msg.role };
        const normalized = normalizeContent(typeof msg.content === 'string' ? msg.content : '');
        if (normalized) newMsg.content = normalized;
        if (toolCalls.length > 0) newMsg.tool_calls = toolCalls;
        if (newMsg.content || newMsg.tool_calls) messages.push(newMsg);

        if (Array.isArray(msg.content)) {
          const toolResults = msg.content.filter((item: any) => item.type === 'tool_result');
          toolResults.forEach((toolResult: any) => {
            messages.push({
              role: 'tool',
              content: toolResult.text || toolResult.content,
              tool_call_id: toolResult.tool_use_id,
            });
          });
        }
      });
    }

    // Prepare the OpenAI payload
    const tools: OpenAITool[] = (payload.tools || [])
      .filter((tool: AnthropicTool) => !EXCLUDED_TOOLS.includes(tool.name))
      .map((tool: AnthropicTool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: removeUriFormat(tool.input_schema),
        },
      }));

    const openaiPayload: OpenAIRequest = {
      model: payload.thinking ? config.models.reasoning : config.models.completion,
      messages,
      ...(payload.max_tokens && { max_tokens: payload.max_tokens }),
      temperature: payload.temperature !== undefined ? payload.temperature : 1,
      stream: payload.stream === true,
    };

    if (tools.length > 0) openaiPayload.tools = tools;
    debug('OpenAI payload:', openaiPayload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (config.requiresApiKey && config.key) {
      headers['Authorization'] = `Bearer ${config.key}`;
    }

    const openaiResponse = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(openaiPayload)
    });

    if (!openaiResponse.ok) {
      const errorDetails = await openaiResponse.text();
      reply.code(openaiResponse.status);
      return { error: errorDetails };
    }

    // If stream is not enabled, process the complete response
    if (!openaiPayload.stream) {
      const data: OpenAIResponse = await openaiResponse.json();
      debug('OpenAI response:', data);
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const choice = data.choices[0];
      if (!choice) {
        throw new Error('No choices in OpenAI response');
      }
      const openaiMessage = choice.message;

      // Map finish_reason to anthropic stop_reason
      const stopReason = mapStopReason(choice.finish_reason);
      const toolCalls = openaiMessage.tool_calls || [];

      // Create a message id; if available, replace prefix, otherwise generate one
      const messageId = data.id
        ? data.id.replace('chatcmpl', 'msg')
        : 'msg_' + Math.random().toString(36).substring(2, 26);

      const anthropicResponse: AnthropicResponse = {
        content: [
          {
            text: openaiMessage.content || '',
            type: 'text'
          },
          ...toolCalls.map((toolCall: OpenAIToolCall) => ({
            type: 'tool_use' as const,
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments),
          })),
        ] as AnthropicContent[],
        id: messageId,
        model: openaiPayload.model,
        role: 'assistant',
        stop_reason: stopReason,
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: data.usage
            ? data.usage.prompt_tokens
            : messages.reduce((acc, msg) => acc + (msg.content?.split(' ').length || 0), 0),
          output_tokens: data.usage
            ? data.usage.completion_tokens
            : (openaiMessage.content?.split(' ').length || 0),
        }
      };

      return anthropicResponse;
    }

    // Handle streaming response
    let isSucceeded = false;
    
    const sendSuccessMessage = (): void => {
      if (isSucceeded) return;
      isSucceeded = true;

      // Streaming response using Server-Sent Events
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });

      // Create a unique message id
      const messageId = 'msg_' + Math.random().toString(36).substring(2, 26);

      // Send initial SSE event for message start
      sendSSE(reply, 'message_start', {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          model: openaiPayload.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 },
        }
      });

      // Send initial ping
      sendSSE(reply, 'ping', { type: 'ping' });
    };

    // Prepare for reading streamed data
    const streamingState: StreamingState = {
      accumulatedContent: '',
      accumulatedReasoning: '',
      usage: null,
      textBlockStarted: false,
      encounteredToolCall: false,
      toolCallAccumulators: {},
      messageId: 'msg_' + Math.random().toString(36).substring(2, 26)
    };

    const decoder = new TextDecoder('utf-8');
    const reader = openaiResponse.body?.getReader();
    
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      
      if (result.value) {
        const chunk = decoder.decode(result.value);
        debug('OpenAI response chunk:', chunk);
        
        // OpenAI streaming responses are typically sent as lines prefixed with "data: "
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '' || !trimmed.startsWith('data:')) continue;
          
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') {
            // Finalize the stream with stop events
            if (streamingState.encounteredToolCall) {
              for (const idx in streamingState.toolCallAccumulators) {
                sendSSE(reply, 'content_block_stop', {
                  type: 'content_block_stop',
                  index: parseInt(idx, 10)
                });
              }
            } else if (streamingState.textBlockStarted) {
              sendSSE(reply, 'content_block_stop', {
                type: 'content_block_stop',
                index: 0
              });
            }
            
            sendSSE(reply, 'message_delta', {
              type: 'message_delta',
              delta: {
                stop_reason: streamingState.encounteredToolCall ? 'tool_use' : 'end_turn',
                stop_sequence: null
              },
              usage: streamingState.usage
                ? { output_tokens: streamingState.usage.completion_tokens }
                : { output_tokens: streamingState.accumulatedContent.split(' ').length + streamingState.accumulatedReasoning.split(' ').length }
            });
            
            sendSSE(reply, 'message_stop', {
              type: 'message_stop'
            });
            
            reply.raw.end();
            return;
          }

          const parsed: OpenAIResponse = JSON.parse(dataStr);
          if (parsed.error) {
            throw new Error(parsed.error.message);
          }
          
          sendSuccessMessage();
          
          // Capture usage if available
          if (parsed.usage) {
            streamingState.usage = parsed.usage;
          }
          
          const delta = parsed.choices[0]?.delta;
          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              streamingState.encounteredToolCall = true;
              const idx = (toolCall as any).index || 0;
              
              if (streamingState.toolCallAccumulators[idx] === undefined) {
                streamingState.toolCallAccumulators[idx] = "";
                sendSSE(reply, 'content_block_start', {
                  type: 'content_block_start',
                  index: idx,
                  content_block: {
                    type: 'tool_use',
                    id: toolCall.id,
                    name: toolCall.function.name,
                    input: {}
                  }
                });
              }
              
              const newArgs = toolCall.function.arguments || "";
              const oldArgs = streamingState.toolCallAccumulators[idx];
              if (newArgs.length > oldArgs.length) {
                const deltaText = newArgs.substring(oldArgs.length);
                sendSSE(reply, 'content_block_delta', {
                  type: 'content_block_delta',
                  index: idx,
                  delta: {
                    type: 'input_json_delta',
                    partial_json: deltaText
                  }
                });
                streamingState.toolCallAccumulators[idx] = newArgs;
              }
            }
          } else if (delta?.content) {
            if (!streamingState.textBlockStarted) {
              streamingState.textBlockStarted = true;
              sendSSE(reply, 'content_block_start', {
                type: 'content_block_start',
                index: 0,
                content_block: {
                  type: 'text',
                  text: ''
                }
              });
            }
            
            streamingState.accumulatedContent += delta.content;
            sendSSE(reply, 'content_block_delta', {
              type: 'content_block_delta',
              index: 0,
              delta: {
                type: 'text_delta',
                text: delta.content
              }
            });
          } else if (delta?.reasoning) {
            if (!streamingState.textBlockStarted) {
              streamingState.textBlockStarted = true;
              sendSSE(reply, 'content_block_start', {
                type: 'content_block_start',
                index: 0,
                content_block: {
                  type: 'text',
                  text: ''
                }
              });
            }
            
            streamingState.accumulatedReasoning += delta.reasoning;
            sendSSE(reply, 'content_block_delta', {
              type: 'content_block_delta',
              index: 0,
              delta: {
                type: 'thinking_delta',
                thinking: delta.reasoning
              }
            });
          }
        }
      }
    }

    reply.raw.end();
  } catch (err: unknown) {
    const error = err as Error;
    console.error(error);
    reply.code(500);
    return { error: error.message };
  }
});

// ==================== SERVER STARTUP ====================

const start = async (): Promise<void> => {
  try {
    await fastify.listen({ port: serverPort });
    console.log(`🚀 cproxy server started on port ${serverPort}`);
    console.log(`📡 Proxying to: ${config.baseUrl}`);
    console.log(`🔑 API Key Required: ${config.requiresApiKey}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Start the server
start().catch((err: Error) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * MCP Proxy Server Type Definitions
 * Comprehensive type system for the Model Context Protocol proxy server
 */

import { z } from 'zod';

// ==================== MCP PROTOCOL TYPES ====================

export interface MCPMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MCPTool {
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface MCPCompletionRequest {
  id?: string;
  messages: MCPMessage[];
  model?: string;
  provider?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: MCPTool[];
  metadata?: Record<string, any>;
}

export interface MCPCompletionResponse {
  id: string;
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  toolCalls?: MCPToolCall[];
  metadata?: Record<string, any>;
}

export interface MCPToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface MCPStreamChunk {
  id: string;
  content?: string;
  delta?: string;
  finishReason?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

// ==================== PROVIDER CONFIGURATION TYPES ====================

export interface ProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  reasoning: boolean;
  multimodal: boolean;
  maxTokens: number;
  contextWindow: number;
}

export interface ProviderRateLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
}

export interface ProviderHealthCheck {
  endpoint: string;
  interval: number;
  timeout: number;
  retries: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openrouter' | 'anthropic' | 'openai' | 'local';
  baseUrl: string;
  apiKey?: string;
  models: string[];
  capabilities: ProviderCapabilities;
  rateLimits: ProviderRateLimits;
  priority: number;
  weight: number;
  healthCheck: ProviderHealthCheck;
  headers?: Record<string, string>;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enabled: boolean;
}

// ==================== ROUTING CONFIGURATION TYPES ====================

export interface RoutingRule {
  id: string;
  name: string;
  condition: {
    model?: string | string[];
    provider?: string | string[];
    capabilities?: (keyof ProviderCapabilities)[];
    metadata?: Record<string, any>;
  };
  target: {
    providerId: string;
    weight?: number;
    fallback?: string[];
  };
  enabled: boolean;
}

export interface LoadBalancingConfig {
  strategy: 'round-robin' | 'weighted' | 'least-connections' | 'response-time' | 'random';
  healthCheck: boolean;
  failover: boolean;
  maxRetries: number;
  retryDelay: number;
}

export interface RoutingConfig {
  defaultProvider: string;
  fallbackProvider: string;
  loadBalancing: LoadBalancingConfig;
  rules: RoutingRule[];
  modelMapping: Record<string, string>;
}

// ==================== PROXY CONFIGURATION TYPES ====================

export interface ServerConfig {
  name: string;
  version: string;
  description: string;
  debug: boolean;
  port?: number;
  host?: string;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  keyPrefix: string;
  storage: 'memory' | 'redis';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  requests: boolean;
  responses: boolean;
  performance: boolean;
  errors: boolean;
  file?: {
    enabled: boolean;
    path: string;
    maxSize: string;
    maxFiles: number;
  };
}

export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    skipSuccessfulRequests: boolean;
  };
  apiKeyValidation: {
    enabled: boolean;
    required: boolean;
  };
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: string[];
  };
}

export interface ProxyConfiguration {
  server: ServerConfig;
  providers: ProviderConfig[];
  routing: RoutingConfig;
  cache: CacheConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
  };
}

// ==================== REQUEST/RESPONSE TYPES ====================

export interface ProxyRequest extends MCPCompletionRequest {
  requestId: string;
  timestamp: number;
  clientInfo?: {
    userAgent?: string;
    ip?: string;
    source?: string;
  };
}

export interface ProxyResponse extends MCPCompletionResponse {
  requestId: string;
  timestamp: number;
  duration: number;
  provider: string;
  cached?: boolean;
  retryCount?: number;
}

export interface ProviderRequest {
  model: string;
  messages: any[];
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  tools?: any[];
  [key: string]: any;
}

export interface ProviderResponse {
  id: string;
  content?: string;
  choices?: any[];
  usage?: any;
  error?: {
    type: string;
    message: string;
    code?: string | number;
  };
  [key: string]: any;
}

// ==================== PROVIDER INTERFACE TYPES ====================

export interface ProviderHealthStatus {
  providerId: string;
  healthy: boolean;
  lastCheck: number;
  responseTime: number;
  errorCount: number;
  errorRate: number;
  availability: number;
}

export interface ProviderMetrics {
  providerId: string;
  requests: {
    total: number;
    successful: number;
    failed: number;
    cached: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  usage: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  };
  errors: {
    total: number;
    rate: number;
    lastError?: string;
  };
}

export abstract class BaseProvider {
  constructor(protected config: ProviderConfig) { }

  abstract healthCheck(): Promise<boolean>;
  abstract completion(request: ProviderRequest): Promise<ProviderResponse>;
  abstract streamCompletion(request: ProviderRequest): Promise<AsyncIterable<any>>;
  abstract transformRequest(request: MCPCompletionRequest): ProviderRequest;
  abstract transformResponse(response: ProviderResponse): MCPCompletionResponse;

  getId(): string {
    return this.config.id;
  }

  getName(): string {
    return this.config.name;
  }

  getModels(): string[] {
    return this.config.models;
  }

  getCapabilities(): ProviderCapabilities {
    return this.config.capabilities;
  }

  supportsModel(model: string): boolean {
    return this.config.models.includes(model) ||
      this.config.models.some(m => m.endsWith('*') && model.startsWith(m.slice(0, -1)));
  }

  supportsCapability(capability: keyof ProviderCapabilities): boolean {
    return this.config.capabilities[capability] === true;
  }
}

// ==================== ERROR TYPES ====================

export class ProxyError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public provider?: string,
    public requestId?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProxyError';
  }
}

export class ProviderError extends ProxyError {
  constructor(
    message: string,
    public override provider: string,
    public originalError?: any,
    statusCode: number = 500,
    retryable: boolean = true
  ) {
    super(message, 'PROVIDER_ERROR', statusCode, provider, undefined, retryable);
    this.name = 'ProviderError';
  }
}

export class ConfigurationError extends ProxyError {
  constructor(message: string, public configSection?: string) {
    super(message, 'CONFIGURATION_ERROR', 500, undefined, undefined, false);
    this.name = 'ConfigurationError';
  }
}

export class ValidationError extends ProxyError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400, undefined, undefined, false);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends ProxyError {
  constructor(message: string, provider?: string, public retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429, provider, undefined, true);
    this.name = 'RateLimitError';
  }
}

// ==================== ZOD SCHEMAS ====================

export const MCPMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string()
});

export const MCPToolSchema = z.object({
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.any())
  })
});

export const MCPCompletionRequestSchema = z.object({
  id: z.string().optional(),
  messages: z.array(MCPMessageSchema),
  model: z.string().optional(),
  provider: z.string().optional(),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
  tools: z.array(MCPToolSchema).optional(),
  metadata: z.record(z.any()).optional()
});

export const ProviderCapabilitiesSchema = z.object({
  streaming: z.boolean(),
  tools: z.boolean(),
  reasoning: z.boolean(),
  multimodal: z.boolean(),
  maxTokens: z.number().positive(),
  contextWindow: z.number().positive()
});

export const ProviderConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['openrouter', 'anthropic', 'openai', 'local']),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  models: z.array(z.string()).min(1),
  capabilities: ProviderCapabilitiesSchema,
  rateLimits: z.object({
    requestsPerMinute: z.number().positive(),
    tokensPerMinute: z.number().positive(),
    requestsPerDay: z.number().positive().optional(),
    tokensPerDay: z.number().positive().optional()
  }),
  priority: z.number().int().min(1).max(10),
  weight: z.number().positive(),
  healthCheck: z.object({
    endpoint: z.string(),
    interval: z.number().positive(),
    timeout: z.number().positive(),
    retries: z.number().int().min(0)
  }),
  headers: z.record(z.string()).optional(),
  timeout: z.number().positive(),
  retryAttempts: z.number().int().min(0),
  retryDelay: z.number().positive(),
  enabled: z.boolean()
});

export const ProxyConfigurationSchema = z.object({
  server: z.object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    debug: z.boolean(),
    port: z.number().int().positive().optional(),
    host: z.string().optional()
  }),
  providers: z.array(ProviderConfigSchema).min(1),
  routing: z.object({
    defaultProvider: z.string(),
    fallbackProvider: z.string(),
    loadBalancing: z.object({
      strategy: z.enum(['round-robin', 'weighted', 'least-connections', 'response-time', 'random']),
      healthCheck: z.boolean(),
      failover: z.boolean(),
      maxRetries: z.number().int().min(0),
      retryDelay: z.number().positive()
    }),
    rules: z.array(z.object({
      id: z.string(),
      name: z.string(),
      condition: z.object({
        model: z.union([z.string(), z.array(z.string())]).optional(),
        provider: z.union([z.string(), z.array(z.string())]).optional(),
        capabilities: z.array(z.string()).optional(),
        metadata: z.record(z.any()).optional()
      }),
      target: z.object({
        providerId: z.string(),
        weight: z.number().positive().optional(),
        fallback: z.array(z.string()).optional()
      }),
      enabled: z.boolean()
    })),
    modelMapping: z.record(z.string())
  }),
  cache: z.object({
    enabled: z.boolean(),
    ttl: z.number().positive(),
    maxSize: z.number().positive(),
    keyPrefix: z.string(),
    storage: z.enum(['memory', 'redis']),
    redis: z.object({
      host: z.string(),
      port: z.number().int().positive(),
      password: z.string().optional(),
      db: z.number().int().min(0)
    }).optional()
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    format: z.enum(['json', 'text']),
    requests: z.boolean(),
    responses: z.boolean(),
    performance: z.boolean(),
    errors: z.boolean(),
    file: z.object({
      enabled: z.boolean(),
      path: z.string(),
      maxSize: z.string(),
      maxFiles: z.number().int().positive()
    }).optional()
  }),
  security: z.object({
    rateLimiting: z.object({
      enabled: z.boolean(),
      requestsPerMinute: z.number().positive(),
      skipSuccessfulRequests: z.boolean()
    }),
    apiKeyValidation: z.object({
      enabled: z.boolean(),
      required: z.boolean()
    }),
    cors: z.object({
      enabled: z.boolean(),
      origins: z.array(z.string()),
      methods: z.array(z.string()),
      headers: z.array(z.string())
    })
  }),
  monitoring: z.object({
    enabled: z.boolean(),
    metricsInterval: z.number().positive(),
    healthCheckInterval: z.number().positive()
  })
});

// ==================== UTILITY TYPES ====================

export type ProviderType = ProviderConfig['type'];
export type LoadBalancingStrategy = LoadBalancingConfig['strategy'];
export type LogLevel = LoggingConfig['level'];
export type CacheStorage = CacheConfig['storage'];

export interface RequestContext {
  requestId: string;
  startTime: number;
  provider?: ProviderConfig;
  attempt: number;
  metadata: Record<string, any>;
}

export interface StreamContext extends RequestContext {
  stream: NodeJS.ReadableStream;
  controller?: AbortController;
}

// ==================== EVENT TYPES ====================

export interface ProxyEvent {
  type: string;
  timestamp: number;
  requestId: string;
  data: any;
}

export interface RequestStartEvent extends ProxyEvent {
  type: 'request_start';
  data: {
    request: ProxyRequest;
    provider: string;
  };
}

export interface RequestCompleteEvent extends ProxyEvent {
  type: 'request_complete';
  data: {
    response: ProxyResponse;
    duration: number;
  };
}

export interface RequestErrorEvent extends ProxyEvent {
  type: 'request_error';
  data: {
    error: ProxyError;
    provider?: string;
    retryCount: number;
  };
}

export interface ProviderHealthEvent extends ProxyEvent {
  type: 'provider_health';
  data: {
    providerId: string;
    healthy: boolean;
    responseTime: number;
  };
}

export type ProxyEventType =
  | RequestStartEvent
  | RequestCompleteEvent
  | RequestErrorEvent
  | ProviderHealthEvent;

// ==================== EXPORT ALL TYPES ====================

export * from './mcp-proxy';
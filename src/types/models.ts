/**
 * Model Provider Configuration Types
 *
 * These types match the Rust backend model_config.rs structures
 */

export type ProviderType = 'default' | 'anthropic' | 'bedrock' | 'bigmodel' | 'minimax' | 'moonshot' | 'ollama' | 'custom';

/**
 * Main model configuration structure
 */
export interface ModelProviderConfig {
  activeProvider: string;
  providers: Providers;
  customProviders: CustomProvider[];
}

/**
 * Built-in providers
 */
export interface Providers {
  default: DefaultProvider;
  anthropic: AnthropicProvider;
  bedrock: BedrockProvider;
  bigmodel: BigModelProvider;
  minimax: MiniMaxProvider;
  moonshot: MoonshotProvider;
  ollama: OllamaProvider;
}

/**
 * Default provider - no additional environment variables
 */
export interface DefaultProvider {
  type: 'default';
  enabled: boolean;
}

/**
 * Anthropic provider configuration
 */
export interface AnthropicProvider {
  type: 'anthropic';
  enabled: boolean;
  model: string;
  opusModel: string;
  sonnetModel: string;
  haikuModel: string;
  subagentModel: string;
  apiKey: string;
  authToken: string;
  baseUrl: string;
}

/**
 * Amazon Bedrock provider configuration
 */
export interface BedrockProvider {
  type: 'bedrock';
  enabled: boolean;
  bearerToken: string;
  region: string;
  model: string;
  opusModel: string;
  sonnetModel: string;
  haikuModel: string;
}

/**
 * BigModel (Zhipu) provider configuration
 */
export interface BigModelProvider {
  type: 'bigmodel';
  enabled: boolean;
  authToken: string;
}

/**
 * MiniMax provider configuration
 */
export interface MiniMaxProvider {
  type: 'minimax';
  enabled: boolean;
  authToken: string;
  model: string;
}

/**
 * Moonshot AI (Kimi) provider configuration
 */
export interface MoonshotProvider {
  type: 'moonshot';
  enabled: boolean;
  authToken: string;
  model: string;
}

/**
 * Ollama provider configuration (local LLM server)
 */
export interface OllamaProvider {
  type: 'ollama';
  enabled: boolean;
  apiKey: string;
  model: string;
  baseUrl: string;
}

/**
 * Custom provider configuration
 */
export interface CustomProvider {
  id: string;
  name: string;
  model: string;
  opusModel: string;
  sonnetModel: string;
  haikuModel: string;
  subagentModel: string;
  apiKey: string;
  authToken: string;
  baseUrl: string;
}

/**
 * Available model options for Anthropic-compatible providers
 */
export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
] as const;

/**
 * Available model options for Bedrock
 */
export const BEDROCK_MODELS = [
  { id: 'global.anthropic.claude-opus-4-5-20251101-v1:0', name: 'Claude Opus 4.5' },
  { id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5' },
  { id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5' },
] as const;

/**
 * AWS Regions commonly used with Bedrock
 */
export const AWS_REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia)' },
  { id: 'us-east-2', name: 'US East (Ohio)' },
  { id: 'us-west-2', name: 'US West (Oregon)' },
  { id: 'eu-west-1', name: 'EU (Ireland)' },
  { id: 'eu-west-3', name: 'EU (Paris)' },
  { id: 'eu-central-1', name: 'EU (Frankfurt)' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
  { id: 'ap-southeast-2', name: 'Asia Pacific (Sydney)' },
] as const;

/**
 * Available model options for MiniMax
 */
export const MINIMAX_MODELS = [
  { id: 'MiniMax-M2.1', name: 'MiniMax M2.1' },
] as const;

/**
 * Available model options for Moonshot AI (Kimi)
 */
export const MOONSHOT_MODELS = [
  { id: 'kimi-k2-thinking-turbo', name: 'Kimi K2 Thinking Turbo' },
  { id: 'kimi-k2-0711-preview', name: 'Kimi K2 Preview' },
  { id: 'moonshot-v1-auto', name: 'Moonshot V1 Auto' },
] as const;

/**
 * Provider display names
 */
export const PROVIDER_NAMES: Record<string, string> = {
  default: 'Default',
  anthropic: 'Anthropic',
  bedrock: 'Amazon Bedrock',
  bigmodel: 'BigModel / Zhipu',
  minimax: 'MiniMax',
  moonshot: 'Moonshot AI / Kimi',
  ollama: 'Ollama',
};

/**
 * Create a default model config
 */
export function createDefaultModelConfig(): ModelProviderConfig {
  return {
    activeProvider: 'default',
    providers: {
      default: {
        type: 'default',
        enabled: true,
      },
      anthropic: {
        type: 'anthropic',
        enabled: true,
        model: 'claude-sonnet-4-5',
        opusModel: 'claude-opus-4-5',
        sonnetModel: 'claude-sonnet-4-5',
        haikuModel: 'claude-haiku-4-5',
        subagentModel: 'claude-sonnet-4-5',
        apiKey: '',
        authToken: '',
        baseUrl: '',
      },
      bedrock: {
        type: 'bedrock',
        enabled: true,
        bearerToken: '',
        region: 'us-east-1',
        model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
        opusModel: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
        sonnetModel: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
        haikuModel: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
      },
      bigmodel: {
        type: 'bigmodel',
        enabled: true,
        authToken: '',
      },
      minimax: {
        type: 'minimax',
        enabled: true,
        authToken: '',
        model: 'MiniMax-M2.1',
      },
      moonshot: {
        type: 'moonshot',
        enabled: true,
        authToken: '',
        model: 'kimi-k2-thinking-turbo',
      },
      ollama: {
        type: 'ollama',
        enabled: true,
        apiKey: '',
        model: '',
        baseUrl: 'http://localhost:11434',
      },
    },
    customProviders: [],
  };
}

/**
 * Create a new custom provider with default values
 */
export function createCustomProvider(id: string, name: string): CustomProvider {
  return {
    id,
    name,
    model: '',
    opusModel: '',
    sonnetModel: '',
    haikuModel: '',
    subagentModel: '',
    apiKey: '',
    authToken: '',
    baseUrl: '',
  };
}

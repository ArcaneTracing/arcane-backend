export enum ModelProvider {
  OPENAI = "OPENAI",
  AZURE_OPENAI = "AZURE_OPENAI",
  ANTHROPIC = "ANTHROPIC",
  GOOGLE = "GOOGLE",
  DEEPSEEK = "DEEPSEEK",
  XAI = "XAI",
  OLLAMA = "OLLAMA",
  AWS = "AWS",
}

export enum TemplateType {
  CHAT = "CHAT",
  STR = "STR",
}

export enum TemplateFormat {
  MUSTACHE = "MUSTACHE",
  F_STRING = "F_STRING",
  NONE = "NONE",
}

export interface PromptStringTemplate {
  type: "string";
  template: string;
}

export interface PromptChatTemplate {
  type: "chat";
  messages: PromptMessage[];
}

export type PromptTemplate = PromptStringTemplate | PromptChatTemplate;

export interface PromptMessage {
  role: "user" | "assistant" | "model" | "ai" | "tool" | "system" | "developer";
  content: string | ContentPart[];
}

export interface TextContentPart {
  text: string;
}

export interface ToolCallContentPart {
  toolCall: {
    toolCallId: string;
    toolCall: {
      name: string;
      arguments: Record<string, unknown>;
    };
  };
}

export interface ToolResultContentPart {
  toolResult: {
    toolCallId: string;
    result: unknown;
  };
}

export type ContentPart =
  | TextContentPart
  | ToolCallContentPart
  | ToolResultContentPart;

export interface OpenAIInvocationParameters {
  type: "openai";
  openai: {
    temperature?: number;
    max_tokens?: number;
    max_completion_tokens?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    top_p?: number;
    seed?: number;
    reasoning_effort?: "minimal" | "low" | "medium" | "high";
  };
}

export interface AzureOpenAIInvocationParameters {
  type: "azure_openai";
  azure_openai: Record<string, unknown>;
}

export interface AnthropicInvocationParameters {
  type: "anthropic";
  anthropic: Record<string, unknown>;
}

export interface GoogleInvocationParameters {
  type: "google";
  google: Record<string, unknown>;
}

export interface DeepSeekInvocationParameters {
  type: "deepseek";
  deepseek: Record<string, unknown>;
}

export interface XAIInvocationParameters {
  type: "xai";
  xai: Record<string, unknown>;
}

export interface OllamaInvocationParameters {
  type: "ollama";
  ollama: Record<string, unknown>;
}

export interface AwsInvocationParameters {
  type: "aws";
  aws: Record<string, unknown>;
}

export type InvocationParameters =
  | OpenAIInvocationParameters
  | AzureOpenAIInvocationParameters
  | AnthropicInvocationParameters
  | GoogleInvocationParameters
  | DeepSeekInvocationParameters
  | XAIInvocationParameters
  | OllamaInvocationParameters
  | AwsInvocationParameters;

export type Tools = Record<string, unknown>[];

export type ResponseFormat = Record<string, unknown>;

import type { ModelDefinition } from "@togetherlink/models";

export type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string; signature?: string }
  | { type: "redacted_thinking"; data: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "server_tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content?: unknown; is_error?: boolean }
  | { type: "tool_reference"; tool_name: string }
  | { type: "web_search_tool_result"; tool_use_id?: string; content?: unknown; error_code?: string }
  | {
      type: "web_search_tool_result_error";
      tool_use_id?: string;
      content?: unknown;
      error_code?: string;
    }
  | { type: "image"; source: { type: string; media_type?: string; data?: string; url?: string } }
  | { type: "url"; url: string };

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

export type AnthropicMessagesRequest = {
  model?: string;
  max_tokens?: number;
  stop_sequences?: string[];
  temperature?: number;
  stream?: boolean;
  system?: string | AnthropicContentBlock[];
  messages?: AnthropicMessage[];
  tools?: AnthropicTool[];
  tool_choice?: unknown;
  thinking?: { type?: string; budget_tokens?: number; effort?: unknown };
  effort?: unknown;
  reasoning_effort?: unknown;
};

export type AnthropicCountTokensRequest = Pick<
  AnthropicMessagesRequest,
  "model" | "system" | "messages" | "tools" | "tool_choice"
>;

export type AnthropicTool = {
  name?: string;
  description?: string;
  input_schema?: unknown;
  type?: string;
  [key: string]: unknown;
};

export type NativeServerTool = {
  kind: "web_search";
  name: string;
  definition: AnthropicTool;
};

export type OpenAITool = {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
};

export type OpenAIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  reasoning?: string;
  reasoning_content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type ClaudeNativeWebSearchRecord = {
  id: string;
  name: "web_search";
  input: unknown;
  result:
    | Array<{ type: "web_search_result"; title: string; url: string }>
    | { type: "web_search_tool_result_error"; error_code: string };
};

export type OpenAIChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
    reasoning_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  };
  _togetherlinkNativeWebSearches?: ClaudeNativeWebSearchRecord[];
};

export type ResolvedClaudeModel = {
  alias: string;
  definition: ModelDefinition;
};

export type TogetherApiError = {
  status: number;
  anthropicStatus: number;
  anthropicType: string;
  message: string;
  code?: string | undefined;
  retryAfterMs?: number | undefined;
  retryable: boolean;
};

export type TogetherFetchResult =
  | { ok: true; json: OpenAIChatResponse; error?: undefined }
  | { ok: false; error: TogetherApiError; json?: undefined };

export type StreamProxyResult =
  | { ok: true; status?: number }
  | { ok: false; status: number; error: string };

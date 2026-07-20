import type { ModelDefinition } from "@togetherlink/models";

export type ResponsesContentPart = {
  type?: string;
  text?: string;
  image_url?: string;
  detail?: string;
};

export type ResponsesInputItem = {
  type?: string;
  role?: string;
  content?: string | ResponsesContentPart[];
  call_id?: string;
  name?: string;
  namespace?: string;
  arguments?: unknown;
  input?: string;
  output?: unknown;
  status?: string;
  execution?: string;
  tools?: ResponsesTool[];
};

export type ResponsesTool = {
  type?: string;
  name?: string;
  description?: string;
  parameters?: unknown;
  execution?: string;
  defer_loading?: boolean;
  strict?: boolean;
  format?: { type?: string; syntax?: string; definition?: string };
  tools?: ResponsesTool[];
};

export type ResponsesRequest = {
  model?: string;
  instructions?: string;
  input?: string | ResponsesInputItem[];
  tools?: ResponsesTool[];
  tool_choice?: unknown;
  temperature?: number;
  max_output_tokens?: number;
  stream?: boolean;
  reasoning?: { effort?: string | null } | null;
  text?: ResponsesTextConfig;
};

export type ResponsesTextConfig = {
  format?: {
    type?: string;
    name?: string;
    schema?: unknown;
    strict?: boolean;
  };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | ChatContentPart[] | null;
  reasoning_content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } };

export type ChatResponse = {
  id?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
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
    completion_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
};

export type ChatStreamChunk = {
  id?: string;
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: ChatResponse["usage"];
};

export type PendingToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type CodexToolMapping =
  | { kind: "function"; sourceName: string; modelName: string; namespace?: string }
  | { kind: "custom"; sourceName: string; modelName: string }
  | { kind: "tool_search"; sourceName: string; modelName: string; execution: string }
  | { kind: "namespace"; sourceName: string; modelName: string; namespace: string }
  | { kind: "web_search"; sourceName: string; modelName: string; definition: ResponsesTool };

export type CodexToolTranslation = {
  tools: Array<{
    type: "function";
    function: { name: string; description: string; parameters: unknown };
  }>;
  mappings: Map<string, CodexToolMapping>;
  nativeTools: CodexToolMapping[];
};

export type TogetherChatResult =
  | { ok: true; response: Response; error?: undefined }
  | { ok: false; status: number; text: string; error?: undefined };

export type StreamProxyResult =
  | { ok: true; status?: number }
  | { ok: false; status: number; error: string };

export type StreamOutputState = {
  nextOutputIndex: number;
  reasoningItemId?: string;
  reasoningOutputIndex?: number;
  reasoningText: string;
  textItemId?: string;
  textOutputIndex?: number;
  text: string;
};

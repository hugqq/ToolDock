export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type HttpBodyMode = "none" | "json" | "form" | "text";

export interface HttpKeyValue {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
}

export interface HttpDebugRequest {
  method: HttpMethod;
  url: string;
  query: HttpKeyValue[];
  headers: HttpKeyValue[];
  bodyMode: HttpBodyMode;
  bodyText: string;
  formFields: HttpKeyValue[];
  timeoutMs: number;
}

export interface HttpDebugResponse {
  status: number;
  reason: string;
  headers: Array<{ key: string; value: string }>;
  bodyText: string | null;
  contentType: string | null;
  sizeBytes: number;
  durationMs: number;
  truncated: boolean;
  binary: boolean;
}

export interface SendHttpResult {
  response: HttpDebugResponse;
  historySaved: boolean;
}

export interface HttpHistoryEntry {
  id: string;
  request: HttpDebugRequest;
  responseStatus: number;
  durationMs: number;
  createdAt: number;
}

export interface HttpDraftErrors {
  url?: "required" | "invalid_url" | "unsupported_scheme";
  body?: "invalid_json" | "incompatible_content_type";
  timeout?: "out_of_range";
}

export interface FormattedResponseBody {
  text: string;
  jsonFormatted: boolean;
  parseWarning: boolean;
}

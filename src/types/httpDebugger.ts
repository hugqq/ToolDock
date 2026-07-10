export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type HttpBodyMode = "none" | "json" | "form" | "multipart" | "text";
export type HttpMultipartFieldKind = "text" | "file";

export interface HttpKeyValue {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
}

export interface HttpMultipartField {
  id: string;
  enabled: boolean;
  key: string;
  kind: HttpMultipartFieldKind;
  value: string;
  filePath: string;
  fileName: string;
}

export interface HttpDebugRequest {
  method: HttpMethod;
  url: string;
  query: HttpKeyValue[];
  headers: HttpKeyValue[];
  bodyMode: HttpBodyMode;
  bodyText: string;
  formFields: HttpKeyValue[];
  multipartFields: HttpMultipartField[];
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

export interface HttpDraftErrors {
  url?: "required" | "invalid_url" | "unsupported_scheme";
  body?: "invalid_json" | "incompatible_content_type" | "multipart_content_type_managed";
  multipart?: Record<string, "field_required" | "file_required">;
  timeout?: "out_of_range";
}

export interface FormattedResponseBody {
  text: string;
  jsonFormatted: boolean;
  parseWarning: boolean;
}

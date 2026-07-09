import type {
  FormattedResponseBody,
  HttpBodyMode,
  HttpDebugRequest,
  HttpDraftErrors,
  HttpKeyValue,
} from "../types/httpDebugger.ts";

type HttpDraft = Pick<
  HttpDebugRequest,
  "url" | "bodyMode" | "bodyText" | "timeoutMs"
> & {
  headers?: HttpKeyValue[];
};

export function activePairs(
  rows: HttpKeyValue[],
): Array<{ key: string; value: string }> {
  return rows.flatMap(({ enabled, key, value }) => {
    const trimmedKey = key.trim();

    return enabled && trimmedKey ? [{ key: trimmedKey, value }] : [];
  });
}

export function buildRequestUrl(
  baseUrl: string,
  query: HttpKeyValue[],
): string {
  const url = new URL(baseUrl);

  for (const { key, value } of activePairs(query)) {
    url.searchParams.append(key, value);
  }

  return url.toString();
}

function mimeTypeOf(contentType: string): string {
  return contentType.split(";", 1)[0].trim().toLowerCase();
}

function isJsonMimeType(mimeType: string): boolean {
  return (
    mimeType === "application/json" ||
    /^[^/\s]+\/[^/\s]+\+json$/.test(mimeType)
  );
}

function acceptsContentType(
  bodyMode: HttpBodyMode,
  contentType: string,
): boolean {
  const mimeType = mimeTypeOf(contentType);

  switch (bodyMode) {
    case "json":
      return isJsonMimeType(mimeType);
    case "form":
      return mimeType === "application/x-www-form-urlencoded";
    case "text":
      return /^text\/[^/\s]+$/.test(mimeType);
    case "none":
      return true;
  }

  const exhaustiveBodyMode: never = bodyMode;
  return exhaustiveBodyMode;
}

export function validateHttpDraft(draft: HttpDraft): HttpDraftErrors {
  const errors: HttpDraftErrors = {};

  if (!draft.url.trim()) {
    errors.url = "required";
  } else {
    try {
      const url = new URL(draft.url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.url = "unsupported_scheme";
      }
    } catch {
      errors.url = "invalid_url";
    }
  }

  if (
    !Number.isFinite(draft.timeoutMs) ||
    draft.timeoutMs < 1000 ||
    draft.timeoutMs > 120000
  ) {
    errors.timeout = "out_of_range";
  }

  if (draft.bodyMode === "json") {
    try {
      JSON.parse(draft.bodyText);
    } catch {
      errors.body = "invalid_json";
    }
  }

  const contentType = activePairs(draft.headers ?? []).find(
    ({ key }) => key.toLowerCase() === "content-type",
  )?.value;

  if (
    !errors.body &&
    contentType !== undefined &&
    !acceptsContentType(draft.bodyMode, contentType)
  ) {
    errors.body = "incompatible_content_type";
  }

  return errors;
}

export function formatResponseBody(
  bodyText: string,
  contentType: string | null,
): FormattedResponseBody {
  const mimeType = contentType ? mimeTypeOf(contentType) : "";

  if (!isJsonMimeType(mimeType)) {
    return { text: bodyText, jsonFormatted: false, parseWarning: false };
  }

  try {
    const formattedText = JSON.stringify(JSON.parse(bodyText), null, 2)!;

    return {
      text: formattedText,
      jsonFormatted: true,
      parseWarning: false,
    };
  } catch {
    return { text: bodyText, jsonFormatted: false, parseWarning: true };
  }
}

export type CurlPlatform = "windows" | "macos";

function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quotePosix(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function generateCurl(
  request: HttpDebugRequest,
  platform: CurlPlatform,
): string {
  const quote = platform === "windows" ? quotePowerShell : quotePosix;
  const executable = platform === "windows" ? "curl.exe" : "curl";
  const url = buildRequestUrl(request.url, request.query);
  const parts = [
    executable,
    "--request",
    quote(request.method),
    quote(url),
    "--max-time",
    String(Math.ceil(request.timeoutMs / 1000)),
  ];

  for (const { key, value } of activePairs(request.headers)) {
    parts.push("--header", quote(`${key}: ${value}`));
  }

  if (request.bodyMode === "json" || request.bodyMode === "text") {
    parts.push("--data-raw", quote(request.bodyText));
  } else if (request.bodyMode === "form") {
    for (const { key, value } of activePairs(request.formFields)) {
      parts.push("--data-urlencode", quote(`${key}=${value}`));
    }
  }

  return parts.join(" ");
}

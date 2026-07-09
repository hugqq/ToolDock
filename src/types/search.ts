export type SearchResultKind = "file" | "directory";

export interface FileSearchResult {
  kind: SearchResultKind;
  name: string;
  path: string;
  modifiedAt?: number;
  size?: number;
}

export interface FileSearchResponse {
  provider: "everything" | "spotlight" | "unsupported";
  available: boolean;
  results: FileSearchResult[];
  errorCode?: "provider_unavailable" | "query_failed" | "unsupported_platform";
}

export interface ToolSearchCandidate {
  id: string;
  route: string;
  name: string;
  description: string;
}

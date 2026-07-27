export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
}

export interface SearchOptions {
  limit?: number;
  country?: string;
  language?: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

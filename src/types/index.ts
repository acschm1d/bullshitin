export interface Post {
  id: string;
  url: string;
  language: string;
  votes: number;
  timestamp: string;
  title?: string;
  author?: string;
  company?: string;
  score?: number;
}

export interface EnrichedPostPayload {
  url: string;
  language: string;
  title?: string;
  author?: string;
}

export interface NewPostPayload {
  url: string;
  title?: string;
  author?: string;
}

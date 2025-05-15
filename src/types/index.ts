export interface EnrichedPostPayload {
  id: string;
  created_at: string;
  url: string;
  title?: string;
  content?: string | null;
  upvotes: number;
  language: string;
}

export interface NewPostPayload {
  url: string;
  title?: string;
  content?: string;
}

export type Post = EnrichedPostPayload;

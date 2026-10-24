export type ChatMode = 'coding' | 'report' | 'daily';
export type ResponseMode = 'fast' | 'normal' | 'think';

export interface ChatSource {
  kind: string;
  source: string;
  status: 'ok' | 'error';
  title: string;
  url?: string;
  id?: string;
  accessedAt?: string;
  excerpt?: string;
  coverage?: 'search_snippet' | 'page_read' | 'local_document' | 'deterministic';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'model';
  content: string;
  timestamp: Date;
  status?: "complete" | "streaming" | "error" | "cancelled";
  modelId?: string;
  responseMode?: ResponseMode;
  sources?: ChatSource[];
  attachment?: {
    type: 'image' | 'file';
    content: string;
    mimeType: string;
    fileName: string;
    extractedText?: string;
  };
}

export interface ChatModeConfig {
  id: ChatMode;
  title: string;
  description: string;
  icon: string;
  systemInstruction: string;
  color: string;
}

export interface ChatRequest {
  messages: Message[];
  mode: ChatMode;
  responseMode?: ResponseMode;
  /** Legacy input, accepted but ignored. Only the server selects models. */
  model?: string;
  frontierAccessToken?: string;
}

export interface ChatResponse {
  response: string;
  error?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary?: string | null;
  imageUrl?: string | null;
  published: boolean;
  createdAt: Date;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  location?: string | null;
  startDate: Date;
  endDate?: Date | null;
  imageUrl?: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  position: string;
  bio?: string | null;
  photoUrl?: string | null;
  order: number;
  socials?: string | null;
}

export type ChatMode = 'coding' | 'report' | 'daily';

export interface ChatSource {
  kind: string;
  source: string;
  status: 'ok' | 'error';
  title: string;
  url?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'model';
  content: string;
  timestamp: Date;
  status?: "complete" | "streaming" | "error" | "cancelled";
  modelId?: string;
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

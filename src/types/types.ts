export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  images?: string[];  // Base64 encoded images
}

export interface ChatSession {
  messages: ChatMessage[];
  created: number;
}

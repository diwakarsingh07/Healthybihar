export type TriageLevel = 'Emergency' | 'Urgent' | 'General' | null;

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  triageLevel?: TriageLevel;
  feedback?: 'helpful' | 'not_helpful' | null;
}

export interface TriageRecord {
  id: string;
  userId: string;
  timestamp: Date;
  symptom: string;
  triageLevel: TriageLevel;
  explanation: string;
  feedback: 'helpful' | 'not_helpful' | null;
}

export interface WhatsAppMessage {
  id: string;
  text: string;
  sender: 'user' | 'doctor';
  time: string;
}

export interface TelemedRequest {
  id: string;
  patientId: string;
  patientName: string;
  problem: string;
  meetingId: string;
  status: 'waiting' | 'in-progress' | 'completed' | 'rejected';
  createdAt: Date;
  doctorId?: string;
  scheduledJoinTime?: Date;
}

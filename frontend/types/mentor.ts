export type MentorId = "mira" | "arjun" | "tara" | "kiran";

export interface MentorVoiceConfig {
  ttsEngine: string;
  voiceModel: string;
  fallbackVoice: string;
  language: string;
  speakingRate: number;
  traits: string;
  isSupported?: boolean;
}

export interface MentorAvatarConfig {
  avatarType: "animated_mascot" | "human_avatar";
  hasRig: boolean;
  hasVisemes: boolean;
  supportsMultiExpression: boolean;
}

export interface MentorProfile {
  id: MentorId;
  name: string;
  title: string;
  specialty: string;
  greeting: string;
  avatar: string;
  avatarType: "animated_mascot" | "human_avatar";
  description: string;
  badgeColor: string;
  voice: MentorVoiceConfig;
  multilingualVoices?: Record<string, MentorVoiceConfig>;
  avatarConfig: MentorAvatarConfig;
}

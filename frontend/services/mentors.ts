import type { MentorId, MentorProfile, MentorVoiceConfig } from "@/types/mentor";

export const DEFAULT_MENTOR_ID: MentorId = "mira";

export const MENTOR_PROFILES: MentorProfile[] = [
  {
    id: "mira",
    name: "Mentor Mira",
    title: "Friendly Foundation Tutor",
    specialty: "Foundations & Overview",
    greeting: "Hello! I'm Mentor Mira. What would you like to explore today?",
    avatar: "/mascot/mira-idle.jpg",
    avatarType: "animated_mascot",
    description: "Gentle step-by-step guidance on ML fundamentals and core concepts.",
    badgeColor: "bg-violet-100 text-violet-700 border-violet-200",
    voice: {
      ttsEngine: "piper",
      voiceModel: "en_US-lessac-medium",
      fallbackVoice: "en_US-lessac-medium",
      language: "en-US",
      speakingRate: 1.0,
      traits: "warm, friendly, patient educator",
      isSupported: true,
    },
    multilingualVoices: {
      en: {
        ttsEngine: "piper",
        voiceModel: "en_US-lessac-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "en-US",
        speakingRate: 1.0,
        traits: "warm, friendly, patient educator",
        isSupported: true,
      },
      hi: {
        ttsEngine: "piper",
        voiceModel: "hi_IN-priyamvada-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "hi-IN",
        speakingRate: 1.0,
        traits: "warm, reassuring, patient Hindi educator",
        isSupported: true,
      },
      kn: {
        ttsEngine: "piper",
        voiceModel: "en_US-lessac-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "kn-IN",
        speakingRate: 1.0,
        traits: "warm, friendly educator (Kannada text / fallback audio)",
        isSupported: false,
      },
    },
    avatarConfig: {
      avatarType: "animated_mascot",
      hasRig: true,
      hasVisemes: true,
      supportsMultiExpression: true,
    },
  },
  {
    id: "arjun",
    name: "Mentor Arjun",
    title: "Practical Systems Architect",
    specialty: "DBMS & Systems",
    greeting: "Hello, I'm Arjun. Let's understand the concept practically and see how it works in real applications.",
    avatar: "/mascot/arjun-idle.jpg",
    avatarType: "human_avatar",
    description: "Focuses on SQL, database design, indexing, transactions, and real-world system architecture.",
    badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
    voice: {
      ttsEngine: "piper",
      voiceModel: "en_US-ryan-medium",
      fallbackVoice: "en_US-lessac-medium",
      language: "en-US",
      speakingRate: 0.94,
      traits: "calm, confident, practical educator",
      isSupported: true,
    },
    multilingualVoices: {
      en: {
        ttsEngine: "piper",
        voiceModel: "en_US-ryan-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "en-US",
        speakingRate: 0.94,
        traits: "mature, calm, confident, professional",
        isSupported: true,
      },
      hi: {
        ttsEngine: "piper",
        voiceModel: "hi_IN-rohan-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "hi-IN",
        speakingRate: 0.95,
        traits: "calm, structured, measured Hindi educator",
        isSupported: true,
      },
      kn: {
        ttsEngine: "piper",
        voiceModel: "en_US-ryan-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "kn-IN",
        speakingRate: 0.94,
        traits: "calm, practical educator (Kannada text / fallback audio)",
        isSupported: false,
      },
    },
    avatarConfig: {
      avatarType: "human_avatar",
      hasRig: false,
      hasVisemes: false,
      supportsMultiExpression: false,
    },
  },
  {
    id: "tara",
    name: "Mentor Tara",
    title: "Deep Learning Specialist",
    specialty: "Neural Nets & Math",
    greeting: "Hi, I'm Tara. Let's explore the idea step by step, starting with the intuition and moving toward the technical details.",
    avatar: "/mascot/tara-idle.jpg",
    avatarType: "human_avatar",
    description: "Deep dive into neural networks, backprop, Transformers, and mathematical intuition.",
    badgeColor: "bg-teal-100 text-teal-700 border-teal-200",
    voice: {
      ttsEngine: "piper",
      voiceModel: "en_US-amy-medium",
      fallbackVoice: "en_US-lessac-medium",
      language: "en-US",
      speakingRate: 1.04,
      traits: "clear, analytical, composed educator",
      isSupported: true,
    },
    multilingualVoices: {
      en: {
        ttsEngine: "piper",
        voiceModel: "en_US-amy-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "en-US",
        speakingRate: 1.04,
        traits: "clear, composed, analytical, articulate",
        isSupported: true,
      },
      hi: {
        ttsEngine: "piper",
        voiceModel: "hi_IN-priyamvada-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "hi-IN",
        speakingRate: 1.05,
        traits: "analytical, clear, precise Hindi tutor",
        isSupported: true,
      },
      kn: {
        ttsEngine: "piper",
        voiceModel: "en_US-amy-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "kn-IN",
        speakingRate: 1.04,
        traits: "clear, composed educator (Kannada text / fallback audio)",
        isSupported: false,
      },
    },
    avatarConfig: {
      avatarType: "human_avatar",
      hasRig: false,
      hasVisemes: false,
      supportsMultiExpression: false,
    },
  },
  {
    id: "kiran",
    name: "Mentor Kiran",
    title: "AI & ML Practitioner",
    specialty: "Algorithms & Code",
    greeting: "Hey, I'm Kiran. Let's connect the theory with practical examples and see how you can implement the concept.",
    avatar: "/mascot/kiran-idle.jpg",
    avatarType: "human_avatar",
    description: "Bridges theory with hands-on experiments, Python implementation, and training pipelines.",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    voice: {
      ttsEngine: "piper",
      voiceModel: "en_US-danny-low",
      fallbackVoice: "en_US-lessac-medium",
      language: "en-US",
      speakingRate: 0.98,
      traits: "energetic, approachable, practical educator",
      isSupported: true,
    },
    multilingualVoices: {
      en: {
        ttsEngine: "piper",
        voiceModel: "en_US-danny-low",
        fallbackVoice: "en_US-lessac-medium",
        language: "en-US",
        speakingRate: 0.98,
        traits: "energetic, approachable, practical educator",
        isSupported: true,
      },
      hi: {
        ttsEngine: "piper",
        voiceModel: "hi_IN-pratham-medium",
        fallbackVoice: "en_US-lessac-medium",
        language: "hi-IN",
        speakingRate: 0.98,
        traits: "energetic, approachable, hands-on Hindi educator",
        isSupported: true,
      },
      kn: {
        ttsEngine: "piper",
        voiceModel: "en_US-danny-low",
        fallbackVoice: "en_US-lessac-medium",
        language: "kn-IN",
        speakingRate: 0.98,
        traits: "energetic, hands-on educator (Kannada text / fallback audio)",
        isSupported: false,
      },
    },
    avatarConfig: {
      avatarType: "human_avatar",
      hasRig: false,
      hasVisemes: false,
      supportsMultiExpression: false,
    },
  },
];

export function getMentorProfile(id?: string): MentorProfile {
  if (!id) return MENTOR_PROFILES[0];
  const found = MENTOR_PROFILES.find((m) => m.id === id.toLowerCase().trim());
  return found || MENTOR_PROFILES[0];
}

export function getMentorVoiceForLanguage(id?: string, lang: string = "en"): MentorVoiceConfig {
  const profile = getMentorProfile(id);
  const cleanLang = lang.toLowerCase().trim();
  const normalizedLang = cleanLang.startsWith("hi") ? "hi" : cleanLang.startsWith("kn") ? "kn" : "en";
  if (profile.multilingualVoices && profile.multilingualVoices[normalizedLang]) {
    return profile.multilingualVoices[normalizedLang];
  }
  return profile.voice;
}

import type { MentorId, MentorProfile } from "@/types/mentor";

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
  },
];

export function getMentorProfile(id?: string): MentorProfile {
  if (!id) return MENTOR_PROFILES[0];
  const found = MENTOR_PROFILES.find((m) => m.id === id.toLowerCase().trim());
  return found || MENTOR_PROFILES[0];
}

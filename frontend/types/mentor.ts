export type MentorId = "mira" | "arjun" | "tara" | "kiran";

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
}

/**
 * Public mascot module exports.
 * Chat UI should import from here when possible.
 */
export { default as MascotAvatar } from "./MascotAvatar";
export { default as MentorFace } from "./MentorFace";
export { default as MascotStatusRing } from "./MascotStatusRing";
export { useMascotState } from "./useMascotState";
export { useLipSync } from "./useLipSync";
export { useMascotAnimation } from "./useMascotAnimation";
export { STATE_LABELS, STATE_POSES, EMOTION_POSES } from "./mascotExpressions";
export type { FacialPose } from "./mascotExpressions";

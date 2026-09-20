import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";

/**
 * Facial pose values applied by the animation loop.
 * Offsets are relative units consumed by MentorFace (CSS transforms + visemes).
 */
export interface FacialPose {
  /** Mouth openness 0 (closed) → 1 (wide open) */
  mouthOpen: number;
  /** Mouth width scale (1 = neutral smile width) */
  mouthWidth: number;
  /** Smile curl amount -1 (frown) → 1 (big smile) */
  smile: number;
  /** Eyebrow vertical offset in SVG units (negative = raised) */
  browRaise: number;
  /** Independent right-brow offset added on top of browRaise */
  browSkew: number;
  /** Eye scale Y for blink (1 = open, 0 = closed) */
  eyeOpen: number;
  /** Gaze offset X/Y in SVG units */
  gazeX: number;
  gazeY: number;
  /** Head rotation in degrees */
  headRot: number;
  /** Head tilt (nod) in degrees */
  headNod: number;
  /** Subtle body sway degrees */
  bodySway: number;
  /** Breathing scale delta around 1 */
  breath: number;
  /** Screen-left arm rotation in degrees (negative = up / toward chat) */
  armLeft: number;
  /** Screen-right arm rotation in degrees (negative = up / wave) */
  armRight: number;
  /** Cheek blush opacity 0–1 */
  blush: number;
}

/** Baseline expression targets for each conversation state. */
export const STATE_POSES: Record<MascotState, Partial<FacialPose>> = {
  idle: {
    mouthOpen: 0,
    mouthWidth: 1,
    smile: 0.55,
    browRaise: 0,
    browSkew: 0,
    eyeOpen: 1,
    gazeX: 0,
    gazeY: 0,
    headRot: 0,
    headNod: 0,
    armLeft: 8,
    armRight: -8,
    blush: 0.15,
  },
  listening: {
    mouthOpen: 0,
    mouthWidth: 0.95,
    smile: 0.35,
    browRaise: -2.5,
    eyeOpen: 1.05,
    gazeX: 0,
    gazeY: -1,
    headRot: -2,
    headNod: 1,
    armLeft: 6,
    armRight: -6,
    blush: 0.1,
  },
  thinking: {
    mouthOpen: 0.04,
    mouthWidth: 0.75,
    smile: 0.15,
    browRaise: -1.5,
    browSkew: 2,
    eyeOpen: 0.92,
    gazeX: 4,
    gazeY: -3,
    headRot: 6,
    headNod: -2,
    armLeft: 12,
    armRight: -40,
    blush: 0.05,
  },
  speaking: {
    mouthOpen: 0,
    mouthWidth: 1.02,
    smile: 0.45,
    browRaise: -0.8,
    eyeOpen: 1,
    gazeX: 0,
    gazeY: 0,
    headRot: 0,
    headNod: 0,
    armLeft: 4,
    armRight: -4,
    blush: 0.2,
  },
};

/** Overlay targets blended on top of the conversation state. */
export const EMOTION_POSES: Record<MascotEmotion, Partial<FacialPose>> = {
  neutral: {},
  happy: {
    smile: 0.95,
    browRaise: -1.2,
    eyeOpen: 1.02,
    blush: 0.55,
    mouthWidth: 1.12,
  },
  thinking: {
    smile: 0.1,
    browRaise: -2,
    browSkew: 3,
    gazeX: 5,
    gazeY: -4,
  },
  surprised: {
    smile: 0.05,
    mouthOpen: 0.42,
    mouthWidth: 0.85,
    browRaise: -5,
    eyeOpen: 1.18,
    blush: 0.2,
  },
  sad: {
    smile: -0.55,
    browRaise: 3,
    eyeOpen: 0.88,
    gazeY: 3,
    blush: 0.05,
    mouthWidth: 0.8,
  },
  confident: {
    smile: 0.62,
    browSkew: -2.5,
    browRaise: -0.6,
    headRot: -3,
    blush: 0.25,
  },
  greeting: {
    smile: 0.9,
    browRaise: -1.5,
    blush: 0.45,
    mouthWidth: 1.1,
  },
};

export const GESTURE_ARMS: Record<MascotGesture, Partial<FacialPose>> = {
  none: {},
  point: { armLeft: -55, armRight: -6 },
  nod: {},
  shake: {},
  raise_hand: { armRight: -125, armLeft: 10 },
  celebrate: { armLeft: -125, armRight: 125, smile: 1, blush: 0.7 },
  wave: { armRight: -95, armLeft: 8, smile: 0.85 },
};

export const DEFAULT_POSE: FacialPose = {
  mouthOpen: 0,
  mouthWidth: 1,
  smile: 0.55,
  browRaise: 0,
  browSkew: 0,
  eyeOpen: 1,
  gazeX: 0,
  gazeY: 0,
  headRot: 0,
  headNod: 0,
  bodySway: 0,
  breath: 1,
  armLeft: 8,
  armRight: -8,
  blush: 0.15,
};

/** Status copy shown under the mascot name. */
export const STATE_LABELS: Record<MascotState, string> = {
  idle: "Ready to help",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
};

export const EMOTION_LABELS: Partial<Record<MascotEmotion, string>> = {
  happy: "Celebrating!",
  sad: "Let's try another way",
  greeting: "Hello!",
  surprised: "Oh!",
  confident: "Explaining",
};

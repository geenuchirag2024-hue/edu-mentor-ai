import type { MascotState } from "@/types/voice";

/**
 * Facial pose values applied by the 60 FPS animation loop.
 * Units are relative offsets / scales used by MentorFace SVG parts.
 */
export interface FacialPose {
  /** Mouth openness 0 (closed) → 1 (wide open) */
  mouthOpen: number;
  /** Mouth width scale (1 = neutral smile width) */
  mouthWidth: number;
  /** Smile curl amount 0 → 1 */
  smile: number;
  /** Eyebrow vertical offset in SVG units (negative = raised) */
  browRaise: number;
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
}

/** Baseline expression targets for each conversation state. */
export const STATE_POSES: Record<MascotState, Partial<FacialPose>> = {
  idle: {
    mouthOpen: 0,
    mouthWidth: 1,
    smile: 0.55,
    browRaise: 0,
    eyeOpen: 1,
    gazeX: 0,
    gazeY: 0,
    headRot: 0,
    headNod: 0,
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
  },
  thinking: {
    mouthOpen: 0.04,
    mouthWidth: 0.75,
    smile: 0.15,
    browRaise: -1.5,
    eyeOpen: 0.92,
    gazeX: 4,
    gazeY: -3,
    headRot: 6,
    headNod: -2,
  },
  speaking: {
    mouthOpen: 0.2,
    mouthWidth: 1.05,
    smile: 0.45,
    browRaise: -0.8,
    eyeOpen: 1,
    gazeX: 0,
    gazeY: 0,
    headRot: 0,
    headNod: 0,
  },
};

export const DEFAULT_POSE: FacialPose = {
  mouthOpen: 0,
  mouthWidth: 1,
  smile: 0.55,
  browRaise: 0,
  eyeOpen: 1,
  gazeX: 0,
  gazeY: 0,
  headRot: 0,
  headNod: 0,
  bodySway: 0,
  breath: 1,
};

/** Status copy shown under the mascot name. */
export const STATE_LABELS: Record<MascotState, string> = {
  idle: "Ready to help",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

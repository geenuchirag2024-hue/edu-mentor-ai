"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { FacialPose } from "./mascotExpressions";
import type { MentorExpression, MentorFaceHandle } from "./MentorFace";
import type { MentorId } from "@/types/mentor";

interface HumanMentorFaceProps {
  mentorId: MentorId;
  size?: number;
  className?: string;
  expression?: MentorExpression;
}

const HUMAN_ASSETS: Record<Exclude<MentorId, "mira">, string> = {
  arjun: "/mascot/arjun-idle.jpg",
  tara: "/mascot/tara-idle.jpg",
  kiran: "/mascot/kiran-idle.jpg",
};

const HUMAN_NAMES: Record<Exclude<MentorId, "mira">, string> = {
  arjun: "Mentor Arjun",
  tara: "Mentor Tara",
  kiran: "Mentor Kiran",
};

const HumanMentorFace = forwardRef<MentorFaceHandle, HumanMentorFaceProps>(
  function HumanMentorFace(
    { mentorId, size, className = "", expression = "idle" },
    ref
  ) {
    const headRef = useRef<HTMLDivElement>(null);
    const blinkOverlayRef = useRef<HTMLDivElement>(null);
    const jawEffectRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

    const safeId: Exclude<MentorId, "mira"> =
      mentorId === "arjun" || mentorId === "tara" || mentorId === "kiran"
        ? mentorId
        : "arjun";

    const imageSrc = HUMAN_ASSETS[safeId];
    const mentorName = HUMAN_NAMES[safeId];

    useEffect(() => {
      setReady(false);
    }, [safeId]);

    useImperativeHandle(ref, () => ({
      applyPose(pose: FacialPose) {
        const head = headRef.current;
        if (head) {
          const rot = (pose.headRot + pose.bodySway * 0.22) * 0.55;
          const nod = pose.headNod * 0.32;
          const gazeX = pose.gazeX * 0.22;
          head.style.transform =
            `translate3d(${gazeX.toFixed(2)}px, ${nod.toFixed(2)}px, 0) ` +
            `rotate(${rot.toFixed(2)}deg) scale(${pose.breath.toFixed(4)})`;
        }

        // Natural eyelid blink simulation
        if (blinkOverlayRef.current) {
          const closed = Math.min(1, Math.max(0, 1 - pose.eyeOpen));
          blinkOverlayRef.current.style.opacity =
            closed > 0.08 ? (closed * 0.82).toFixed(3) : "0";
        }

        // Audio-synchronized subtle jaw / speaking resonance
        if (jawEffectRef.current) {
          const open = Math.min(1, Math.max(0, pose.mouthOpen));
          if (open > 0.05) {
            jawEffectRef.current.style.transform = `translateY(${(open * 2.8).toFixed(1)}px)`;
            jawEffectRef.current.style.opacity = Math.min(1, 0.25 + open * 0.75).toFixed(2);
          } else {
            jawEffectRef.current.style.transform = "translateY(0px)";
            jawEffectRef.current.style.opacity = "0";
          }
        }
      },
    }));

    const boxStyle = size
      ? { width: size, height: Math.round(size * 1.5) }
      : undefined;

    return (
      <div
        className={`mira-stage human-mentor-stage relative overflow-hidden rounded-2xl ${
          ready ? "mira-stage-ready" : ""
        } ${className}`}
        style={boxStyle}
        role="img"
        aria-label={`${mentorName}, your realistic AI learning mentor`}
        data-expression={expression}
        data-mentor={safeId}
      >
        <div ref={headRef} className="mira-head relative h-full w-full overflow-hidden rounded-2xl transition-transform duration-75">
          <img
            src={imageSrc}
            alt={mentorName}
            className="mira-layer h-full w-full object-cover transition-opacity duration-300"
            draggable={false}
            fetchPriority="high"
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
          />

          {/* Blink darkening layer */}
          <div
            ref={blinkOverlayRef}
            className="pointer-events-none absolute inset-x-0 top-1/4 h-1/5 bg-slate-900/65 mix-blend-multiply transition-opacity duration-75"
            style={{ opacity: 0 }}
            aria-hidden
          />

          {/* Audio-synchronized jaw / lower face motion modulation */}
          <div
            ref={jawEffectRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent transition-all duration-75"
            style={{ opacity: 0 }}
            aria-hidden
          />

          {/* Vignette styling */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
        </div>
      </div>
    );
  }
);

export default HumanMentorFace;

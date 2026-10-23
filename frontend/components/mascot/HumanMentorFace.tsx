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
          const rot = (pose.headRot + pose.bodySway * 0.25) * 0.6;
          const nod = pose.headNod * 0.25;
          const gazeX = pose.gazeX * 0.2;
          head.style.transform =
            `translate3d(${gazeX.toFixed(2)}px, ${nod.toFixed(2)}px, 0) ` +
            `rotate(${rot.toFixed(2)}deg) scale(${pose.breath.toFixed(4)})`;
        }
      },
    }));

    const boxStyle = size
      ? { width: size, height: Math.round(size * 1.5) }
      : undefined;

    return (
      <div
        className={`mira-stage human-mentor-stage ${ready ? "mira-stage-ready" : ""} ${className}`}
        style={boxStyle}
        role="img"
        aria-label={`${mentorName}, your realistic AI learning mentor`}
        data-expression={expression}
        data-mentor={safeId}
      >
        <div ref={headRef} className="mira-head relative h-full w-full overflow-hidden rounded-2xl">
          <img
            src={imageSrc}
            alt={mentorName}
            className="mira-layer h-full w-full object-cover transition-opacity duration-300"
            draggable={false}
            fetchPriority="high"
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
          />

          {/* Subtle gradient vignette to integrate cleanly into stage backdrop */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
        </div>
      </div>
    );
  }
);

export default HumanMentorFace;

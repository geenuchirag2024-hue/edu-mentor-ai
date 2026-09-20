"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { FacialPose } from "./mascotExpressions";

export interface MentorFaceHandle {
  applyPose: (pose: FacialPose) => void;
}

export type MentorExpression =
  | "idle"
  | "listen"
  | "think"
  | "happy"
  | "concern";

interface MentorFaceProps {
  size?: number;
  className?: string;
  expression?: MentorExpression;
}

/** Original framed portraits — never pass these through canvas/chroma-key. */
const ASSETS = {
  idle: "/mascot/mira-idle.jpg",
  blink: "/mascot/mira-blink.jpg",
  speak: "/mascot/mira-speak.jpg",
  listen: "/mascot/mira-listen.jpg",
  think: "/mascot/mira-think.jpg",
  happy: "/mascot/mira-happy.jpg",
  concern: "/mascot/mira-concern.jpg",
} as const;

const MentorFace = forwardRef<MentorFaceHandle, MentorFaceProps>(
  function MentorFace(
    { size, className = "", expression = "idle" },
    ref
  ) {
    const headRef = useRef<HTMLDivElement>(null);
    const blinkRef = useRef<HTMLDivElement>(null);
    const speakRef = useRef<HTMLImageElement>(null);
    const idleRef = useRef<HTMLImageElement>(null);
    const listenRef = useRef<HTMLImageElement>(null);
    const thinkRef = useRef<HTMLImageElement>(null);
    const happyRef = useRef<HTMLImageElement>(null);
    const concernRef = useRef<HTMLImageElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      const setOp = (el: HTMLImageElement | null, on: boolean) => {
        if (el) el.style.opacity = on ? "1" : "0";
      };
      setOp(listenRef.current, expression === "listen");
      setOp(thinkRef.current, expression === "think");
      setOp(happyRef.current, expression === "happy");
      setOp(concernRef.current, expression === "concern");
    }, [expression]);

    useEffect(() => {
      const el = idleRef.current;
      if (el?.complete) setReady(true);
    }, []);

    useImperativeHandle(ref, () => ({
      applyPose(pose: FacialPose) {
        const head = headRef.current;
        if (head) {
          const rot = pose.headRot + pose.bodySway * 0.35;
          const nod = pose.headNod * 0.4;
          const gazeX = pose.gazeX * 0.32;
          const gazeY = pose.gazeY * 0.28;
          head.style.transform =
            `translate3d(${gazeX.toFixed(2)}px, ${nod.toFixed(2)}px, 0) ` +
            `rotate(${rot.toFixed(2)}deg) scale(${pose.breath.toFixed(4)})`;
        }

        if (blinkRef.current) {
          const closed = Math.min(1, Math.max(0, 1 - pose.eyeOpen));
          blinkRef.current.style.opacity =
            closed > 0.08 ? closed.toFixed(3) : "0";
        }

        if (speakRef.current) {
          const open = Math.min(1, Math.max(0, pose.mouthOpen));
          const viseme =
            open < 0.06 ? 0 : Math.min(1, 0.22 + (open - 0.06) / 0.38);
          speakRef.current.style.opacity = viseme.toFixed(3);
        }
      },
    }));

    const boxStyle = size
      ? { width: size, height: Math.round(size * 1.5) }
      : undefined;

    return (
      <div
        className={`mira-stage ${ready ? "mira-stage-ready" : ""} ${className}`}
        style={boxStyle}
        role="img"
        aria-label="Mentor Mira, your AI learning mentor"
        data-expression={expression}
      >
        <div ref={headRef} className="mira-head">
          <img
            ref={idleRef}
            src={ASSETS.idle}
            alt=""
            className="mira-layer"
            draggable={false}
            fetchPriority="high"
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
          />
          <img
            ref={listenRef}
            src={ASSETS.listen}
            alt=""
            className="mira-layer mira-expr"
            draggable={false}
          />
          <img
            ref={thinkRef}
            src={ASSETS.think}
            alt=""
            className="mira-layer mira-expr"
            draggable={false}
          />
          <img
            ref={happyRef}
            src={ASSETS.happy}
            alt=""
            className="mira-layer mira-expr"
            draggable={false}
          />
          <img
            ref={concernRef}
            src={ASSETS.concern}
            alt=""
            className="mira-layer mira-expr"
            draggable={false}
          />
          <img
            ref={speakRef}
            src={ASSETS.speak}
            alt=""
            className="mira-layer mira-speak"
            draggable={false}
          />
          <div ref={blinkRef} className="mira-blink-mask" aria-hidden>
            <img src={ASSETS.blink} alt="" className="mira-layer" draggable={false} />
          </div>
        </div>
      </div>
    );
  }
);

export default MentorFace;

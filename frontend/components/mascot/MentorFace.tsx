"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { FacialPose } from "./mascotExpressions";

export interface MentorFaceHandle {
  /** Apply a full facial pose without triggering a React render. */
  applyPose: (pose: FacialPose) => void;
}

interface MentorFaceProps {
  /** Visual size in CSS pixels (SVG scales with viewBox). */
  size?: number;
  className?: string;
}

/**
 * Friendly young human mentor face (Mentor Mira).
 * All motion is applied imperatively via refs for smooth ~60 FPS updates.
 */
const MentorFace = forwardRef<MentorFaceHandle, MentorFaceProps>(
  function MentorFace({ size = 220, className = "" }, ref) {
    const rootRef = useRef<SVGGElement>(null);
    const headGroupRef = useRef<SVGGElement>(null);
    const leftPupilRef = useRef<SVGCircleElement>(null);
    const rightPupilRef = useRef<SVGCircleElement>(null);
    const leftEyeRef = useRef<SVGGElement>(null);
    const rightEyeRef = useRef<SVGGElement>(null);
    const leftBrowRef = useRef<SVGPathElement>(null);
    const rightBrowRef = useRef<SVGPathElement>(null);
    const mouthGroupRef = useRef<SVGGElement>(null);
    const mouthOuterRef = useRef<SVGEllipseElement>(null);
    const mouthInnerRef = useRef<SVGEllipseElement>(null);
    const smilePathRef = useRef<SVGPathElement>(null);
    const teethRef = useRef<SVGRectElement>(null);
    const leftArmRef = useRef<SVGGElement>(null);
    const rightArmRef = useRef<SVGGElement>(null);
    const leftCheekRef = useRef<SVGEllipseElement>(null);
    const rightCheekRef = useRef<SVGEllipseElement>(null);
    const sparkleRef = useRef<SVGGElement>(null);

    useImperativeHandle(ref, () => ({
      applyPose(pose: FacialPose) {
        const head = headGroupRef.current;
        if (head) {
          const rot = pose.headRot + pose.bodySway * 0.35;
          const nod = pose.headNod;
          // Pivot around approximate neck / head center
          head.setAttribute(
            "transform",
            `translate(100 108) rotate(${rot.toFixed(2)}) translate(-100 -108) translate(0 ${nod.toFixed(2)}) scale(${pose.breath.toFixed(4)})`
          );
        }

        // Eyes — blink via scaleY on the eye groups
        const eyeScale = Math.max(0.08, pose.eyeOpen);
        leftEyeRef.current?.setAttribute(
          "transform",
          `translate(72 96) scale(1 ${eyeScale.toFixed(3)}) translate(-72 -96)`
        );
        rightEyeRef.current?.setAttribute(
          "transform",
          `translate(128 96) scale(1 ${eyeScale.toFixed(3)}) translate(-128 -96)`
        );

        // Gaze
        leftPupilRef.current?.setAttribute("cx", String(72 + pose.gazeX));
        leftPupilRef.current?.setAttribute("cy", String(96 + pose.gazeY));
        rightPupilRef.current?.setAttribute("cx", String(128 + pose.gazeX));
        rightPupilRef.current?.setAttribute("cy", String(96 + pose.gazeY));

        // Brows — right brow can skew independently (confident / thinking)
        leftBrowRef.current?.setAttribute(
          "transform",
          `translate(0 ${pose.browRaise.toFixed(2)})`
        );
        rightBrowRef.current?.setAttribute(
          "transform",
          `translate(0 ${(pose.browRaise + (pose.browSkew ?? 0)).toFixed(2)})`
        );

        leftArmRef.current?.setAttribute(
          "transform",
          `translate(58 196) rotate(${pose.armLeft.toFixed(1)}) translate(-58 -196)`
        );
        rightArmRef.current?.setAttribute(
          "transform",
          `translate(142 196) rotate(${pose.armRight.toFixed(1)}) translate(-142 -196)`
        );

        const blush = Math.min(1, Math.max(0, pose.blush));
        leftCheekRef.current?.setAttribute("opacity", blush.toFixed(2));
        rightCheekRef.current?.setAttribute("opacity", blush.toFixed(2));
        sparkleRef.current?.setAttribute(
          "opacity",
          pose.armLeft < -90 && pose.armRight > 90 ? "1" : "0"
        );

        // Mouth: blend closed smile vs open speaking mouth
        const open = Math.min(1, Math.max(0, pose.mouthOpen));
        const width = pose.mouthWidth;
        const smile = pose.smile;

        if (mouthGroupRef.current) {
          mouthGroupRef.current.setAttribute(
            "transform",
            `translate(100 138) scale(${width.toFixed(3)} 1) translate(-100 -138)`
          );
        }

        // Open mouth (ellipse) — visible when speaking
        const outerRy = 2.2 + open * 14;
        const outerRx = 10 + open * 8;
        mouthOuterRef.current?.setAttribute("ry", outerRy.toFixed(2));
        mouthOuterRef.current?.setAttribute("rx", outerRx.toFixed(2));
        mouthOuterRef.current?.setAttribute(
          "opacity",
          String(Math.min(1, open * 3.2))
        );

        const innerRy = Math.max(0.5, open * 9);
        const innerRx = 6 + open * 5;
        mouthInnerRef.current?.setAttribute("ry", innerRy.toFixed(2));
        mouthInnerRef.current?.setAttribute("rx", innerRx.toFixed(2));
        mouthInnerRef.current?.setAttribute(
          "opacity",
          String(Math.min(1, open * 3.5))
        );

        if (teethRef.current) {
          teethRef.current.setAttribute("height", String(Math.max(0, open * 5.5)));
          teethRef.current.setAttribute("opacity", String(Math.min(0.95, open * 2.5)));
        }

        // Closed lips — positive smile curls down in SVG (U), negative is a frown
        const smileDepth = 5 + smile * 10;
        const smileHalf = 14 + Math.max(-0.2, smile) * 4;
        const y = 136;
        smilePathRef.current?.setAttribute(
          "d",
          `M ${100 - smileHalf} ${y} Q 100 ${y + smileDepth} ${100 + smileHalf} ${y}`
        );
        smilePathRef.current?.setAttribute(
          "opacity",
          String(Math.max(0, 1 - open * 2.4))
        );
        smilePathRef.current?.setAttribute(
          "stroke-width",
          String(2.4 + smile * 0.6)
        );
      },
    }));

    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 236"
        className={className}
        role="img"
        aria-label="Mentor Mira, your AI learning mentor"
      >
        <defs>
          {/* Soft skin shading */}
          <radialGradient id="miraSkin" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fde4d2" />
            <stop offset="55%" stopColor="#f0c4a8" />
            <stop offset="100%" stopColor="#e0a888" />
          </radialGradient>
          <linearGradient id="miraHair" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3d2b1f" />
            <stop offset="50%" stopColor="#5c4033" />
            <stop offset="100%" stopColor="#2a1c14" />
          </linearGradient>
          <linearGradient id="miraShirt" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4f6ef7" />
            <stop offset="100%" stopColor="#3550d4" />
          </linearGradient>
          <radialGradient id="miraCheek" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f5a89a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f5a89a" stopOpacity="0" />
          </radialGradient>
          <filter id="miraSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.18" />
          </filter>
        </defs>

        <g ref={rootRef}>
          {/* Arms — pivoted from shoulders; sit behind the torso */}
          <g ref={leftArmRef}>
            <path
              d="M 58 196 Q 38 214 32 232"
              stroke="#4f6ef7"
              strokeWidth="13"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="30" cy="234" r="7.5" fill="#f0c4a8" />
          </g>
          <g ref={rightArmRef}>
            <path
              d="M 142 196 Q 162 214 168 232"
              stroke="#4f6ef7"
              strokeWidth="13"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="170" cy="234" r="7.5" fill="#f0c4a8" />
          </g>

          {/* Shoulders / torso — professional mentor look */}
          <ellipse cx="100" cy="214" rx="62" ry="28" fill="url(#miraShirt)" filter="url(#miraSoftShadow)" />
          <path
            d="M 55 198 Q 100 185 145 198 L 150 236 L 50 236 Z"
            fill="url(#miraShirt)"
          />
          {/* Collar accent */}
          <path
            d="M 78 200 Q 100 192 122 200"
            stroke="#c7d2fe"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />

          {/* Head group — rotated / scaled by animation loop */}
          <g ref={headGroupRef}>
            {/* Hair back layer */}
            <ellipse cx="100" cy="95" rx="58" ry="68" fill="url(#miraHair)" />

            {/* Neck */}
            <rect x="88" y="155" width="24" height="28" rx="8" fill="#e8b898" />

            {/* Face */}
            <ellipse
              cx="100"
              cy="108"
              rx="48"
              ry="54"
              fill="url(#miraSkin)"
              filter="url(#miraSoftShadow)"
            />

            {/* Soft cheeks — opacity driven by emotion */}
            <ellipse
              ref={leftCheekRef}
              cx="68"
              cy="120"
              rx="10"
              ry="7"
              fill="url(#miraCheek)"
            />
            <ellipse
              ref={rightCheekRef}
              cx="132"
              cy="120"
              rx="10"
              ry="7"
              fill="url(#miraCheek)"
            />

            {/* Celebrate sparkles */}
            <g ref={sparkleRef} opacity="0">
              <text x="28" y="58" fontSize="16">
                ✦
              </text>
              <text x="158" y="52" fontSize="14">
                ✦
              </text>
              <text x="42" y="42" fontSize="11">
                ✧
              </text>
            </g>

            {/* Nose (subtle) */}
            <path
              d="M 100 108 Q 104 122 98 126"
              stroke="#d4a088"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />

            {/* Eyebrows */}
            <path
              ref={leftBrowRef}
              d="M 56 82 Q 72 76 86 82"
              stroke="#3d2b1f"
              strokeWidth="3.2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              ref={rightBrowRef}
              d="M 114 82 Q 128 76 144 82"
              stroke="#3d2b1f"
              strokeWidth="3.2"
              fill="none"
              strokeLinecap="round"
            />

            {/* Eyes */}
            <g ref={leftEyeRef}>
              <ellipse cx="72" cy="96" rx="11" ry="9" fill="#fff" />
              <circle ref={leftPupilRef} cx="72" cy="96" r="5.2" fill="#2c3e50" />
              <circle cx="74" cy="94" r="1.6" fill="#fff" opacity="0.9" />
            </g>
            <g ref={rightEyeRef}>
              <ellipse cx="128" cy="96" rx="11" ry="9" fill="#fff" />
              <circle ref={rightPupilRef} cx="128" cy="96" r="5.2" fill="#2c3e50" />
              <circle cx="130" cy="94" r="1.6" fill="#fff" opacity="0.9" />
            </g>

            {/* Mouth group */}
            <g ref={mouthGroupRef}>
              {/* Open mouth cavity */}
              <ellipse
                ref={mouthOuterRef}
                cx="100"
                cy="138"
                rx="12"
                ry="2"
                fill="#c47878"
                opacity="0"
              />
              {/* Teeth */}
              <rect
                ref={teethRef}
                x="92"
                y="132"
                width="16"
                height="0"
                rx="2"
                fill="#fffaf5"
                opacity="0"
              />
              {/* Inner mouth / tongue hint */}
              <ellipse
                ref={mouthInnerRef}
                cx="100"
                cy="142"
                rx="7"
                ry="1"
                fill="#a85a5a"
                opacity="0"
              />
              {/* Closed smile path */}
              <path
                ref={smilePathRef}
                d="M 86 136 Q 100 144 114 136"
                stroke="#c47878"
                strokeWidth="2.6"
                fill="none"
                strokeLinecap="round"
              />
            </g>

            {/* Hair front bangs */}
            <path
              d="M 52 95 Q 55 55 100 48 Q 145 55 148 95 Q 140 70 100 68 Q 60 70 52 95 Z"
              fill="url(#miraHair)"
            />
            <path
              d="M 58 78 Q 70 95 68 115"
              stroke="#2a1c14"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M 142 78 Q 130 95 132 115"
              stroke="#2a1c14"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              opacity="0.85"
            />
          </g>
        </g>
      </svg>
    );
  }
);

export default MentorFace;

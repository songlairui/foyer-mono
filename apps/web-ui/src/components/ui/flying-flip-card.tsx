import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "#/lib/utils";

export type FlyingFlipCardPhase = "measuring" | "flying" | "arrived" | "closing";

type SlotState = {
  phase: FlyingFlipCardPhase;
  requestClose: () => void;
};

type FaceSlot = ReactNode | ((state: SlotState) => ReactNode);
export type FlyingFlipCardAnimateStyle = "reference" | "orbit";

interface FlyingFlipCardProps {
  sourceRect: DOMRect;
  flipped: boolean;
  animateStyle?: FlyingFlipCardAnimateStyle;
  front: FaceSlot;
  back: FaceSlot;
  onClose: () => void;
  onFlippedChange?: (flipped: boolean) => void;
  overlay?: FaceSlot;
  className?: string;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
}

type FlightMetrics = {
  left: number;
  top: number;
  offsetX: number;
  offsetY: number;
  driftX: number;
  driftY: number;
  overshootX: number;
  overshootY: number;
  scaleX: number;
  scaleY: number;
};

const REFERENCE_FLY_DURATION = 1000;
const ORBIT_FLY_DURATION = 1180;
const EXIT_DURATION = 180;
const FLIP_DURATION = 620;
const REFERENCE_FLY_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const ORBIT_FLY_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const EXIT_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

function renderSlot(slot: FaceSlot | undefined, state: SlotState) {
  if (!slot) return null;
  return typeof slot === "function" ? slot(state) : slot;
}

function mix(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function buildTransform(
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  rotateY: number,
  rotateX = 0,
  rotateZ = 0,
  z = 0,
) {
  return [
    `translate3d(${x}px, ${y}px, ${z}px)`,
    `scale(${scaleX}, ${scaleY})`,
    `rotateX(${rotateX}deg)`,
    `rotateY(${rotateY}deg)`,
    `rotateZ(${rotateZ}deg)`,
  ].join(" ");
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function FlyingFlipCard({
  sourceRect,
  flipped,
  animateStyle = "reference",
  front,
  back,
  onClose,
  onFlippedChange,
  overlay,
  className,
  width = "min(440px, calc(100vw - 32px))",
  height = "min(520px, calc(100vh - 72px))",
}: FlyingFlipCardProps) {
  const [phase, setPhase] = useState<FlyingFlipCardPhase>("measuring");
  const [metrics, setMetrics] = useState<FlightMetrics | null>(null);
  const flightRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const el = flightRef.current;
    if (!el) return;

    const targetRect = el.getBoundingClientRect();
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const sourceCenterX = sourceRect.left + sourceRect.width / 2;
    const sourceCenterY = sourceRect.top + sourceRect.height / 2;
    const distance = Math.hypot(sourceCenterX - viewportCenterX, sourceCenterY - viewportCenterY);
    const safeDistance = Math.max(distance, 1);
    const offsetX = sourceCenterX - viewportCenterX;
    const offsetY = sourceCenterY - viewportCenterY;
    const unitX = offsetX / safeDistance;
    const unitY = offsetY / safeDistance;
    const drift = Math.min(48, Math.max(18, distance * 0.09));
    const overshoot = Math.min(38, Math.max(18, distance * 0.08));
    const driftX = -unitY * drift;
    const driftY = unitX * drift;

    setMetrics({
      left: (window.innerWidth - targetRect.width) / 2,
      top: (window.innerHeight - targetRect.height) / 2,
      offsetX,
      offsetY,
      driftX,
      driftY,
      overshootX: -unitX * overshoot + driftX * 0.22,
      overshootY: -unitY * overshoot + driftY * 0.22,
      scaleX: Math.max(sourceRect.width / targetRect.width, 0.18),
      scaleY: Math.max(sourceRect.height / targetRect.height, 0.14),
    });
  }, [sourceRect]);

  useEffect(() => {
    const el = flightRef.current;
    if (!el || !metrics) return;

    const start = buildTransform(
      metrics.offsetX,
      metrics.offsetY,
      metrics.scaleX,
      metrics.scaleY,
      0,
    );
    const end = buildTransform(0, 0, 1, 1, 360);
    const flightDuration =
      animateStyle === "reference" ? REFERENCE_FLY_DURATION : ORBIT_FLY_DURATION;
    const flightEasing = animateStyle === "reference" ? REFERENCE_FLY_EASING : ORBIT_FLY_EASING;
    const keyframes =
      animateStyle === "reference"
        ? [
            {
              transform: start,
              offset: 0,
            },
            {
              transform: buildTransform(
                metrics.offsetX * 0.62,
                metrics.offsetY * 0.62,
                mix(metrics.scaleX, 1, 0.36),
                mix(metrics.scaleY, 1, 0.36),
                132,
                0,
                0,
                18,
              ),
              offset: 0.34,
            },
            {
              transform: buildTransform(
                metrics.offsetX * 0.24,
                metrics.offsetY * 0.24,
                mix(metrics.scaleX, 1, 0.74),
                mix(metrics.scaleY, 1, 0.74),
                276,
                0,
                0,
                14,
              ),
              offset: 0.72,
            },
            {
              transform: end,
              offset: 1,
            },
          ]
        : [
            {
              transform: start,
              offset: 0,
            },
            {
              transform: buildTransform(
                metrics.offsetX * 0.68 + metrics.driftX * 0.78,
                metrics.offsetY * 0.68 + metrics.driftY * 0.78,
                mix(metrics.scaleX, 1, 0.24),
                mix(metrics.scaleY, 1, 0.24),
                84,
                0,
                0,
                24,
              ),
              offset: 0.22,
            },
            {
              transform: buildTransform(
                metrics.offsetX * 0.36 + metrics.driftX,
                metrics.offsetY * 0.36 + metrics.driftY,
                mix(metrics.scaleX, 1, 0.5),
                mix(metrics.scaleY, 1, 0.5),
                180,
                0,
                0,
                48,
              ),
              offset: 0.5,
            },
            {
              transform: buildTransform(
                metrics.offsetX * 0.12 + metrics.driftX * 0.55,
                metrics.offsetY * 0.12 + metrics.driftY * 0.55,
                mix(metrics.scaleX, 1, 0.84),
                mix(metrics.scaleY, 1, 0.84),
                306,
                0,
                0,
                30,
              ),
              offset: 0.78,
            },
            {
              transform: buildTransform(
                metrics.overshootX,
                metrics.overshootY,
                1.025,
                1.025,
                342,
                0,
                0,
                12,
              ),
              offset: 0.92,
            },
            {
              transform: buildTransform(
                -metrics.overshootX * 0.28,
                -metrics.overshootY * 0.28,
                1.006,
                1.006,
                354,
                0,
                0,
                4,
              ),
              offset: 0.97,
            },
            {
              transform: end,
              offset: 1,
            },
          ];

    el.style.opacity = "1";
    el.style.transform = start;

    if (prefersReducedMotion()) {
      el.style.transform = buildTransform(0, 0, 1, 1, 0);
      setPhase("arrived");
      return;
    }

    const nextFrame = requestAnimationFrame(() => {
      setPhase("flying");
      const anim = el.animate(keyframes, {
        duration: flightDuration,
        easing: flightEasing,
        fill: "both",
      });

      animationRef.current = anim;
      anim.onfinish = () => {
        el.style.transform = buildTransform(0, 0, 1, 1, 0);
        anim.cancel();
        animationRef.current = null;
        setPhase("arrived");
      };
    });

    return () => {
      cancelAnimationFrame(nextFrame);
      animationRef.current?.cancel();
      animationRef.current = null;
    };
  }, [animateStyle, metrics]);

  const requestClose = useCallback(() => {
    if (phase === "closing") return;

    const el = flightRef.current;
    animationRef.current?.cancel();
    animationRef.current = null;

    if (!el || !metrics || phase === "measuring" || prefersReducedMotion()) {
      onClose();
      return;
    }

    setPhase("closing");

    const currentTransform = getComputedStyle(el).transform;
    const sourceDistance = Math.hypot(metrics.offsetX, metrics.offsetY);
    const visibleTravel = Math.min(1, 100 / Math.max(sourceDistance, 1));
    const visibleExitTransform = buildTransform(
      metrics.offsetX * visibleTravel,
      metrics.offsetY * visibleTravel,
      mix(1, metrics.scaleX, visibleTravel),
      mix(1, metrics.scaleY, visibleTravel),
      0,
      0,
      0,
      0,
    );
    const exitTransform = buildTransform(
      metrics.offsetX,
      metrics.offsetY,
      metrics.scaleX,
      metrics.scaleY,
      0,
      0,
      0,
      0,
    );

    const anim = el.animate(
      [
        {
          opacity: 1,
          transform: currentTransform === "none" ? buildTransform(0, 0, 1, 1, 0) : currentTransform,
        },
        {
          opacity: 0,
          transform: visibleExitTransform,
          offset: 0.62,
        },
        {
          opacity: 0,
          transform: exitTransform,
          offset: 1,
        },
      ],
      {
        duration: EXIT_DURATION,
        easing: EXIT_EASING,
        fill: "forwards",
      },
    );

    animationRef.current = anim;
    anim.onfinish = () => {
      el.style.opacity = "0";
      animationRef.current = null;
      onClose();
    };
  }, [metrics, onClose, phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (phase === "closing") return;
      if (phase === "arrived" && flipped) {
        onFlippedChange?.(false);
        return;
      }
      requestClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flipped, onFlippedChange, phase, requestClose]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;
      if (phase === "closing") return;
      if (phase === "arrived" && flipped) {
        onFlippedChange?.(false);
        return;
      }
      requestClose();
    },
    [flipped, onFlippedChange, phase, requestClose],
  );

  const state = { phase, requestClose };

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (phase !== "arrived") return;

      const el = cardRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      const tiltX = (x - 0.5) * 3;
      const tiltY = (0.5 - y) * 2.4;

      el.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
    },
    [phase],
  );

  const resetPointer = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;

    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }, []);

  const flightStyle: CSSProperties = {
    width,
    height,
    left: metrics ? metrics.left : "50%",
    top: metrics ? metrics.top : "50%",
    opacity: metrics ? 1 : 0,
    transform: metrics
      ? buildTransform(metrics.offsetX, metrics.offsetY, metrics.scaleX, metrics.scaleY, 0)
      : "translate(-50%, -50%)",
    transformOrigin: "center center",
    transformStyle: "preserve-3d",
    perspective: "1200px",
    willChange: "transform, opacity",
    pointerEvents: phase === "arrived" ? "auto" : "none",
  };

  const cardStyle = {
    "--tilt-x": "0deg",
    "--tilt-y": "0deg",
    transform: `rotateX(var(--tilt-y)) rotateY(calc(${flipped ? 180 : 0}deg + var(--tilt-x)))`,
    transition: `transform ${FLIP_DURATION}ms cubic-bezier(0.16, 1, 0.3, 1)`,
    transformStyle: "preserve-3d",
  } as CSSProperties;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 transition-colors duration-500",
        phase === "closing" && "duration-150",
        phase === "measuring" || phase === "closing" ? "bg-black/0" : "bg-black/70",
      )}
      onClick={handleBackdropClick}
    >
      {renderSlot(overlay, state)}

      <div
        ref={flightRef}
        data-phase={phase}
        className={cn("fixed", className)}
        style={flightStyle}
      >
        <div
          ref={cardRef}
          className="group relative h-full w-full"
          style={cardStyle}
          onPointerMove={handlePointerMove}
          onPointerLeave={resetPointer}
          onPointerCancel={resetPointer}
        >
          <FlyingFace>{renderSlot(front, state)}</FlyingFace>
          <FlyingFace back>{renderSlot(back, state)}</FlyingFace>
        </div>
      </div>
    </div>
  );
}

function FlyingFace({ back, children }: { back?: boolean; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-xl"
      style={{
        backfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg) translateZ(0.6px)" : "translateZ(0.6px)",
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
}

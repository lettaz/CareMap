import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  X,
  FileUp,
  Shuffle,
  Layers,
  ShieldCheck,
  Download,
  Sparkles,
} from "lucide-react";
import type { TourStep, TourPlacement } from "./tour-steps";

interface TourOverlayProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PADDING = 8;
const BORDER_RADIUS = 12;
const TOOLTIP_GAP = 16;
const TOOLTIP_WIDTH = 340;

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.x - PADDING,
    y: r.y - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

function computeTooltipPosition(
  rect: Rect | null,
  placement: TourPlacement,
): { top: number; left: number; transformOrigin: string } {
  if (!rect || placement === "center") {
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      transformOrigin: "center center",
    };
  }

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;

  switch (placement) {
    case "bottom":
      return {
        top: rect.y + rect.height + TOOLTIP_GAP,
        left: Math.min(
          Math.max(cx - TOOLTIP_WIDTH / 2, 16),
          window.innerWidth - TOOLTIP_WIDTH - 16,
        ),
        transformOrigin: "top center",
      };
    case "top":
      return {
        top: rect.y - TOOLTIP_GAP,
        left: Math.min(
          Math.max(cx - TOOLTIP_WIDTH / 2, 16),
          window.innerWidth - TOOLTIP_WIDTH - 16,
        ),
        transformOrigin: "bottom center",
      };
    case "right":
      return {
        top: Math.max(cy - 60, 16),
        left: rect.x + rect.width + TOOLTIP_GAP,
        transformOrigin: "left center",
      };
    case "left":
      return {
        top: Math.max(cy - 60, 16),
        left: rect.x - TOOLTIP_WIDTH - TOOLTIP_GAP,
        transformOrigin: "right center",
      };
    default:
      return { top: cy, left: cx, transformOrigin: "center center" };
  }
}

function PipelineFlowDiagram() {
  const nodes = [
    { icon: FileUp, label: "Source", color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: Shuffle, label: "Transform", color: "text-violet-600", bg: "bg-violet-50" },
    { icon: Layers, label: "Harmonize", color: "text-amber-600", bg: "bg-amber-50" },
    { icon: ShieldCheck, label: "Quality", color: "text-orange-600", bg: "bg-orange-50" },
    { icon: Download, label: "Store", color: "text-blue-600", bg: "bg-blue-50" },
  ];

  return (
    <div className="flex items-center justify-center gap-1 py-3">
      {nodes.map((n, i) => (
        <div key={n.label} className="flex items-center gap-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.08, type: "spring", stiffness: 400, damping: 25 }}
            className={`flex flex-col items-center gap-1 rounded-lg ${n.bg} p-2`}
          >
            <n.icon className={`h-4 w-4 ${n.color}`} />
            <span className={`text-[10px] font-medium ${n.color}`}>{n.label}</span>
          </motion.div>
          {i < nodes.length - 1 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="text-xs text-slate-400"
            >
              &rarr;
            </motion.span>
          )}
        </div>
      ))}
    </div>
  );
}

export function TourOverlay({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: TourOverlayProps) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const rafRef = useRef(0);

  const updateRect = useCallback(() => {
    if (step.target) {
      setTargetRect(getTargetRect(step.target));
    } else {
      setTargetRect(null);
    }
  }, [step.target]);

  useLayoutEffect(() => {
    updateRect();
  }, [updateRect]);

  useEffect(() => {
    function onResize() {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateRect);
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, [updateRect]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onSkip();
      if (e.key === "ArrowRight" || e.key === "Enter") onNext();
      if (e.key === "ArrowLeft" && stepIndex > 0) onPrev();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSkip, onNext, onPrev, stepIndex]);

  const isCentered = !step.target || !targetRect;
  const pos = computeTooltipPosition(targetRect, step.placement);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const isPipelineStep = step.id === "pipeline-flow";
  const isWelcome = step.id === "welcome";
  const isComplete = step.id === "complete";

  const overlay = (
    <motion.div
      key="tour-overlay"
      className="fixed inset-0 z-[9998]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <motion.rect
                initial={{ opacity: 0 }}
                animate={{
                  x: targetRect.x,
                  y: targetRect.y,
                  width: targetRect.width,
                  height: targetRect.height,
                  opacity: 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                rx={BORDER_RADIUS}
                ry={BORDER_RADIUS}
                fill="black"
              />
            )}
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-mask)"
        />

        {targetRect && (
          <motion.rect
            animate={{
              x: targetRect.x,
              y: targetRect.y,
              width: targetRect.width,
              height: targetRect.height,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            rx={BORDER_RADIUS}
            ry={BORDER_RADIUS}
            fill="none"
            stroke="rgba(99,102,241,0.5)"
            strokeWidth="2"
          />
        )}
      </svg>

      {targetRect && (
        <motion.div
          className="absolute rounded-xl"
          animate={{
            left: targetRect.x,
            top: targetRect.y,
            width: targetRect.width,
            height: targetRect.height,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ zIndex: 9999, pointerEvents: "none" }}
        >
          <motion.div
            className="absolute inset-0 rounded-xl ring-2 ring-indigo-400/40"
            animate={{ scale: [1, 1.03, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          className={
            isCentered
              ? "fixed inset-0 z-[10000] flex items-center justify-center"
              : "fixed z-[10000]"
          }
          style={
            isCentered
              ? undefined
              : { top: pos.top, left: pos.left }
          }
          initial={{ opacity: 0, scale: 0.95, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 6 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <div
            className={`rounded-2xl border border-white/20 bg-white shadow-2xl ${
              isCentered ? "w-[400px]" : ""
            }`}
            style={{ width: isCentered ? 400 : TOOLTIP_WIDTH }}
          >
            <div className="relative p-5">
              <button
                onClick={onSkip}
                className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close tour"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {(isWelcome || isComplete) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 25 }}
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50"
                >
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                </motion.div>
              )}

              <h3 className="pr-6 text-base font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {step.description}
              </p>

              {isPipelineStep && <PipelineFlowDiagram />}

              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-1">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="h-1.5 rounded-full"
                      animate={{
                        width: i === stepIndex ? 16 : 6,
                        backgroundColor:
                          i === stepIndex
                            ? "rgb(99,102,241)"
                            : i < stepIndex
                              ? "rgb(165,180,252)"
                              : "rgb(226,232,240)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {!isFirst && (
                    <button
                      onClick={onPrev}
                      className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Back
                    </button>
                  )}
                  {isFirst && (
                    <button
                      onClick={onSkip}
                      className="flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
                    >
                      Skip tour
                    </button>
                  )}
                  <button
                    onClick={onNext}
                    className="flex h-8 items-center gap-1 rounded-lg bg-indigo-500 px-3.5 text-xs font-medium text-white transition-colors hover:bg-indigo-600"
                  >
                    {isLast ? "Start Building" : isWelcome ? "Let's Go" : "Next"}
                    {!isLast && <ArrowRight className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );

  return createPortal(overlay, document.body);
}

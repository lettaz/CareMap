import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { buildTourSteps, type TourStep } from "./tour-steps";
import { TourOverlay } from "./tour-overlay";

const STORAGE_KEY = "caremap-tour-v1";

interface TourState {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  totalSteps: number;
  next: () => void;
  prev: () => void;
  skip: () => void;
  restart: () => void;
}

export const TourContext = createContext<TourState | null>(null);

function isCompleted(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return JSON.parse(raw).completed === true;
  } catch {
    return false;
  }
}

function markCompleted() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ completed: true, completedAt: new Date().toISOString() }),
  );
}

function clearCompleted() {
  localStorage.removeItem(STORAGE_KEY);
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigatingRef = useRef(false);

  const steps = useMemo(
    () => (projectId ? buildTourSteps(projectId) : []),
    [projectId],
  );

  useEffect(() => {
    if (projectId && !isCompleted()) {
      const timer = setTimeout(() => setIsActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, [projectId]);

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return;

      const step = steps[index];
      if (step.navigateTo) {
        navigatingRef.current = true;
        navigate(step.navigateTo);
        setTimeout(() => {
          setCurrentStep(index);
          navigatingRef.current = false;
        }, 300);
      } else {
        setCurrentStep(index);
      }
    },
    [steps, navigate],
  );

  const next = useCallback(() => {
    if (navigatingRef.current) return;
    const nextIdx = currentStep + 1;
    if (nextIdx >= steps.length) {
      setIsActive(false);
      markCompleted();
      return;
    }
    goToStep(nextIdx);
  }, [currentStep, steps.length, goToStep]);

  const prev = useCallback(() => {
    if (navigatingRef.current) return;
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const skip = useCallback(() => {
    setIsActive(false);
    markCompleted();
  }, []);

  const restart = useCallback(() => {
    clearCompleted();
    setCurrentStep(0);

    if (projectId) {
      navigate(`/projects/${projectId}/canvas`);
      setTimeout(() => setIsActive(true), 400);
    }
  }, [projectId, navigate]);

  const value = useMemo<TourState>(
    () => ({
      isActive,
      currentStep,
      steps,
      totalSteps: steps.length,
      next,
      prev,
      skip,
      restart,
    }),
    [isActive, currentStep, steps, next, prev, skip, restart],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {isActive && steps.length > 0 && (
        <TourOverlay
          step={steps[currentStep]}
          stepIndex={currentStep}
          totalSteps={steps.length}
          onNext={next}
          onPrev={prev}
          onSkip={skip}
        />
      )}
    </TourContext.Provider>
  );
}

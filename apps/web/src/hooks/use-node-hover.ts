import { useState, useCallback, useMemo, useRef } from "react";

const LEAVE_DELAY_MS = 200;

export function useNodeHover() {
  const [isHovered, setIsHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    setIsHovered(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => {
      setIsHovered(false);
      leaveTimer.current = null;
    }, LEAVE_DELAY_MS);
  }, []);

  const hoverProps = useMemo(
    () => ({ onMouseEnter, onMouseLeave }),
    [onMouseEnter, onMouseLeave],
  );

  return { isHovered, hoverProps } as const;
}

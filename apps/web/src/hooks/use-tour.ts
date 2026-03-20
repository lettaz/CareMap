import { useContext } from "react";
import { TourContext } from "@/components/onboarding/tour-provider";

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return ctx;
}

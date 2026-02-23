import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const consultationStatusConfig = {
  draft: {
    label: "Rascunho",
    className:
      "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  },
  transcribed: {
    label: "Transcrito",
    className:
      "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  reviewed: {
    label: "Revisado",
    className:
      "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  finalized: {
    label: "Finalizado",
    className:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
} as const;

export type ConsultationStatus = keyof typeof consultationStatusConfig;
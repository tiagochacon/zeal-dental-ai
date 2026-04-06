import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const consultationStatusConfig = {
  draft: {
    label: "Rascunho",
    className:
      "bg-transparent border border-white/10 text-foreground/80 hover:bg-white/5 shadow-sm gap-2 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-yellow-400 before:shadow-[0_0_8px_rgba(250,204,21,0.8)]",
  },
  transcribed: {
    label: "Transcrito",
    className:
      "bg-transparent border border-white/10 text-foreground/80 hover:bg-white/5 shadow-sm gap-2 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-blue-400 before:shadow-[0_0_8px_rgba(96,165,250,0.8)]",
  },
  reviewed: {
    label: "Revisado",
    className:
      "bg-transparent border border-white/10 text-foreground/80 hover:bg-white/5 shadow-sm gap-2 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-violet-400 before:shadow-[0_0_8px_rgba(167,139,250,0.8)]",
  },
  finalized: {
    label: "Finalizado",
    className:
      "bg-transparent border border-white/10 text-foreground/80 hover:bg-white/5 shadow-sm gap-2 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full before:bg-emerald-400 before:shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  },
} as const;

export type ConsultationStatus = keyof typeof consultationStatusConfig;

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
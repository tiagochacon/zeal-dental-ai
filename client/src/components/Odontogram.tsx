import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface OdontogramProps {
  affectedTeeth: string[];
  diagnoses?: string[];
}

// Dental notation mapping (FDI - Fédération Dentaire Internationale)
const UPPER_RIGHT = ["18", "17", "16", "15", "14", "13", "12", "11"];
const UPPER_LEFT = ["21", "22", "23", "24", "25", "26", "27", "28"];
const LOWER_LEFT = ["31", "32", "33", "34", "35", "36", "37", "38"];
const LOWER_RIGHT = ["48", "47", "46", "45", "44", "43", "42", "41"];

// Tooth names in Portuguese
const TOOTH_NAMES: Record<string, string> = {
  "11": "Incisivo Central Superior Direito",
  "12": "Incisivo Lateral Superior Direito",
  "13": "Canino Superior Direito",
  "14": "Primeiro Pré-Molar Superior Direito",
  "15": "Segundo Pré-Molar Superior Direito",
  "16": "Primeiro Molar Superior Direito",
  "17": "Segundo Molar Superior Direito",
  "18": "Terceiro Molar Superior Direito",
  "21": "Incisivo Central Superior Esquerdo",
  "22": "Incisivo Lateral Superior Esquerdo",
  "23": "Canino Superior Esquerdo",
  "24": "Primeiro Pré-Molar Superior Esquerdo",
  "25": "Segundo Pré-Molar Superior Esquerdo",
  "26": "Primeiro Molar Superior Esquerdo",
  "27": "Segundo Molar Superior Esquerdo",
  "28": "Terceiro Molar Superior Esquerdo",
  "31": "Incisivo Central Inferior Esquerdo",
  "32": "Incisivo Lateral Inferior Esquerdo",
  "33": "Canino Inferior Esquerdo",
  "34": "Primeiro Pré-Molar Inferior Esquerdo",
  "35": "Segundo Pré-Molar Inferior Esquerdo",
  "36": "Primeiro Molar Inferior Esquerdo",
  "37": "Segundo Molar Inferior Esquerdo",
  "38": "Terceiro Molar Inferior Esquerdo",
  "41": "Incisivo Central Inferior Direito",
  "42": "Incisivo Lateral Inferior Direito",
  "43": "Canino Inferior Direito",
  "44": "Primeiro Pré-Molar Inferior Direito",
  "45": "Segundo Pré-Molar Inferior Direito",
  "46": "Primeiro Molar Inferior Direito",
  "47": "Segundo Molar Inferior Direito",
  "48": "Terceiro Molar Inferior Direito",
};

function ToothIcon({ 
  number, 
  isAffected, 
  isMolar 
}: { 
  number: string; 
  isAffected: boolean; 
  isMolar: boolean;
}) {
  const baseClasses = "transition-all duration-200 cursor-pointer";
  const affectedClasses = isAffected 
    ? "fill-destructive/80 stroke-destructive" 
    : "fill-muted stroke-muted-foreground/50 hover:fill-muted-foreground/20";

  if (isMolar) {
    return (
      <svg viewBox="0 0 40 50" className={`w-8 h-10 ${baseClasses}`}>
        <path
          d={`M8 5 Q5 5 5 10 L5 40 Q5 45 10 45 L30 45 Q35 45 35 40 L35 10 Q35 5 30 5 Z`}
          className={affectedClasses}
          strokeWidth="2"
        />
        <text x="20" y="30" textAnchor="middle" className="fill-foreground text-[10px] font-medium">
          {number}
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 30 50" className={`w-6 h-10 ${baseClasses}`}>
      <path
        d={`M5 8 Q5 3 15 3 Q25 3 25 8 L25 42 Q25 47 15 47 Q5 47 5 42 Z`}
        className={affectedClasses}
        strokeWidth="2"
      />
      <text x="15" y="30" textAnchor="middle" className="fill-foreground text-[10px] font-medium">
        {number}
      </text>
    </svg>
  );
}

function ToothWithTooltip({ 
  number, 
  isAffected 
}: { 
  number: string; 
  isAffected: boolean;
}) {
  const isMolar = ["16", "17", "18", "26", "27", "28", "36", "37", "38", "46", "47", "48"].includes(number);
  const toothName = TOOTH_NAMES[number] || `Dente ${number}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <ToothIcon number={number} isAffected={isAffected} isMolar={isMolar} />
          {isAffected && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-pulse" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{toothName}</p>
        {isAffected && <p className="text-destructive text-xs">Afetado</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export default function Odontogram({ affectedTeeth, diagnoses }: OdontogramProps) {
  // Normalize affected teeth numbers (remove spaces, handle ranges)
  const normalizedAffected = affectedTeeth.flatMap(tooth => {
    const cleaned = tooth.toString().trim();
    // Handle ranges like "21-25"
    if (cleaned.includes("-")) {
      const [start, end] = cleaned.split("-").map(n => parseInt(n.trim()));
      const result: string[] = [];
      for (let i = start; i <= end; i++) {
        result.push(i.toString());
      }
      return result;
    }
    return [cleaned];
  });

  const isAffected = (tooth: string) => normalizedAffected.includes(tooth);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8 2 5 5 5 9c0 2 1 4 2 5l1 8h8l1-8c1-1 2-3 2-5 0-4-3-7-7-7z" />
            </svg>
            Odontograma
          </span>
          {normalizedAffected.length > 0 && (
            <Badge variant="destructive">
              {normalizedAffected.length} dente{normalizedAffected.length > 1 ? "s" : ""} afetado{normalizedAffected.length > 1 ? "s" : ""}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {normalizedAffected.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum dente afetado identificado na consulta</p>
            <p className="text-sm mt-1">Os dentes serão destacados conforme mencionados no áudio</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Upper Jaw */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-2">
                <span>Direito</span>
                <span className="flex-1 border-t border-dashed mx-2" />
                <span>Superior</span>
                <span className="flex-1 border-t border-dashed mx-2" />
                <span>Esquerdo</span>
              </div>
              <div className="flex justify-center gap-0.5">
                {UPPER_RIGHT.map(tooth => (
                  <ToothWithTooltip key={tooth} number={tooth} isAffected={isAffected(tooth)} />
                ))}
                <div className="w-4" /> {/* Center gap */}
                {UPPER_LEFT.map(tooth => (
                  <ToothWithTooltip key={tooth} number={tooth} isAffected={isAffected(tooth)} />
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-muted-foreground/30 relative">
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                Linha Oclusal
              </span>
            </div>

            {/* Lower Jaw */}
            <div className="space-y-2">
              <div className="flex justify-center gap-0.5">
                {LOWER_RIGHT.map(tooth => (
                  <ToothWithTooltip key={tooth} number={tooth} isAffected={isAffected(tooth)} />
                ))}
                <div className="w-4" /> {/* Center gap */}
                {LOWER_LEFT.map(tooth => (
                  <ToothWithTooltip key={tooth} number={tooth} isAffected={isAffected(tooth)} />
                ))}
              </div>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                <span>Direito</span>
                <span className="flex-1 border-t border-dashed mx-2" />
                <span>Inferior</span>
                <span className="flex-1 border-t border-dashed mx-2" />
                <span>Esquerdo</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-muted border border-muted-foreground/30" />
                <span className="text-xs text-muted-foreground">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-destructive/80 border border-destructive" />
                <span className="text-xs text-muted-foreground">Afetado</span>
              </div>
            </div>

            {/* Affected teeth list */}
            {normalizedAffected.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 mt-4">
                <p className="text-sm font-medium mb-2">Dentes identificados:</p>
                <div className="flex flex-wrap gap-2">
                  {normalizedAffected.map(tooth => (
                    <Badge key={tooth} variant="outline" className="bg-destructive/10 border-destructive/30">
                      {tooth} - {TOOTH_NAMES[tooth]?.split(" ").slice(0, 2).join(" ") || `Dente ${tooth}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

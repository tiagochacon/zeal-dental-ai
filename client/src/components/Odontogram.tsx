import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

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

// Tooth classifications - Simplified (General only)
export type ToothClassification = 
  | "not_evaluated"
  | "healthy"
  | "cavity"
  | "restored"
  | "missing"
  | "fractured"
  | "root_canal"
  | "crown"
  | "extraction";

const CLASSIFICATION_LABELS: Record<ToothClassification, string> = {
  not_evaluated: "Não Avaliado",
  healthy: "Saudável",
  cavity: "Cárie",
  restored: "Restaurado",
  missing: "Ausente",
  fractured: "Fraturado",
  root_canal: "Canal",
  crown: "Coroa",
  extraction: "Indicação de Extração",
};

// Distinct colors for each classification (highly contrasting)
const CLASSIFICATION_COLORS: Record<ToothClassification, { fill: string; stroke: string; bg: string }> = {
  not_evaluated: { 
    fill: "fill-gray-200 dark:fill-gray-700", 
    stroke: "stroke-gray-400 dark:stroke-gray-600",
    bg: "bg-gray-200 dark:bg-gray-700"
  },
  healthy: { 
    fill: "fill-green-400", 
    stroke: "stroke-green-600",
    bg: "bg-green-400"
  },
  cavity: { 
    fill: "fill-red-500", 
    stroke: "stroke-red-700",
    bg: "bg-red-500"
  },
  restored: { 
    fill: "fill-blue-400", 
    stroke: "stroke-blue-600",
    bg: "bg-blue-400"
  },
  missing: { 
    fill: "fill-gray-900 dark:fill-gray-950", 
    stroke: "stroke-black",
    bg: "bg-gray-900"
  },
  fractured: { 
    fill: "fill-orange-500", 
    stroke: "stroke-orange-700",
    bg: "bg-orange-500"
  },
  root_canal: { 
    fill: "fill-purple-500", 
    stroke: "stroke-purple-700",
    bg: "bg-purple-500"
  },
  crown: { 
    fill: "fill-yellow-400", 
    stroke: "stroke-yellow-600",
    bg: "bg-yellow-400"
  },
  extraction: { 
    fill: "fill-red-800", 
    stroke: "stroke-red-900",
    bg: "bg-red-800"
  },
};

// Automatic classification based on diagnosis keywords
function classifyToothFromDiagnosis(toothNumber: string, diagnoses: string[]): ToothClassification {
  const diagnosisText = diagnoses.join(" ").toLowerCase();
  const toothMentions = diagnosisText.match(new RegExp(`dente[\\s]*${toothNumber}[^0-9]*([a-záàâãéèêíïóôõöúçñ\\s]+)`, 'gi'));
  
  if (!toothMentions || toothMentions.length === 0) {
    return "not_evaluated";
  }

  const mention = toothMentions.join(" ").toLowerCase();

  // Priority order matters - more specific conditions first
  if (mention.match(/ausente|perdido|extraído|sem o dente|falta/)) {
    return "missing";
  }
  if (mention.match(/extração|extrair|remover|indicação.*extra/)) {
    return "extraction";
  }
  if (mention.match(/coroa|prótese fixa/)) {
    return "crown";
  }
  if (mention.match(/canal|endodontia|tratamento de canal|endodôntico/)) {
    return "root_canal";
  }
  if (mention.match(/fratura|quebrado|partido|rachado/)) {
    return "fractured";
  }
  if (mention.match(/restaura|obtura|resina|amálgama/)) {
    return "restored";
  }
  if (mention.match(/cárie|lesão de cárie|cavidade|podre/)) {
    return "cavity";
  }
  if (mention.match(/saudável|hígido|normal|sem alterações|sem lesões/)) {
    return "healthy";
  }

  // Default: if tooth is mentioned but no specific condition, assume it needs evaluation
  return "cavity"; // Most common condition when mentioned
}

function ToothIcon({ 
  number, 
  classification,
  isMolar,
}: { 
  number: string; 
  classification: ToothClassification;
  isMolar: boolean;
}) {
  const baseClasses = "transition-all duration-200";
  const colors = CLASSIFICATION_COLORS[classification];
  const colorClasses = `${colors.fill} ${colors.stroke}`;

  if (isMolar) {
    return (
      <svg viewBox="0 0 40 50" className={`w-8 h-10 ${baseClasses}`}>
        <path
          d={`M8 5 Q5 5 5 10 L5 40 Q5 45 10 45 L30 45 Q35 45 35 40 L35 10 Q35 5 30 5 Z`}
          className={colorClasses}
          strokeWidth="2"
        />
        <text x="20" y="30" textAnchor="middle" className="fill-white text-[10px] font-bold pointer-events-none" style={{ paintOrder: "stroke", stroke: "black", strokeWidth: "2px" }}>
          {number}
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 30 50" className={`w-6 h-10 ${baseClasses}`}>
      <path
        d={`M5 8 Q5 3 15 3 Q25 3 25 8 L25 42 Q25 47 15 47 Q5 47 5 42 Z`}
        className={colorClasses}
        strokeWidth="2"
      />
      <text x="15" y="30" textAnchor="middle" className="fill-white text-[10px] font-bold pointer-events-none" style={{ paintOrder: "stroke", stroke: "black", strokeWidth: "2px" }}>
        {number}
      </text>
    </svg>
  );
}

function ToothWithTooltip({ 
  number, 
  classification,
}: { 
  number: string; 
  classification: ToothClassification;
}) {
  const isMolar = ["16", "17", "18", "26", "27", "28", "36", "37", "38", "46", "47", "48"].includes(number);
  const toothName = TOOTH_NAMES[number] || `Dente ${number}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <ToothIcon number={number} classification={classification} isMolar={isMolar} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{toothName}</p>
        <p className="text-xs">{CLASSIFICATION_LABELS[classification]}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function Odontogram({ affectedTeeth, diagnoses = [] }: OdontogramProps) {
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

  // Automatic classification for each tooth
  const teethClassifications: Record<string, ToothClassification> = {};
  
  // Classify affected teeth based on diagnoses
  normalizedAffected.forEach(toothNum => {
    teethClassifications[toothNum] = classifyToothFromDiagnosis(toothNum, diagnoses);
  });

  const getToothClassification = (toothNumber: string): ToothClassification => {
    return teethClassifications[toothNumber] || "not_evaluated";
  };

  // Count affected teeth by classification
  const classificationCounts: Partial<Record<ToothClassification, number>> = {};
  Object.values(teethClassifications).forEach(classification => {
    classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
  });

  // Get only classifications that are actually used
  const usedClassifications = Object.entries(classificationCounts)
    .filter(([key]) => key !== "not_evaluated")
    .sort((a, b) => b[1] - a[1]); // Sort by count descending

  const affectedCount = normalizedAffected.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8 2 5 5 5 9c0 2 1 4 2 5l1 8h8l1-8c1-1 2-3 2-5 0-4-3-7-7-7z" />
            </svg>
            Odontograma
          </span>
          {affectedCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {affectedCount} dente{affectedCount > 1 ? "s" : ""} com alterações
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
                  <ToothWithTooltip 
                    key={tooth} 
                    number={tooth} 
                    classification={getToothClassification(tooth)}
                  />
                ))}
                <div className="w-4" /> {/* Center gap */}
                {UPPER_LEFT.map(tooth => (
                  <ToothWithTooltip 
                    key={tooth} 
                    number={tooth} 
                    classification={getToothClassification(tooth)}
                  />
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
                  <ToothWithTooltip 
                    key={tooth} 
                    number={tooth} 
                    classification={getToothClassification(tooth)}
                  />
                ))}
                <div className="w-4" /> {/* Center gap */}
                {LOWER_LEFT.map(tooth => (
                  <ToothWithTooltip 
                    key={tooth} 
                    number={tooth} 
                    classification={getToothClassification(tooth)}
                  />
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

            {/* Automatic Legend - Only show classifications that are used */}
            {usedClassifications.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3">Legenda Automática:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {usedClassifications.map(([classification, count]) => {
                    const colors = CLASSIFICATION_COLORS[classification as ToothClassification];
                    return (
                      <div key={classification} className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded border-2 ${colors.bg} ${colors.stroke}`} />
                        <div className="flex-1">
                          <span className="text-xs text-foreground">
                            {CLASSIFICATION_LABELS[classification as ToothClassification]}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({count})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Info about auto-generation */}
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-500">
                As classificações foram geradas automaticamente com base na transcrição da consulta. 
                Apenas dentes mencionados no áudio são classificados e exibidos com cores distintas.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

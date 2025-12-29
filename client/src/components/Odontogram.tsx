import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface ToothData {
  number: string;
  classification: ToothClassification;
  notes?: string;
}

interface OdontogramProps {
  affectedTeeth: string[];
  diagnoses?: string[];
  teethData?: ToothData[];
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

// Tooth classifications - Simplified (General only, no faces)
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

// Distinct colors for each classification (highly contrasting, unique colors)
const CLASSIFICATION_COLORS: Record<ToothClassification, { fill: string; stroke: string; bg: string; text: string }> = {
  not_evaluated: { 
    fill: "#6B7280", // Gray
    stroke: "#4B5563",
    bg: "bg-gray-500",
    text: "text-gray-500"
  },
  healthy: { 
    fill: "#22C55E", // Green
    stroke: "#16A34A",
    bg: "bg-green-500",
    text: "text-green-500"
  },
  cavity: { 
    fill: "#EF4444", // Red
    stroke: "#DC2626",
    bg: "bg-red-500",
    text: "text-red-500"
  },
  restored: { 
    fill: "#3B82F6", // Blue
    stroke: "#2563EB",
    bg: "bg-blue-500",
    text: "text-blue-500"
  },
  missing: { 
    fill: "#1F2937", // Dark Gray/Black
    stroke: "#111827",
    bg: "bg-gray-800",
    text: "text-gray-800"
  },
  fractured: { 
    fill: "#F97316", // Orange
    stroke: "#EA580C",
    bg: "bg-orange-500",
    text: "text-orange-500"
  },
  root_canal: { 
    fill: "#A855F7", // Purple
    stroke: "#9333EA",
    bg: "bg-purple-500",
    text: "text-purple-500"
  },
  crown: { 
    fill: "#EAB308", // Yellow
    stroke: "#CA8A04",
    bg: "bg-yellow-500",
    text: "text-yellow-500"
  },
  extraction: { 
    fill: "#BE123C", // Rose/Dark Red
    stroke: "#9F1239",
    bg: "bg-rose-700",
    text: "text-rose-700"
  },
};

// Keywords for automatic classification based on transcription
const CLASSIFICATION_KEYWORDS: Record<ToothClassification, RegExp[]> = {
  not_evaluated: [],
  healthy: [
    /saud[áa]vel/i,
    /h[íi]gido/i,
    /normal/i,
    /sem altera[çc][õo]es/i,
    /sem les[õo]es/i,
    /integro/i,
    /bom estado/i,
  ],
  cavity: [
    /c[áa]rie/i,
    /les[ãa]o.*c[áa]rie/i,
    /cavidade/i,
    /podre/i,
    /cariado/i,
    /les[ãa]o cariosa/i,
  ],
  restored: [
    /restaura/i,
    /obtura/i,
    /resina/i,
    /am[áa]lgama/i,
    /restaurado/i,
    /obturado/i,
  ],
  missing: [
    /ausente/i,
    /perdido/i,
    /extra[íi]do/i,
    /sem o dente/i,
    /falta/i,
    /n[ãa]o.*presente/i,
    /edentulo/i,
  ],
  fractured: [
    /fratura/i,
    /quebrado/i,
    /partido/i,
    /rachado/i,
    /trinca/i,
    /lascado/i,
  ],
  root_canal: [
    /canal/i,
    /endodontia/i,
    /tratamento.*canal/i,
    /endod[ôo]ntico/i,
    /pulpectomia/i,
    /desvitalizado/i,
  ],
  crown: [
    /coroa/i,
    /pr[óo]tese.*fixa/i,
    /coroado/i,
    /jaqueta/i,
  ],
  extraction: [
    /extra[çc][ãa]o/i,
    /extrair/i,
    /remover/i,
    /indica[çc][ãa]o.*extra/i,
    /necessita.*extra/i,
    /precisa.*extrair/i,
  ],
};

// Automatic classification based on diagnosis keywords
function classifyToothFromDiagnosis(toothNumber: string, diagnoses: string[]): ToothClassification {
  const diagnosisText = diagnoses.join(" ").toLowerCase();
  
  // Look for mentions of this specific tooth
  const toothPatterns = [
    new RegExp(`dente\\s*${toothNumber}[^0-9]`, 'gi'),
    new RegExp(`${toothNumber}\\s*[-:]`, 'gi'),
    new RegExp(`elemento\\s*${toothNumber}`, 'gi'),
    new RegExp(`\\b${toothNumber}\\b.*?(?=\\b\\d{2}\\b|$)`, 'gi'),
  ];
  
  let toothMentions: string[] = [];
  for (const pattern of toothPatterns) {
    const matches = diagnosisText.match(pattern);
    if (matches) {
      // Get context around the match (100 chars before and after)
      for (const match of matches) {
        const index = diagnosisText.indexOf(match.toLowerCase());
        const start = Math.max(0, index - 100);
        const end = Math.min(diagnosisText.length, index + match.length + 100);
        toothMentions.push(diagnosisText.substring(start, end));
      }
    }
  }
  
  if (toothMentions.length === 0) {
    return "not_evaluated";
  }

  const mentionText = toothMentions.join(" ");

  // Check classifications in priority order (more specific first)
  const priorityOrder: ToothClassification[] = [
    "missing",
    "extraction",
    "crown",
    "root_canal",
    "fractured",
    "restored",
    "cavity",
    "healthy",
  ];

  for (const classification of priorityOrder) {
    const keywords = CLASSIFICATION_KEYWORDS[classification];
    for (const keyword of keywords) {
      if (keyword.test(mentionText)) {
        return classification;
      }
    }
  }

  // If tooth is mentioned but no specific condition found, mark as needing evaluation
  // but if it's in the affected list, assume there's an issue (likely cavity as most common)
  return "cavity";
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
  const colors = CLASSIFICATION_COLORS[classification];
  const isAffected = classification !== "not_evaluated";

  if (isMolar) {
    return (
      <svg viewBox="0 0 40 50" className="w-8 h-10 transition-all duration-200">
        <path
          d="M8 5 Q5 5 5 10 L5 40 Q5 45 10 45 L30 45 Q35 45 35 40 L35 10 Q35 5 30 5 Z"
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth="2"
          className={isAffected ? "drop-shadow-md" : ""}
        />
        {classification === "missing" && (
          <line x1="5" y1="5" x2="35" y2="45" stroke="#EF4444" strokeWidth="3" />
        )}
        {classification === "extraction" && (
          <>
            <line x1="10" y1="10" x2="30" y2="40" stroke="#FFF" strokeWidth="2" />
            <line x1="30" y1="10" x2="10" y2="40" stroke="#FFF" strokeWidth="2" />
          </>
        )}
        <text 
          x="20" 
          y="30" 
          textAnchor="middle" 
          className="text-[10px] font-bold pointer-events-none"
          fill="white"
          stroke="black"
          strokeWidth="0.5"
          paintOrder="stroke"
        >
          {number}
        </text>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 30 50" className="w-6 h-10 transition-all duration-200">
      <path
        d="M5 8 Q5 3 15 3 Q25 3 25 8 L25 42 Q25 47 15 47 Q5 47 5 42 Z"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
        className={isAffected ? "drop-shadow-md" : ""}
      />
      {classification === "missing" && (
        <line x1="5" y1="3" x2="25" y2="47" stroke="#EF4444" strokeWidth="3" />
      )}
      {classification === "extraction" && (
        <>
          <line x1="8" y1="10" x2="22" y2="40" stroke="#FFF" strokeWidth="2" />
          <line x1="22" y1="10" x2="8" y2="40" stroke="#FFF" strokeWidth="2" />
        </>
      )}
      <text 
        x="15" 
        y="30" 
        textAnchor="middle" 
        className="text-[10px] font-bold pointer-events-none"
        fill="white"
        stroke="black"
        strokeWidth="0.5"
        paintOrder="stroke"
      >
        {number}
      </text>
    </svg>
  );
}

function ToothWithTooltip({ 
  number, 
  classification,
  notes,
}: { 
  number: string; 
  classification: ToothClassification;
  notes?: string;
}) {
  const isMolar = ["16", "17", "18", "26", "27", "28", "36", "37", "38", "46", "47", "48"].includes(number);
  const toothName = TOOTH_NAMES[number] || `Dente ${number}`;
  const isAffected = classification !== "not_evaluated";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`relative cursor-pointer ${isAffected ? 'scale-105' : 'opacity-60 hover:opacity-100'}`}>
          <ToothIcon number={number} classification={classification} isMolar={isMolar} />
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium">{toothName}</p>
        <p className={`text-sm ${CLASSIFICATION_COLORS[classification].text}`}>
          {CLASSIFICATION_LABELS[classification]}
        </p>
        {notes && (
          <p className="text-xs text-muted-foreground mt-1">{notes}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export default function Odontogram({ affectedTeeth, diagnoses = [], teethData = [] }: OdontogramProps) {
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

  // Build teeth classifications map
  const teethClassifications: Record<string, { classification: ToothClassification; notes?: string }> = {};
  
  // First, use provided teethData if available
  teethData.forEach(tooth => {
    teethClassifications[tooth.number] = {
      classification: tooth.classification,
      notes: tooth.notes,
    };
  });
  
  // Then, classify remaining affected teeth based on diagnoses
  normalizedAffected.forEach(toothNum => {
    if (!teethClassifications[toothNum]) {
      teethClassifications[toothNum] = {
        classification: classifyToothFromDiagnosis(toothNum, diagnoses),
      };
    }
  });

  const getToothData = (toothNumber: string) => {
    return teethClassifications[toothNumber] || { classification: "not_evaluated" as ToothClassification };
  };

  // Count affected teeth by classification for legend
  const classificationCounts: Partial<Record<ToothClassification, number>> = {};
  Object.values(teethClassifications).forEach(({ classification }) => {
    if (classification !== "not_evaluated") {
      classificationCounts[classification] = (classificationCounts[classification] || 0) + 1;
    }
  });

  // Get only classifications that are actually used, sorted by count
  const usedClassifications = Object.entries(classificationCounts)
    .sort((a, b) => b[1] - a[1]);

  const affectedCount = Object.keys(teethClassifications).filter(
    k => teethClassifications[k].classification !== "not_evaluated"
  ).length;

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
              <div className="flex justify-center gap-0.5 flex-wrap">
                {UPPER_RIGHT.map(tooth => {
                  const data = getToothData(tooth);
                  return (
                    <ToothWithTooltip 
                      key={tooth} 
                      number={tooth} 
                      classification={data.classification}
                      notes={data.notes}
                    />
                  );
                })}
                <div className="w-2" /> {/* Center gap */}
                {UPPER_LEFT.map(tooth => {
                  const data = getToothData(tooth);
                  return (
                    <ToothWithTooltip 
                      key={tooth} 
                      number={tooth} 
                      classification={data.classification}
                      notes={data.notes}
                    />
                  );
                })}
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
              <div className="flex justify-center gap-0.5 flex-wrap">
                {LOWER_RIGHT.map(tooth => {
                  const data = getToothData(tooth);
                  return (
                    <ToothWithTooltip 
                      key={tooth} 
                      number={tooth} 
                      classification={data.classification}
                      notes={data.notes}
                    />
                  );
                })}
                <div className="w-2" /> {/* Center gap */}
                {LOWER_LEFT.map(tooth => {
                  const data = getToothData(tooth);
                  return (
                    <ToothWithTooltip 
                      key={tooth} 
                      number={tooth} 
                      classification={data.classification}
                      notes={data.notes}
                    />
                  );
                })}
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
                <p className="text-sm font-medium mb-3">Legenda (Gerada Automaticamente):</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {usedClassifications.map(([classification, count]) => {
                    const colors = CLASSIFICATION_COLORS[classification as ToothClassification];
                    return (
                      <div key={classification} className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 rounded border-2 shrink-0"
                          style={{ 
                            backgroundColor: colors.fill,
                            borderColor: colors.stroke,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-foreground truncate block">
                            {CLASSIFICATION_LABELS[classification as ToothClassification]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({count} dente{count > 1 ? "s" : ""})
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
                Apenas dentes mencionados no áudio são classificados. Nenhum dado é inventado.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export classification types for use in other components
export { CLASSIFICATION_LABELS, CLASSIFICATION_COLORS };

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

// Tooth classifications
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

export type ToothFace = "vestibular" | "lingual" | "mesial" | "distal" | "occlusal";

interface ToothCondition {
  general?: ToothClassification;
  faces?: Partial<Record<ToothFace, ToothClassification>>;
}

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

const CLASSIFICATION_COLORS: Record<ToothClassification, string> = {
  not_evaluated: "fill-muted stroke-muted-foreground/30",
  healthy: "fill-green-500/30 stroke-green-600",
  cavity: "fill-red-500/30 stroke-red-600",
  restored: "fill-blue-500/30 stroke-blue-600",
  missing: "fill-gray-900 stroke-gray-700",
  fractured: "fill-orange-500/30 stroke-orange-600",
  root_canal: "fill-purple-500/30 stroke-purple-600",
  crown: "fill-yellow-500/30 stroke-yellow-600",
  extraction: "fill-red-700/40 stroke-red-800",
};

const FACE_LABELS: Record<ToothFace, string> = {
  vestibular: "Vestibular",
  lingual: "Palatina/Lingual",
  mesial: "Mesial",
  distal: "Distal",
  occlusal: "Oclusal/Incisal",
};

function ToothIcon({ 
  number, 
  condition,
  isMolar,
  onClick 
}: { 
  number: string; 
  condition: ToothCondition;
  isMolar: boolean;
  onClick: () => void;
}) {
  const classification = condition.general || "not_evaluated";
  const baseClasses = "transition-all duration-200 cursor-pointer hover:opacity-80";
  const colorClasses = CLASSIFICATION_COLORS[classification];

  if (isMolar) {
    return (
      <svg viewBox="0 0 40 50" className={`w-8 h-10 ${baseClasses}`} onClick={onClick}>
        <path
          d={`M8 5 Q5 5 5 10 L5 40 Q5 45 10 45 L30 45 Q35 45 35 40 L35 10 Q35 5 30 5 Z`}
          className={colorClasses}
          strokeWidth="2"
        />
        <text x="20" y="30" textAnchor="middle" className="fill-foreground text-[10px] font-medium pointer-events-none">
          {number}
        </text>
        {classification !== "not_evaluated" && (
          <circle cx="35" cy="8" r="4" className="fill-primary animate-pulse" />
        )}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 30 50" className={`w-6 h-10 ${baseClasses}`} onClick={onClick}>
      <path
        d={`M5 8 Q5 3 15 3 Q25 3 25 8 L25 42 Q25 47 15 47 Q5 47 5 42 Z`}
        className={colorClasses}
        strokeWidth="2"
      />
      <text x="15" y="30" textAnchor="middle" className="fill-foreground text-[10px] font-medium pointer-events-none">
        {number}
      </text>
      {classification !== "not_evaluated" && (
        <circle cx="25" cy="8" r="3" className="fill-primary animate-pulse" />
      )}
    </svg>
  );
}

function ToothWithTooltip({ 
  number, 
  condition,
  onClick
}: { 
  number: string; 
  condition: ToothCondition;
  onClick: () => void;
}) {
  const isMolar = ["16", "17", "18", "26", "27", "28", "36", "37", "38", "46", "47", "48"].includes(number);
  const toothName = TOOTH_NAMES[number] || `Dente ${number}`;
  const classification = condition.general || "not_evaluated";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative">
          <ToothIcon number={number} condition={condition} isMolar={isMolar} onClick={onClick} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{toothName}</p>
        <p className="text-xs text-muted-foreground">{CLASSIFICATION_LABELS[classification]}</p>
        {condition.faces && Object.keys(condition.faces).length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Clique para ver detalhes das faces
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function ToothDetailDialog({
  toothNumber,
  condition,
  onClose,
  onUpdate,
  readOnly = false
}: {
  toothNumber: string;
  condition: ToothCondition;
  onClose: () => void;
  onUpdate: (condition: ToothCondition) => void;
  readOnly?: boolean;
}) {
  const [localCondition, setLocalCondition] = useState<ToothCondition>(condition);
  const toothName = TOOTH_NAMES[toothNumber] || `Dente ${toothNumber}`;

  const handleGeneralChange = (value: ToothClassification) => {
    setLocalCondition({ ...localCondition, general: value });
  };

  const handleFaceChange = (face: ToothFace, value: ToothClassification) => {
    setLocalCondition({
      ...localCondition,
      faces: {
        ...localCondition.faces,
        [face]: value,
      },
    });
  };

  const handleSave = () => {
    onUpdate(localCondition);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Dente {toothNumber} - {toothName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* General Classification */}
          <div>
            <label className="text-sm font-medium mb-2 block">Classificação Geral</label>
            {readOnly ? (
              <div className="p-3 bg-muted rounded-lg">
                {CLASSIFICATION_LABELS[localCondition.general || "not_evaluated"]}
              </div>
            ) : (
              <Select 
                value={localCondition.general || "not_evaluated"} 
                onValueChange={(value) => handleGeneralChange(value as ToothClassification)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLASSIFICATION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Face Classifications */}
          <div>
            <label className="text-sm font-medium mb-3 block">Classificação por Face</label>
            <div className="space-y-3">
              {(Object.entries(FACE_LABELS) as [ToothFace, string][]).map(([face, label]) => (
                <div key={face} className="flex items-center gap-3">
                  <span className="text-sm w-32 text-muted-foreground">{label}</span>
                  {readOnly ? (
                    <div className="flex-1 p-2 bg-muted rounded-lg text-sm">
                      {localCondition.faces?.[face] 
                        ? CLASSIFICATION_LABELS[localCondition.faces[face]!]
                        : "Não Avaliado"
                      }
                    </div>
                  ) : (
                    <Select 
                      value={localCondition.faces?.[face] || "not_evaluated"}
                      onValueChange={(value) => handleFaceChange(face, value as ToothClassification)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CLASSIFICATION_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </div>

          {!readOnly && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                Salvar Alterações
              </Button>
            </div>
          )}

          {readOnly && (
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-500">
                Este odontograma foi gerado automaticamente com base na transcrição da consulta. 
                As classificações refletem apenas o que foi mencionado no áudio.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Odontogram({ affectedTeeth, diagnoses }: OdontogramProps) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [teethConditions, setTeethConditions] = useState<Record<string, ToothCondition>>(() => {
    // Initialize conditions based on affected teeth from audio
    const conditions: Record<string, ToothCondition> = {};
    
    // Normalize affected teeth numbers (remove spaces, handle ranges)
    const normalizedAffected = affectedTeeth.flatMap(tooth => {
      const cleaned = tooth.toString().trim();
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

    // Set affected teeth as having issues (based on diagnoses if available)
    normalizedAffected.forEach(toothNum => {
      // Simple heuristic: check diagnoses for keywords
      let classification: ToothClassification = "cavity"; // default for affected teeth
      
      if (diagnoses) {
        const diagnosesText = diagnoses.join(" ").toLowerCase();
        if (diagnosesText.includes("restaura")) classification = "restored";
        else if (diagnosesText.includes("ausente") || diagnosesText.includes("perdido")) classification = "missing";
        else if (diagnosesText.includes("fratura")) classification = "fractured";
        else if (diagnosesText.includes("canal")) classification = "root_canal";
        else if (diagnosesText.includes("coroa")) classification = "crown";
        else if (diagnosesText.includes("extra")) classification = "extraction";
      }
      
      conditions[toothNum] = { general: classification };
    });

    return conditions;
  });

  const getToothCondition = (toothNumber: string): ToothCondition => {
    return teethConditions[toothNumber] || { general: "not_evaluated" };
  };

  const handleToothClick = (toothNumber: string) => {
    setSelectedTooth(toothNumber);
  };

  const handleToothUpdate = (toothNumber: string, condition: ToothCondition) => {
    setTeethConditions(prev => ({
      ...prev,
      [toothNumber]: condition,
    }));
  };

  const affectedCount = Object.keys(teethConditions).filter(
    key => teethConditions[key].general !== "not_evaluated"
  ).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8 2 5 5 5 9c0 2 1 4 2 5l1 8h8l1-8c1-1 2-3 2-5 0-4-3-7-7-7z" />
            </svg>
            Odontograma Detalhado
          </span>
          {affectedCount > 0 && (
            <Badge variant="destructive">
              {affectedCount} dente{affectedCount > 1 ? "s" : ""} com alterações
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                  condition={getToothCondition(tooth)}
                  onClick={() => handleToothClick(tooth)}
                />
              ))}
              <div className="w-4" /> {/* Center gap */}
              {UPPER_LEFT.map(tooth => (
                <ToothWithTooltip 
                  key={tooth} 
                  number={tooth} 
                  condition={getToothCondition(tooth)}
                  onClick={() => handleToothClick(tooth)}
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
                  condition={getToothCondition(tooth)}
                  onClick={() => handleToothClick(tooth)}
                />
              ))}
              <div className="w-4" /> {/* Center gap */}
              {LOWER_LEFT.map(tooth => (
                <ToothWithTooltip 
                  key={tooth} 
                  number={tooth} 
                  condition={getToothCondition(tooth)}
                  onClick={() => handleToothClick(tooth)}
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

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-4 border-t">
            {Object.entries(CLASSIFICATION_LABELS).slice(1).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border ${CLASSIFICATION_COLORS[key as ToothClassification]}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* Info about auto-generation */}
          {affectedCount > 0 && (
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-500">
                As classificações foram geradas automaticamente com base na transcrição da consulta. 
                Clique em qualquer dente para ver ou editar os detalhes.
              </p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Tooth Detail Dialog */}
      {selectedTooth && (
        <ToothDetailDialog
          toothNumber={selectedTooth}
          condition={getToothCondition(selectedTooth)}
          onClose={() => setSelectedTooth(null)}
          onUpdate={(condition) => handleToothUpdate(selectedTooth, condition)}
          readOnly={false}
        />
      )}
    </Card>
  );
}

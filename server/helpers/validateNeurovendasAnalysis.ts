/**
 * Validação pós-parse não-bloqueante para análises de Neurovendas.
 * 
 * Verifica campos obrigatórios e valores de enums categóricos,
 * logando warnings sem bloquear a resposta ao usuário.
 */

// Enums válidos conforme documentação de metodologia do Dr. Carlos Rodriguez
export const VALID_ENUMS = {
  nivelCerebralDominante: ["neocortex", "limbico", "reptiliano"],
  motivacaoPrimaria: ["alivio_dor", "estetica", "status", "saude"],
  gatilhoMentalNome: ["transformacao", "saude_longevidade", "status", "conforto", "exclusividade"],
  categoriaObjecao: ["financeira", "medo", "tempo", "confianca", "outra"],
  tecnicaObjecaoTipo: ["LAER", "redirecionamento"],
} as const;

export const REQUIRED_TOP_LEVEL_FIELDS = [
  "perfilPsicografico",
  "objecoes",
  "sinaisLinguagem",
  "gatilhosMentais",
  "scriptPARE",
  "tecnicaObjecao",
  "rapport",
] as const;

export const RAPPORT_BREAKDOWN_FIELDS = [
  "validacaoEmocional",
  "espelhamentoLinguistico",
  "escutaAtiva",
  "equilibrioTurnos",
  "ausenciaInterrupcoes",
] as const;

export interface ValidationWarning {
  field: string;
  issue: string;
  value?: unknown;
}

/**
 * Validates a neurovendas analysis object returned by the LLM.
 * Returns an array of warnings (empty if everything is valid).
 * NEVER throws — validation is non-blocking.
 */
export function validateNeurovendasAnalysis(
  analysis: Record<string, unknown>,
  context: "consulta" | "crc"
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const prefix = context === "consulta" ? "[Neurovendas Consulta]" : "[Neurovendas CRC]";

  try {
    // 1. Check required top-level fields
    for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
      if (!analysis[field]) {
        warnings.push({ field, issue: "Campo obrigatório ausente" });
      }
    }

    // 2. Validate perfilPsicografico enums
    const perfil = analysis.perfilPsicografico as Record<string, unknown> | undefined;
    if (perfil) {
      if (perfil.nivelCerebralDominante && !(VALID_ENUMS.nivelCerebralDominante as readonly string[]).includes(perfil.nivelCerebralDominante as string)) {
        warnings.push({
          field: "perfilPsicografico.nivelCerebralDominante",
          issue: `Valor fora do enum permitido: ${VALID_ENUMS.nivelCerebralDominante.join(", ")}`,
          value: perfil.nivelCerebralDominante,
        });
      }
      if (perfil.motivacaoPrimaria && !(VALID_ENUMS.motivacaoPrimaria as readonly string[]).includes(perfil.motivacaoPrimaria as string)) {
        warnings.push({
          field: "perfilPsicografico.motivacaoPrimaria",
          issue: `Valor fora do enum permitido: ${VALID_ENUMS.motivacaoPrimaria.join(", ")}`,
          value: perfil.motivacaoPrimaria,
        });
      }
      // Validate numeric ranges
      if (typeof perfil.nivelAnsiedade === "number" && (perfil.nivelAnsiedade < 0 || perfil.nivelAnsiedade > 10)) {
        warnings.push({
          field: "perfilPsicografico.nivelAnsiedade",
          issue: "Valor fora do range esperado (0-10)",
          value: perfil.nivelAnsiedade,
        });
      }
      if (typeof perfil.nivelReceptividade === "number" && (perfil.nivelReceptividade < 0 || perfil.nivelReceptividade > 10)) {
        warnings.push({
          field: "perfilPsicografico.nivelReceptividade",
          issue: "Valor fora do range esperado (0-10)",
          value: perfil.nivelReceptividade,
        });
      }
    }

    // 3. Validate gatilhosMentais enum values
    const gatilhos = analysis.gatilhosMentais as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(gatilhos)) {
      for (let i = 0; i < gatilhos.length; i++) {
        const g = gatilhos[i];
        if (g.nome && !(VALID_ENUMS.gatilhoMentalNome as readonly string[]).includes(g.nome as string)) {
          warnings.push({
            field: `gatilhosMentais[${i}].nome`,
            issue: `Valor fora do enum permitido: ${VALID_ENUMS.gatilhoMentalNome.join(", ")}`,
            value: g.nome,
          });
        }
      }
    }

    // 4. Validate objecoes categorias
    const objecoes = analysis.objecoes as Record<string, unknown> | undefined;
    if (objecoes) {
      const verdadeiras = objecoes.verdadeiras as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(verdadeiras)) {
        for (let i = 0; i < verdadeiras.length; i++) {
          const obj = verdadeiras[i];
          if (obj.categoria && !(VALID_ENUMS.categoriaObjecao as readonly string[]).includes(obj.categoria as string)) {
            warnings.push({
              field: `objecoes.verdadeiras[${i}].categoria`,
              issue: `Valor fora do enum permitido: ${VALID_ENUMS.categoriaObjecao.join(", ")}`,
              value: obj.categoria,
            });
          }
        }
      }
    }

    // 5. Validate tecnicaObjecao tipo
    const tecnica = analysis.tecnicaObjecao as Record<string, unknown> | undefined;
    if (tecnica) {
      if (tecnica.tipo && !(VALID_ENUMS.tecnicaObjecaoTipo as readonly string[]).includes(tecnica.tipo as string)) {
        warnings.push({
          field: "tecnicaObjecao.tipo",
          issue: `Valor fora do enum permitido: ${VALID_ENUMS.tecnicaObjecaoTipo.join(", ")}`,
          value: tecnica.tipo,
        });
      }
    }

    // 6. Validate rapport breakdown fields and ranges
    const rapport = analysis.rapport as Record<string, unknown> | undefined;
    if (rapport) {
      if (typeof rapport.nivel === "number" && (rapport.nivel < 0 || rapport.nivel > 100)) {
        warnings.push({
          field: "rapport.nivel",
          issue: "Valor fora do range esperado (0-100)",
          value: rapport.nivel,
        });
      }
      const breakdown = rapport.breakdown as Record<string, unknown> | undefined;
      if (breakdown) {
        for (const field of RAPPORT_BREAKDOWN_FIELDS) {
          if (typeof breakdown[field] !== "number") {
            warnings.push({
              field: `rapport.breakdown.${field}`,
              issue: "Campo numérico ausente ou inválido",
              value: breakdown[field],
            });
          }
        }
      }
    }

    // Log all warnings
    if (warnings.length > 0) {
      console.warn(`${prefix} ${warnings.length} warning(s) na validação pós-parse:`);
      for (const w of warnings) {
        console.warn(`  - ${w.field}: ${w.issue}${w.value !== undefined ? ` (valor: ${JSON.stringify(w.value)})` : ""}`);
      }
    }
  } catch (error) {
    // Validation itself should never crash the flow
    console.error(`${prefix} Erro na validação pós-parse (não-bloqueante):`, error);
  }

  return warnings;
}

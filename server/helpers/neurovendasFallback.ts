/**
 * Fallback seguro para análises de Neurovendas.
 * Retornado quando todas as tentativas de LLM falham.
 */

export function getNeurovendasFallback(): Record<string, unknown> {
  return {
    perfilPsicografico: {
      nivelCerebralDominante: "limbico",
      motivacaoPrimaria: "saude",
      nivelAnsiedade: 0,
      nivelReceptividade: 0,
      descricaoPerfil: "Análise de Neurovendas indisponível no momento. Por favor, tente novamente.",
    },
    objecoes: {
      verdadeiras: [],
      ocultas: [],
    },
    sinaisLinguagem: {
      positivos: [],
      negativos: [],
      palavrasChaveEmocionais: [],
    },
    gatilhosMentais: [],
    scriptPARE: {
      problema: "Análise indisponível — tente novamente",
      amplificacao: "",
      resolucao: "",
      engajamento: "",
    },
    tecnicaObjecao: {
      tipo: "LAER",
      passos: [],
    },
    rapport: {
      nivel: 0,
      breakdown: {
        validacaoEmocional: 0,
        espelhamentoLinguistico: 0,
        escutaAtiva: 0,
        equilibrioTurnos: 0,
        ausenciaInterrupcoes: 0,
      },
      justificativa: "Análise indisponível",
      melhoria: "Tente novamente",
      pontosFortesRelacionamento: [],
      acoesParaMelhorar: [],
    },
    resumoExecutivo: "Análise de Neurovendas indisponível. Por favor, tente novamente.",
  };
}

/**
 * Conta o número de palavras do paciente na transcrição.
 * Heurística simples: linhas que começam com "Paciente:" ou não começam com "Dentista:"/"CRC:"
 */
export function countPatientWords(transcript: string): number {
  const lines = transcript.split('\n');
  let patientWords = 0;
  let isPatientSpeaking = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect speaker changes
    if (/^(paciente|patient|lead)\s*:/i.test(trimmed)) {
      isPatientSpeaking = true;
      const afterColon = trimmed.replace(/^[^:]+:\s*/, '');
      patientWords += afterColon.split(/\s+/).filter(w => w.length > 0).length;
    } else if (/^(dentista|doctor|crc|atendente|recepcionista)\s*:/i.test(trimmed)) {
      isPatientSpeaking = false;
    } else if (isPatientSpeaking) {
      patientWords += trimmed.split(/\s+/).filter(w => w.length > 0).length;
    }
  }

  // If no speaker labels detected, estimate ~40% of words are patient's
  if (patientWords === 0) {
    const totalWords = transcript.split(/\s+/).filter(w => w.length > 0).length;
    patientWords = Math.round(totalWords * 0.4);
  }

  return patientWords;
}

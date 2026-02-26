# Pasta de Metodologia — Neurovendas e Perfil Comportamental

## O que é esta pasta?

Coloque aqui os arquivos de metodologia proprietária que serão usados como **base de conhecimento exclusiva** para todas as análises de Neurovendas, perfil comportamental e scripts de objeção gerados pela IA do sistema.

## Como funciona?

Sempre que o sistema gerar uma análise de neurovendas (seja para consultas odontológicas ou para ligações do CRC), o conteúdo de todos os arquivos desta pasta será automaticamente injetado no contexto da IA **antes** da análise.

A IA é instruída a usar **exclusivamente** o conteúdo destes documentos — não seu conhecimento geral sobre vendas ou psicologia.

## Formatos suportados

| Formato | Suportado |
|---------|-----------|
| `.txt`  | ✅ Sim |
| `.md` (Markdown) | ✅ Sim (exceto este README) |

> **Nota sobre PDF:** Arquivos `.pdf` precisam ser convertidos para `.txt` ou `.md` antes de colocar aqui. Use qualquer conversor PDF → texto da sua preferência.

## O que colocar aqui?

Exemplos de arquivos úteis:

- `perfis-comportamentais.md` — Descrição dos perfis cerebrais (Neocórtex, Límbico, Reptiliano) com nomenclatura e critérios de classificação
- `tecnica-laer.md` — Estrutura completa da técnica LAER com exemplos de scripts
- `tecnica-pare.md` — Estrutura do script PARE com exemplos por perfil
- `gatilhos-mentais.md` — Catálogo de gatilhos mentais com exemplos de frases
- `objecoes-comuns.md` — Mapeamento de objeções frequentes e respostas recomendadas
- `rapport.md` — Critérios de avaliação de rapport com pesos e exemplos
- `manual-neurovendas.txt` — Manual completo exportado em texto

## Atualização da metodologia

Para atualizar:
1. Substitua ou adicione arquivos nesta pasta
2. Reinicie o servidor — o cache será automaticamente recarregado

Ou, se o servidor estiver rodando, o cache é atualizado automaticamente a cada **5 minutos**.

## ⚠️ Importante: Segurança

**Estes arquivos NÃO são versionados no git.** O `.gitignore` está configurado para excluir todos os arquivos desta pasta (exceto este README), protegendo a metodologia proprietária do negócio.

import type { Ficha } from '../ficha.ts'

// Anexos III (adulto) e IV (pediatria) do protocolo de classificação de risco
// da unidade, transcritos COMO ESTÃO no documento (conferido contra o PDF,
// p. 59–61). São consulta do enfermeiro ao lado de cada sinal vital: o sistema
// NÃO usa estas faixas para sugerir, marcar ou trocar a cor (CLAUDE.md).
// Na ficha impressa os sinais vitais saem crus, sem estas faixas.

export const fichaAnexosSinaisVitais: Ficha = {
  id: 'triagem-anexos-sinais-vitais',
  titulo: 'Sinais vitais — Anexos III e IV do protocolo de classificação de risco',
  versao: '2026-09-29.1',
  publico: 'ambos',
  fontes: [
    { citacao: 'Protocolo de Classificação de Risco (baseado no protocolo Manchester) · SMS Aparecida de Goiânia · 2025, Anexo III (Sinais vitais em adultos, p. 59–60)' },
    { citacao: 'Idem, Anexo IV (Sinais vitais em pediatria, p. 61: FR e FC da OMS; PA do PALS 2023)', pediatrica: true },
  ],
  revisadoEm: '29/09/2026 (porte do protótipo; texto conferido contra o PDF)',
}

export type GrupoAnexo = {
  /** chaves de src/domain/vitais.ts a que a tabela se refere */
  vitais: string[]
  titulo: string
  colunas: string[]
  linhas: string[][]
  /** divergência do documento, transcrita sem corrigir */
  conferir?: string
}

export type Anexo = { titulo: string; grupos: GrupoAnexo[] }

const PA = ['pressao-arterial-sistolica', 'pressao-arterial-diastolica']

export const ANEXO_III_ADULTO: Anexo = {
  titulo: 'Anexo III · Sinais vitais em adultos',
  grupos: [
    { vitais: PA, titulo: 'Pressão arterial', colunas: ['Categoria', 'Sistólica', 'Diastólica', 'Classificação de risco'], linhas: [
      ['Normal', '< 130 mmHg', '< 85 mmHg', 'Azul/Verde'],
      ['Normal limítrofe', '130-139 mmHg', '85-89 mmHg', 'Azul/Verde'],
      ['Hipertensão leve (estágio 1)', '140-159 mmHg', '90-99 mmHg', 'Azul/Verde'],
      ['Hipertensão moderada (estágio 2)', '160-179 mmHg', '100-109 mmHg', 'Amarelo'],
      ['Hipertensão grave (estágio 3)', '180-199 mmHg', '110-112 mmHg', 'Amarelo'],
      ['Crise hipertensiva', '>200', '-', 'Amarelo/Laranja'],
      ['Hipotensão', '<80 mmHg', '<50 mmHg', 'Laranja'],
    ] },
    { vitais: ['temperatura'], titulo: 'Temperatura', colunas: ['Nomenclatura', 'Temperatura', 'Classificação de risco'], linhas: [
      ['Hipotermia profunda', '<20 °C', 'Vermelho'],
      ['Hipotermia severa', '< 30 °C', 'Vermelho'],
      ['Hipotermia moderada', '34 °C - 30 °C', 'Vermelho'],
      ['Hipotermia', '36 °C - 34 °C', 'Azul/Verde'],
      ['Afebril', '36,1 °C - 37,0 °C', 'Azul/Verde'],
      ['Estado febril', '37,1 °C - 37,7 °C', 'Verde'],
      ['Febre/Hipertermia', '37,8 °C - 38,9 °C', 'Verde'],
      ['Pirexia', '39 °C - 40 °C', 'Amarelo'],
      ['Hiperpirexia', '>40,1 °C', 'Laranja'],
    ] },
    { vitais: ['frequencia-cardiaca'], titulo: 'Frequência cardíaca', colunas: ['Nomenclatura', 'Frequência', 'Classificação de risco'], linhas: [
      ['Normocardia', '60-100 bpm', 'Azul/Verde'],
      ['Bradicardia', '40-59 bpm', 'Amarelo/Laranja'],
      ['Taquicardia', '100 – 149 bpm', 'Verde/Amarelo'],
      ['Taquicardia', '>150 bpm', 'Laranja'],
      ['Bradicardia', '>39 bpm', 'Vermelho'],
    ], conferir: 'O documento traz "Bradicardia >39 bpm · Vermelho" (provavelmente < 40 bpm). Transcrito como está; a conferir pela unidade.' },
    { vitais: ['frequencia-respiratoria'], titulo: 'Frequência respiratória', colunas: ['Nomenclatura', 'Frequência', 'Classificação de risco'], linhas: [
      ['Normopneia', '13-19 rpm', 'Azul/Verde'],
      ['Bradipneia', '<12 rpm', 'Amarelo/Laranja'],
      ['Taquipneia', '>20 rpm', 'Amarelo/Laranja'],
      ['Apneia', 'Ausência de incursões respiratórias', 'Vermelho'],
    ] },
    { vitais: ['saturacao-o2'], titulo: 'Oximetria', colunas: ['Referência', 'Valores', 'Classificação de risco'], linhas: [
      ['Normal', '95% a 100%', 'Azul/Verde'],
      ['Baixa saturação de O2', '90% a 94%', 'Verde/Amarelo'],
      ['Muito baixa saturação de O2', '<90%', 'Laranja/Vermelho'],
    ] },
    { vitais: ['glicemia-capilar'], titulo: 'Glicemia', colunas: ['Nomenclatura', 'Referência', 'Classificação de risco'], linhas: [
      ['Normoglicêmico', '70 a 179', 'Azul/Verde'],
      ['Hiperglicemia', '180 a 399', 'Amarelo'],
      ['Hiperglicemia', '400 a HI', 'Laranja'],
      ['Hipoglicemia', 'LO a 69', 'Laranja/Vermelho'],
    ] },
  ],
}

export const ANEXO_IV_PEDIATRIA: Anexo = {
  titulo: 'Anexo IV · Sinais vitais em pediatria',
  grupos: [
    { vitais: ['frequencia-respiratoria'], titulo: 'Frequência respiratória pediátrica (OMS)', colunas: ['Idade', 'Movimentos/minuto'], linhas: [
      ['De 0 a 2 meses', 'Até 60 mrm'],
      ['De 3 a 11 meses', 'Até 50 mrm'],
      ['De 12 meses a 5 anos', 'Até 40 mrm'],
      ['De 6 anos a 8 anos', 'Até 30 mrm'],
      ['Acima de 8 anos', 'Até 25 mrm'],
    ] },
    { vitais: ['frequencia-cardiaca'], titulo: 'Frequência cardíaca pediátrica (OMS)', colunas: ['Idade', 'Bradicárdica', 'Taquicárdica'], linhas: [
      ['Neonatos até 30 dias (até um mês)', 'FC < 100 bpm', 'FC > 180 bpm'],
      ['Lactentes 1 mês - 1 ano (de 1 a 12 meses)', 'FC < 90 bpm', 'FC > 160 bpm'],
      ['Crianças de 13 meses a 2 anos', 'FC < 80 bpm', 'FC > 130 bpm'],
      ['Idade escolar de 3 a 7 anos', 'FC < 70 bpm', 'FC > 120 bpm'],
      ['Adolescente 8-14 anos', 'FC < 60 bpm', 'FC > 110 bpm'],
    ] },
    { vitais: PA, titulo: 'Pressões arteriais normais (PALS 2023)', colunas: ['Idade', 'Sistólica (mmHg)', 'Diastólica (mmHg)', 'PAM (mmHg)'], linhas: [
      ['Bebê (1 a 12 meses)', '72-104', '37-56', '50-62'],
      ['1ª infância (1 a 2 anos)', '86-106', '42-63', '49-62'],
      ['Idade pré-escolar (6 a 9 anos)', '89-112', '46-72', '58-69'],
      ['Criança em idade escolar (6 a 9 anos)', '97-115', '57-76', '66-72'],
      ['Pré-adolescente (10 a 12 anos)', '102-120', '61-80', '71-79'],
      ['Adolescente (12 a 15 anos)', '110-131', '64-83', '73-84'],
    ], conferir: 'O documento repete "6 a 9 anos" na idade pré-escolar (provavelmente 3 a 5 anos). Transcrito como está; a conferir pela unidade.' },
  ],
}

export const AVISO_ANEXO = 'Consulta do enfermeiro: o sistema não usa estas faixas para definir a cor.'

export function anexoDoGrupo(publico: 'adulto' | 'pediatrico'): Anexo {
  return publico === 'pediatrico' ? ANEXO_IV_PEDIATRIA : ANEXO_III_ADULTO
}

/** Tabela do anexo para um sinal vital, ou null quando o anexo não traz faixa. */
export function referenciaDoSinal(publico: 'adulto' | 'pediatrico' | null, vital: string): { anexo: string; grupo: GrupoAnexo } | null {
  if (!publico) return null
  const a = anexoDoGrupo(publico)
  const grupo = a.grupos.find((g) => g.vitais.includes(vital))
  return grupo ? { anexo: publico === 'pediatrico' ? 'Anexo IV' : 'Anexo III', grupo } : null
}

import type { Ficha } from '../ficha.ts'

// SAE — Processo de Enfermagem em cinco etapas, como o protótipo traz
// (SAE_ETAPAS, 23/09): "Processo de enfermagem em cinco etapas (COFEN
// 736/2024). Códigos e títulos vêm da licença NANDA-I, NOC e NIC da unidade;
// o sistema não sugere diagnósticos."
//
// Os nomes das etapas são os do protótipo (os da Resolução 736/2024): o antigo
// "histórico" é a Avaliação de enfermagem, e a antiga "avaliação" é a Evolução
// de enfermagem. O app não tem a lista NANDA-I/NOC/NIC (é licenciada; não há
// lista com fonte aqui): o enfermeiro digita código e título da licença da
// unidade, e o sistema guarda como veio, sem sugerir e sem conferir.

export type EtapaSae = 'avaliacao' | 'diagnosticos' | 'planejamento' | 'implementacao' | 'evolucao'
export type ItemSae = { codigo: string; titulo: string; detalhe: string }

export const ETAPAS_SAE: { id: EtapaSae; titulo: string; sub: string; lista: boolean; rotuloDetalhe?: string }[] = [
  { id: 'avaliacao', titulo: 'Avaliação de enfermagem', sub: 'Histórico, entrevista e exame físico', lista: false },
  { id: 'diagnosticos', titulo: 'Diagnósticos de enfermagem (NANDA-I)', sub: 'Código e título da licença, fatores relacionados e características definidoras', lista: true, rotuloDetalhe: 'Relacionado a · evidenciado por' },
  { id: 'planejamento', titulo: 'Planejamento · resultados (NOC)', sub: 'Resultado esperado e meta', lista: true, rotuloDetalhe: 'Meta e prazo' },
  { id: 'implementacao', titulo: 'Implementação · intervenções (NIC)', sub: 'Intervenção e atividades', lista: true, rotuloDetalhe: 'Atividades e horários' },
  { id: 'evolucao', titulo: 'Evolução de enfermagem', sub: 'Resposta do paciente e revisão do plano', lista: false },
]

export const fichaSae: Ficha = {
  id: 'enfermagem-sae',
  titulo: 'SAE — Processo de Enfermagem',
  versao: '2026-09-29.1',
  publico: 'ambos',
  fontes: [
    // o protótipo cita número e ano; conferir a referência completa (data e DOU)
    { citacao: 'Conselho Federal de Enfermagem (COFEN). Resolução nº 736/2024 — Processo de Enfermagem em cinco etapas.' },
    { citacao: 'Diagnósticos NANDA-I, resultados NOC e intervenções NIC: códigos e títulos da licença adotada pela unidade (o sistema não traz a lista).' },
  ],
  revisadoEm: '29/09/2026 (porte do protótipo)',
}

/** Item novo vale quando tem título (o da licença). Devolve aparado ou null. */
export function itemSaeValido(x: { codigo?: string; titulo?: string; detalhe?: string }): ItemSae | null {
  const titulo = (x.titulo ?? '').trim()
  if (titulo.length < 3) return null
  return { codigo: (x.codigo ?? '').trim().slice(0, 20), titulo, detalhe: (x.detalhe ?? '').trim() }
}

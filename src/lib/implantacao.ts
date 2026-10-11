// Playbook de implantação (Fase 3, tarefa 10; decisões do RT de 10/10/2026).
// Regras de exibição da tela Implantação; o banco confere os itens
// (migration 20261106000001_implantacao.sql). Roteiro em docs/implantacao/.

export type Fase = 'preparacao' | 'virada' | 'assistida' | 'encerramento'
export type TipoUnidade = 'upa' | 'ps' | 'hospital'

export type Item = {
  id: string; codigo: string; fase: Fase; titulo: string; descricao: string | null
  obrigatorio: boolean; responsavel: 'implantador' | 'gestor' | 'ambos'; prazo: string
  automatico: boolean; ok: boolean; detalhe: string | null
  feito_em: string | null; feito_por: string | null; observacao: string | null
}

export const FASES: { fase: Fase; rotulo: string; janela: string }[] = [
  { fase: 'preparacao', rotulo: 'Preparação', janela: 'D-30 a D-7' },
  { fase: 'virada', rotulo: 'Virada', janela: 'D0' },
  { fase: 'assistida', rotulo: 'Operação assistida', janela: 'D+1 a D+14' },
  { fase: 'encerramento', rotulo: 'Encerramento', janela: 'D+30' },
]

export const TIPOS: Record<TipoUnidade, string> = { upa: 'UPA 24h', ps: 'Pronto-socorro', hospital: 'Hospital pequeno' }

export const RESPONSAVEL: Record<Item['responsavel'], string> = {
  implantador: 'Implantador', gestor: 'Gestor', ambos: 'Implantador e gestor',
}

export const PAPEIS: Record<string, string> = {
  gestor: 'Gestor', recepcao: 'Recepção', enfermeiro: 'Enfermeiro', tecnico_enfermagem: 'Técnico de enfermagem',
  plantonista: 'Médico plantonista', farmaceutico: 'Farmacêutico', faturamento: 'Faturamento',
  regulador: 'Médico regulador', telemedicina: 'Telemedicina',
}

/** Dias entre duas datas 'aaaa-mm-dd' (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86_400_000)
}

/** D-30, D0, D+14… */
export function rotuloDia(d0: string, data: string): string {
  const n = diasEntre(d0, data)
  return n === 0 ? 'D0' : n > 0 ? `D+${n}` : `D${n}`
}

export type SituacaoPrazo = 'feito' | 'atrasado' | 'perto' | 'no_prazo'

/** Item cumprido; senão atrasado, perto (até 3 dias) ou no prazo. */
export function situacaoPrazo(it: Pick<Item, 'ok' | 'prazo'>, hoje: string): SituacaoPrazo {
  if (it.ok) return 'feito'
  const falta = diasEntre(hoje, it.prazo)
  if (falta < 0) return 'atrasado'
  if (falta <= 3) return 'perto'
  return 'no_prazo'
}

/** Obrigatórios cumpridos por fase, para o cabeçalho de cada fase. */
export function resumoFase(itens: Item[], fase: Fase): { feitos: number; obrigatorios: number; total: number } {
  const daFase = itens.filter((i) => i.fase === fase)
  const obrig = daFase.filter((i) => i.obrigatorio)
  return { feitos: obrig.filter((i) => i.ok).length, obrigatorios: obrig.length, total: daFase.length }
}

/** Obrigatórios que ainda faltam para o aceite da etapa. */
export function faltamParaAceite(itens: Item[], etapa: 'virada' | 'encerramento'): Item[] {
  const fases: Fase[] = etapa === 'virada' ? ['preparacao', 'virada'] : ['preparacao', 'virada', 'assistida', 'encerramento']
  return itens.filter((i) => i.obrigatorio && !i.ok && fases.includes(i.fase))
}

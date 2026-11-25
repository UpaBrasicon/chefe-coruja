// Textos montados a partir do caderno do leito para a regulação (RG2), o
// sumário de alta (AL2) e o laudo de AIH (MA3) — revisão da Internação
// aprovada pelo RT em 24/11/2026. Tudo é rascunho: a tela marca "veio do
// prontuário, revise" e o médico edita antes de enviar ou emitir. Os números
// vão como foram registrados (sinais vitais e resultados crus, com a hora).
// Sem dose sugerida: a prescrição entra como foi prescrita pelo médico.
// Sem dependência de tela: os testes rodam no node.
import { dataHora, diaMes } from './formato.ts'

export const MARCA_PRONTUARIO = 'veio do prontuário, revise'

export type Diag = { cid: string; descricao: string | null; tipo: 'primario' | 'secundario'; status: 'hipotese' | 'confirmado'; encerrado_em?: string | null }
export type SvCru = { pa: string | null; fc: string | null; fr: string | null; temp: string | null; spo2: string | null; glic?: string | null; condicao: 'ar' | 'o2' | null; aferido_em: string }
export type ExameCru = { exame: string; resultado: string | null; situacao: string; pedido_em: string }
export type ItemPrescrito = { tipo: string; descricao: string; dose: string | null; via: string | null; posologia: string | null; se_necessario?: boolean }
export type EvolucaoCrua = { a?: string; p?: string; s?: string; criado_em: string }

const vigentes = (d: readonly Diag[]) => [...d].filter((x) => !x.encerrado_em).sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'primario' ? -1 : 1))

/** "J18.9 — Pneumonia (hipótese)" por linha, o principal primeiro. */
export function linhasDiagnostico(d: readonly Diag[]): string {
  return vigentes(d).map((x) => `${x.cid}${x.descricao ? ` — ${x.descricao}` : ''}${x.status === 'hipotese' ? ' (hipótese)' : ''}`).join('\n')
}

/** O CID principal vigente (o código), ou vazio. */
export const cidPrincipal = (d: readonly Diag[]) => vigentes(d).find((x) => x.tipo === 'primario')?.cid ?? ''

/** Sinais vitais crus, com a hora: "PA 128/76, FC 102, FR 22, Tax 37.85, SpO₂ 94% em O₂ às 24/11 14:50". */
export function textoVitais(sv: SvCru | null | undefined): string {
  if (!sv) return ''
  const p: string[] = []
  if (sv.pa) p.push(`PA ${sv.pa}`)
  if (sv.fc) p.push(`FC ${sv.fc}`)
  if (sv.fr) p.push(`FR ${sv.fr}`)
  if (sv.temp) p.push(`Tax ${sv.temp}`)
  if (sv.spo2) p.push(`SpO₂ ${sv.spo2}%${sv.condicao === 'o2' ? ' em O₂' : sv.condicao === 'ar' ? ' em ar ambiente' : ''}`)
  if (sv.glic) p.push(`glicemia ${sv.glic}`)
  return p.length ? `${p.join(', ')} às ${dataHora(sv.aferido_em)}` : ''
}

/** Exames com resultado, o valor cru e a data: "Potássio: 5,8 (24/11)". */
export function textoExames(lista: readonly ExameCru[], max = 12): string {
  return lista.filter((e) => e.situacao === 'resultado' && e.resultado)
    .sort((a, b) => Date.parse(b.pedido_em) - Date.parse(a.pedido_em)).slice(0, max)
    .map((e) => `${e.exame}: ${e.resultado} (${diaMes(e.pedido_em)})`).join('; ')
}

/** A prescrição vigente como foi escrita pelo médico (medicamentos com dose, via e frequência; cuidados pelo nome). */
export function textoPrescricao(itens: readonly ItemPrescrito[]): string {
  return itens.filter((i) => i.tipo === 'medicamento')
    .map((i) => [i.descricao, i.dose, i.via, i.posologia, i.se_necessario ? 'se necessário' : ''].filter(Boolean).join(' ')).join('; ')
}

/** RG2: os campos do quadro clínico da regulação, preenchidos do caderno (só os que têm o que dizer). */
export function quadroParaRegulacao(c: { evolucao?: EvolucaoCrua | null; sv?: SvCru | null; exames: readonly ExameCru[]; prescricao: readonly ItemPrescrito[]; diagnosticos: readonly Diag[] }) {
  const ev = c.evolucao
  const quadro = [ev?.s?.trim() ? `Subjetivo: ${ev.s.trim()}` : '', ev?.a?.trim() ? `Avaliação: ${ev.a.trim()}` : '', ev?.p?.trim() ? `Plano: ${ev.p.trim()}` : '']
    .filter(Boolean).join('\n')
  return {
    cid: cidPrincipal(c.diagnosticos),
    hipotese: linhasDiagnostico(c.diagnosticos).split('\n').join('; '),
    quadro_clinico: quadro ? `${quadro}\n(Evolução de ${dataHora(ev!.criado_em)})` : '',
    sinais_vitais: textoVitais(c.sv),
    exames: textoExames(c.exames),
    medicacoes: textoPrescricao(c.prescricao),
  }
}

/** AL2: rascunho do sumário de alta da internação. */
export function sumarioAlta(c: {
  admissao: string; alta?: string | null; motivo?: string | null; diagnosticos: readonly Diag[]; resumoCaso?: string | null
  evolucao?: EvolucaoCrua | null; exames: readonly ExameCru[]; procedimentos?: string | null; prescricaoCasa?: string | null
}): string {
  const bloco = (t: string, v: string | null | undefined) => (v && v.trim() ? `${t}\n${v.trim()}` : `${t}\n—`)
  return [
    bloco('Internação', `De ${dataHora(c.admissao)}${c.alta ? ` a ${dataHora(c.alta)}` : ''}.${c.motivo ? ` Motivo: ${c.motivo}.` : ''}`),
    bloco('Diagnósticos (CID-10)', linhasDiagnostico(c.diagnosticos)),
    bloco('Resumo da evolução na internação', [c.resumoCaso ?? '', c.evolucao?.a ? `Última avaliação (${dataHora(c.evolucao.criado_em)}): ${c.evolucao.a}` : ''].filter((x) => x.trim()).join('\n')),
    bloco('Exames relevantes', textoExames(c.exames, 20)),
    bloco('Procedimentos', c.procedimentos),
    bloco('Condição na alta', ''),
    bloco('Prescrição para casa', c.prescricaoCasa),
    bloco('Seguimento e encaminhamento', c.evolucao?.p ?? ''),
  ].join('\n\n')
}

/** Vias que fazem sentido em casa (receita da alta): oral, sublingual, tópica, inalatória, ocular, retal. */
const VIAS_CASA = ['VO', 'SL', 'TÓPICA', 'TOPICA', 'INAL', 'OCULAR', 'RETAL', 'NASAL', 'OTOLOGICA']
export const viaDeCasa = (via: string | null | undefined) => !via || VIAS_CASA.includes(via.toUpperCase())

// Conferência do BPA em linguagem de quem fecha (revisão do perfil Faturamento,
// FT2 a FT4, RT em 24/11/2026). Só leitura do que a RPC bpa_conferencia já
// devolve: a regra da crítica e do destino é do banco e não muda aqui.
//
// • FT4: os números da competência numa frase ("27 linhas: 25 vão no
//   consolidado por falta de dado do paciente; 2 ficam fora por CBO").
// • FT2: por que o botão Fechar está desligado.
// • FT3: "Para corrigir" por causa, com os pacientes de cada uma e o que falta,
//   e a lista para a recepção completar (CSV e folha para imprimir).
import { gerarCsv, type ValorCsv } from './csv.ts'
import { CRITICA_BPA, type Conferencia, type GlobalBpa, type LinhaConferencia } from './bpa.ts'
import { dataHora, diaMes } from './formato.ts'

/** "1 linha" / "27 linhas". */
export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

/** Quem corrige cada causa. */
export type QuemCorrige = 'paciente' | 'profissional' | 'configuracao' | 'lancamento'
export const QUEM_CORRIGE: Record<string, QuemCorrige> = {
  raca: 'paciente', etnia: 'paciente', sexo: 'paciente', nascimento: 'paciente', documento: 'paciente', endereco: 'paciente', nacionalidade: 'paciente',
  cns_profissional: 'profissional', cbo: 'profissional', cbo_enfermagem: 'profissional', cbo_nao_aceito: 'profissional',
  sem_codigo: 'configuracao', procedimento_sigtap: 'configuracao', instrumento: 'configuracao',
  quantidade_maxima: 'lancamento',
}
export const ONDE_CORRIGE: Record<QuemCorrige, string> = {
  paciente: 'A recepção completa no cadastro do paciente; endereço, nacionalidade e etnia também se completam aqui.',
  profissional: 'O profissional completa o CNS e o CBO no perfil dele na unidade.',
  configuracao: 'Na aba Configuração: o código SIGTAP da fonte.',
  lancamento: 'No registro do procedimento.',
}
/** O que falta no paciente, em poucas palavras (lista da recepção). */
export const FALTA_NO_PACIENTE: Record<string, string> = {
  raca: 'raça/cor', etnia: 'etnia', sexo: 'sexo', nascimento: 'data de nascimento',
  documento: 'CNS ou CPF', endereco: 'endereço', nacionalidade: 'nacionalidade',
}
// Por que a linha fica fora, na frase do resumo.
const FORA_POR: Record<QuemCorrige, (codigo: string) => string> = {
  paciente: () => 'falta de dado do paciente',
  profissional: (k) => (k === 'cns_profissional' ? 'CNS do profissional' : 'CBO'),
  configuracao: () => 'código SIGTAP',
  lancamento: () => 'quantidade acima do máximo',
}
const PRIORIDADE: QuemCorrige[] = ['configuracao', 'profissional', 'lancamento', 'paciente']

const codigos = (l: LinhaConferencia) => [...new Set([...l.criticas, ...l.avisos].map((k) => k.codigo))]
const quem = (codigo: string): QuemCorrige => QUEM_CORRIGE[codigo] ?? 'lancamento'

function porQueFora(l: LinhaConferencia): string {
  const cs = l.criticas.map((k) => k.codigo)
  for (const q of PRIORIDADE) {
    const k = cs.find((c) => quem(c) === q)
    if (k) return FORA_POR[q](k)
  }
  return 'crítica'
}

function porQueConsolidado(l: LinhaConferencia): string {
  const m = l.motivo_c ?? ''
  if (/sempre BPA-C/i.test(m)) return 'porque a unidade marcou o código como consolidado'
  if (/só aceita/i.test(m)) return 'porque o SIGTAP só aceita o procedimento assim'
  const doPaciente = codigos(l).some((k) => quem(k) === 'paciente')
  if (doPaciente) return 'por falta de dado do paciente'
  if (l.criticas.some((k) => k.codigo === 'cns_profissional')) return 'por falta do CNS do profissional'
  return ''
}

function contarPor<T>(itens: T[], chave: (t: T) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const i of itens) m.set(chave(i), (m.get(chave(i)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * FT4: a competência numa frase. Os números são os da conferência; o motivo de
 * cada parte vem das linhas (até 500, as que têm crítica, aviso ou vão no BPA-C).
 */
export function frasePanorama(c: Pick<Conferencia, 'total' | 'prontas' | 'com_critica' | 'com_aviso' | 'bpa_i' | 'bpa_c' | 'linhas'>): string {
  if (c.total === 0) return 'Nenhuma linha nesta competência.'
  const partes: string[] = []
  const bpaI = c.bpa_c === undefined ? c.prontas : (c.bpa_i ?? 0)
  if (bpaI > 0) {
    const vao = `${bpaI} ${bpaI === 1 ? 'vai' : 'vão'} no ${c.bpa_c === undefined ? 'arquivo' : 'BPA-I'}`
    partes.push(c.com_aviso > 0 ? `${vao} (${c.com_aviso} com campo vazio)` : vao)
  }
  if ((c.bpa_c ?? 0) > 0) {
    const grupos = contarPor(c.linhas.filter((l) => l.destino === 'bpa_c'), porQueConsolidado)
    let resto = c.bpa_c!
    for (const [motivo, n] of grupos) {
      const k = Math.min(n, resto)
      if (k <= 0) break
      partes.push(`${k} ${k === 1 ? 'vai' : 'vão'} no consolidado${motivo ? ` ${motivo}` : ''}`)
      resto -= k
    }
    if (resto > 0) partes.push(`${resto} ${resto === 1 ? 'vai' : 'vão'} no consolidado`)
  }
  if (c.com_critica > 0) {
    const grupos = contarPor(c.linhas.filter((l) => l.destino === 'fora'), porQueFora)
    let resto = c.com_critica
    for (const [motivo, n] of grupos) {
      const k = Math.min(n, resto)
      if (k <= 0) break
      partes.push(`${k} ${k === 1 ? 'fica' : 'ficam'} fora por ${motivo}`)
      resto -= k
    }
    if (resto > 0) partes.push(`${resto} ${resto === 1 ? 'fica' : 'ficam'} fora`)
  }
  return `${plural(c.total, 'linha', 'linhas')}: ${partes.join('; ')}.`
}

/** FT2: por que o Fechar está desligado (null quando pode fechar). */
export function motivoFecharDesligado(o: { bloqueios: number; prontas: number; processamentoValido: boolean }): string | null {
  if (o.bloqueios > 0) return o.bloqueios === 1 ? 'Resolva o passo acima para fechar.' : 'Resolva os passos acima para fechar.'
  if (o.prontas === 0) return 'Nenhuma linha pronta para o arquivo nesta competência.'
  if (!o.processamentoValido) return 'Escreva a competência de processamento como MM/AAAA.'
  return null
}

/** "Cabeçalho incompleto: órgão de origem, …" → título e detalhe. */
export function partesDoBloqueio(g: Pick<GlobalBpa, 'texto'>): { titulo: string; detalhe: string | null } {
  const i = g.texto.indexOf(':')
  if (i < 0) return { titulo: g.texto.replace(/\.$/, ''), detalhe: null }
  const detalhe = g.texto.slice(i + 1).trim()
  return { titulo: g.texto.slice(0, i).trim(), detalhe: detalhe ? detalhe.charAt(0).toUpperCase() + detalhe.slice(1) : null }
}

/** O bloqueio que se resolve na aba Configuração do BPA (e o que é do gestor). */
export const BLOQUEIO_NA_CONFIGURACAO = new Set(['cabecalho'])
export const BLOQUEIO_DO_GESTOR = new Set(['cnes'])

export type PacienteCorrigir = {
  paciente_id: string; paciente: string
  /** códigos do que falta no paciente (raca, endereco…) */
  falta: string[]
  /** quando foi atendido na competência (instantes das linhas) */
  atendimentos: string[]
  linhas: number
}
export type GrupoCorrigir = {
  codigo: string; rotulo: string; quem: QuemCorrige
  linhas: LinhaConferencia[]
  /** linhas que ficam fora, vão no consolidado ou vão com o campo vazio */
  efeito: { fora: number; bpa_c: number; vazio: number }
  pacientes: PacienteCorrigir[]
}

/** Pacientes com dado faltando, um por pessoa, com tudo o que falta nas linhas dela. */
export function pacientesComFalta(linhas: LinhaConferencia[]): PacienteCorrigir[] {
  const m = new Map<string, PacienteCorrigir>()
  for (const l of linhas) {
    const falta = codigos(l).filter((k) => quem(k) === 'paciente')
    if (falta.length === 0) continue
    const p = m.get(l.paciente_id) ?? { paciente_id: l.paciente_id, paciente: l.paciente, falta: [], atendimentos: [], linhas: 0 }
    for (const k of falta) if (!p.falta.includes(k)) p.falta.push(k)
    if (!p.atendimentos.includes(l.em)) p.atendimentos.push(l.em)
    p.linhas += 1
    m.set(l.paciente_id, p)
  }
  const ordem = Object.keys(FALTA_NO_PACIENTE)
  return [...m.values()]
    .map((p) => ({ ...p, falta: p.falta.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)), atendimentos: p.atendimentos.sort() }))
    .sort((a, b) => a.paciente.localeCompare(b.paciente, 'pt-BR'))
}

/** FT3: as causas, da que mais pesa para a que menos pesa, com as linhas e os pacientes de cada uma. */
export function gruposParaCorrigir(linhas: LinhaConferencia[]): GrupoCorrigir[] {
  const m = new Map<string, LinhaConferencia[]>()
  for (const l of linhas) for (const k of codigos(l)) m.set(k, [...(m.get(k) ?? []), l])
  return [...m.entries()]
    .map(([codigo, ls]) => ({
      codigo, rotulo: CRITICA_BPA[codigo] ?? codigo, quem: quem(codigo), linhas: ls,
      efeito: {
        fora: ls.filter((l) => l.destino === 'fora').length,
        bpa_c: ls.filter((l) => l.destino === 'bpa_c').length,
        vazio: ls.filter((l) => l.destino !== 'fora' && l.destino !== 'bpa_c').length,
      },
      pacientes: quem(codigo) === 'paciente' ? pacientesComFalta(ls) : [],
    }))
    .sort((a, b) => b.efeito.fora - a.efeito.fora || b.linhas.length - a.linhas.length || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}

/** "25 vão no consolidado · 2 ficam fora" — o efeito da causa no arquivo. */
export function efeitoNaTela(e: GrupoCorrigir['efeito']): string {
  return [
    e.fora > 0 && `${e.fora} ${e.fora === 1 ? 'fica' : 'ficam'} fora`,
    e.bpa_c > 0 && `${e.bpa_c} ${e.bpa_c === 1 ? 'vai' : 'vão'} no consolidado`,
    e.vazio > 0 && `${e.vazio} ${e.vazio === 1 ? 'vai' : 'vão'} com o campo vazio`,
  ].filter(Boolean).join(' · ')
}

export const faltaNaTela = (falta: string[]) => falta.map((k) => FALTA_NO_PACIENTE[k] ?? CRITICA_BPA[k] ?? k).join(', ')

export type CabecalhoLista = { unidade: string; competencia: string; geradoEm: number | string }

/** A lista da recepção em CSV (Excel em português), um paciente por linha. */
export function csvParaRecepcao(pacientes: PacienteCorrigir[], c: CabecalhoLista): string {
  const linhas: ValorCsv[][] = pacientes.map((p) => [p.paciente, faltaNaTela(p.falta), p.atendimentos.map((e) => diaMes(e)).join(', ')])
  return gerarCsv(['Paciente', 'O que falta', 'Atendido em'], linhas, {
    contexto: [['Unidade', c.unidade], ['Competência', c.competencia], ['Gerado em', dataHora(c.geradoEm)]],
  })
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))

/** A mesma lista numa folha para imprimir (ou salvar em PDF pelo navegador). */
export function htmlParaRecepcao(pacientes: PacienteCorrigir[], c: CabecalhoLista): string {
  const corpo = pacientes.map((p) => `<tr><td><b>${esc(p.paciente)}</b></td><td>${esc(faltaNaTela(p.falta))}</td><td>${esc(p.atendimentos.map((e) => diaMes(e)).join(', '))}</td><td class="anota"></td></tr>`).join('\n')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cadastros para completar · ${esc(c.competencia)}</title>
<style>
@page { size: A4; margin: 14mm; }
body { font: 11px/1.4 system-ui, sans-serif; color: black; background: white; margin: 0; }
h1 { font-size: 16px; margin: 0 0 4px; }
p { margin: 0 0 8px; color: dimgray; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid dimgray; padding: 4px 6px; vertical-align: top; text-align: left; }
thead th { background: gainsboro; }
td.anota { width: 22%; }
tr { page-break-inside: avoid; }
</style></head><body>
<h1>Cadastros para completar</h1>
<p>${esc(c.unidade)} · competência ${esc(c.competencia)} · ${esc(plural(pacientes.length, 'paciente', 'pacientes'))} · gerado em ${esc(dataHora(c.geradoEm))}</p>
<p>Sem estes dados a linha do BPA não fecha no individualizado. Complete no cadastro do paciente e marque aqui.</p>
<table><thead><tr><th>Paciente</th><th>O que falta</th><th>Atendido em</th><th>Feito</th></tr></thead>
<tbody>
${corpo}
</tbody></table>
</body></html>`
}

// Óbito para o prontuário (lacuna 5; decisão do RT em 10/11/2026, A em O1 a
// O8; migration 20270326000001). Os mesmos dados na porta, na observação e na
// internação: o formulário (DadosObito), as regras que a tela mostra antes de
// enviar e o jsonb que vai para registrar_desfecho, finalizar_observacao e
// dar_alta. O servidor confere tudo de novo (private.obito_validado).
//
// O registro é só do prontuário. A Declaração de Óbito (D.O.) que vale é o
// formulário do Ministério da Saúde, em 3 vias (branca, amarela e rosa). O app
// não imprime nada com cara de D.O.
//
// Fontes (texto conferido em 10/11/2026):
// - Resolução CFM nº 1.779/2005, art. 2º: quem fornece a D.O. em cada caso.
// - Portaria SVS/MS nº 116/2009, arts. 17, 20, 22 e 25: quem emite e o destino
//   das vias (branca para a SMS, amarela para a família, rosa no prontuário).
// - MS, Declaração de Óbito: manual de instruções para preenchimento, 2022:
//   número de 9 algarismos (o último é dígito verificador; o manual não dá o
//   algoritmo, então só o tamanho é conferido); causas em texto na Parte I
//   (linhas a a d) e na Parte II; o médico não codifica a CID; sem SVO, a
//   Parte I leva "causa da morte desconhecida".
// - MS/CFM/CBCD, A Declaração de Óbito: documento necessário e importante, 3ª
//   ed., 2009: não usar termos vagos ("parada cardíaca", "parada
//   cardiorrespiratória", "falência de múltiplos órgãos"; nos exemplos de
//   erro, também "parada respiratória"). Aqui é aviso, não bloqueio.
// - Código de Ética Médica, art. 83: atesta quem verificou o óbito (o login).

export type TipoMorte = 'natural_assistida' | 'natural_sem_assistencia_ou_a_esclarecer' | 'violenta_ou_suspeita'
export type Encaminhamento = 'unidade' | 'svo' | 'causa_desconhecida' | 'iml'
export type CondicaoAtestante = 'assistente' | 'substituto'
export type DestinoCorpo = 'funeraria' | 'svo' | 'iml'

export const AVISO_PRONTUARIO = 'Registro para o prontuário. A Declaração de Óbito é o formulário oficial do Ministério da Saúde.'

export const TIPOS_MORTE: { valor: TipoMorte; rotulo: string; orientacao: string; fonte: string }[] = [
  {
    valor: 'natural_assistida',
    rotulo: 'Natural, com assistência',
    orientacao: 'O médico da unidade atesta, como assistente ou substituto, e preenche a D.O. do Ministério da Saúde.',
    fonte: 'Res. CFM 1.779/2005, art. 2º; Portaria SVS/MS 116/2009, art. 20',
  },
  {
    valor: 'natural_sem_assistencia_ou_a_esclarecer',
    rotulo: 'Natural sem assistência ou a esclarecer',
    orientacao: 'O corpo vai ao SVO, que emite a D.O. Onde não há SVO, o médico da unidade emite a D.O. com "causa da morte desconhecida" na Parte I.',
    fonte: 'Res. CFM 1.779/2005, art. 2º; Portaria SVS/MS 116/2009, art. 22; manual MS 2022',
  },
  {
    valor: 'violenta_ou_suspeita',
    rotulo: 'Violenta ou suspeita',
    orientacao: 'O corpo vai ao IML, que emite a D.O. A unidade não preenche a D.O. e registra a comunicação à polícia.',
    fonte: 'Res. CFM 1.779/2005, art. 2º; Portaria SVS/MS 116/2009, art. 25',
  },
]

export const ROTULO_TIPO_MORTE: Record<TipoMorte, string> = Object.fromEntries(TIPOS_MORTE.map((t) => [t.valor, t.rotulo])) as Record<TipoMorte, string>

export const ROTULO_ENCAMINHAMENTO: Record<Encaminhamento, string> = {
  unidade: 'A unidade atesta',
  svo: 'Encaminhado ao SVO',
  causa_desconhecida: 'A unidade atesta: causa da morte desconhecida (sem SVO)',
  iml: 'Encaminhado ao IML',
}

export const ROTULO_DESTINO: Record<DestinoCorpo, string> = { funeraria: 'Funerária', svo: 'SVO', iml: 'IML' }

export const ROTULO_IDENTIFICACAO: Record<string, string> = {
  pulseira: 'Pulseira', documento: 'Documento', pulseira_e_documento: 'Pulseira e documento',
}

export const ROTULO_PENDENCIA: Record<string, string> = {
  comunicacao_familia: 'comunicação à família',
  policia: 'comunicação à polícia',
  identificacao: 'conferência da identificação do corpo',
  liberacao: 'liberação do corpo',
  via_branca: 'via branca guardada para a SMS',
  via_amarela: 'via amarela entregue à família',
  via_rosa: 'via rosa no prontuário',
}

/** "Falta: comunicação à família, liberação do corpo". Vazio quando nada falta. */
export function rotuloPendencias(p: string[]): string {
  return p.length ? `Falta: ${p.map((x) => ROTULO_PENDENCIA[x] ?? x).join(', ')}` : ''
}

/** O corpo vai para onde o caminho do óbito manda (o servidor recusa outro destino). */
export function destinoDoCorpo(enc: Encaminhamento): DestinoCorpo {
  return enc === 'iml' ? 'iml' : enc === 'svo' ? 'svo' : 'funeraria'
}

// ── termos vagos (MS/CFM 2009): só os citados na fonte ───────────────────────
const TERMOS: { rotulo: string; re: RegExp }[] = [
  { rotulo: 'parada cardiorrespiratória', re: /parada\s+cardio\s*-?\s*r?respiratoria/ },
  { rotulo: 'parada cardíaca', re: /parada\s+cardiaca/ },
  { rotulo: 'parada respiratória', re: /parada\s+respiratoria/ },
  { rotulo: 'falência de múltiplos órgãos', re: /falencia\s+(de\s+)?multipl[ao]s?\s+(de\s+|dos\s+)?orgaos/ },
]
const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Os termos vagos do texto, na ordem da lista (o mesmo que private.obito_termos_vagos). */
export function termosVagos(texto: string | null | undefined): string[] {
  const x = semAcento(texto ?? '')
  return TERMOS.filter((t) => t.re.test(x)).map((t) => t.rotulo)
}

// ── o formulário ────────────────────────────────────────────────────────────
export type ValorObito = {
  /** datetime-local, hora de Brasília */
  hora: string
  tipo: TipoMorte | ''
  /** só na morte natural sem assistência ou a esclarecer */
  encaminhamento: 'svo' | 'causa_desconhecida' | ''
  numeroDo: string
  condicao: CondicaoAtestante | ''
  causaA: string; causaB: string; causaC: string; causaD: string; parte2: string
  /** violenta: a polícia já foi comunicada? (pode ficar para depois) */
  policiaComunicada: boolean
  policiaEm: string
  ocorrencia: string
}

export const obitoVazio = (hora = ''): ValorObito => ({
  hora, tipo: '', encaminhamento: '', numeroDo: '', condicao: '',
  causaA: '', causaB: '', causaC: '', causaD: '', parte2: '',
  policiaComunicada: false, policiaEm: '', ocorrencia: '',
})

export const soDigitos = (s: string) => s.replace(/\D/g, '')

/** O campo datetime-local mostra e devolve a hora de Brasília, não a do aparelho. */
export const doCampo = (v: string) => new Date(`${v}:00-03:00`)

export function encaminhamentoDe(v: Pick<ValorObito, 'tipo' | 'encaminhamento'>): Encaminhamento | null {
  if (v.tipo === 'natural_assistida') return 'unidade'
  if (v.tipo === 'violenta_ou_suspeita') return 'iml'
  if (v.tipo === 'natural_sem_assistencia_ou_a_esclarecer') return v.encaminhamento || null
  return null
}

/** A unidade preenche a D.O.: natural com assistência, ou sem SVO ("causa da morte desconhecida"). */
export function unidadeEmiteDo(v: Pick<ValorObito, 'tipo' | 'encaminhamento'>): boolean {
  const e = encaminhamentoDe(v)
  return e === 'unidade' || e === 'causa_desconhecida'
}

/** As regras que a tela marca antes de enviar (o servidor confere de novo). */
export function regrasObito(v: ValorObito, ctx: { agora: number; desde?: string | null }): { ok: boolean; texto: string }[] {
  const r: { ok: boolean; texto: string }[] = []
  const ms = v.hora ? doCampo(v.hora).getTime() : NaN
  const desde = ctx.desde ? Date.parse(ctx.desde) : NaN
  r.push({ ok: Number.isFinite(ms) && ms <= ctx.agora + 60_000 && (!Number.isFinite(desde) || ms >= desde - 60_000), texto: 'Hora do óbito (entre a entrada e agora)' })
  r.push({ ok: !!v.tipo, texto: 'Tipo de morte' })
  if (v.tipo === 'natural_sem_assistencia_ou_a_esclarecer') r.push({ ok: !!v.encaminhamento, texto: 'SVO ou "causa da morte desconhecida" (sem SVO)' })
  if (unidadeEmiteDo(v)) {
    r.push({ ok: /^\d{9}$/.test(soDigitos(v.numeroDo)), texto: 'Nº da Declaração de Óbito (9 dígitos)' })
    r.push({ ok: !!v.condicao, texto: 'Você atesta como assistente ou substituto' })
  }
  if (encaminhamentoDe(v) === 'unidade') r.push({ ok: v.causaA.trim().length >= 3, texto: 'Causa na linha a da Parte I' })
  return r
}

/** Avisos de termo vago, como o servidor grava (linha e termo). */
export function avisosObito(v: ValorObito): string[] {
  const linhas: [string, string][] = encaminhamentoDe(v) === 'causa_desconhecida'
    ? [['Parte II', v.parte2]]
    : [['linha a', v.causaA], ['linha b', v.causaB], ['linha c', v.causaC], ['linha d', v.causaD], ['Parte II', v.parte2]]
  return linhas.flatMap(([l, t]) => termosVagos(t).map((x) => `${l}: "${x}" é modo de morrer, não causa. Escreva a doença ou lesão que levou a ele.`))
}

/** O jsonb para registrar_desfecho, finalizar_observacao e dar_alta (hora e número no primeiro nível, como antes). */
export function detalhesObito(v: ValorObito): Record<string, unknown> {
  const enc = encaminhamentoDe(v)
  const obito: Record<string, string> = { tipo_morte: v.tipo }
  if (v.tipo === 'natural_sem_assistencia_ou_a_esclarecer' && v.encaminhamento) obito.encaminhamento = v.encaminhamento
  if (unidadeEmiteDo(v) && v.condicao) obito.atestado_condicao = v.condicao
  if (enc !== 'causa_desconhecida') {
    const linhas: [string, string][] = [['causa_a', v.causaA], ['causa_b', v.causaB], ['causa_c', v.causaC], ['causa_d', v.causaD]]
    for (const [k, t] of linhas) if (t.trim()) obito[k] = t.trim()
  }
  if (v.parte2.trim()) obito.parte2 = v.parte2.trim()
  if (v.tipo === 'violenta_ou_suspeita' && v.policiaComunicada) {
    if (v.policiaEm) obito.policia_comunicada_em = doCampo(v.policiaEm).toISOString()
    if (v.ocorrencia.trim()) obito.policia_ocorrencia = v.ocorrencia.trim()
  }
  const d: Record<string, unknown> = { obito }
  if (v.hora) d.hora_obito = doCampo(v.hora).toISOString()
  if (unidadeEmiteDo(v) && soDigitos(v.numeroDo)) d.numero_do = soDigitos(v.numeroDo)
  return d
}

// ── o que as RPCs devolvem ──────────────────────────────────────────────────
type Quem = { em: string; por: string | null }
export type ObitoRegistro = {
  id: string; paciente_id: string; episodio_id: string | null; internacao_id: string | null
  origem: 'porta' | 'observacao' | 'internacao'; setor: string | null; leito_id: string | null; leito: string | null
  leito_aguardando: boolean
  hora_obito: string; tipo_morte: TipoMorte; encaminhamento: Encaminhamento
  numero_do: string | null; atestado_condicao: CondicaoAtestante | null; atestado_por: string | null
  causas: { a: string | null; b: string | null; c: string | null; d: string | null; parte2: string | null }
  cid_interno: string | null; avisos: string[]
  policia: (Quem & { ocorrencia: string | null }) | null
  vias: { branca: Quem | null; amarela: Quem | null; rosa: Quem | null }
  identificacao: (Quem & { meio: string }) | null
  liberacao: (Quem & { destino: DestinoCorpo }) | null
  comunicada_familia: boolean
  documento_id: string | null; registrado_em: string; registrado_por: string | null
  anulado_em: string | null; motivo_anulacao: string | null
  pendencias: string[]
  /** obito_do_paciente */
  comunicacoes?: { id: string; por: string | null; papel: string; destinatario_nome: string; parentesco: string; em: string; meio: string; testemunha: string | null }[]
  do_anuladas?: { numero_anulado: string; numero_novo: string; motivo: string; em: string; por: string | null }[]
  pode?: PodeObito
  /** obitos_pendentes */
  paciente?: string
}
export type PodeObito = { comunicar: boolean; policia: boolean; corpo: boolean; vias: boolean; anular_do: boolean }

/** As causas como o médico escreveu, em linhas ("a. …"). */
export function linhasCausas(c: ObitoRegistro['causas']): { rotulo: string; texto: string }[] {
  return ([['Parte I, a', c.a], ['Parte I, b', c.b], ['Parte I, c', c.c], ['Parte I, d', c.d], ['Parte II', c.parte2]] as [string, string | null][])
    .filter(([, t]) => !!t && t.trim()).map(([rotulo, t]) => ({ rotulo, texto: (t as string).trim() }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Leitura do pacote de alta (a resposta de abrir_pacote_alta /
// ver_pacote_alta_equipe) para a página do paciente.
//
// O conteúdo de cada documento é o JSON que a ferramenta gravou (as mesmas
// formas de src/lib/folhas.ts). Aqui ele vira blocos que o paciente entende;
// o que não tem forma conhecida cai na lista rótulo: valor. Nada é inventado:
// campo vazio some, e bloco sem campo nenhum não aparece.
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentoPacote = {
  tipo: string
  numero: string | null
  emitido_em: string
  assinado_em?: string | null
  conteudo: string
  autor?: string | null
  crm?: string | null
  uf_crm?: string | null
}

export type ConteudoPacote = {
  situacao: 'ok'
  situacao_link?: string
  primeiro_nome: string
  nome?: string
  idade_anos?: number | null
  idade_meses?: number | null
  unidade: string
  setor?: string | null
  leito?: string | null
  internado_em?: string | null
  alta_em: string | null
  gerado_em?: string | null
  expira_em: string
  diagnostico_cid?: string | null
  orientacoes: string[]
  retorno: string | null
  sinais_retorno?: string[]
  retorno_detalhes?: { onde?: string; quando?: string; exame_controle?: string; levar?: string } | null
  medico?: { nome: string | null; crm: string | null; uf_crm: string | null } | null
  documentos: DocumentoPacote[]
  exames?: { exame: string; resultado: string; quando: string | null }[]
}

const FUSO = 'America/Sao_Paulo'
export const dia = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO }) : ''
export const diaCurto = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO }) : ''
export const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO }) : ''

type Obj = Record<string, unknown>
const texto = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})

export function lerJson(conteudo: string): Obj | null {
  try {
    const v: unknown = JSON.parse(conteudo)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null
  } catch {
    return null
  }
}

export function idade(anos: number | null | undefined, meses: number | null | undefined): string {
  if (anos == null) return ''
  if (anos >= 2) return `${anos} anos`
  const m = meses ?? anos * 12
  if (m < 1) return 'menos de 1 mês'
  return m === 1 ? '1 mês' : `${m} meses`
}

export function assinatura(d: { autor?: string | null; crm?: string | null; uf_crm?: string | null }): { nome: string; crm: string } | null {
  const nome = texto(d.autor)
  if (!nome) return null
  const crm = texto(d.crm) ? `CRM${texto(d.uf_crm) ? `-${texto(d.uf_crm)}` : ''} ${texto(d.crm)}` : ''
  return { nome, crm }
}

// ── orientações e "volte ao pronto-socorro se" ──────────────────────────────
// A frase-modelo "Volte ao pronto-socorro se …" das orientações (pacotes
// montados antes dos sinais separados) vai para o quadro vermelho, com o
// mesmo texto: só muda de lugar.
const VOLTE = /^volte ao pronto[- ]socorro se\s*/i

export function separarOrientacoes(p: ConteudoPacote): { passos: string[]; sinais: string[] } {
  const passos: string[] = []
  const sinais: string[] = []
  for (const o of p.orientacoes ?? []) {
    const t = texto(o)
    if (!t) continue
    if (VOLTE.test(t)) sinais.push(t.replace(VOLTE, '').replace(/\.$/, ''))
    else passos.push(t)
  }
  for (const s of p.sinais_retorno ?? []) if (texto(s)) sinais.push(texto(s))
  return { passos, sinais }
}

// ── receita ─────────────────────────────────────────────────────────────────
export type ItemReceita = { nome: string; uso: string; explicacao: string }
export function lerReceita(conteudo: string): { itens: ItemReceita[]; obs: string } | null {
  const j = lerJson(conteudo)
  const r = obj(j?.receita)
  if (!Array.isArray(r.itens)) return null
  const itens = (r.itens as unknown[])
    .map(obj)
    .filter((i) => texto(i.medicamento))
    .map((i) => ({
      nome: [texto(i.medicamento), texto(i.dose)].filter(Boolean).join(' '),
      uso: [texto(i.posologia), texto(i.quantidade) ? `quantidade: ${texto(i.quantidade)}` : ''].filter(Boolean).join(' · '),
      // explicação para o paciente, se a receita trouxer (a ferramenta atual não tem o campo)
      explicacao: texto(i.explicacao) || texto(i.orientacao) || texto(i.orientacao_paciente),
    }))
  return itens.length || texto(r.obs) ? { itens, obs: texto(r.obs) } : null
}

// ── atestado (o mesmo texto da folha impressa) ──────────────────────────────
export function lerAtestado(conteudo: string): { titulo: string; texto: string; obs: string } | null {
  const j = lerJson(conteudo)
  const a = obj(j?.atestado)
  if (!Object.keys(a).length) return null
  const nome = texto(obj(j?.paciente).nome)
  const quem = nome || 'o(a) paciente'
  const dias = texto(a.dias)
  const data = texto(obj(j?.paciente).dataAtual)
  const dataBr = /^\d{4}-\d{2}-\d{2}/.test(data) ? data.slice(0, 10).split('-').reverse().join('/') : ''
  const nDias = dias ? `${dias} dia(s)` : ''
  let corpo: string
  if (a.tipo === 'comparecimento') {
    corpo = `Atesto, para os devidos fins, que ${quem} compareceu a esta unidade${dataBr ? ` em ${dataBr}` : ''}${nDias ? `, necessitando de ${nDias} de afastamento de suas atividades` : ''}.`
  } else if (a.tipo === 'afastamento') {
    corpo = `Atesto, para os devidos fins, que ${quem} esteve sob cuidados médicos${nDias ? `, necessitando de ${nDias} de afastamento de suas atividades laborais` : ''}${texto(a.cid) ? ` (CID: ${texto(a.cid)})` : ''}.`
  } else {
    corpo = `Atesto, para os devidos fins, que ${quem}${nDias ? ` necessita de ${nDias} de repouso` : ' necessita de repouso'}, devendo manter-se em observação clínica.`
  }
  const titulo = a.tipo === 'comparecimento' ? 'Comparecimento' : a.tipo === 'afastamento' ? `Afastamento${nDias ? ` de ${nDias}` : ''}` : `Repouso${nDias ? ` de ${nDias}` : ''}`
  return { titulo, texto: corpo, obs: texto(a.texto) }
}

// ── encaminhamento ──────────────────────────────────────────────────────────
export function lerEncaminhamento(conteudo: string): { especialidade: string; prioridade: string; resumo: string; hipotese: string } | null {
  const j = lerJson(conteudo)
  const e = obj(j?.encaminhamento)
  const r = {
    especialidade: texto(e.especialidade),
    prioridade: texto(e.prioridade),
    resumo: texto(e.resumo),
    hipotese: texto(obj(j?.paciente).diagnostico),
  }
  return r.especialidade || r.resumo ? r : null
}

// ── pedido de exames: porta ({pedido:{texto}}) e internação ({exames:{texto}}) ─
export function lerPedidoExames(conteudo: string): string[] | null {
  const j = lerJson(conteudo)
  const t = texto(obj(j?.pedido).texto) || texto(obj(j?.exames).texto)
  if (!t) return null
  const linhas = t.split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
  return linhas.length ? linhas : null
}

// ── sumário de alta ─────────────────────────────────────────────────────────
// Ainda não há ferramenta que grave o sumário no app; aceita texto corrido ou
// um JSON com as partes que o protótipo mostra.
const PARTES_SUMARIO: { titulo: string; chaves: string[] }[] = [
  { titulo: 'Por que você foi internado', chaves: ['por_que', 'motivo_internacao', 'motivo'] },
  { titulo: 'Como foi o tratamento', chaves: ['tratamento', 'evolucao', 'resumo'] },
  { titulo: 'Como você saiu', chaves: ['condicao_alta', 'como_saiu'] },
]
export function lerSumario(conteudo: string): { partes: { titulo: string; texto: string }[]; diagnostico: string } | null {
  const j = lerJson(conteudo)
  if (!j) {
    const t = conteudo.trim()
    return t ? { partes: [{ titulo: '', texto: t }], diagnostico: '' } : null
  }
  const partes = PARTES_SUMARIO.map((p) => ({ titulo: p.titulo, texto: p.chaves.map((k) => texto(j[k])).find(Boolean) ?? '' })).filter((p) => p.texto)
  const diagnostico = texto(j.diagnostico_paciente) || texto(j.diagnostico)
  const livre = texto(j.texto)
  if (livre) partes.push({ titulo: partes.length ? 'Observações' : '', texto: livre })
  return partes.length || diagnostico ? { partes, diagnostico } : null
}

// ── o que não tem forma conhecida ───────────────────────────────────────────
export function legivel(conteudo: string): { rotulo: string; valor: string }[] {
  let raiz: unknown
  try {
    raiz = JSON.parse(conteudo)
  } catch {
    return conteudo.trim() ? [{ rotulo: '', valor: conteudo }] : []
  }
  const linhas: { rotulo: string; valor: string }[] = []
  const andar = (v: unknown, chave: string) => {
    if (/(^id$|_id$|^paciente$|^setor|^unidade|cpf|cns|nascimento)/i.test(chave)) return
    if (v === null || v === undefined || v === '' || v === false) return
    if (Array.isArray(v)) return v.forEach((x) => andar(x, chave))
    if (typeof v === 'object') return Object.entries(v as Obj).forEach(([k, x]) => andar(x, k))
    const rotulo = chave.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
    linhas.push({ rotulo: rotulo.charAt(0).toUpperCase() + rotulo.slice(1), valor: v === true ? 'sim' : String(v) })
  }
  andar(raiz, '')
  return linhas
}

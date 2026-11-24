// Passômetro do médico (pedido 8; PS1 a PS3 = A do RT em 23/11/2026,
// docs/plantonista/PASSOMETRO-DIAGNOSTICO.md). Funções puras sobre o que
// public.passometro devolve: os pacientes que o médico cuida no plantão, com
// as pendências de cada um (public.pendencias, as mesmas do leito).

export type PendenciaPassometro = {
  id: string
  tipo: string
  descricao: string
  prazo: string | null
  impeditiva: boolean
  situacao: string
  criada_em: string
  autor_id: string | null
  resolvida_por: string | null
  resolvida_em: string | null
}

export type PacientePassometro = {
  internacao_id: string
  paciente_id: string
  nome: string
  data_nascimento: string | null
  sexo: string | null
  setor_id: string
  setor: string
  leito: string | null
  status: string
  desde: string | null
  cid_principal: string | null
  queixa: string | null
  pendencias: PendenciaPassometro[]
}

const texto = (v: unknown) => (typeof v === 'string' ? v : v == null ? null : String(v))
const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [])

/** Lê o jsonb do banco sem confiar no formato. */
export function lerPassometro(json: unknown): PacientePassometro[] {
  return lista(json).map((p) => ({
    internacao_id: String(p.internacao_id ?? ''),
    paciente_id: String(p.paciente_id ?? ''),
    nome: String(p.nome ?? ''),
    data_nascimento: texto(p.data_nascimento),
    sexo: texto(p.sexo),
    setor_id: String(p.setor_id ?? ''),
    setor: String(p.setor ?? ''),
    leito: texto(p.leito),
    status: String(p.status ?? ''),
    desde: texto(p.desde),
    cid_principal: texto(p.cid_principal),
    queixa: texto(p.queixa),
    pendencias: lista(p.pendencias).map((x) => ({
      id: String(x.id ?? ''),
      tipo: String(x.tipo ?? ''),
      descricao: String(x.descricao ?? ''),
      prazo: texto(x.prazo),
      impeditiva: x.impeditiva === true,
      situacao: String(x.situacao ?? ''),
      criada_em: String(x.criada_em ?? ''),
      autor_id: texto(x.autor_id),
      resolvida_por: texto(x.resolvida_por),
      resolvida_em: texto(x.resolvida_em),
    })),
  }))
}

/** Pacientes por setor, na ordem em que o banco mandou (setor, leito, nome). */
export function porSetor(pacientes: PacientePassometro[]): { setor: string; pacientes: PacientePassometro[] }[] {
  const grupos: { setor: string; pacientes: PacientePassometro[] }[] = []
  for (const p of pacientes) {
    const g = grupos.find((x) => x.setor === p.setor)
    if (g) g.pacientes.push(p)
    else grupos.push({ setor: p.setor, pacientes: [p] })
  }
  return grupos
}

export const abertas = (p: { pendencias: PendenciaPassometro[] }) => p.pendencias.filter((x) => x.situacao === 'aberta')

/** Abertas com prazo vencido em `agora`. */
export function vencidas(p: { pendencias: PendenciaPassometro[] }, agora: number): PendenciaPassometro[] {
  return abertas(p).filter((x) => !!x.prazo && Date.parse(x.prazo) < agora)
}

/** Abertas e vencidas de um paciente (revisão do Passômetro, M2). */
export function contagemPendencias(p: { pendencias: PendenciaPassometro[] }, agora: number): { abertas: number; vencidas: number } {
  return { abertas: abertas(p).length, vencidas: vencidas(p, agora).length }
}

/** Faixa do topo (M3): "12 pacientes · 5 abertas · 1 vencida". */
export function resumoPassometro(pacientes: PacientePassometro[], agora: number): { pacientes: number; abertas: number; vencidas: number } {
  let ab = 0
  let ve = 0
  for (const p of pacientes) {
    const c = contagemPendencias(p, agora)
    ab += c.abertas
    ve += c.vencidas
  }
  return { pacientes: pacientes.length, abertas: ab, vencidas: ve }
}

/**
 * Ordem dentro do setor (M3): quem tem pendência vencida primeiro, depois quem
 * tem mais abertas; no empate, a ordem do banco (leito, nome).
 */
export function ordenarPorUrgencia(pacientes: PacientePassometro[], agora: number): PacientePassometro[] {
  return pacientes
    .map((p, i) => ({ p, i, c: contagemPendencias(p, agora) }))
    .sort((a, b) => b.c.vencidas - a.c.vencidas || b.c.abertas - a.c.abertas || a.i - b.i)
    .map((x) => x.p)
}

/** Por que o passômetro está vazio (M1), pela situação do check-in no servidor. */
export type MotivoVazio = 'sem_escala' | 'sem_checkin' | 'checkout' | 'sem_pacientes' | 'indefinido'

export function motivoVazio(s: { na_janela?: boolean; liberado?: boolean; pendente?: unknown } | null | undefined): MotivoVazio {
  if (!s) return 'indefinido'
  if (s.liberado) return 'sem_pacientes'
  if (s.na_janela) return s.pendente ? 'sem_checkin' : 'checkout'
  return 'sem_escala'
}

/** Dias inteiros desde a entrada no setor (0 = hoje). */
export function diasDesde(iso: string | null, agora: number): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((agora - t) / 86_400_000))
}

const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) // padrao-ok: domínio puro, testado no node sem o alias @/ (mesmo fuso de @/lib/formato)

/**
 * Começo do resumo da passagem com as pendências abertas (PS2 = A): o colega
 * recebe o que ficou por fazer. O médico completa e edita antes de enviar.
 */
export function textoPassagem(pendencias: PendenciaPassometro[]): string {
  const ab = pendencias
    .filter((x) => x.situacao === 'aberta' && x.tipo !== 'observacao')
    .sort((a, b) => (a.prazo ? Date.parse(a.prazo) : Infinity) - (b.prazo ? Date.parse(b.prazo) : Infinity))
  if (ab.length === 0) return ''
  const itens = ab.map((x) => `${x.descricao.trim()}${x.prazo ? ` (até ${fmtHora.format(new Date(x.prazo))})` : ''}`)
  return `Pendências: ${itens.join('; ')}.\n`
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) // padrao-ok: domínio puro, testado no node sem o alias @/ (mesmo fuso de @/lib/formato)

export type CabecalhoFolha = { unidade: string; medico: string; emitidoEm: string; idade: (nascimento: string) => string }

/**
 * Folha A4 do passômetro (PS3 = A): leito, paciente, diagnóstico, pendências
 * abertas e espaço para anotar à mão. Só depois de registrar_impressao_passometro.
 */
export function htmlFolha(pacientes: PacientePassometro[], c: CabecalhoFolha): string {
  const linhas = porSetor(pacientes).map((g) => {
    const corpo = g.pacientes.map((p) => {
      const pend = abertas(p)
      return `<tr>
  <td class="leito">${esc(p.leito ?? '—')}</td>
  <td><b>${esc(p.nome)}</b><br><span class="sub">${esc([p.data_nascimento ? c.idade(p.data_nascimento) : '', p.sexo ?? ''].filter(Boolean).join(' · '))}</span></td>
  <td>${esc(p.cid_principal ?? p.queixa ?? '')}</td>
  <td>${pend.length ? `<ul>${pend.map((x) => `<li>☐ ${esc(x.descricao)}${x.prazo ? ` <span class="sub">(até ${fmtHora.format(new Date(x.prazo))})</span>` : ''}</li>`).join('')}</ul>` : '<span class="sub">Nenhuma</span>'}</td>
  <td class="anota"></td>
</tr>`
    }).join('\n')
    return `<tr class="setor"><th colspan="5">${esc(g.setor)} · ${g.pacientes.length} ${g.pacientes.length === 1 ? 'paciente' : 'pacientes'}</th></tr>\n${corpo}`
  }).join('\n')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Passômetro · ${esc(c.unidade)}</title>
<style>
@page { size: A4 landscape; margin: 12mm; }
body { font: 11px/1.35 system-ui, sans-serif; color: black; background: white; margin: 0; }
h1 { font-size: 16px; margin: 0 0 2px; }
.cab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid dimgray; padding: 4px 6px; vertical-align: top; text-align: left; }
thead th { background: gainsboro; }
tr.setor th { background: whitesmoke; font-size: 12px; }
td.leito { width: 7%; font-weight: 600; } td.anota { width: 24%; }
ul { margin: 0; padding: 0; list-style: none; } li { margin: 0 0 2px; }
.sub { color: dimgray; font-size: 10px; }
.rodape { margin-top: 8px; font-size: 9.5px; color: dimgray; }
tr { page-break-inside: avoid; }
</style></head><body>
<div class="cab"><div><h1>Passômetro</h1><span class="sub">${esc(c.unidade)}</span></div>
<div class="sub">Emitido por ${esc(c.medico)} em ${esc(fmtDataHora.format(new Date(c.emitidoEm)))} · ${pacientes.length} ${pacientes.length === 1 ? 'paciente' : 'pacientes'}</div></div>
<table><thead><tr><th>Leito</th><th>Paciente</th><th>Diagnóstico</th><th>Pendências abertas</th><th>Anotações</th></tr></thead>
<tbody>
${linhas}
</tbody></table>
<p class="rodape">Folha de trabalho do plantão, com dado de paciente: impressão registrada no prontuário. As pendências valem as do sistema; o que for feito, marque no app. Descarte em lixo seguro ao fim do plantão.</p>
</body></html>`
}

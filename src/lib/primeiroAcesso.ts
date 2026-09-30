import { conferirSenha, type RegraSenha } from '@/lib/senha'
import type { Papel } from '@/types/database'

// Primeiro acesso por convite ou contrato (protótipo primeiro-acesso.html).
// Máscaras, dígito do CPF, regras de senha e as chaves de aviso — as mesmas
// regras que o banco confere em private.aplicar_primeiro_acesso.

/** Versão do termo mostrada na tela. O banco recusa versão diferente da vigente. */
export const TERMO_USO_VERSAO = 'termo-uso-sigilo-2026-10'

export type Conselho = 'CRM' | 'CRF' | 'COREN'
export const CONSELHOS: Conselho[] = ['CRM', 'CRF', 'COREN']

/** Conselho sugerido pelo papel do convite. */
export function conselhoDoPapel(papel: Papel | null | undefined): Conselho {
  if (papel === 'farmaceutico') return 'CRF'
  if (papel === 'enfermeiro' || papel === 'tecnico_enfermagem') return 'COREN'
  return 'CRM'
}

/** Papéis que atuam no paciente: registro profissional obrigatório. */
export function exigeRegistro(papel: Papel | null | undefined): boolean {
  return (
    papel === 'plantonista' ||
    papel === 'telemedicina' ||
    papel === 'enfermeiro' ||
    papel === 'tecnico_enfermagem' ||
    papel === 'farmaceutico'
  )
}

// ── Máscaras ────────────────────────────────────────────────────────────────
export function mascaraConvite(v: string): string {
  let cru = v.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cru.startsWith('CC')) cru = cru.slice(2)
  return 'CC-' + cru.slice(0, 5)
}

export function mascaraContrato(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 7)
  if (!d) return ''
  return d.length > 4 ? `CT-${d.slice(0, 4)}-${d.slice(4)}` : `CT-${d}`
}

export function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  let s = d.slice(0, 3)
  if (d.length > 3) s += '.' + d.slice(3, 6)
  if (d.length > 6) s += '.' + d.slice(6, 9)
  if (d.length > 9) s += '-' + d.slice(9)
  return s
}

export function mascaraData(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8)
  let s = d.slice(0, 2)
  if (d.length > 2) s += '/' + d.slice(2, 4)
  if (d.length > 4) s += '/' + d.slice(4)
  return s
}

// ── Conferências ────────────────────────────────────────────────────────────
export function cpfValido(v: string): boolean {
  const d = v.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const digito = (ate: number) => {
    let s = 0
    for (let i = 0; i < ate; i++) s += Number(d[i]) * (ate + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

/** dd/mm/aaaa → aaaa-mm-dd, ou null se a data não existe ou foge de 16–100 anos. */
export function nascimentoIso(v: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v)
  if (!m) return null
  const [, dd, mm, aaaa] = m
  const data = new Date(Number(aaaa), Number(mm) - 1, Number(dd))
  if (data.getFullYear() !== Number(aaaa) || data.getMonth() !== Number(mm) - 1 || data.getDate() !== Number(dd)) return null
  const hoje = new Date()
  const idade = (hoje.getTime() - data.getTime()) / (365.25 * 24 * 3600 * 1000)
  if (idade < 16 || idade > 100) return null
  return `${aaaa}-${mm}-${dd}`
}

/** As regras de senha marcadas ao vivo — as de src/lib/senha.ts, a fonte única. */
export function regrasSenha(senha: string, email: string) {
  const { regras } = conferirSenha(senha, '', email)
  const ok = (chave: RegraSenha['chave']) => regras.find((r) => r.chave === chave)?.ok ?? false
  return { tamanho: ok('tamanho'), letra: ok('letra'), numero: ok('numero'), diferenteEmail: ok('email') }
}

// ── O que vira aviso ────────────────────────────────────────────────────────
export type ChaveAviso =
  | 'observacao_6h'
  | 'leito_novo'
  | 'prescricao_devolvida'
  | 'item_abaixo_minimo'
  | 'troca_plantao'
  | 'fim_turno_30min'

export const AVISOS: { chave: ChaveAviso; titulo: string; texto: string; cor: string; padrao: boolean; fixo?: true }[] = [
  { chave: 'observacao_6h', titulo: 'Observação passando de 6 horas', texto: 'O prazo com consequência clínica', cor: 'bg-observacao', padrao: true, fixo: true },
  { chave: 'leito_novo', titulo: 'Leito novo sob seu cuidado', texto: 'Quando a coordenação te atribui um leito no turno', cor: 'bg-leitos', padrao: true },
  { chave: 'prescricao_devolvida', titulo: 'Prescrição devolvida pela farmácia', texto: 'Com o motivo e quem devolveu', cor: 'bg-suprimento', padrao: true },
  { chave: 'item_abaixo_minimo', titulo: 'Item abaixo do mínimo', texto: 'Falta na farmácia satélite da sua unidade', cor: 'bg-suprimento', padrao: false },
  { chave: 'troca_plantao', titulo: 'Troca de plantão pedida por colega', texto: 'Só se envolver a sua escala', cor: 'bg-turno', padrao: true },
  { chave: 'fim_turno_30min', titulo: 'Fim de turno em 30 minutos', texto: 'Para fechar as passagens antes de sair', cor: 'bg-turno', padrao: false },
]

// ── Datas ───────────────────────────────────────────────────────────────────
const fmtDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

/** "25/08, 07:00 às 19:00" */
export function formatarPlantao(inicio: string | null, fim: string | null): string | null {
  if (!inicio) return null
  const i = new Date(inicio)
  const base = `${fmtDia.format(i)}, ${fmtHora.format(i)}`
  return fim ? `${base} às ${fmtHora.format(new Date(fim))}` : base
}

/** "20/08, 19:00" */
export function formatarDiaHora(iso: string): string {
  const d = new Date(iso)
  return `${fmtDia.format(d)}, ${fmtHora.format(d)}`
}

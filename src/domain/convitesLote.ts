// Convites em lote (Fase 1, item 16b; CA2 = A do RT em 23/11/2026,
// docs/seguranca/CONTA-PELA-ADMINISTRACAO-DIAGNOSTICO.md). O gestor cola uma
// lista, uma pessoa por linha, e a tela gera um convite por pessoa pela mesma
// gerar_convite de sempre (regras de S1 e S2). Nenhuma conta nasce aqui.

import { gerarCsv } from '../lib/csv.ts'

/** Teto de pessoas por lote: uma unidade nova costuma ter 30 a 40. */
export const LIMITE_LOTE = 60

export type OpcaoPapel = { papel: string; rotulo: string }
export type LinhaLote = { linha: number; paraQuem: string; papel: string | null; erro: string | null }

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Lê a lista: uma pessoa por linha, "Nome" ou "Nome; papel" (também com tab).
 * Sem papel na linha, vale o papel padrão. O papel é reconhecido pelo nome da
 * tela ("Médico", "Técnico de enfermagem"…) ou pela chave ("plantonista"),
 * sem acento e sem diferença de maiúscula.
 */
export function lerLista(texto: string, papelPadrao: string | null, papeis: OpcaoPapel[]): LinhaLote[] {
  const porNome = new Map<string, string>()
  for (const p of papeis) { porNome.set(sem(p.rotulo), p.papel); porNome.set(sem(p.papel), p.papel) }
  const saida: LinhaLote[] = []
  texto.split(/\r?\n/).forEach((bruta, i) => {
    if (!bruta.trim()) return
    const [nomeBruto, papelBruto] = bruta.split(/[;\t]/)
    const paraQuem = (nomeBruto ?? '').trim().replace(/\s+/g, ' ')
    let papel: string | null = papelPadrao
    let erro: string | null = null
    if (papelBruto !== undefined && papelBruto.trim()) {
      papel = porNome.get(sem(papelBruto)) ?? null
      if (!papel) erro = `Papel não reconhecido: ${papelBruto.trim()}`
    }
    if (!erro && !papel) erro = 'Sem papel: escolha o papel padrão ou escreva "Nome; papel"'
    if (!erro && (paraQuem.length < 3 || paraQuem.length > 120)) erro = 'Nome de 3 a 120 letras'
    saida.push({ linha: i + 1, paraQuem, papel, erro })
  })
  return saida
}

export type ConviteGerado = { paraQuem: string; papelRotulo: string; codigo: string; expiraEm: string }

/** Arquivo para entregar os códigos: nome, papel, código e validade. */
export function csvConvitesLote(gerados: ConviteGerado[], unidade: string, geradoEm: string, validade: (iso: string) => string): string {
  return gerarCsv(
    ['Para quem', 'Papel', 'Código', 'Vale até'],
    gerados.map((g) => [g.paraQuem, g.papelRotulo, g.codigo, validade(g.expiraEm)]),
    { contexto: [['Unidade', unidade], ['Gerado em', geradoEm], ['Como usar', 'A pessoa entra em Primeiro acesso, digita o código e cria a senha. Cada código abre um acesso só.']] },
  )
}

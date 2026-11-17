import { LIGACOES_CID, type LigacaoCid } from './cidFerramentasMapa.ts'

// Ferramentas pelo CID no atendimento (pedido do RT de 17/11/2026, decisões
// CF1–CF9 = A, docs/clinico/CID-FERRAMENTAS-CELULAR-DIAGNOSTICO.md).
// Quando o médico escolhe o CID, a urgência e a UBS mostram as ferramentas da
// Central ligadas àquele CID. O bloco só abre ferramentas: não mostra
// resultado, dose, cor nem conduta (CF4). O mapa, com a ficha que o versiona,
// fica em cidFerramentasMapa.ts (o gate do LG10 sobe a versão quando muda).

/** "I21.0 — Infarto…", "i210", "I21" → "I21"; vazio se não for código CID-10. */
export function categoriaCid(valor: string): string {
  const m = valor.trim().toUpperCase().match(/^([A-Z])(\d{2})/)
  return m ? m[1] + m[2] : ''
}

/** CF2: categoria ("I21") ou faixa de categorias ("I20-I25"). */
export function casaFaixa(faixa: string, categoria: string): boolean {
  const [de, ate = de] = faixa.split('-')
  return categoria >= de && categoria <= ate
}

export type FaixaPaciente = 'adulto' | 'pediatrico' | 'desconhecida'

/**
 * Ferramentas ligadas ao CID, sem repetir ferramenta, na ordem do mapa.
 * CF6: criança (até 13 anos, 11 meses e 29 dias) vê só as pediátricas e as de
 * público "ambos"; adulto, só as de adulto e as de "ambos"; sem idade, todas.
 */
export function ferramentasDoCid(cid: string, faixa: FaixaPaciente): LigacaoCid[] {
  const categoria = categoriaCid(cid)
  if (!categoria) return []
  const vistas = new Set<string>()
  const lista: LigacaoCid[] = []
  for (const l of LIGACOES_CID) {
    if (vistas.has(l.ficha) || !l.cids.some((f) => casaFaixa(f, categoria))) continue
    if (faixa === 'adulto' && l.publico === 'pediatrico') continue
    if (faixa === 'pediatrico' && l.publico === 'adulto') continue
    vistas.add(l.ficha)
    lista.push(l)
  }
  return lista
}

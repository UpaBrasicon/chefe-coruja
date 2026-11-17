import { GRUPOS_SECAO } from './gruposSecoes.ts'

// Piloto das calculadoras da Central (diagnóstico em
// docs/clinico/CALCULADORAS-CENTRAL-DIAGNOSTICO.md; C1–C8 = A e lista
// aprovada pelo RT em 16/11/2026). As dez ferramentas ganham o modelo novo
// primeiro; o RT confere na homologação e só depois vêm os outros lotes.
// Chave = `${secao}/${slug}` do registro (src/content/registry.tsx).

export const PILOTO_CALCULADORAS = new Set([
  'escores/heart',
  'escores/curb-65',
  'escores/sepse-adulto',
  'escores/glasgow',
  'calculadoras/iot',
  'calculadoras/infusoes-adulto',
  'emergencias/hipocalemia-reposicao-potassio',
  'emergencias/pcr-adulto',
  'pediatria/bolus',
  'pediatria/desidratacao-diarreia-ped',
])

/** Escore da tela única no piloto, pelo id da ficha (o EscoreTela não sabe o slug). */
export const ESCORES_PILOTO = new Set(['heart', 'curb-65', 'sepse-adulto', 'glasgow'])

/**
 * Ferramentas relacionadas (F4): de 2 a 5, as que costumam vir junto no
 * plantão. É escolha de navegação, não conduta.
 */
export const RELACIONADAS: Record<string, string[]> = {
  'escores/heart': ['escores/timi', 'escores/grace', 'emergencias/sca-inicial-adulto'],
  'escores/curb-65': ['escores/crb-65', 'escores/psi-port', 'emergencias/pac-antibiotico-adulto'],
  'escores/sepse-adulto': ['escores/sofa-2', 'escores/news2', 'emergencias/ressuscitacao-volemica-adulto', 'calculadoras/infusoes-adulto'],
  'escores/glasgow': ['escores/four', 'escores/canadian-ct-head', 'emergencias/trauma-inicial-adulto', 'calculadoras/iot'],
  'calculadoras/iot': ['calculadoras/infusoes-adulto', 'emergencias/sedacao-procedimento-adulto', 'emergencias/pcr-adulto'],
  'calculadoras/infusoes-adulto': ['calculadoras/iot', 'emergencias/ressuscitacao-volemica-adulto', 'escores/sepse-adulto'],
  'emergencias/hipocalemia-reposicao-potassio': ['emergencias/hipomagnesemia-reposicao-magnesio', 'protocolos/hiperpotassemia'],
  'emergencias/pcr-adulto': ['emergencias/pos-pcr-adulto', 'emergencias/taquiarritmias-adulto', 'emergencias/bradicardia-adulto', 'calculadoras/iot'],
  'pediatria/bolus': ['pediatria/infusoes', 'pediatria/rcp-pediatrica', 'pediatria/via-aerea'],
  'pediatria/desidratacao-diarreia-ped': ['pediatria/fluidoterapia-manutencao-ped', 'pediatria/sodio-ped', 'pediatria/eletrolitos-ped'],
}

// ---------------------------------------------------------------- lote 2 (RT, 16/11/2026)

/**
 * Seções inteiras já no modelo novo (resumo flutuante, abas, Central). Lote 2:
 * os 50 escores. O EscoreTela liga o modelo pela seção do endereço.
 */
// 16/11/2026: a seção Calculadoras entra no modelo (QTc pela tela única de escores).
// 17/11/2026: Emergências no modelo (escores da tela única e relacionadas pelos grupos da seção).
export const SECOES_NO_MODELO = new Set(['escores', 'calculadoras', 'emergencias'])

/**
 * Relacionadas: a lista escolhida à mão (RELACIONADAS) ou, nas seções do
 * modelo, até 3 vizinhas do mesmo grupo da seção (gruposSecoes.ts).
 */
export function relacionadasDe(chave: string): string[] {
  if (RELACIONADAS[chave]) return RELACIONADAS[chave]
  const [secao, slug] = chave.split('/')
  if (!SECOES_NO_MODELO.has(secao)) return []
  const grupo = (GRUPOS_SECAO[secao] ?? []).find((g) => g.slugs.includes(slug))
  if (!grupo) return []
  const i = grupo.slugs.indexOf(slug)
  const vizinhas = [...grupo.slugs.slice(i + 1), ...grupo.slugs.slice(0, i)].slice(0, 3)
  return vizinhas.map((s) => `${secao}/${s}`)
}

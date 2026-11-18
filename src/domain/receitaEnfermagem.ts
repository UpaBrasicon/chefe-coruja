// Receita do enfermeiro pelo protocolo do município (U6, PR 3b). A receita leva
// a identificação do protocolo usado e o ano de publicação (Resolução Cofen
// 801/2026, art. 3º, I). O protocolo vem de receita_protocolos_da_unidade
// (migration 20270415000013).

export type ItemProtocolo = { medicamento: string; posologia: string; quantidade?: string }
export type ProtocoloEnfermagem = {
  id: string; nome: string; ativo: boolean; enfermagem?: boolean; itens: ItemProtocolo[]
  origem_numero?: string | null; origem_data?: string | null; origem_orgao?: string | null
}

/** "Nome (Portaria SMS 12/2026, Secretaria Municipal de Saúde, 2026)". */
export function textoProtocoloEnfermagem(p: ProtocoloEnfermagem): string {
  const ano = p.origem_data ? p.origem_data.slice(0, 4) : ''
  return `${p.nome} (${[p.origem_numero, p.origem_orgao, ano].filter(Boolean).join(', ')})`
}

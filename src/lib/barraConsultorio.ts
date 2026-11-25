// Barra do consultório na fila do Pronto-Socorro (BT1, revisão das telas novas
// de 25/11/2026). Antes era uma linha por setor da escala: o médico escalado no
// Pronto Socorro e também na Clínica Médica, na Observação e na Sala Vermelha
// via "Nenhum consultório cadastrado nesta porta" três vezes (setores sem
// consultório) e a escolha do consultório repetida. Agora só os setores com
// consultório entram, numa linha: "Seu consultório: escolha · Consultório 1 ·
// 2 · 3 · Sala de Emergência".
// node --experimental-strip-types --test src/lib/barraConsultorio.test.ts

export type SalaDaPorta = { id: string; nome: string; tipo: string; setor_id: string; setor_nome?: string | null }
export type PortaComConsultorio = { setor: string; setorNome: string | null; consultorios: { id: string; nome: string }[] }

/** Os setores da escala que têm consultório (a sala de triagem não conta), na ordem da escala. */
export function portasComConsultorio(setores: readonly string[], salas: readonly SalaDaPorta[]): PortaComConsultorio[] {
  return setores.flatMap((setor) => {
    const doSetor = salas.filter((s) => s.setor_id === setor && s.tipo !== 'triagem')
    if (doSetor.length === 0) return []
    return [{ setor, setorNome: doSetor[0].setor_nome ?? null, consultorios: doSetor.map(({ id, nome }) => ({ id, nome })) }]
  })
}

/**
 * Rótulo curto de cada opção: o número basta quando o anterior tem o mesmo
 * nome antes do número ("Consultório 1", "2", "3", "Sala de Emergência").
 */
export function rotulosCurtos(nomes: readonly string[]): string[] {
  const partes = (n: string) => /^(.*\S)\s+(\d+)$/.exec(n.trim())
  return nomes.map((nome, i) => {
    const atual = partes(nome)
    const antes = i > 0 ? partes(nomes[i - 1]) : null
    return atual && antes && atual[1] === antes[1] ? atual[2] : nome
  })
}

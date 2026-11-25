// Sinais vitais da regulação com rótulos legíveis (RC7 da revisão unslop,
// decisão do RT de 25/11/2026). O texto dos sinais do pedido e da evolução é
// livre; quando vem com as chaves técnicas do prontuário ("saturacao-o2 87,
// frequencia-cardiaca 108"), a tela troca só a CHAVE pelo rótulo curto. O
// VALOR fica cru, como veio (regra do projeto: vitais impressos crus): sem
// arredondar, sem vírgula no lugar do ponto, sem marca de alterado. A pressão
// sistólica e a diastólica, quando vêm as duas, saem juntas ("PA 138/84"),
// com os mesmos números. Texto que não tem chave técnica volta igual.

const ROTULO: Record<string, string> = {
  'escala-dor': 'Dor',
  temperatura: 'Tax',
  'saturacao-o2': 'SpO₂',
  'frequencia-cardiaca': 'FC',
  'frequencia-respiratoria': 'FR',
  'pressao-arterial-sistolica': 'PAS',
  'pressao-arterial-diastolica': 'PAD',
  'glicemia-capilar': 'Glicemia',
  glasgow: 'Glasgow',
  peso: 'Peso',
}

const PAS = 'pressao-arterial-sistolica'
const PAD = 'pressao-arterial-diastolica'

/** "escala-dor 1, saturacao-o2 87, pressao-arterial-sistolica 138, pressao-arterial-diastolica 84" → "Dor 1 · SpO₂ 87 · PA 138/84". */
export function rotularSinaisVitais(texto: string | null | undefined): string {
  if (!texto) return ''
  const partes = texto.split(/\s*[,;]\s*/).filter((p) => p.trim() !== '')
  const lidas = partes.map((p) => {
    const m = /^([a-z0-9]+(?:-[a-z0-9]+)+|temperatura|glasgow|peso)\s*[:=]?\s+(.+)$/i.exec(p.trim())
    return m && ROTULO[m[1].toLowerCase()] ? { chave: m[1].toLowerCase(), valor: m[2].trim() } : null
  })
  // nada com chave técnica: o texto fica como a pessoa escreveu
  if (lidas.every((l) => l === null)) return texto
  const pas = lidas.find((l) => l?.chave === PAS)
  const pad = lidas.find((l) => l?.chave === PAD)
  const juntaPa = !!pas && !!pad
  const saida: string[] = []
  lidas.forEach((l, i) => {
    if (!l) { saida.push(partes[i].trim()); return }
    if (juntaPa && l.chave === PAD) return
    if (juntaPa && l.chave === PAS) { saida.push(`PA ${pas!.valor}/${pad!.valor}`); return }
    saida.push(`${ROTULO[l.chave]} ${l.valor}`)
  })
  return saida.join(' · ')
}

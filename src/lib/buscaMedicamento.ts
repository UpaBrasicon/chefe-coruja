// Busca de medicamento da prescrição (ponto 11 do plantonista,
// docs/plantonista/PONTO-11-PRESCRICAO.md). A busca é do servidor
// (buscar_medicamento: sinônimo, várias palavras, apresentação); aqui ficam o
// destaque do que foi achado e a frase do que falta para prescrever.
import { normalizar } from './search.ts'

export type MedicamentoAchado = {
  id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null
  alta_vigilancia: boolean; casou_por: string | null
}

/** O que o servidor diz que falta (o_que_falta_para_prescrever). */
export type FaltaParaPrescrever = {
  falta: ('peso' | 'idade')[]
  peso: { valor: number; metodo: string | null; em: string } | null
  peso_anterior: { valor: number; metodo: string | null; em: string } | null
}

/**
 * Divide o texto em pedaços, marcando os que batem com alguma palavra digitada
 * (sem acento, sem diferença de maiúscula). Palavra de uma letra não destaca.
 */
export function trechosAchados(texto: string, termo: string): { t: string; achou: boolean }[] {
  const palavras = normalizar(termo).split(/[^a-z0-9]+/).filter((p) => p.length >= 2)
  if (!texto || palavras.length === 0) return texto ? [{ t: texto, achou: false }] : []
  // normalizar só tira acento: o texto normalizado tem o mesmo tamanho do original
  const base = normalizar(texto)
  const marca = new Array<boolean>(texto.length).fill(false)
  for (const p of palavras) {
    for (let i = base.indexOf(p); i >= 0; i = base.indexOf(p, i + 1)) marca.fill(true, i, i + p.length)
  }
  const saida: { t: string; achou: boolean }[] = []
  for (let i = 0; i < texto.length; i++) {
    const ultimo = saida[saida.length - 1]
    if (ultimo && ultimo.achou === marca[i]) ultimo.t += texto[i]
    else saida.push({ t: texto[i], achou: marca[i] })
  }
  return saida
}

/**
 * O que ainda falta para o botão "Prescrever", na ordem da tela. `porta`: a
 * porta não pede frequência (Agora / Se necessário).
 */
export function faltaNoItem(f: { med: boolean; dose: string; via: string; posologia: string; porta: boolean },
  servidor: FaltaParaPrescrever['falta'] = []): string[] {
  const falta: string[] = []
  if (servidor.includes('idade')) falta.push('idade')
  if (servidor.includes('peso')) falta.push('peso deste atendimento')
  if (!f.med) falta.push('medicamento')
  if (!f.dose.trim()) falta.push('dose')
  if (!f.via) falta.push('via')
  if (!f.porta && !f.posologia.trim()) falta.push('frequência')
  return falta
}

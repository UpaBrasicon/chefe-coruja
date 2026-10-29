// Atestado e receita para casa: o estado em curso e os textos comuns à porta
// (aba "Atestado e receita"), ao Receituário e ao leito ("Alta e documentos",
// pontos 14 e 16 do plantonista). Moram aqui para os componentes não
// importarem telas (guia do padrão, 4.5).

export type ItemReceita = { id: string; medicamento_id: string | null; medicamento: string; posologia: string; quantidade: string }
export type EstadoDocs = {
  atTipo: 'afastamento' | 'comparecimento'; atDias: string; atCid: boolean; atEmitidoEm: string | null
  receita: ItemReceita[]; rxEmitidaEm: string | null
}
export const DOCS_INICIAL: EstadoDocs = { atTipo: 'afastamento', atDias: '', atCid: false, atEmitidoEm: null, receita: [], rxEmitidaEm: null }

/** Medicamento do cadastro, como a receita o mostra. */
export type Med = { id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null }
export const nomeMed = (m: { principio_ativo: string; apresentacao: string | null } | null) =>
  (m ? [m.principio_ativo, m.apresentacao].filter(Boolean).join(' ') : '')

// Receita padrão e favoritos têm dose de adulto: só para adulto PELA IDADE
// (decisão do RT, 02/10/2026).
export const TEXTO_PEDIATRICO =
  'Paciente pediátrico. Os protocolos e favoritos desta unidade têm dose e apresentação de adulto e não são oferecidos. Sem referência pediátrica cadastrada, prescreva item a item pela busca, por peso aferido.'

export const TEXTO_SEM_NASCIMENTO =
  'Sem data de nascimento no cadastro: o paciente não é tratado como adulto. Os protocolos e favoritos desta unidade têm dose e apresentação de adulto e não são oferecidos. Sem referência pediátrica cadastrada, prescreva item a item pela busca, por peso aferido. Cadastre a data de nascimento.'

/**
 * "Trazer da prescrição" na receita para casa (opção a do RT, 28/10/2026): só
 * o medicamento da prescrição vigente, uma vez cada; dose e "como tomar" ficam
 * em branco para o médico escrever (a dose da internação não é a de casa).
 */
export function sugestoesDaPrescricao(itens: { tipo: string; descricao: string; medicamento_id: string | null; dose?: string | null }[]): Med[] {
  const vistos = new Set<string>()
  const saida: Med[] = []
  for (const it of itens) {
    if (it.tipo !== 'medicamento' || !it.medicamento_id || vistos.has(it.medicamento_id)) continue
    vistos.add(it.medicamento_id)
    saida.push({ id: it.medicamento_id, principio_ativo: it.descricao, apresentacao: null, concentracao: null })
  }
  return saida
}

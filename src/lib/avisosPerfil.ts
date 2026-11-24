// Avisos pelo perfil em uso (SH1, revisão do perfil Enfermeiro, RT
// 24/11/2026). minhas_notificacoes devolve os avisos da CONTA; quem tem mais
// de um papel na unidade via, no perfil Enfermeiro, os prazos da regulação
// feitos para o médico ("72 h sem evolução… atualize a evolução"). Aqui se diz
// quais perfis resolvem cada tipo de aviso; o que não é do perfil em uso vai
// para "De outros perfis (N)", recolhido. Nada some: só muda de lugar.
// node --experimental-strip-types --test src/lib/avisosPerfil.test.ts

const ENFERMAGEM = ['enfermeiro', 'tecnico_enfermagem']
const MEDICO_REGULACAO = ['plantonista', 'nir', 'gestor', 'regulador', 'regulacao_regional', 'secretaria']

/** Primeira regra que casa vale; tipo sem regra é de todos (escala, vaga, candidatura, mensagem, reunião). */
const REGRAS: readonly [RegExp, readonly string[]][] = [
  // chegada regulada: a enfermagem do setor de destino recebe o paciente
  [/^reg_(saiu|chegada|nao_chegou|chegou_origem_aberta)/, [...ENFERMAGEM, ...MEDICO_REGULACAO]],
  [/^reg_/, MEDICO_REGULACAO],
  [/^(noite|manha|tarde|turno)_/, ['plantonista']],
  [/^obs_/, ['plantonista', 'gestor']],
  [/^triagem_/, ['plantonista']],
  // validade da prescrição: a enfermagem não administra o vencido; o médico renova
  [/^presc_/, [...ENFERMAGEM, 'plantonista']],
  [/^farm_/, ['plantonista', 'farmaceutico']],
  [/^leito_/, [...ENFERMAGEM, 'nir', 'gestor', 'plantonista']],
  [/^(nir_aih_|nir_apac_|aih_|apac_)/, ['plantonista', 'regulador', 'faturamento', 'gestor', 'nir']],
  [/^nir_/, ['plantonista', 'nir', 'gestor']],
  [/^rnds_/, ['admin', 'gestor']],
  [/^exame_/, ['plantonista', 'enfermeiro']],
  [/^ubs_upa_/, ['recepcao', 'plantonista', 'enfermeiro']],
  [/^ubs_retorno_/, ['plantonista', 'enfermeiro']],
]

/** Os perfis que resolvem o aviso; null = de todos. */
export function perfisDoAviso(tipo: string): readonly string[] | null {
  return REGRAS.find(([r]) => r.test(tipo))?.[1] ?? null
}

/** O aviso é do perfil em uso? Sem perfil escolhido, tudo é. */
export function avisoDoPerfil(tipo: string, papel: string | null | undefined): boolean {
  const p = perfisDoAviso(tipo)
  return !papel || !p || p.includes(papel)
}

/** Separa os avisos do perfil em uso dos de outros perfis, na ordem em que vieram. */
export function separarPorPerfil<T extends { tipo: string }>(lista: readonly T[], papel: string | null | undefined): { doPerfil: T[]; outros: T[] } {
  const doPerfil: T[] = []
  const outros: T[] = []
  for (const n of lista) (avisoDoPerfil(n.tipo, papel) ? doPerfil : outros).push(n)
  return { doPerfil, outros }
}

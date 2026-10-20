// Endereço do leito aberto (parte 4.7a do padrão do frontend, RT "2a"): a lista
// de pacientes internados já com o leito do paciente aberto e, se pedido, numa
// aba do caderno. Substitui o formulário de internação antigo.

/** Aba do caderno do leito onde cada tipo de documento se abre. */
export const ABA_DO_DOCUMENTO: Record<string, string> = {
  admissao_anamnese: 'admissao',
  laudo_aih: 'aih',
  apac: 'apac',
  pedido_exames: 'exames',
  receita: 'receituario',
  atestado: 'atestado',
  encaminhamento: 'encaminhamento',
}

export function rotaDoLeito(pacienteId?: string | null, aba?: string) {
  const q = new URLSearchParams()
  if (pacienteId) q.set('paciente', pacienteId)
  if (pacienteId && aba) q.set('aba', aba)
  const s = q.toString()
  return `/plantao/internacao/pacientes${s ? `?${s}` : ''}`
}

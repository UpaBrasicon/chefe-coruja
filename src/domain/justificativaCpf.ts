// Percurso da UBS, U15, vacina, PR 2 (VC7 = A): motivo do cidadão sem CPF nas
// fichas do SISAB. Lista do LEDI APS 8.7.0 (Dicionário de dados,
// JustificativaNaoPossuiCpf), a mesma da tabela
// terminologia.ledi_justificativa_sem_cpf (migration 20270415000026).
export const JUSTIFICATIVAS_SEM_CPF: readonly { codigo: number; rotulo: string }[] = [
  { codigo: 2, rotulo: 'Paciente desacordado, sem documentos' },
  { codigo: 3, rotulo: 'Recém-nascidos' },
  { codigo: 4, rotulo: 'Indígenas sem CPF' },
  { codigo: 5, rotulo: 'Pessoa em situação de rua sem documentos' },
  { codigo: 6, rotulo: 'Recusa cultural ou religiosa' },
  { codigo: 7, rotulo: 'Estrangeiro em trânsito (turista/visitante)' },
  { codigo: 8, rotulo: 'Pessoa indocumentada' },
  { codigo: 9, rotulo: 'Crianças sem documentação emitida' },
  { codigo: 10, rotulo: 'Estrangeiro residente sem CPF' },
  { codigo: 11, rotulo: 'Internação compulsória (saúde mental ou ordem judicial)' },
  { codigo: 12, rotulo: 'População migrante/refugiada em processo de regularização' },
  { codigo: 13, rotulo: 'Situações de calamidade ou desastre' },
]

/** Na UBS a recepção pede o motivo quando não há CPF válido nem motivo no cadastro. */
export function pedeMotivoSemCpf(cpfDigitado: string, temCpfNoCadastro: boolean, motivoNoCadastro: number | null): boolean {
  return cpfDigitado.replace(/\D/g, '').length !== 11 && !temCpfNoCadastro && motivoNoCadastro == null
}

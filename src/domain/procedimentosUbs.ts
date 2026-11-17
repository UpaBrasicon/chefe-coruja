// Procedimentos da UBS (percurso da UBS, U7, PR 5). Cópia da lista do banco
// (private.ubs_procedimentos, migration 20270415000009_ubs_procedimentos.sql):
// código SIGTAP conferido na tabela da homologação em 17/11/2026, quem faz cada
// um (P4 = A) e se tem resultado (os testes rápidos).

export type PapelProcedimento = 'plantonista' | 'enfermeiro' | 'tecnico_enfermagem'
export type ResultadoTeste = 'reagente' | 'nao_reagente' | 'invalido'
export type ProcedimentoUbs = { codigo: string; nome: string; papeis: PapelProcedimento[]; comResultado: boolean }

const MED_ENF: PapelProcedimento[] = ['plantonista', 'enfermeiro']
const TODOS: PapelProcedimento[] = ['plantonista', 'enfermeiro', 'tecnico_enfermagem']

export const PROCEDIMENTOS_UBS: ProcedimentoUbs[] = [
  { codigo: '0214010074', nome: 'Teste rápido de sífilis', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010252', nome: 'Teste rápido de sífilis em gestante', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010260', nome: 'Teste rápido de sífilis em parceria de gestante', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010058', nome: 'Teste rápido de HIV', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010279', nome: 'Teste rápido de HIV em gestante', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010287', nome: 'Teste rápido de HIV em parceria de gestante', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010228', nome: 'Teste rápido de hepatite B (HBsAg)', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010236', nome: 'Teste rápido de hepatite B (HBsAg) em gestante', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010244', nome: 'Teste rápido de hepatite B (HBsAg) em parceria de gestante', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010295', nome: 'Teste rápido de hepatite C', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010309', nome: 'Teste rápido de hepatite C em gestante', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010317', nome: 'Teste rápido de hepatite C em parceria de gestante', papeis: MED_ENF, comResultado: true },
  { codigo: '0214010066', nome: 'Teste rápido de gravidez', papeis: MED_ENF, comResultado: true },
  { codigo: '0201020033', nome: 'Coleta de material do colo do útero (preventivo)', papeis: MED_ENF, comResultado: false },
  { codigo: '0301040176', nome: 'Inserção do implante de etonogestrel', papeis: ['plantonista'], comResultado: false },
  { codigo: '0301040184', nome: 'Retirada do implante de etonogestrel', papeis: ['plantonista'], comResultado: false },
  { codigo: '0301040141', nome: 'Inserção do DIU', papeis: ['plantonista'], comResultado: false },
  { codigo: '0301040150', nome: 'Retirada do DIU', papeis: ['plantonista'], comResultado: false },
  { codigo: '0301100284', nome: 'Curativo simples', papeis: TODOS, comResultado: false },
  { codigo: '0301100276', nome: 'Curativo especial', papeis: TODOS, comResultado: false },
  { codigo: '0301100209', nome: 'Administração de medicamento intramuscular', papeis: TODOS, comResultado: false },
  { codigo: '0301100225', nome: 'Administração de medicamento subcutâneo', papeis: TODOS, comResultado: false },
  { codigo: '0301100217', nome: 'Administração de medicamento oral', papeis: TODOS, comResultado: false },
  { codigo: '0301100233', nome: 'Administração tópica de medicamento', papeis: TODOS, comResultado: false },
  { codigo: '0214010015', nome: 'Glicemia capilar', papeis: TODOS, comResultado: false },
]

export const RESULTADOS_TESTE: { valor: ResultadoTeste; rotulo: string }[] = [
  { valor: 'reagente', rotulo: 'Reagente' },
  { valor: 'nao_reagente', rotulo: 'Não reagente' },
  { valor: 'invalido', rotulo: 'Inválido' },
]

export const procedimentosDoPapel = (papel: string | null | undefined) =>
  PROCEDIMENTOS_UBS.filter((p) => p.papeis.includes(papel as PapelProcedimento))

export const nomeProcedimentoUbs = (codigo: string) => PROCEDIMENTOS_UBS.find((p) => p.codigo === codigo)?.nome ?? codigo
export const rotuloResultado = (r: string | null | undefined) => RESULTADOS_TESTE.find((x) => x.valor === r)?.rotulo ?? null

// Exames que o enfermeiro pede na consulta de enfermagem da UBS (percurso da UBS,
// U6, decisão P1 = A; lista em docs/ubs/U6-LISTA-EXAMES-ENFERMEIRO.md, E1 = A).
// Cópia da lista do banco (private.ubs_exames_enfermagem, migration
// 20270415000011_ubs_pre_natal_parceiro.sql, que acrescenta a linha da parceria
// à 20270415000010): código SIGTAP conferido na tabela da homologação e a linha de cuidado de cada exame. Fora desta lista, o banco recusa.

export type LinhaCuidado = 'pre_natal' | 'hiperdia' | 'parceria'
export type ExameEnfermagem = { codigo: string; nome: string; linhas: LinhaCuidado[] }

export const LINHAS_CUIDADO: { id: LinhaCuidado; rotulo: string }[] = [
  { id: 'pre_natal', rotulo: 'Pré-natal' },
  { id: 'hiperdia', rotulo: 'Hipertensão e diabetes' },
  // U6, E3: só na ficha do pré-natal do parceiro (Guia do pré-natal do parceiro, MS 2023, p. 47–48)
  { id: 'parceria', rotulo: 'Pré-natal do parceiro' },
]

export const EXAMES_ENFERMAGEM_UBS: ExameEnfermagem[] = [
  { codigo: '0202020380', nome: 'Hemograma completo', linhas: ['pre_natal', 'parceria'] },
  { codigo: '0202020355', nome: 'Eletroforese de hemoglobina', linhas: ['pre_natal', 'parceria'] },
  { codigo: '0202120023', nome: 'Grupo ABO', linhas: ['pre_natal', 'parceria'] },
  { codigo: '0202120082', nome: 'Fator Rh', linhas: ['pre_natal', 'parceria'] },
  { codigo: '0202120090', nome: 'Coombs indireto', linhas: ['pre_natal'] },
  { codigo: '0202010473', nome: 'Glicose', linhas: ['pre_natal', 'hiperdia', 'parceria'] },
  { codigo: '0202010040', nome: 'Curva glicêmica (2 dosagens)', linhas: ['pre_natal'] },
  { codigo: '0202050017', nome: 'Urina tipo I (EAS)', linhas: ['pre_natal', 'hiperdia'] },
  { codigo: '0202080080', nome: 'Urocultura', linhas: ['pre_natal'] },
  { codigo: '0202031179', nome: 'Sífilis (VDRL) em gestante', linhas: ['pre_natal'] },
  { codigo: '0202031519', nome: 'HIV em gestante', linhas: ['pre_natal'] },
  { codigo: '0202031454', nome: 'Hepatite B (HBsAg) em gestante', linhas: ['pre_natal'] },
  { codigo: '0202030768', nome: 'Toxoplasmose IgG', linhas: ['pre_natal'] },
  { codigo: '0202030873', nome: 'Toxoplasmose IgM', linhas: ['pre_natal'] },
  { codigo: '0202010503', nome: 'Hemoglobina glicada (HbA1c)', linhas: ['hiperdia'] },
  { codigo: '0202010317', nome: 'Creatinina', linhas: ['hiperdia'] },
  { codigo: '0202010600', nome: 'Potássio', linhas: ['hiperdia'] },
  { codigo: '0202010295', nome: 'Colesterol total', linhas: ['hiperdia', 'parceria'] },
  { codigo: '0202010279', nome: 'Colesterol HDL', linhas: ['hiperdia', 'parceria'] },
  { codigo: '0202010678', nome: 'Triglicerídeos', linhas: ['hiperdia', 'parceria'] },
  { codigo: '0202050092', nome: 'Microalbumina na urina', linhas: ['hiperdia'] },
  { codigo: '0202031624', nome: 'Sífilis (VDRL) em parceria de gestante', linhas: ['parceria'] },
  { codigo: '0202031527', nome: 'HIV em parceria de gestante', linhas: ['parceria'] },
  { codigo: '0202031462', nome: 'Hepatite B (HBsAg) em parceria de gestante', linhas: ['parceria'] },
  { codigo: '0202031497', nome: 'Hepatite C (anti-HCV) em parceria de gestante', linhas: ['parceria'] },
]

export const examesDaLinha = (linha: LinhaCuidado) => EXAMES_ENFERMAGEM_UBS.filter((e) => e.linhas.includes(linha))

/** Linhas que a ficha aceita: a do parceiro só no pré-natal do parceiro; as outras nas demais fichas. */
export const linhasDaFicha = (tipoAtendimento: string | null | undefined) =>
  LINHAS_CUIDADO.filter((l) => (tipoAtendimento === 'pre_natal_parceiro') === (l.id === 'parceria'))

// Exames que o enfermeiro pede na consulta de enfermagem da UBS (percurso da UBS,
// U6, decisão P1 = A; lista em docs/ubs/U6-LISTA-EXAMES-ENFERMEIRO.md, E1 = A).
// Cópia da lista do banco (private.ubs_exames_enfermagem, migration
// 20270415000010_ubs_exames_enfermeiro.sql): código SIGTAP conferido na tabela da
// homologação e a linha de cuidado de cada exame. Fora desta lista, o banco recusa.

export type LinhaCuidado = 'pre_natal' | 'hiperdia'
export type ExameEnfermagem = { codigo: string; nome: string; linhas: LinhaCuidado[] }

export const LINHAS_CUIDADO: { id: LinhaCuidado; rotulo: string }[] = [
  { id: 'pre_natal', rotulo: 'Pré-natal' },
  { id: 'hiperdia', rotulo: 'Hipertensão e diabetes' },
]

export const EXAMES_ENFERMAGEM_UBS: ExameEnfermagem[] = [
  { codigo: '0202020380', nome: 'Hemograma completo', linhas: ['pre_natal'] },
  { codigo: '0202020355', nome: 'Eletroforese de hemoglobina', linhas: ['pre_natal'] },
  { codigo: '0202120023', nome: 'Grupo ABO', linhas: ['pre_natal'] },
  { codigo: '0202120082', nome: 'Fator Rh', linhas: ['pre_natal'] },
  { codigo: '0202120090', nome: 'Coombs indireto', linhas: ['pre_natal'] },
  { codigo: '0202010473', nome: 'Glicose', linhas: ['pre_natal', 'hiperdia'] },
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
  { codigo: '0202010295', nome: 'Colesterol total', linhas: ['hiperdia'] },
  { codigo: '0202010279', nome: 'Colesterol HDL', linhas: ['hiperdia'] },
  { codigo: '0202010678', nome: 'Triglicerídeos', linhas: ['hiperdia'] },
  { codigo: '0202050092', nome: 'Microalbumina na urina', linhas: ['hiperdia'] },
]

export const examesDaLinha = (linha: LinhaCuidado) => EXAMES_ENFERMAGEM_UBS.filter((e) => e.linhas.includes(linha))

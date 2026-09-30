// Catálogos dos documentos da porta e da internação, copiados do protótipo
// (index.html 19835–19910). Ficam exportados porque as folhas A4 também os
// usam: o pedido de exames imprime o cardápio inteiro de cada serviço com os
// itens marcados (pedFolhas/montarPedHtml).

/** De onde o paciente chegou (ficha de admissão). */
export const PROCEDENCIAS = [
  'Demanda espontânea', 'SAMU 192', 'Corpo de Bombeiros', 'Transferência de outra unidade', 'Encaminhado da UBS',
  'Retorno de alta', 'Trazido pela polícia',
]

/** Lembrete do que o subjetivo precisa ter (ficha de admissão). */
export const ROTEIRO_SUBJETIVO = [
  'Queixa principal e há quanto tempo',
  'História da doença atual: início, evolução, o que melhora e o que piora, sintomas associados',
  'Antecedentes pessoais e cirúrgicos',
  'Medicações em uso, com dose',
  'Alergias',
  'Hábitos: tabagismo, etilismo, outras substâncias',
  'Antecedentes familiares',
  'Contexto social quando pesa no caso: moradia, trabalho, quem cuida',
]

/** Lembrete do que o objetivo precisa ter (ficha de admissão). */
export const ROTEIRO_OBJETIVO = [
  'Estado geral, nível de consciência e hidratação',
  'Cardiovascular: ritmo, bulhas, pulsos, perfusão',
  'Respiratório: padrão, ausculta, esforço',
  'Abdome: inspeção, ruídos, palpação',
  'Neurológico: Glasgow, pupilas, déficits',
  'Extremidades e pele: edema, perfusão, lesões',
  'Exames complementares já disponíveis',
]

/** Especialidades do encaminhamento (SMS003a). */
export const ESPECIALIDADES_ENC = [
  'Cardiologia', 'Neurologia', 'Ortopedia', 'Pediatria', 'Endocrinologia', 'Gastroenterologia', 'Nefrologia', 'Pneumologia',
  'Psiquiatria', 'Cirurgia Geral', 'Ginecologia e Obstetrícia', 'Oftalmologia', 'Otorrinolaringologia', 'Urologia',
  'Dermatologia', 'Reumatologia', 'Hematologia', 'Oncologia', 'Infectologia',
]

export const PRIORIDADES_ENC = ['Emergência', 'Urgência', 'Eletivo'] as const

/** Clínica do laudo de AIH (campo 29). */
export const CLINICAS_AIH = ['Clínica Médica', 'Cirurgia Geral', 'Ortopedia', 'Ginecologia e Obstetrícia', 'Neurologia', 'Pediatria']

/** Vínculo com a previdência (campo 45 do laudo de AIH). */
export const VINCULOS_PREVIDENCIA = ['Empregado', 'Empregador', 'Autônomo', 'Desempregado', 'Aposentado', 'Não segurado']

export type DestinoExame = { destino: string; grupos: [string, string[]][] }

/**
 * Pedido de exames por destino. Laboratório e imagem são pedidos separados
 * porque vão para serviços diferentes; na folha, cada serviço (laboratório,
 * radiologia/imagem, métodos gráficos) sai em página própria.
 */
export const EXAMES_PEDIDO: DestinoExame[] = [
  { destino: 'Laboratório', grupos: [
    ['Hemograma e coagulação', ['Hemograma completo', 'Plaquetas', 'TAP / INR', 'TTPA', 'Fibrinogênio']],
    ['Bioquímica', ['Glicemia', 'Ureia', 'Creatinina', 'Sódio', 'Potássio', 'Magnésio', 'Cálcio total', 'Cálcio iônico', 'Albumina']],
    ['Hepático e pancreático', ['TGO (AST)', 'TGP (ALT)', 'GGT', 'Fosfatase alcalina', 'Bilirrubinas', 'Amilase', 'Lipase']],
    ['Inflamatório e marcadores', ['PCR', 'VHS', 'Procalcitonina', 'Lactato', 'Troponina', 'CK-MB', 'D-dímero', 'BNP / NT-proBNP']],
    ['Gasometria e urina', ['Gasometria arterial', 'Gasometria venosa', 'EAS (urina tipo I)', 'Urocultura com antibiograma']],
    ['Microbiologia e sorologias', ['Hemocultura (2 amostras)', 'Cultura de secreção', 'HIV', 'HBsAg', 'Anti-HCV', 'VDRL', 'Dengue NS1 / IgM']],
    ['Endócrino e outros', ['TSH', 'T4 livre', 'HbA1c', 'Perfil lipídico', 'Ferritina', 'Beta-HCG']],
  ] },
  { destino: 'Imagem e métodos gráficos', grupos: [
    ['Raio-X', ['Tórax PA e perfil', 'Tórax AP (leito)', 'Abdome agudo (3 incidências)', 'Abdome simples', 'Coluna cervical', 'Coluna lombossacra', 'Bacia', 'Crânio', 'Membro superior', 'Membro inferior']],
    ['Ultrassom', ['Abdome total', 'Abdome superior', 'Rins e vias urinárias', 'Pelve', 'Obstétrica', 'Transvaginal', 'Doppler venoso de MMII', 'Doppler arterial', 'Partes moles', 'Cervical / tireoide', 'FAST à beira do leito']],
    ['Eletrocardiograma', ['ECG de 12 derivações', 'ECG seriado']],
  ] },
]

/** Atalhos de marcação: nada é pedido sem o médico ver a lista marcada. */
export const PERFIS_EXAME: [string, string[]][] = [
  ['Dor torácica', ['Hemograma completo', 'Troponina', 'CK-MB', 'Creatinina', 'Sódio', 'Potássio', 'ECG de 12 derivações', 'Tórax PA e perfil']],
  ['Dor abdominal', ['Hemograma completo', 'PCR', 'Amilase', 'Lipase', 'TGO (AST)', 'TGP (ALT)', 'Bilirrubinas', 'Creatinina', 'EAS (urina tipo I)', 'Abdome total']],
  ['Dispneia', ['Hemograma completo', 'Gasometria arterial', 'D-dímero', 'BNP / NT-proBNP', 'Troponina', 'Tórax PA e perfil', 'ECG de 12 derivações']],
  ['Febre sem foco', ['Hemograma completo', 'PCR', 'Procalcitonina', 'Lactato', 'EAS (urina tipo I)', 'Urocultura com antibiograma', 'Hemocultura (2 amostras)', 'Tórax PA e perfil']],
  ['Rotina de internação', ['Hemograma completo', 'Glicemia', 'Ureia', 'Creatinina', 'Sódio', 'Potássio', 'TAP / INR', 'TTPA']],
]

const ehGrafico = (grupo: string) => /eletrocardio|ecg|holter|mapa|ergom/i.test(grupo)

/**
 * As folhas do pedido, na ordem do modelo (pedFolhas do protótipo): uma por
 * serviço com item marcado. Item fora do cardápio vai em "Outros" da última.
 */
export function folhasDoPedido(marcados: string[]) {
  const lab = EXAMES_PEDIDO.find((d) => d.destino === 'Laboratório') ?? { grupos: [] }
  const img = EXAMES_PEDIDO.find((d) => d.destino !== 'Laboratório') ?? { grupos: [] }
  const base = [
    { nome: 'laboratório', grupos: lab.grupos },
    { nome: 'radiologia/imagem', grupos: img.grupos.filter((g) => !ehGrafico(g[0])) },
    { nome: 'métodos gráficos', grupos: img.grupos.filter((g) => ehGrafico(g[0])) },
  ]
  const folhas = base
    .map((f) => ({ ...f, extras: [] as string[], itens: f.grupos.flatMap((g) => g[1].filter((x) => marcados.includes(x))) }))
    .filter((f) => f.itens.length)
  const todos = EXAMES_PEDIDO.flatMap((d) => d.grupos.flatMap((g) => g[1]))
  const extras = marcados.filter((x) => !todos.includes(x))
  if (extras.length) {
    if (!folhas.length) folhas.push({ nome: 'outros exames', grupos: [], extras: [], itens: [] })
    const u = folhas[folhas.length - 1]
    u.extras = extras
    u.itens = u.itens.concat(extras)
  }
  return folhas
}

/**
 * Exemplo do laudo de AIH (dengue grupo D, protótipo AIH_EXEMPLO). Só mostra
 * os pontos principais de cada campo: a hidratação sai sem volume e sem
 * velocidade — nenhum documento traz dose sugerida.
 */
export const AIH_EXEMPLO = {
  carater: 'Urgência',
  clinica: 'Clínica Médica',
  sinais: 'Paciente com D3 dias de sintomas. Apresentando os seguintes sinais/condições: sangramento grave.\n\nHPP OU HISTÓRIA PATOLÓGICA PREGRESSA:\n- NEGA',
  condicoes: 'Dengue Grupo D. Sinais presentes: sangramento grave.\n\nConduta:\n- Dieta: dieta livre\n- Hidratação venosa conforme o protocolo de dengue da unidade (grupo D).\n- Prescrição médica conforme sistema.',
  provas: '[Preencher exame físico aferido, sinais vitais e resultados laboratoriais]\nHemograma solicitado como 1º hemograma de hoje.',
  diagnostico: 'Dengue Grupo D.',
  cid: 'A91',
  cidSec: '',
  procDesc: 'Tratamento de dengue hemorrágica',
  procCod: '03.03.01.002-9',
}

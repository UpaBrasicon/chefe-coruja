// LG11, decisão C5 (RT, 17/11/2026): rotulagem mínima do módulo clínico.
// Texto aprovado pelo RT como está em docs/regulatorio/LG11-SOBRE-MODULO-CLINICO-TEXTO.md.
// Mudar este texto pede novo ok do RT.

export const ROTA_SOBRE_MODULO = '/plantonista/sobre-modulo-clinico'

export type ParteSobre = {
  titulo: string
  /** parágrafo único */
  texto?: string
  /** lista de itens */
  itens?: string[]
}

export const SOBRE_MODULO_CLINICO: ParteSobre[] = [
  {
    titulo: 'Para que serve',
    texto:
      'As ferramentas da Central (escores, calculadoras, condutas e avisos) ajudam o profissional de saúde a consultar referências e fazer contas à beira do leito. Elas mostram o que a fonte citada diz para os dados informados.',
  },
  {
    titulo: 'Para quem é',
    texto: 'Médicos, enfermeiros e farmacêuticos, no exercício da profissão. Não é para o paciente nem para leigos.',
  },
  {
    titulo: 'O que ele não faz',
    itens: [
      'Não diagnostica e não decide o tratamento. A decisão é sempre do profissional, que conhece o paciente.',
      'Não substitui o exame do paciente, o protocolo da instituição nem a bula.',
      'Não converte dose de adulto para criança. Na pediatria (até 13 anos, 11 meses e 29 dias), só calcula quando a fonte é pediátrica.',
      'A cor da classificação de risco é da enfermagem. O sistema só apoia.',
    ],
  },
  {
    titulo: 'De onde vem cada regra',
    texto:
      'Cada ferramenta mostra a fonte (diretriz, livro ou artigo) e a versão. Uma versão nova só aparece depois de aprovada pelo responsável técnico; até lá, fica a anterior.',
  },
  {
    titulo: 'Avisos automáticos',
    texto:
      'Alguns avisos, como o de sepse, aparecem sozinhos a partir dos sinais vitais e do CID registrados. Eles pedem atenção, não dão ordem. Podem faltar quando o registro está incompleto ou atrasado.',
  },
  {
    titulo: 'Limites',
    itens: [
      'O resultado vale para os dados informados. Peso, idade e exames errados ou antigos dão resultado errado. Confira a origem e a data mostradas na tela.',
      'As referências têm data. A medicina muda, e a revisão das fichas é contínua, mas pode haver atraso.',
    ],
  },
  {
    titulo: 'Achou um erro?',
    texto:
      'Use "Relatar problema", no topo de cada ferramenta ou aqui embaixo. O relato vai para o responsável técnico da Chefe Coruja, que investiga no prazo e responde em "Meus relatos". Diga o que a tela mostrou e o que era esperado. Não mande nome nem documento do paciente. Se o problema chegou ao paciente, avise também o gestor da sua unidade. Sem acesso ao sistema, escreva para contato@chefecoruja.com.br.',
  },
  {
    titulo: 'Situação regulatória',
    texto:
      'O enquadramento do módulo clínico como software de dispositivo médico (RDC 657/2022 da ANVISA) está em avaliação com consultor regulatório.',
  },
]

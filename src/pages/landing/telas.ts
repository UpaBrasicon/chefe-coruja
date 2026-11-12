// Telas da seção "Um plantão" (pedido 8, J4). As imagens são capturas reais da
// homologação, na UPA 24h Jardim Primavera, com pacientes e equipe fictícios
// (scripts/demo/capturar-telas.mjs). Tamanho 1424 × 749, JPG abaixo de 250 KB.
export type Tela = {
  id: string
  rotulo: string
  arquivo: string
  titulo: string
  texto: string
  alt: string
}

export const LARGURA_TELA = 1424
export const ALTURA_TELA = 749

export const TELAS: readonly Tela[] = [
  {
    id: 'porta',
    rotulo: 'Porta',
    arquivo: '/landing/telas/porta.jpg',
    titulo: 'A porta em tempo real',
    texto: 'Quem espera triagem, médico ou medicação, há quanto tempo, e quem já passou do tempo-alvo da cor.',
    alt: 'Tela da porta: 2 aguardando triagem, 5 aguardando médico, 2 em atendimento, 6 em observação e 4 altas, com a espera por cor de classificação.',
  },
  {
    id: 'painel',
    rotulo: 'Gestão',
    arquivo: '/landing/telas/painel.jpg',
    titulo: 'O painel do gestor',
    texto: 'Ocupação, equipe em plantão e a auditoria de check-in, com hora e lugar de cada um.',
    alt: 'Painel do gestor: ocupação de 73%, 8 de 11 leitos, 6 pessoas em plantão e a auditoria de check-in sem divergência.',
  },
  {
    id: 'escala',
    rotulo: 'Escala',
    arquivo: '/landing/telas/escala.jpg',
    titulo: 'A escala do mês',
    texto: 'O mês publicado, e quem está em cada setor e turno do dia.',
    alt: 'Escala de novembro com todos os dias cobertos e, ao lado, a equipe de cada setor e turno do dia.',
  },
]

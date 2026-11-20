// Guia rápido (F4 das ferramentas pelo CID: celular e tablet; pedido do RT de
// 17/11/2026, M1–M6 = A, protótipo aprovado). Cartões por situação do plantão,
// pelo modelo de organização do ANY App (não a marca). Cada cartão abre uma
// conduta que já existe na Central; o teste confere que a rota existe.
// Ordem do RT: "Parada e reanimação" primeiro no adulto e na criança. Na criança
// o cartão junta a parada pediátrica e a reanimação neonatal (pedido do RT em
// 17/11/2026: "pode agrupar, que vamos construir juntos").

export type IconeGuia =
  | 'parada' | 'seringa' | 'via-aerea' | 'pulmao' | 'gota' | 'termometro' | 'coracao' | 'cerebro'
  | 'lua' | 'alerta' | 'inseto' | 'maos' | 'bebe'

/** Cartão que abre uma ferramenta (rota) ou um grupo de ferramentas (itens, aberto em ?guia=<id>). */
export type CartaoGuia =
  | { nome: string; rota: string; icone: IconeGuia }
  | { nome: string; id: string; itens: { nome: string; rota: string }[]; icone: IconeGuia }

export const GUIA_ADULTO: CartaoGuia[] = [
  // G3 (RT, 18/11/2026): o cartão abre o cronômetro da parada, com a PCR completa embaixo
  { nome: 'Parada e reanimação', id: 'parada-adulto', icone: 'parada', itens: [{ nome: 'PCR do adulto completa', rota: '/plantonista/emergencias/pcr-adulto' }] },
  { nome: 'Infusões e vasoativas', rota: '/plantonista/calculadoras/infusoes-adulto', icone: 'seringa' },
  { nome: 'Via aérea e intubação', id: 'iot-adulto', icone: 'via-aerea', itens: [{ nome: 'Via aérea e intubação completa', rota: '/plantonista/calculadoras/iot' }] },
  { nome: 'Ventilação mecânica', rota: '/plantonista/ventilacao-mecanica/vm-cinco-passos', icone: 'pulmao' },
  { nome: 'Choque e volume', rota: '/plantonista/emergencias/ressuscitacao-volemica-adulto', icone: 'gota' },
  { nome: 'Sepse', rota: '/plantonista/escores/sepse-adulto', icone: 'termometro' },
  { nome: 'Dor torácica e SCA', rota: '/plantonista/emergencias/sca-inicial-adulto', icone: 'coracao' },
  { nome: 'AVC e trombólise', rota: '/plantonista/emergencias/trombolise-avc-adulto', icone: 'cerebro' },
  { nome: 'Crise epiléptica', id: 'crise-adulto', icone: 'cerebro', itens: [{ nome: 'Estado de mal epiléptico completo', rota: '/plantonista/calculadoras/hidantalizacao' }] },
  { nome: 'TEP', rota: '/plantonista/escores/wells-tep', icone: 'pulmao' },
  { nome: 'Sedação', rota: '/plantonista/emergencias/sedacao-procedimento-adulto', icone: 'lua' },
  { nome: 'Intoxicações e antídotos', rota: '/plantonista/emergencias/intoxicacoes-antidotos-adulto', icone: 'alerta' },
  { nome: 'Anafilaxia', id: 'anafilaxia-adulto', icone: 'alerta', itens: [{ nome: 'Anafilaxia completa', rota: '/plantonista/emergencias/anafilaxia-adulto' }] },
  { nome: 'Cetoacidose e EHH', rota: '/plantonista/emergencias/cad-ehh-tratamento', icone: 'gota' },
  { nome: 'Dengue', rota: '/plantonista/dengue/classificacao-conduta-hidratacao', icone: 'inseto' },
  { nome: 'Cuidados paliativos', rota: '/plantonista/emergencias/sintomas-paliativos-adulto', icone: 'maos' },
]

export const GUIA_CRIANCA: CartaoGuia[] = [
  {
    nome: 'Parada e reanimação', id: 'parada-crianca', icone: 'parada',
    itens: [
      { nome: 'Parada cardiorrespiratória na criança', rota: '/plantonista/pediatria/rcp-pediatrica' },
      { nome: 'Reanimação neonatal', rota: '/plantonista/pediatria/reanimacao-neonatal' },
    ],
  },
  // guias de bolso (pedido do RT de 20/11/2026): abrem a tela de bolso, com a ferramenta completa embaixo
  { nome: 'Doses por classe', id: 'doses-crianca', icone: 'seringa', itens: [{ nome: 'Doses por peso completas', rota: '/plantonista/pediatria/bolus' }] },
  { nome: 'Via aérea', rota: '/plantonista/pediatria/via-aerea', icone: 'via-aerea' },
  { nome: 'Choque', rota: '/plantonista/pediatria/choque-pediatrico', icone: 'gota' },
  { nome: 'Desidratação e diarreia', id: 'desidratacao-crianca', icone: 'gota', itens: [{ nome: 'Desidratação e diarreia completa', rota: '/plantonista/pediatria/desidratacao-diarreia-ped' }] },
  { nome: 'Crise epiléptica', id: 'crise-crianca', icone: 'cerebro', itens: [{ nome: 'Crise epiléptica completa', rota: '/plantonista/pediatria/crise-epileptica-pediatrica' }] },
  { nome: 'Anafilaxia', id: 'anafilaxia-crianca', icone: 'alerta', itens: [{ nome: 'Anafilaxia completa', rota: '/plantonista/pediatria/anafilaxia-pediatrica' }] },
  { nome: 'Asma', rota: '/plantonista/pediatria/asma-pediatrica', icone: 'pulmao' },
  { nome: 'Bronquiolite', rota: '/plantonista/pediatria/bronquiolite-ped', icone: 'pulmao' },
  { nome: 'Sedação', rota: '/plantonista/pediatria/sedacao-procedimento-ped', icone: 'lua' },
  { nome: 'Intoxicações', rota: '/plantonista/pediatria/intoxicacoes-ped', icone: 'alerta' },
  { nome: 'Dengue', rota: '/plantonista/pediatria/dengue-ped', icone: 'inseto' },
]

/** "Calculadoras e escores": a Central completa (busca, grupos, favoritos). */
export const ROTA_TODAS_FERRAMENTAS = '/plantonista?todas=1'

/** Todas as rotas de um cartão (a dele ou as do grupo). */
export const rotasDoCartao = (c: CartaoGuia): string[] => ('rota' in c ? [c.rota] : c.itens.map((i) => i.rota))

export const cartaoDoGuia = (id: string | null): Extract<CartaoGuia, { id: string }> | undefined =>
  [...GUIA_ADULTO, ...GUIA_CRIANCA].find((c): c is Extract<CartaoGuia, { id: string }> => 'id' in c && c.id === id)

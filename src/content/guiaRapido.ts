// Guia rápido (F4 das ferramentas pelo CID: celular e tablet; pedido do RT de
// 17/11/2026, M1–M6 = A, protótipo aprovado). Cartões por situação do plantão,
// pelo modelo de organização do ANY App (não a marca). Cada cartão abre uma
// conduta que já existe na Central; o teste confere que a rota existe.
// Ordem do RT: "Parada e reanimação" primeiro no adulto e na criança;
// "Reanimação neonatal" em segundo na criança.

export type IconeGuia =
  | 'parada' | 'seringa' | 'via-aerea' | 'pulmao' | 'gota' | 'termometro' | 'coracao' | 'cerebro'
  | 'lua' | 'alerta' | 'inseto' | 'maos' | 'bebe'

export type CartaoGuia = { nome: string; rota: string; icone: IconeGuia }

export const GUIA_ADULTO: CartaoGuia[] = [
  { nome: 'Parada e reanimação', rota: '/plantonista/emergencias/pcr-adulto', icone: 'parada' },
  { nome: 'Infusões e vasoativas', rota: '/plantonista/calculadoras/infusoes-adulto', icone: 'seringa' },
  { nome: 'Via aérea e intubação', rota: '/plantonista/calculadoras/iot', icone: 'via-aerea' },
  { nome: 'Ventilação mecânica', rota: '/plantonista/ventilacao-mecanica/vm-cinco-passos', icone: 'pulmao' },
  { nome: 'Choque e volume', rota: '/plantonista/emergencias/ressuscitacao-volemica-adulto', icone: 'gota' },
  { nome: 'Sepse', rota: '/plantonista/escores/sepse-adulto', icone: 'termometro' },
  { nome: 'Dor torácica e SCA', rota: '/plantonista/emergencias/sca-inicial-adulto', icone: 'coracao' },
  { nome: 'AVC e trombólise', rota: '/plantonista/emergencias/trombolise-avc-adulto', icone: 'cerebro' },
  { nome: 'TEP', rota: '/plantonista/escores/wells-tep', icone: 'pulmao' },
  { nome: 'Sedação', rota: '/plantonista/emergencias/sedacao-procedimento-adulto', icone: 'lua' },
  { nome: 'Intoxicações e antídotos', rota: '/plantonista/emergencias/intoxicacoes-antidotos-adulto', icone: 'alerta' },
  { nome: 'Anafilaxia', rota: '/plantonista/emergencias/anafilaxia-adulto', icone: 'alerta' },
  { nome: 'Cetoacidose e EHH', rota: '/plantonista/emergencias/cad-ehh-tratamento', icone: 'gota' },
  { nome: 'Dengue', rota: '/plantonista/dengue/classificacao-conduta-hidratacao', icone: 'inseto' },
  { nome: 'Cuidados paliativos', rota: '/plantonista/emergencias/sintomas-paliativos-adulto', icone: 'maos' },
]

export const GUIA_CRIANCA: CartaoGuia[] = [
  { nome: 'Parada e reanimação', rota: '/plantonista/pediatria/rcp-pediatrica', icone: 'parada' },
  { nome: 'Reanimação neonatal', rota: '/plantonista/pediatria/reanimacao-neonatal', icone: 'bebe' },
  { nome: 'Bolus e infusões', rota: '/plantonista/pediatria/bolus', icone: 'seringa' },
  { nome: 'Via aérea', rota: '/plantonista/pediatria/via-aerea', icone: 'via-aerea' },
  { nome: 'Choque', rota: '/plantonista/pediatria/choque-pediatrico', icone: 'gota' },
  { nome: 'Desidratação e diarreia', rota: '/plantonista/pediatria/desidratacao-diarreia-ped', icone: 'gota' },
  { nome: 'Crise epiléptica', rota: '/plantonista/pediatria/crise-epileptica-pediatrica', icone: 'cerebro' },
  { nome: 'Asma', rota: '/plantonista/pediatria/asma-pediatrica', icone: 'pulmao' },
  { nome: 'Bronquiolite', rota: '/plantonista/pediatria/bronquiolite-ped', icone: 'pulmao' },
  { nome: 'Sedação', rota: '/plantonista/pediatria/sedacao-procedimento-ped', icone: 'lua' },
  { nome: 'Intoxicações', rota: '/plantonista/pediatria/intoxicacoes-ped', icone: 'alerta' },
  { nome: 'Dengue', rota: '/plantonista/pediatria/dengue-ped', icone: 'inseto' },
]

/** "Calculadoras e escores": a Central completa (busca, grupos, favoritos). */
export const ROTA_TODAS_FERRAMENTAS = '/plantonista?todas=1'

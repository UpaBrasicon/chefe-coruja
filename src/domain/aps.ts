// Ficha de Atendimento Individual do e-SUS APS (Ministério da Saúde, Manual do
// CDS 2.1, 2016): tipo de atendimento (p. 57 e 58), problema/condição avaliada
// (p. 62 a 65) e conduta (p. 69 a 71). Os códigos são os do banco
// (private.lista_aps e os CHECKs de episodios, migration
// 20270211000002_atendimento_ubs.sql); o teste src/lib/apsListas.test.ts
// confere que são os mesmos.

export type OpcaoAps = { valor: string; rotulo: string; grupo?: string; /** rótulo de tabela */ curto?: string }

export const TIPOS_ATENDIMENTO_APS: OpcaoAps[] = [
  { valor: 'consulta_programada', rotulo: 'Consulta agendada programada / cuidado continuado', curto: 'Cuidado continuado' },
  { valor: 'consulta_agendada', rotulo: 'Consulta agendada', curto: 'Agendada' },
  { valor: 'escuta_inicial', rotulo: 'Escuta inicial / orientação', grupo: 'Demanda espontânea', curto: 'Escuta inicial' },
  { valor: 'consulta_no_dia', rotulo: 'Consulta no dia', grupo: 'Demanda espontânea', curto: 'No dia' },
  { valor: 'atendimento_urgencia', rotulo: 'Atendimento de urgência', grupo: 'Demanda espontânea', curto: 'Urgência' },
]

export const PROBLEMAS_APS: OpcaoAps[] = [
  { valor: 'asma', rotulo: 'Asma' },
  { valor: 'desnutricao', rotulo: 'Desnutrição' },
  { valor: 'diabetes', rotulo: 'Diabetes' },
  { valor: 'dpoc', rotulo: 'DPOC' },
  { valor: 'hipertensao_arterial', rotulo: 'Hipertensão arterial' },
  { valor: 'obesidade', rotulo: 'Obesidade' },
  { valor: 'pre_natal', rotulo: 'Pré-natal' },
  { valor: 'puericultura', rotulo: 'Puericultura' },
  { valor: 'puerperio', rotulo: 'Puerpério (até 42 dias)' },
  { valor: 'saude_sexual_reprodutiva', rotulo: 'Saúde sexual e reprodutiva' },
  { valor: 'tabagismo', rotulo: 'Tabagismo' },
  { valor: 'uso_alcool', rotulo: 'Uso de álcool' },
  { valor: 'uso_outras_drogas', rotulo: 'Uso de outras drogas' },
  { valor: 'saude_mental', rotulo: 'Saúde mental' },
  { valor: 'reabilitacao', rotulo: 'Reabilitação' },
  { valor: 'tuberculose', rotulo: 'Tuberculose', grupo: 'Doenças transmissíveis' },
  { valor: 'hanseniase', rotulo: 'Hanseníase', grupo: 'Doenças transmissíveis' },
  { valor: 'dengue', rotulo: 'Dengue', grupo: 'Doenças transmissíveis' },
  { valor: 'dst', rotulo: 'DST', grupo: 'Doenças transmissíveis' },
  { valor: 'rastreamento_cancer_colo_utero', rotulo: 'Rastreamento: câncer de colo do útero', grupo: 'Rastreamento' },
  { valor: 'rastreamento_cancer_mama', rotulo: 'Rastreamento: câncer de mama', grupo: 'Rastreamento' },
  { valor: 'rastreamento_risco_cardiovascular', rotulo: 'Rastreamento: risco cardiovascular', grupo: 'Rastreamento' },
]

export const CONDUTAS_APS: OpcaoAps[] = [
  { valor: 'retorno_consulta_agendada', rotulo: 'Retorno para consulta agendada', grupo: 'Retorno e agendamento' },
  { valor: 'retorno_cuidado_continuado', rotulo: 'Retorno para cuidado continuado/programado', grupo: 'Retorno e agendamento' },
  { valor: 'agendamento_grupos', rotulo: 'Agendamento para grupos', grupo: 'Retorno e agendamento' },
  { valor: 'agendamento_nasf', rotulo: 'Agendamento para Nasf', grupo: 'Retorno e agendamento' },
  { valor: 'alta_episodio', rotulo: 'Alta do episódio', grupo: 'Alta' },
  { valor: 'encaminhamento_interno', rotulo: 'Encaminhamento interno no dia', grupo: 'Encaminhamento' },
  { valor: 'encaminhamento_especializado', rotulo: 'Encaminhamento para serviço especializado', grupo: 'Encaminhamento' },
  { valor: 'encaminhamento_caps', rotulo: 'Encaminhamento para CAPS', grupo: 'Encaminhamento' },
  { valor: 'encaminhamento_internacao', rotulo: 'Encaminhamento para internação hospitalar', grupo: 'Encaminhamento' },
  { valor: 'encaminhamento_urgencia', rotulo: 'Encaminhamento para urgência', grupo: 'Encaminhamento' },
  { valor: 'encaminhamento_atencao_domiciliar', rotulo: 'Encaminhamento para serviço de atenção domiciliar', grupo: 'Encaminhamento' },
  { valor: 'encaminhamento_intersetorial', rotulo: 'Encaminhamento intersetorial', grupo: 'Encaminhamento' },
]

const rotuloDe = (lista: OpcaoAps[], v: string | null | undefined) => lista.find((o) => o.valor === v)?.rotulo ?? v ?? ''

export const rotuloTipoAps = (v: string | null | undefined) => rotuloDe(TIPOS_ATENDIMENTO_APS, v)
export const rotuloTipoApsCurto = (v: string | null | undefined) =>
  TIPOS_ATENDIMENTO_APS.find((o) => o.valor === v)?.curto ?? rotuloTipoAps(v)
export const rotuloProblemaAps = (v: string | null | undefined) => rotuloDe(PROBLEMAS_APS, v)
export const rotuloCondutaAps = (v: string | null | undefined) => rotuloDe(CONDUTAS_APS, v)

// Ficha de Atendimento Individual do e-SUS APS (Ministério da Saúde, Manual do
// CDS 2.1, 2016): tipo de atendimento (p. 57 e 58), problema/condição avaliada
// (p. 62 a 65) e conduta (p. 69 a 71). Os códigos são os do banco
// (private.lista_aps e os CHECKs de episodios, migration
// 20270211000002_atendimento_ubs.sql); o teste src/lib/apsListas.test.ts
// confere que são os mesmos.

import { ordemTriagem } from './prioridade.ts'

export type OpcaoAps = { valor: string; rotulo: string; grupo?: string; /** rótulo de tabela */ curto?: string }

export const TIPOS_ATENDIMENTO_APS: OpcaoAps[] = [
  { valor: 'consulta_programada', rotulo: 'Consulta agendada programada / cuidado continuado', curto: 'Cuidado continuado' },
  { valor: 'consulta_agendada', rotulo: 'Consulta agendada', curto: 'Agendada' },
  { valor: 'escuta_inicial', rotulo: 'Escuta inicial / orientação', grupo: 'Demanda espontânea', curto: 'Escuta inicial' },
  { valor: 'consulta_no_dia', rotulo: 'Consulta no dia', grupo: 'Demanda espontânea', curto: 'No dia' },
  { valor: 'atendimento_urgencia', rotulo: 'Atendimento de urgência', grupo: 'Demanda espontânea', curto: 'Urgência' },
  // U6, E3 (migration 20270415000011): consulta própria da parceria da gestante,
  // SIGTAP 03.01.01.023-4 (Guia do pré-natal do parceiro, MS 2023)
  { valor: 'pre_natal_parceiro', rotulo: 'Pré-natal do parceiro', curto: 'Pré-natal do parceiro' },
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
  // `curto`: o rótulo debaixo do grupo "Encaminhamento" (aba Conduta)
  { valor: 'encaminhamento_interno', rotulo: 'Encaminhamento interno no dia', grupo: 'Encaminhamento', curto: 'Interno no dia' },
  { valor: 'encaminhamento_especializado', rotulo: 'Encaminhamento para serviço especializado', grupo: 'Encaminhamento', curto: 'Serviço especializado' },
  { valor: 'encaminhamento_caps', rotulo: 'Encaminhamento para CAPS', grupo: 'Encaminhamento', curto: 'CAPS' },
  { valor: 'encaminhamento_internacao', rotulo: 'Encaminhamento para internação hospitalar', grupo: 'Encaminhamento', curto: 'Internação hospitalar' },
  { valor: 'encaminhamento_urgencia', rotulo: 'Encaminhamento para urgência', grupo: 'Encaminhamento', curto: 'Urgência' },
  { valor: 'encaminhamento_atencao_domiciliar', rotulo: 'Encaminhamento para serviço de atenção domiciliar', grupo: 'Encaminhamento', curto: 'Serviço de atenção domiciliar' },
  { valor: 'encaminhamento_intersetorial', rotulo: 'Encaminhamento intersetorial', grupo: 'Encaminhamento', curto: 'Intersetorial' },
]

const rotuloDe = (lista: OpcaoAps[], v: string | null | undefined) => lista.find((o) => o.valor === v)?.rotulo ?? v ?? ''

export const rotuloTipoAps = (v: string | null | undefined) => rotuloDe(TIPOS_ATENDIMENTO_APS, v)
export const rotuloTipoApsCurto = (v: string | null | undefined) =>
  TIPOS_ATENDIMENTO_APS.find((o) => o.valor === v)?.curto ?? rotuloTipoAps(v)
export const rotuloProblemaAps = (v: string | null | undefined) => rotuloDe(PROBLEMAS_APS, v)
export const rotuloCondutaAps = (v: string | null | undefined) => rotuloDe(CONDUTAS_APS, v)

// Escuta inicial (5A, tarefa 2, parte 2.4): classificação da demanda
// espontânea do Caderno de Atenção Básica nº 28 (MS; vol. I, p. 34 e 35; vol.
// II, p. 18 e 19, onde estão as cores). Sem tempo-alvo: a fonte não dá minutos.
// Os códigos e as saídas são os do banco (registrar_escuta_aps e os CHECKs de
// classificacoes_risco, migration 20270213000001_escuta_inicial_ubs.sql).
export type CorCab28 = 'vermelho' | 'amarelo' | 'verde' | 'azul'
export type SaidaEscuta = 'orientacao' | 'agendamento' | 'consulta'

export const CLASSIFICACAO_CAB28: { cor: CorCab28; rotulo: string; descricao: string; exemplos: string; aguda: boolean }[] = [
  { cor: 'vermelho', rotulo: 'Atendimento imediato', aguda: true,
    descricao: 'Alto risco de vida: intervenção no mesmo momento, com o médico.',
    exemplos: 'parada cardiorrespiratória, dificuldade respiratória grave, convulsão, rebaixamento do nível de consciência, dor severa' },
  { cor: 'amarelo', rotulo: 'Atendimento prioritário', aguda: true,
    descricao: 'Risco moderado: intervenção breve; muda a ordem de atendimento.',
    exemplos: 'crise asmática leve ou moderada, febre sem complicação, gestante com dor abdominal, suspeita de doença transmissível' },
  { cor: 'verde', rotulo: 'Atendimento no dia', aguda: true,
    descricao: 'Risco baixo, ou sem risco com vulnerabilidade importante: manejo no mesmo dia.',
    exemplos: 'disúria, tosse sem sinais de risco, dor lombar leve, renovação de medicamento de uso contínuo' },
  { cor: 'azul', rotulo: 'Situação não aguda', aguda: false,
    descricao: 'Orientação, adiantamento de ação prevista em protocolo ou agendamento.',
    exemplos: 'orientação sobre as ofertas da unidade, teste de gravidez, imunização' },
]

export const SAIDAS_AZUL: { valor: Exclude<SaidaEscuta, 'consulta'>; rotulo: string }[] = [
  { valor: 'orientacao', rotulo: 'Orientação' },
  { valor: 'agendamento', rotulo: 'Agendamento' },
]

/** Peso na fila do médico: o imediato e o prioritário (que "influencia na ordem
 *  de atendimento", CAB 28) passam à frente; o verde e quem não passou pela
 *  escuta seguem a prioridade legal e a chegada. */
export const pesoCab28 = (cor: string | null | undefined) => (cor === 'vermelho' ? 0 : cor === 'amarelo' ? 1 : 2)

/** Fila do médico na UBS: imediato → prioritário → (no dia e sem escuta) por
 *  prioridade legal e chegada. */
export function ordemFilaUbs<T extends { prioridades_legais: string[]; chegada_em: string; cor_atual?: string | null }>(a: T, b: T): number {
  return pesoCab28(a.cor_atual) - pesoCab28(b.cor_atual) || ordemTriagem(a, b)
}

/** Refinamento da UBS, RF1 = A (RT, 23/11/2026): a fila do consultório da UBS
 *  em três faixas.
 *  - prioritário: vermelho e amarelo da escuta (CAB 28), nunca atrás de agendado;
 *  - agendado: quem tem consulta marcada hoje, pela hora marcada;
 *  - espontâneo: o resto da demanda espontânea, o verde antes de quem não
 *    passou pela escuta, e cada um pela prioridade legal e pela chegada. */
export type FaixaFilaUbs = 'prioritario' | 'agendado' | 'espontaneo'
const TIPOS_AGENDADOS = new Set(['consulta_agendada', 'consulta_programada'])
const ORDEM_FAIXA: Record<FaixaFilaUbs, number> = { prioritario: 0, agendado: 1, espontaneo: 2 }
type NaFilaUbs = { prioridades_legais: string[]; chegada_em: string; cor_atual?: string | null; tipo_atendimento_aps?: string | null }

/** A faixa de quem está na fila; `horaMarcada` é o início do agendamento de hoje, quando há. */
export function faixaFilaUbs(e: NaFilaUbs, horaMarcada: string | null | undefined): FaixaFilaUbs {
  if (pesoCab28(e.cor_atual) < 2) return 'prioritario'
  if (horaMarcada || TIPOS_AGENDADOS.has(e.tipo_atendimento_aps ?? '')) return 'agendado'
  return 'espontaneo'
}

/** Comparador da fila do consultório da UBS, com a hora marcada de cada um. */
export function ordemFilaUbsComAgenda<T extends NaFilaUbs>(horaDe: (e: T) => string | null | undefined) {
  return (a: T, b: T): number => {
    const ha = horaDe(a), hb = horaDe(b)
    const fa = faixaFilaUbs(a, ha), fb = faixaFilaUbs(b, hb)
    if (fa !== fb) return ORDEM_FAIXA[fa] - ORDEM_FAIXA[fb]
    if (fa === 'prioritario') return ordemFilaUbs(a, b)
    if (fa === 'agendado') {
      // sem a hora (agendamento de outro dia), depois de quem tem hora hoje
      const porHora = ha && hb ? ha.localeCompare(hb) : ha ? -1 : hb ? 1 : 0
      return porHora || a.chegada_em.localeCompare(b.chegada_em)
    }
    return (a.cor_atual ? 0 : 1) - (b.cor_atual ? 0 : 1) || ordemTriagem(a, b)
  }
}

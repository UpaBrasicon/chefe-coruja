import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BedDouble, Building2, Clock, Hourglass, Repeat, Stethoscope, type LucideIcon } from 'lucide-react'

import type { Grandeza, Nivel } from '@/components/monitor/Parametros'
import { supabase } from '@/lib/supabase'

// Panorama da unidade (P/index.html 20751–20812, PANORAMA): os painéis do
// carrossel e as medidas de cada um. Os números vêm de panorama_gestor (a
// unidade inteira, contada agora); o que o gestor tirou do carrossel fica no
// banco (definir_panorama). Medida sem dado no banco não entra: vaga negada,
// transferência recebida e horas extras não têm registro ainda.

export type NumerosPanorama = Record<string, number | null>
export type Panorama = { gerado_em: string; fora: string[]; n: NumerosPanorama }

export type Medida = {
  chave: string
  rotulo: string
  grandeza: Grandeza
  valor: string
  nivel: Nivel
  pct?: number
  limite?: number
  estado: string
}

export type Painel = {
  chave: string
  titulo: string
  icone: LucideIcon
  medidas: (n: NumerosPanorama) => Medida[]
  nota: (n: NumerosPanorama) => string
}

const num = (n: NumerosPanorama, k: string) => n[k] ?? 0
const pct = (a: number, b: number) => (b > 0 ? a / b : 0)
const fmt = (v: number, casas = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas })
const plural = (v: number, um: string, varios: string) => `${v} ${v === 1 ? um : varios}`
const minutos = (v: number | null) => (v == null ? '—' : v >= 60 ? `${Math.floor(v / 60)} h ${v % 60} min` : `${v} min`)

function ocupacao(n: NumerosPanorama): Medida {
  const t = pct(num(n, 'leitos_ocupados'), num(n, 'leitos'))
  return {
    chave: 'ocupacao', rotulo: 'Ocupação da unidade', grandeza: 'leitos',
    valor: num(n, 'leitos') ? `${Math.round(t * 100)}%` : '—',
    nivel: t >= 0.95 ? 'critico' : t >= 0.85 ? 'atencao' : 'ok', pct: t, limite: 0.85,
    estado: `${num(n, 'leitos_ocupados')} de ${num(n, 'leitos')} leitos · limite 85%`,
  }
}

function contagem(chave: string, rotulo: string, grandeza: Grandeza, v: number, base: number, alerta: boolean, estado: string, critico = false): Medida {
  return { chave, rotulo, grandeza, valor: String(v), nivel: alerta ? (critico ? 'critico' : 'atencao') : 'ok', pct: base > 0 ? pct(v, base) : undefined, estado }
}

export const PAINEIS: Painel[] = [
  {
    chave: 'agora', titulo: 'Agora', icone: Building2,
    medidas: (n) => [
      ocupacao(n),
      contagem('checkin', 'Check-in com divergência', 'observacao', num(n, 'checkin_divergentes'), num(n, 'checkin_total'),
        num(n, 'checkin_divergentes') > 0, `de ${num(n, 'checkin_total')} previstos até agora`),
      contagem('plantao', 'Em plantão agora', 'turno', num(n, 'escalados_agora'), num(n, 'escalados_hoje'), false, `${num(n, 'escalados_hoje')} na escala de hoje`),
      contagem('estoque', 'Estoque crítico', 'suprimento', num(n, 'estoque_critico'), 0, num(n, 'estoque_critico') > 0,
        `${plural(num(n, 'estoque_falta'), 'item', 'itens')} no limite de falta`, num(n, 'estoque_falta') > 0),
    ],
    nota: (n) => `${num(n, 'leitos_ocupados')} de ${num(n, 'leitos')} leitos · ${plural(num(n, 'checkin_divergentes'), 'check-in', 'check-ins')} com atraso, fora do raio ou sem escala · ${plural(num(n, 'faltas_abertas'), 'falta sinalizada', 'faltas sinalizadas')}`,
  },
  {
    chave: 'permanencia', titulo: 'Permanência e espera', icone: Hourglass,
    medidas: (n) => {
      const perm = n.permanencia_media_d
      return [
        { chave: 'permanencia', rotulo: 'Permanência média', grandeza: 'turno', valor: perm == null ? '—' : `${fmt(perm)} d`, nivel: 'ok', estado: 'altas dos últimos 30 dias' },
        { chave: 'espera', rotulo: 'Espera na porta', grandeza: 'observacao', valor: minutos(n.espera_media_min), nivel: (n.espera_media_min ?? 0) > 60 ? 'atencao' : 'ok', estado: `média de quem espera agora · mais longa ${minutos(n.espera_max_min)}` },
        contagem('obs_prazo', 'Observação acima do prazo', 'observacao', num(n, 'obs_acima_prazo'), num(n, 'em_observacao'), num(n, 'obs_acima_prazo') > 0,
          `de ${num(n, 'em_observacao')} em observação`, true),
        contagem('reavaliacao', 'Reavaliação vencida', 'observacao', num(n, 'reavaliacao_vencida'), num(n, 'porta_agora'), num(n, 'reavaliacao_vencida') > 0, 'na porta agora'),
      ]
    },
    nota: () => `Permanência nas altas dos últimos 30 dias · espera e observação são de agora`,
  },
  {
    chave: 'internacoes', titulo: 'Internações', icone: BedDouble,
    medidas: (n) => [
      contagem('internados', 'Internados agora', 'leitos', num(n, 'internados'), num(n, 'leitos_internacao'), false, `${num(n, 'leitos_internacao')} leitos fora da observação`),
      ocupacao(n),
      contagem('admissoes', 'Admissões em 7 dias', 'leitos', num(n, 'admissoes_7d'), 0, false, 'internações que entraram'),
      contagem('altas', 'Altas em 7 dias', 'leitos', num(n, 'altas_7d'), 0, false, 'internações que saíram'),
      contagem('evolucoes', 'Evoluções em atraso', 'observacao', num(n, 'evolucoes_atraso'), num(n, 'internados'), num(n, 'evolucoes_atraso') > 0,
        'internado há mais de 24 h sem evolução em 24 h'),
    ],
    nota: (n) => {
      const saldo = num(n, 'admissoes_7d') - num(n, 'altas_7d')
      return `Saldo de ${saldo > 0 ? '+' : ''}${saldo} na semana · ${plural(num(n, 'evolucoes_atraso'), 'evolução', 'evoluções')} em atraso`
    },
  },
  {
    chave: 'giro', titulo: 'Giro de leitos', icone: Repeat,
    medidas: (n) => {
      const giro = num(n, 'leitos_internacao') ? num(n, 'altas_mes') / num(n, 'leitos_internacao') : null
      return [
        { chave: 'giro', rotulo: 'Giro no mês', grandeza: 'turno', valor: giro == null ? '—' : fmt(giro), nivel: 'ok', estado: 'altas do mês por leito de internação' },
        contagem('livres', 'Leitos livres', 'leitos', num(n, 'leitos_livres'), num(n, 'leitos'), false, `de ${num(n, 'leitos')} leitos ativos`),
        contagem('higienizacao', 'Em higienização', 'turno', num(n, 'leitos_higienizacao'), num(n, 'leitos'), false, 'aguardando liberação'),
        contagem('bloqueados', 'Bloqueados', 'observacao', num(n, 'leitos_bloqueados'), num(n, 'leitos'), num(n, 'leitos_bloqueados') > 0, 'fora de uso'),
      ]
    },
    nota: (n) => `${plural(num(n, 'altas_mes'), 'alta', 'altas')} no mês · ${plural(num(n, 'leitos_bloqueados'), 'leito bloqueado', 'leitos bloqueados')}`,
  },
  {
    chave: 'porta', titulo: 'Porta e observação', icone: Clock,
    medidas: (n) => [
      contagem('atendimentos', 'Chegadas em 7 dias', 'leitos', num(n, 'atendimentos_7d'), 0, false, 'fichas abertas na porta'),
      contagem('observacao', 'Em observação agora', 'observacao', num(n, 'em_observacao'), 0, false, 'nos setores de observação'),
      {
        chave: 'conversao', rotulo: 'Conversão em internação', grandeza: 'leitos',
        valor: num(n, 'desfechos_7d') ? `${Math.round(pct(num(n, 'internacoes_da_porta_7d'), num(n, 'desfechos_7d')) * 100)}%` : '—',
        nivel: 'ok', pct: pct(num(n, 'internacoes_da_porta_7d'), num(n, 'desfechos_7d')), estado: `${num(n, 'internacoes_da_porta_7d')} de ${num(n, 'desfechos_7d')} desfechos em 7 dias`,
      },
      contagem('vermelhos', 'Classificação vermelha hoje', 'leitos', num(n, 'vermelhos_hoje'), 0, false, 'atendimentos classificados'),
      contagem('evasoes', 'Saída sem alta médica', 'observacao', num(n, 'evasoes_7d'), 0, num(n, 'evasoes_7d') > 0, 'evasões em 7 dias'),
    ],
    nota: (n) => `${num(n, 'porta_agora')} na porta agora · ${plural(num(n, 'obs_acima_prazo'), 'paciente passou', 'pacientes passaram')} do prazo da observação`,
  },
  {
    chave: 'equipe', titulo: 'Equipe em plantão', icone: Stethoscope,
    medidas: (n) => [
      contagem('escala', 'Em escala hoje', 'turno', num(n, 'escalados_hoje'), 0, false, 'profissionais'),
      contagem('checkin_feito', 'Check-in feito', 'turno', num(n, 'checkin_feitos'), num(n, 'checkin_total'), false, `de ${num(n, 'checkin_total')} previstos até agora`),
      contagem('fora_raio', 'Fora do raio', 'observacao', num(n, 'checkin_fora_do_raio'), num(n, 'checkin_total'), num(n, 'checkin_fora_do_raio') > 0, 'check-ins de hoje'),
      contagem('sem_checkin', 'Sem check-in', 'observacao', num(n, 'sem_checkin'), num(n, 'checkin_total'), num(n, 'sem_checkin') > 0, 'depois de 15 minutos do início'),
      contagem('vagas', 'Vagas abertas na semana', 'observacao', num(n, 'vagas_abertas_7d'), 0, num(n, 'vagas_abertas_7d') > 0, 'plantões sem profissional'),
      contagem('trocas', 'Trocas aguardando você', 'turno', num(n, 'trocas_pendentes'), 0, num(n, 'trocas_pendentes') > 0, 'pedidos de troca'),
      contagem('solicitacoes', 'Solicitações de escala', 'turno', num(n, 'solicitacoes_pendentes') + num(n, 'candidaturas_pendentes'), 0,
        num(n, 'solicitacoes_pendentes') + num(n, 'candidaturas_pendentes') > 0, 'faltas, passagens e candidaturas'),
    ],
    nota: (n) => `${plural(num(n, 'checkin_sem_escala'), 'check-in', 'check-ins')} sem plantão na escala · ${plural(num(n, 'trocas_pendentes'), 'troca', 'trocas')} para decidir`,
  },
]

export const chavePainel = (p: string) => `p:${p}`
export const chaveMedida = (p: string, m: string) => `c:${p}|${m}`

export function usePanorama(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['panorama-gestor', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('panorama_gestor', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Panorama
    },
  })
}

/** Grava o que sai do carrossel. Otimista: a chave muda na hora. */
export function useDefinirPanorama(unidadeId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fora: string[]) => {
      const { error } = await supabase.rpc('definir_panorama', { p_unidade: unidadeId!, p_fora: fora })
      if (error) throw error
    },
    onMutate: async (fora) => {
      await qc.cancelQueries({ queryKey: ['panorama-gestor', unidadeId] })
      const antes = qc.getQueryData<Panorama>(['panorama-gestor', unidadeId])
      if (antes) qc.setQueryData<Panorama>(['panorama-gestor', unidadeId], { ...antes, fora })
      return { antes }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(['panorama-gestor', unidadeId], ctx.antes)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['panorama-gestor', unidadeId] }),
  })
}

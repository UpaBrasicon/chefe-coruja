import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Activity, BedDouble, Hourglass, MapPin } from 'lucide-react'

import { ehSecaoDireta, SECOES_PLANTAO } from '@/content/plantaoRegistry'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useFaixaPlantonista } from '@/hooks/useFaixaPlantonista'
import { supabase } from '@/lib/supabase'
import { formatarDuracao, nivelDaObservacao } from '@/domain/plantao'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Canal, Canais } from '@/components/monitor/Canais'
import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'

// Plantão (design_handoff/telas/02): sem faixa — ela é só da página inicial.
// Meu plantão no topo, o resumo que leva aos riscos, e as seções como canais.

const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : null

function CartaoResumo({ icone: Icone, rotulo, valor, detalhe, cor, onClick }: {
  icone: typeof BedDouble; rotulo: string; valor: string; detalhe: string; cor: string; onClick: () => void
}) {
  // Nenhum número de risco sem caminho: o cartão inteiro é o link.
  return (
    <button type="button" onClick={onClick} className="rounded-container border border-fio bg-superficie px-4 py-3 text-left shadow-repouso transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-halo">
      <span className={cn('rotulo flex items-center gap-1.5', cor)}>
        <Icone className="size-3" aria-hidden />
        {rotulo}
      </span>
      <span className="mt-1.5 block text-numeral-ok leading-none font-semibold tracking-[-0.03em] text-ok tabular">{valor}</span>
      <span className="mt-1 block text-rotulo text-tinta-apoio">{detalhe}</span>
    </button>
  )
}

export default function PlantaoHome() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { unidadeAtiva } = useUnidade()
  const faixa = useFaixaPlantonista(unidadeAtiva?.unidade_id)

  const { data: presenca } = useQuery({
    queryKey: ['plantao-presenca', unidadeAtiva?.unidade_id, perfil?.id],
    enabled: !!unidadeAtiva?.unidade_id && !!perfil,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('presenca_plantonista')
        .select('checkin_em, checkout_em, checkin_dentro')
        .eq('unidade_id', unidadeAtiva!.unidade_id)
        .eq('perfil_id', perfil!.id)
        .order('checkin_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  const emPlantao = !!presenca?.checkin_em && !presenca.checkout_em
  const d = faixa.data
  const obs = d?.maiorObservacaoMin ?? null

  return (
    <>
      <TituloPagina icone={Activity} titulo="Plantão" descricao="Check-in, atendimento de porta, internação, observação e evolução clínica." />

      <section aria-label="Meu plantão" className="mb-[22px] flex flex-wrap items-center gap-x-5 gap-y-2 rounded-container border border-fio bg-superficie px-4 py-3">
        <span className="rotulo flex items-center gap-1.5 text-turno"><MapPin className="size-3" aria-hidden />Meu plantão</span>
        {emPlantao ? (
          <Badge variant="success">Acesso liberado</Badge>
        ) : presenca?.checkout_em ? (
          <Badge variant="secondary">Plantão encerrado</Badge>
        ) : (
          <Badge variant="warning">Check-in pendente</Badge>
        )}
        <span className="text-apoio text-tinta-apoio tabular">
          Check-in {hora(presenca?.checkin_em ?? null) ?? '—'}
          {presenca?.checkin_em && presenca.checkin_dentro === false && ' · fora do raio'}
          {' · '}Check-out {hora(presenca?.checkout_em ?? null) ?? '—'}
        </span>
        <button type="button" onClick={() => navigate('/plantao/check-in')} className="ml-auto text-apoio font-medium text-acao hover:text-acao-pressionada">
          {emPlantao ? 'Fazer check-out' : 'Fazer check-in'}
        </button>
      </section>

      <div className="mb-[22px] grid gap-3 sm:grid-cols-2">
        <CartaoResumo
          icone={BedDouble}
          rotulo="Pacientes sob cuidado"
          valor={d ? String(d.pacientes) : '—'}
          detalhe={d?.setores.length ? `nos setores da sua escala agora` : 'Sem setor na escala agora'}
          cor="text-leitos"
          onClick={() => navigate('/plantao/internacao/pacientes')}
        />
        <CartaoResumo
          icone={Hourglass}
          rotulo="Em observação"
          valor={obs === null ? '—' : formatarDuracao(obs)}
          detalhe={obs === null ? 'Ninguém em observação no seu acesso' : nivelDaObservacao(obs) === 'critico' ? 'maior permanência · acima de 6 h' : 'maior permanência'}
          cor="text-observacao"
          onClick={() => navigate('/plantao/observacao')}
        />
      </div>

      <TituloSecao>Seções do plantão</TituloSecao>
      <Canais rotulo="Seções do plantão">
        {SECOES_PLANTAO.map((s) => (
          <Canal
            key={s.slug}
            icone={s.icon}
            nome={s.label}
            exemplos={ehSecaoDireta(s) ? s.description : s.tools.map((t) => t.label).join(' · ')}
            contagem={ehSecaoDireta(s) ? undefined : s.tools.length}
            unidade="ferr."
            corIcone="text-acao"
            onClick={() => navigate(`/plantao/${s.slug}`)}
          />
        ))}
      </Canais>
    </>
  )
}

import { AlertTriangle, Info, LayoutDashboard } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { TituloPagina } from '@/components/monitor/Pagina'

import { avaliarUnidade, haQuanto, LATENCIA_ALVO_MS, lugar, selo, SELO_ESTADO, useLatencia, useServidores, useUnidadesRede } from './dadosAdmin'
import { cartao, Metricas } from './ui'

// Plataformas (P/index.html 9383–9454): o software em cada unidade da rede.
// O protótipo trazia versão, latência, uptime e backup por unidade, com
// números fixos. O app é um só serviço para a rede: não há versão nem
// servidor por unidade, e uptime e backup ficam no painel do Supabase, fora
// do banco. Aqui entra o que é medido de verdade: pessoas conectadas e último
// uso por unidade, chamados técnicos, a fila da RNDS e a latência deste
// navegador até o banco. O que não tem fonte aparece dito, não inventado.

const ROTULO_ESTADO = ['Estável', 'Atenção', 'Crítico'] as const

export default function Plataformas() {
  const navigate = useNavigate()
  const unidades = useUnidadesRede()
  const servidores = useServidores()
  const latencia = useLatencia()
  const agora = unidades.dataUpdatedAt

  const linhas = React.useMemo(
    () => (unidades.data ?? []).map((u) => ({ u, ...avaliarUnidade(u, agora) })).sort((a, b) => b.estado - a.estado || a.u.nome.localeCompare(b.u.nome)),
    [unidades.data, agora],
  )
  const atencao = linhas.filter((l) => l.estado > 0)
  const lat = latencia.data
  const rnds = servidores.data?.rnds

  function abrirChamado(unidadeId: string, titulo: string) {
    const q = new URLSearchParams({ novo: unidadeId, titulo })
    navigate(`/pendencias-tecnicas?${q.toString()}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={LayoutDashboard}
        titulo="Plataformas"
        descricao="O software em cada unidade da rede: quem está conectado, último uso, chamados e envios à RNDS. Nenhum dado de paciente atravessa esta tela."
      />

      <Metricas
        className="mb-[22px]"
        itens={[
          { rotulo: 'Sessões ativas', valor: servidores.data ? servidores.data.sessoes : '—', nota: 'pessoas, últimos 30 min' },
          {
            rotulo: 'Latência daqui',
            valor: lat !== undefined ? `${lat} ms` : latencia.error ? 'sem resposta' : '—',
            nota: 'deste navegador ao banco',
            tom: latencia.error ? 'critico' : lat !== undefined && lat >= LATENCIA_ALVO_MS ? 'atencao' : undefined,
          },
          { rotulo: 'Pedem atenção', valor: unidades.data ? atencao.length : '—', nota: `de ${linhas.length} ${linhas.length === 1 ? 'unidade' : 'unidades'}`, tom: atencao.length ? 'atencao' : undefined },
          {
            rotulo: 'Fila da RNDS',
            valor: rnds ? rnds.pendentes + rnds.erro : '—',
            nota: rnds ? (rnds.erro ? `${rnds.erro} com erro` : 'nenhum com erro') : undefined,
            tom: rnds?.erro ? 'critico' : undefined,
          },
        ]}
      />

      <section className={cn(cartao, 'mb-[22px]')} aria-labelledby="plat-atencao">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trilha px-5 py-3.5">
          <span className="flex items-center gap-2.5">
            <AlertTriangle className="size-4 text-atencao" aria-hidden />
            <h2 id="plat-atencao" className="text-corpo font-semibold tracking-[-0.01em] text-tinta">Precisa de atenção</h2>
          </span>
          <span className="text-apoio text-atencao">
            {atencao.length === 0 ? 'Todas as unidades estáveis'
              : `${atencao.length} de ${linhas.length} ${atencao.length === 1 ? 'unidade pede atenção' : 'unidades pedem atenção'}`}
          </span>
        </div>
        {unidades.isLoading && <div className="px-5 py-5"><Spinner /></div>}
        {unidades.error && <p className="px-5 py-4 text-apoio text-critico">{(unidades.error as Error).message}</p>}
        {atencao.map(({ u, estado, motivos }) => (
          <div key={u.unidade_id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-[13px] last:border-0 hover:bg-campo">
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span className="text-corpo font-medium text-tinta">{u.nome}</span>
              <span className="text-apoio text-pretty text-tinta-sussurro">{motivos.join(' · ')}</span>
            </div>
            <span className={cn(selo, SELO_ESTADO[estado])}>{ROTULO_ESTADO[estado]}</span>
            <button
              type="button"
              onClick={() => abrirChamado(u.unidade_id, motivos[0] ? `${u.nome}: ${motivos[0]}` : u.nome)}
              className="rounded-[9px] border border-fio bg-superficie px-[11px] py-1.5 text-apoio whitespace-nowrap text-tinta-apoio hover:border-marca hover:text-acao"
            >
              Abrir chamado
            </button>
          </div>
        ))}
        {unidades.data && atencao.length === 0 && (
          <p className="px-5 py-[18px] text-apoio text-tinta-sussurro">Nenhum chamado aberto e nenhum envio à RNDS parado.</p>
        )}
      </section>

      <section className={cn(cartao, 'mb-[22px]')} aria-label="Unidades">
        <div className="hidden items-center gap-3 border-b border-fio bg-campo px-5 py-[11px] text-rotulo font-semibold tracking-[0.05em] text-tinta-sussurro uppercase sm:flex">
          <span className="min-w-0 flex-1">Unidade</span>
          <span className="w-[88px] text-right">Conectadas</span>
          <span className="w-[88px] text-right">RNDS</span>
          <span className="w-[88px] text-right">Chamados</span>
        </div>
        {linhas.map(({ u, estado }) => (
          <div key={u.unidade_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-[13px] last:border-0 hover:bg-campo">
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span className="text-corpo font-medium text-tinta">{u.nome}</span>
              <span className="text-apoio text-tinta-sussurro">{[lugar(u) || null, `último uso ${haQuanto(u.ultimo_uso, agora)}`].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="w-[88px] text-right text-controle tabular-nums text-tinta-apoio" title="Pessoas com vínculo na unidade e sessão renovada nos últimos 30 minutos">
              <span className="sm:hidden">Conectadas </span>{u.sessoes_ativas}
            </span>
            <span className={cn('w-[88px] text-right text-controle font-semibold tabular-nums', u.rnds_erro ? 'text-critico' : u.rnds_pendentes ? 'text-atencao' : 'text-tinta')}
              title="Envios à RNDS pendentes (e com erro)">
              <span className="font-normal sm:hidden">RNDS </span>{u.rnds_pendentes + u.rnds_erro}{u.rnds_erro ? ` (${u.rnds_erro} erro)` : ''}
            </span>
            <span className={cn('w-[88px] text-right text-controle tabular-nums', estado === 2 ? 'font-semibold text-critico' : u.chamados_abertos ? 'text-atencao' : 'text-tinta-apoio')}>
              <span className="sm:hidden">Chamados </span>{u.chamados_abertos}
            </span>
          </div>
        ))}
        {unidades.data && linhas.length === 0 && <p className="px-5 py-[18px] text-apoio text-tinta-sussurro">Nenhuma unidade ativa na sua organização.</p>}
      </section>

      <div className="flex items-start gap-2.5 rounded-container border border-fio bg-campo px-4 py-3.5 text-apoio text-pretty text-tinta-apoio">
        <Info className="mt-0.5 size-4 shrink-0 text-tinta-sussurro" aria-hidden />
        <span>
          <strong className="font-semibold text-tinta">Sem fonte no app:</strong> versão por unidade, uptime, espaço de backup e latência de cada
          unidade. O Chefe Coruja é uma só publicação para toda a rede, e uptime e backup ficam no painel do Supabase — trazê-los para cá
          exige a chave de gestão do projeto, que não pode ir ao navegador. A latência acima é a deste navegador.
        </span>
      </div>
    </div>
  )
}

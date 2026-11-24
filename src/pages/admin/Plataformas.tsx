import { AlertTriangle, Info, LayoutDashboard } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TituloCartao, TituloPagina } from '@/components/monitor/Pagina'

import { avaliarUnidade, haQuanto, LATENCIA_ALVO_MS, lugar, selo, SELO_ESTADO, useLatencia, useServidores, useUnidadesRede } from '@/lib/dadosAdmin'
import { cartao, Metricas } from '@/components/admin/ui'

// Plataformas (P/index.html 9383–9454): o software em cada unidade da rede.
// O protótipo trazia versão, latência, uptime e backup por unidade, com
// números fixos. O app é um só serviço para a rede: não há versão nem
// servidor por unidade, e uptime e backup ficam no painel do Supabase, fora
// do banco. Aqui entra o que é medido de verdade: pessoas conectadas e último
// uso por unidade, chamados técnicos, a fila da RNDS e a latência deste
// navegador até o banco. O que não tem fonte aparece dito, não inventado.

const ROTULO_ESTADO = ['Estável', 'Atenção', 'Crítico'] as const
// revisão do admin (RT, 24/11/2026): ordem pelo atraso do envio mais antigo
const desde = (u: { rnds_mais_antigo: string | null }) => (u.rnds_mais_antigo ? new Date(u.rnds_mais_antigo).getTime() : Number.MAX_SAFE_INTEGER)
const soRnds = (motivos: string[]) => motivos.length > 0 && motivos.every((m) => m.includes('RNDS'))

export default function Plataformas() {
  const navigate = useNavigate()
  const unidades = useUnidadesRede()
  const servidores = useServidores()
  const latencia = useLatencia()
  const agora = unidades.dataUpdatedAt

  const linhas = React.useMemo(
    () => (unidades.data ?? []).map((u) => ({ u, ...avaliarUnidade(u, agora) })).sort((a, b) => b.estado - a.estado || desde(a.u) - desde(b.u) || a.u.nome.localeCompare(b.u.nome)),
    [unidades.data, agora],
  )
  const atencao = linhas.filter((l) => l.estado > 0)
  // M1: a mesma causa (RNDS parada) vira uma linha só, com as unidades dentro
  const atencaoRnds = atencao.filter((l) => soRnds(l.motivos))
  const atencaoOutras = atencao.filter((l) => !soRnds(l.motivos))
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
        descricao="O software em cada unidade da rede: quem está conectado, último uso, chamados e envios à RNDS. Esta tela não traz dado de paciente."
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
            <TituloCartao id="plat-atencao" className="mb-0">Precisa de atenção</TituloCartao>
          </span>
          <span className="text-apoio text-atencao">
            {atencao.length === 0 ? 'Todas as unidades estáveis'
              : `${atencao.length} de ${linhas.length} ${atencao.length === 1 ? 'unidade pede atenção' : 'unidades pedem atenção'}`}
          </span>
        </div>
        {unidades.isLoading && <div className="px-5 py-5"><Spinner /></div>}
        {unidades.error && <p className="px-5 py-4 text-apoio text-critico">{(unidades.error as Error).message}</p>}
        {atencaoRnds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-[13px] last:border-0 hover:bg-campo">
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span className="text-corpo font-medium text-tinta">
                Envio à RNDS parado em {atencaoRnds.length} {atencaoRnds.length === 1 ? 'unidade' : 'unidades'}
              </span>
              <span className="text-apoio text-pretty text-tinta-sussurro">
                Sem credencial e certificado, a fila guarda e não envia. {atencaoRnds.map((l) => l.u.nome).join(', ')}.
              </span>
            </div>
            <Link to="/integracoes?aba=rnds" className="text-apoio font-medium text-acao hover:underline">Ver a RNDS</Link>
          </div>
        )}
        {atencaoOutras.map(({ u, estado, motivos }) => (
          <div key={u.unidade_id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-[13px] last:border-0 hover:bg-campo">
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span className="text-corpo font-medium text-tinta">{u.nome}</span>
              <span className="text-apoio text-pretty text-tinta-sussurro">{motivos.join(' · ')}</span>
            </div>
            <span className={cn(selo, SELO_ESTADO[estado])}>{ROTULO_ESTADO[estado]}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => abrirChamado(u.unidade_id, motivos[0] ? `${u.nome}: ${motivos[0]}` : u.nome)}
            >
              Abrir chamado
            </Button>
          </div>
        ))}
        {unidades.data && atencao.length === 0 && (
          <p className="px-5 py-[18px] text-apoio text-tinta-sussurro">Nenhum chamado aberto e nenhum envio à RNDS parado.</p>
        )}
      </section>

      <section className={cn(cartao, 'mb-[22px]')} aria-label="Unidades">
        <div className="hidden items-center gap-3 border-b border-fio bg-campo px-5 py-[11px] text-rotulo font-semibold text-tinta-sussurro sm:flex">
          <span className="min-w-0 flex-1">Unidade</span>
          <span className="w-[88px] text-right" title="Pessoas com sessão nos últimos 30 minutos">Conectadas</span>
          <span className="w-[88px] text-right" title="Envios à RNDS na fila (pendentes e com erro)">Fila RNDS</span>
          <span className="w-[88px] text-right" title="Chamados técnicos abertos">Chamados</span>
        </div>
        {linhas.map(({ u, estado }) => (
          <div key={u.unidade_id} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-[13px] last:border-0 hover:bg-campo">
            <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
              <span className="text-corpo font-medium text-tinta">{u.nome}</span>
              <span className="text-apoio text-tinta-sussurro">{[lugar(u) || null, `último uso ${haQuanto(u.ultimo_uso, agora)}`].filter(Boolean).join(' · ')}</span>
            </div>
            <span className={cn('w-[88px] text-right text-controle tabular-nums', u.sessoes_ativas ? 'text-tinta-apoio' : 'text-tinta-sussurro')} title="Pessoas com vínculo na unidade e sessão renovada nos últimos 30 minutos">
              <span className="sm:hidden">Conectadas </span>{u.sessoes_ativas}
            </span>
            <span className={cn('w-[88px] text-right text-controle font-semibold tabular-nums', u.rnds_erro ? 'text-critico' : u.rnds_pendentes ? 'text-atencao' : 'font-normal text-tinta-sussurro')}
              title="Envios à RNDS pendentes (e com erro)">
              <span className="font-normal sm:hidden">RNDS </span>{u.rnds_pendentes + u.rnds_erro}{u.rnds_erro ? ` (${u.rnds_erro} erro)` : ''}
            </span>
            <span className={cn('w-[88px] text-right text-controle tabular-nums', estado === 2 ? 'font-semibold text-critico' : u.chamados_abertos ? 'text-atencao' : 'text-tinta-sussurro')}>
              <span className="sm:hidden">Chamados </span>{u.chamados_abertos}
            </span>
          </div>
        ))}
        {unidades.data && linhas.length === 0 && <p className="px-5 py-[18px] text-apoio text-tinta-sussurro">Nenhuma unidade ativa na sua organização.</p>}
      </section>

      <details className="rounded-container border border-fio bg-campo px-4 py-3 text-apoio text-pretty text-tinta-apoio">
        <summary className="flex cursor-pointer items-center gap-2 text-tinta-sussurro">
          <Info className="size-4 shrink-0" aria-hidden /> Por que não há versão, uptime e backup por unidade
        </summary>
        <span className="mt-2 block">
          Sem fonte no app: versão por unidade, uptime, espaço de backup e latência de cada
          unidade. O Chefe Coruja é uma só publicação para toda a rede, e uptime e backup ficam no painel do Supabase. Trazê-los para cá
          exige a chave de gestão do projeto, que não pode ir ao navegador. A latência acima é a deste navegador.
        </span>
      </details>
    </div>
  )
}

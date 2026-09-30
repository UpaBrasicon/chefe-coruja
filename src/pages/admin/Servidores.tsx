import { useQueryClient } from '@tanstack/react-query'
import { Clock, Gauge, RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { TituloPagina } from '@/components/monitor/Pagina'

import { bytes, haQuanto, LATENCIA_ALVO_MS, selo, SELO_ESTADO, useLatencia, useServidores, type Estado } from './dadosAdmin'
import { cartao } from './ui'

// Servidores (P/index.html 10070–10097). No protótipo, sete serviços com
// medidas fixas (p95 da API, entrega de push, 4 TB contratados, janela de
// manutenção). Aqui cada linha é medida agora: o banco mede a si mesmo
// (admin_servidores) e o navegador mede a ida e volta até ele. O que não tem
// fonte (uptime, backup, taxa de entrega do push, janela de manutenção) é dito
// no rodapé, sem número.

const ROTULO = ['Operando', 'Degradado', 'Fora do ar'] as const
const DIA_MS = 24 * 60 * 60 * 1000
const NOME_BUCKET: Record<string, string> = { atendimento: 'anexos do atendimento', banners: 'avisos da unidade', painel: 'propaganda do painel', receitas: 'receitas', fotos: 'fotos' }

type Servico = { servico: string; medida: string; nota: string; estado: Estado }

export default function Servidores() {
  const queryClient = useQueryClient()
  const s = useServidores()
  const lat = useLatencia()
  const d = s.data
  const agora = s.dataUpdatedAt

  const servicos: Servico[] = []
  servicos.push({
    servico: 'Banco de dados',
    medida: lat.data !== undefined ? `${lat.data} ms` : lat.error ? 'sem resposta' : '…',
    nota: d
      ? `ida e volta deste navegador · ${bytes(d.banco.tamanho_bytes)} · ${d.banco.conexoes} de ${d.banco.conexoes_max} conexões`
      : 'ida e volta deste navegador',
    estado: lat.error ? 2 : lat.data !== undefined && lat.data >= LATENCIA_ALVO_MS ? 1 : 0,
  })
  if (d) {
    const antigo = d.rnds.mais_antigo ? agora - new Date(d.rnds.mais_antigo).getTime() : 0
    const armazenado = d.armazenamento.reduce((t, b) => t + b.bytes, 0)
    servicos.push(
      {
        servico: 'Sessões e acesso',
        medida: String(d.sessoes),
        nota: d.sessoes === 1 ? 'pessoa com sessão em uso nos últimos 30 minutos' : 'pessoas com sessão em uso nos últimos 30 minutos',
        estado: 0,
      },
      {
        servico: 'Fila da RNDS',
        medida: String(d.rnds.pendentes + d.rnds.erro),
        nota: [
          d.rnds.erro ? `${d.rnds.erro} com erro` : 'nenhum com erro',
          `${d.rnds.enviados_24h} enviados em 24 horas`,
          d.rnds.mais_antigo ? `o mais antigo ${haQuanto(d.rnds.mais_antigo, agora)}` : null,
        ].filter(Boolean).join(' · '),
        estado: d.rnds.erro ? 1 : antigo > DIA_MS ? 1 : 0,
      },
      {
        servico: 'Armazenamento de arquivos',
        medida: bytes(armazenado),
        nota: d.armazenamento.length
          ? d.armazenamento.map((b) => `${NOME_BUCKET[b.bucket] ?? b.bucket} ${bytes(b.bytes)}`).join(' · ')
          : 'nenhum arquivo nas pastas das suas unidades',
        estado: 0,
      },
      {
        servico: 'Avisos no aparelho (push)',
        medida: String(d.push),
        nota: 'aparelhos inscritos; a entrega não é medida',
        estado: 0,
      },
      {
        servico: 'Registro de auditoria',
        medida: String(d.auditoria.registros_24h),
        nota: `registros em 24 horas · último ${haQuanto(d.auditoria.ultima_em, agora)}`,
        estado: 0,
      },
    )
  }

  function medirDeNovo() {
    void queryClient.invalidateQueries({ queryKey: ['admin-servidores'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-latencia'] })
  }

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={Gauge}
        titulo="Servidores"
        descricao={d ? `Saúde da plataforma medida às ${new Date(d.servidor).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}` : 'Saúde da plataforma medida agora'}
        acoes={
          <Button variant="outline" onClick={medirDeNovo} disabled={s.isFetching || lat.isFetching}>
            {s.isFetching || lat.isFetching ? <Spinner className="size-4" /> : <RefreshCw />} Medir de novo
          </Button>
        }
      />

      <div className={cartao}>
        {s.error && <p className="border-b border-trilha px-5 py-4 text-apoio text-critico">{(s.error as Error).message}</p>}
        {servicos.map((v) => (
          <div key={v.servico} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3.5 hover:bg-campo">
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-[3px]">
              <span className="text-corpo font-medium text-tinta">{v.servico}</span>
              <span className="text-apoio text-pretty text-tinta-sussurro">{v.nota}</span>
            </div>
            <span className={cn('text-[17px] font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums',
              v.estado === 2 ? 'text-critico' : v.estado === 1 ? 'text-atencao' : 'text-tinta')}>
              {v.medida}
            </span>
            <span className={cn(selo, SELO_ESTADO[v.estado])}>{ROTULO[v.estado]}</span>
          </div>
        ))}
        {s.isLoading && <div className="border-b border-trilha px-5 py-5"><Spinner /></div>}
        <div className="flex items-start gap-[9px] px-5 py-[15px] text-apoio text-tinta-apoio">
          <Clock className="mt-px size-[15px] shrink-0 text-tinta-sussurro" aria-hidden />
          <span className="text-pretty">
            Uptime, backup, taxa de entrega do push e janela de manutenção não têm fonte no banco: ficam no painel do Supabase e não
            aparecem aqui. Degradado quer dizer latência acima de {LATENCIA_ALVO_MS} ms, envio à RNDS com erro ou parado há mais de 24 horas.
          </span>
        </div>
      </div>
    </div>
  )
}

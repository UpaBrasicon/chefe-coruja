import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Gauge, RefreshCw } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { TituloPagina } from '@/components/monitor/Pagina'
import { hora } from '@/lib/formato'

import { bytes, haQuanto, LATENCIA_ALVO_MS, selo, SELO_ESTADO, useLatencia, useServidores, type Estado } from '@/lib/dadosAdmin'
import { cartao } from '@/components/admin/ui'
import { supabase } from '@/lib/supabase'
import { emDolar, lerTeto, linhaCustoIa, linhaTetoIa, type CustoIaMes, type TetoIa } from '@/lib/custoIa'

// Servidores (P/index.html 10070–10097). No protótipo, sete serviços com
// medidas fixas (p95 da API, entrega de push, 4 TB contratados, janela de
// manutenção). Aqui cada linha é medida agora: o banco mede a si mesmo
// (admin_servidores) e o navegador mede a ida e volta até ele. O que não tem
// fonte (uptime, backup, taxa de entrega do push, janela de manutenção) é dito
// no rodapé, sem número.

const ROTULO = ['Operando', 'Degradado', 'Fora do ar'] as const
const DIA_MS = 24 * 60 * 60 * 1000
const NOME_BUCKET: Record<string, string> = { atendimento: 'anexos do atendimento', banners: 'avisos da unidade', painel: 'propaganda do painel', receitas: 'receitas', fotos: 'fotos' }

const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
type Servico = { servico: string; medida: string; nota: string; estado: Estado; rotulo?: string }

const SELO_TETO = { dentro: 'Dentro do teto', acima: 'Acima do teto', sem_medida: 'Sem medida' } as const

export default function Servidores() {
  const queryClient = useQueryClient()
  const s = useServidores()
  const lat = useLatencia()
  // E6: custo do mês da busca clínica; só o super admin recebe (os outros, 42501, e a linha some)
  const custo = useQuery({
    queryKey: ['admin-custo-ia'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ia_custo_busca_mes')
      if (error) return null
      return ((data ?? []) as CustoIaMes[])[0] ?? null
    },
    staleTime: 5 * 60 * 1000,
  })
  // Ajustes da revisão, item 5 (RT, 24/11/2026): teto mensal da IA. Só o super
  // admin recebe (os outros, 42501: a linha e o campo somem)
  const teto = useQuery({
    queryKey: ['admin-teto-ia'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ia_teto_mensal')
      if (error) return null
      return { teto: ((data ?? []) as TetoIa[])[0] ?? null }
    },
    staleTime: 5 * 60 * 1000,
  })
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
        medida: pl(d.sessoes, 'pessoa', 'pessoas'),
        nota: 'com sessão em uso nos últimos 30 minutos',
        estado: 0,
      },
      {
        servico: 'Fila da RNDS',
        medida: `${d.rnds.pendentes + d.rnds.erro} na fila`,
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
        // revisão do admin (RT, 24/11/2026): zero aparelho é "sem uso", não um número solto
        medida: d.push ? pl(d.push, 'aparelho', 'aparelhos') : 'Sem uso',
        nota: d.push ? 'aparelhos inscritos; a entrega não é medida' : 'nenhum aparelho inscrito para receber avisos',
        estado: 0,
      },
      {
        servico: 'Registro de auditoria',
        medida: pl(d.auditoria.registros_24h, 'registro', 'registros'),
        nota: `em 24 horas · último ${haQuanto(d.auditoria.ultima_em, agora)}`,
        estado: 0,
      },
    )
  }
  if (custo.data) {
    const l = linhaCustoIa(custo.data)
    servicos.push({ servico: 'IA da busca clínica', medida: l.medida, nota: l.nota, estado: 0 })
  }
  if (teto.data?.teto) {
    const l = linhaTetoIa(custo.data ?? null, teto.data.teto)
    servicos.push({ servico: 'Teto mensal da IA', medida: l.medida, nota: l.nota, estado: l.selo === 'acima' ? 1 : 0, rotulo: SELO_TETO[l.selo] })
  }

  // M1: o que tem problema sobe; os outros mantêm a ordem
  const ordenados = servicos.map((v, i) => ({ v, i })).sort((a, b) => b.v.estado - a.v.estado || a.i - b.i).map((x) => x.v)
  const ruins = servicos.filter((v) => v.estado > 0).length
  const resumo = !d ? null : ruins === 0 ? 'Tudo operando' : `${ruins} ${ruins === 1 ? 'serviço pede' : 'serviços pedem'} atenção`

  function medirDeNovo() {
    void queryClient.invalidateQueries({ queryKey: ['admin-servidores'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-latencia'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-custo-ia'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-teto-ia'] })
  }

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={Gauge}
        titulo="Servidores"
        descricao={d ? `${resumo} · medido às ${hora(d.servidor)}` : 'Saúde da plataforma medida agora'}
        acoes={
          <Button variant="outline" onClick={medirDeNovo} disabled={s.isFetching || lat.isFetching}>
            {s.isFetching || lat.isFetching ? <Spinner className="size-4" /> : <RefreshCw />} Medir de novo
          </Button>
        }
      />

      <div className={cartao}>
        {s.error && <p className="border-b border-trilha px-5 py-4 text-apoio text-critico">{(s.error as Error).message}</p>}
        {ordenados.map((v) => (
          <div key={v.servico} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3.5 hover:bg-campo">
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-[3px]">
              <span className="text-corpo font-medium text-tinta">{v.servico}</span>
              <span className="text-apoio text-pretty text-tinta-sussurro">{v.nota}</span>
            </div>
            <span className={cn('text-secao font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums',
              v.estado === 2 ? 'text-critico' : v.estado === 1 ? 'text-atencao' : 'text-tinta')}>
              {v.medida}
            </span>
            {(v.estado > 0 || v.rotulo) && <span className={cn(selo, SELO_ESTADO[v.estado])}>{v.rotulo ?? ROTULO[v.estado]}</span>}
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

      {teto.data && <TetoDaIa atual={teto.data.teto} />}
    </div>
  )
}

// Ajustes da revisão, item 5 (RT, 24/11/2026; migration 20270421000074): o
// administrador geral define o teto mensal da IA, em dólar. Sem valor padrão.
function TetoDaIa({ atual }: { atual: TetoIa | null }) {
  const queryClient = useQueryClient()
  const [texto, setTexto] = React.useState(atual ? String(Number(atual.usd)).replace('.', ',') : '')
  const valor = lerTeto(texto)
  const salvar = useMutation({
    mutationFn: async (usd: number | null) => {
      const { error } = await supabase.rpc('definir_ia_teto_mensal', { p_usd: usd })
      if (error) throw error
    },
    onSuccess: (_d, usd) => {
      if (usd === null) setTexto('')
      void queryClient.invalidateQueries({ queryKey: ['admin-teto-ia'] })
    },
  })
  return (
    <div className={cn(cartao, 'mt-4 flex flex-col gap-3 px-5 py-4')}>
      <div className="flex flex-col gap-[3px]">
        <span className="text-corpo font-medium text-tinta">Teto mensal da IA</span>
        <span className="text-apoio text-pretty text-tinta-sussurro">
          {atual
            ? `Teto atual: ${emDolar(Number(atual.usd))} por mês. O consumo medido é o da busca clínica; o teto é referência e não bloqueia a IA.`
            : 'Nenhum teto definido. Informe o valor em dólar, a mesma moeda do custo estimado da busca clínica.'}
        </span>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (valor !== null) salvar.mutate(valor)
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="teto-ia">Teto por mês (US$)</Label>
          <Input id="teto-ia" inputMode="decimal" autoComplete="off" className="w-40" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="valor em dólar" />
        </div>
        <Button type="submit" disabled={valor === null || salvar.isPending}>Salvar teto</Button>
        {atual && <Button type="button" variant="ghost" disabled={salvar.isPending} onClick={() => salvar.mutate(null)}>Tirar o teto</Button>}
      </form>
      {texto.trim() !== '' && valor === null && <span className="text-rotulo text-atencao">Use um valor maior que zero, com até duas casas (ex.: 50 ou 50,5).</span>}
      {salvar.error && <p role="alert" className="text-apoio text-critico">{(salvar.error as Error).message}</p>}
    </div>
  )
}

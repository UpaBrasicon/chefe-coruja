import { useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarClock } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { dataPura, numero } from '@/lib/formato'
import { PAPEL_LABEL } from '@/lib/constants'
import { acharSecao } from '@/content/registry'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { Chip, TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cartao } from '@/components/admin/ui'
import type { Papel } from '@/types/database'
import {
  lerPainel, porUnidadePapel, ranking, totalEntradas, totalEvento, ROTULO_EVENTO,
} from '@/domain/usoApp'

// Fase 1, item 14 (PH1 a PH3 = A do RT, 23/11/2026; docs/frontend/POSTHOG-DIAGNOSTICO.md):
// o administrador geral vê o uso do app por dia, unidade e papel, sem pessoa e
// sem paciente. A entrada no app vem dos registros de acesso do LG9; o resto,
// de public.uso_app_diario (migration 20270415000038).

const PERIODOS = [7, 30, 90] as const

const rotuloPapel = (p: string) => PAPEL_LABEL[p as Papel] ?? p
const rotuloSecao = (slug: string) => acharSecao(slug)?.label ?? slug
function rotuloFerramenta(chave: string) {
  const [secao, slug] = chave.split('/')
  const s = acharSecao(secao)
  const t = s?.tools.find((x) => x.slug === slug)
  return t ? `${t.label} · ${s?.label}` : chave
}

function Numero({ titulo, valor, nota }: { titulo: string; valor: number; nota?: string }) {
  return (
    <div className={cn(cartao, 'flex flex-col gap-1 px-5 py-4')}>
      <span className="text-apoio text-tinta-sussurro">{titulo}</span>
      <span className="text-titulo font-semibold tabular-nums text-tinta">{numero(valor)}</span>
      {nota && <span className="text-apoio text-tinta-sussurro">{nota}</span>}
    </div>
  )
}

function Ranking({ titulo, itens, rotulo, vazio }: {
  titulo: string; itens: { detalhe: string; total: number }[]; rotulo: (d: string) => string; vazio: string
}) {
  const maior = itens[0]?.total ?? 0
  return (
    <section className="mb-7">
      <TituloSecao>{titulo}</TituloSecao>
      <div className={cartao}>
        {itens.length === 0 && <p className="px-5 py-4 text-apoio text-tinta-sussurro">{vazio}</p>}
        <ol>
          {itens.map((i) => (
            <li key={i.detalhe} className="flex items-center gap-3 border-b border-trilha px-5 py-2.5 last:border-0">
              <span className="min-w-0 flex-1 truncate text-corpo text-tinta">{rotulo(i.detalhe)}</span>
              <span className="hidden h-1.5 w-28 overflow-hidden rounded-capsula bg-trilha sm:block" aria-hidden>
                <span className="block h-full rounded-capsula bg-acao" style={{ width: `${maior ? Math.max(4, (i.total / maior) * 100) : 0}%` }} />
              </span>
              <span className="w-12 text-right text-corpo tabular-nums text-tinta">{numero(i.total)}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default function UsoDoApp() {
  const [dias, setDias] = React.useState<(typeof PERIODOS)[number]>(30)
  const painel = useQuery({
    queryKey: ['uso-app-painel', dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('uso_app_painel', { p_dias: dias })
      if (error) throw error
      return lerPainel(data)
    },
  })
  const p = painel.data
  const linhas = React.useMemo(() => (p ? porUnidadePapel(p.eventos) : []), [p])

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={BarChart3}
        titulo="Uso do app"
        descricao="Quantas vezes cada parte do app foi usada, por dia, unidade e papel. Sem pessoa e sem paciente."
      />

      <div role="group" aria-label="Período" className="mb-5 flex flex-wrap items-center gap-1.5 text-apoio text-tinta-sussurro">
        <CalendarClock className="size-4" aria-hidden />
        {PERIODOS.map((d) => (
          <Chip key={d} ativo={dias === d} onClick={() => setDias(d)}>
            {d} dias
          </Chip>
        ))}
        {p?.desde && <span className="ml-2">desde {dataPura(p.desde)}</span>}
      </div>

      {painel.isLoading && <EsqueletoLinhas linhas={4} rotulo="Carregando o uso do app…" className="px-0" />}
      {painel.error && <p role="alert" className="mb-5 text-apoio text-critico">{(painel.error as Error).message}</p>}

      {p && (
        <>
          <div className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Numero titulo="Entradas no app" valor={totalEntradas(p.entradas)} nota="sessões abertas" />
            <Numero titulo={ROTULO_EVENTO.central_aba} valor={totalEvento(p.eventos, 'central_aba')} />
            <Numero titulo={ROTULO_EVENTO.ferramenta} valor={totalEvento(p.eventos, 'ferramenta')} />
            <Numero titulo={ROTULO_EVENTO.censo} valor={totalEvento(p.eventos, 'censo')} />
          </div>

          <section className="mb-7">
            <TituloSecao extra={`${linhas.length} ${linhas.length === 1 ? 'linha' : 'linhas'}`}>Por unidade e papel</TituloSecao>
            <div className={cn(cartao, 'overflow-x-auto')}>
              {linhas.length === 0 ? (
                <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nenhum uso registrado no período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Papel</TableHead>
                      <TableHead className="text-right">Abas</TableHead>
                      <TableHead className="text-right">Ferramentas</TableHead>
                      <TableHead className="text-right">Censo</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l) => (
                      <TableRow key={`${l.unidade_id}|${l.papel}`}>
                        <TableCell>{l.unidade}</TableCell>
                        <TableCell>{rotuloPapel(l.papel)}</TableCell>
                        <TableCell className="text-right tabular-nums">{numero(l.central_aba)}</TableCell>
                        <TableCell className="text-right tabular-nums">{numero(l.ferramenta)}</TableCell>
                        <TableCell className="text-right tabular-nums">{numero(l.censo)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{numero(l.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </section>

          <Ranking titulo="Ferramentas mais abertas no período" itens={ranking(p.eventos, 'ferramenta')}
            rotulo={rotuloFerramenta} vazio="Nenhuma ferramenta aberta no período." />
          <Ranking titulo="Abas da Central no período" itens={ranking(p.eventos, 'central_aba')}
            rotulo={rotuloSecao} vazio="Nenhuma aba aberta no período." />
          <Ranking titulo="Ferramentas desde o início (todas as pessoas somadas)"
            itens={p.ferramentas_desde_inicio.slice(0, 15).map((f) => ({ detalhe: f.chave, total: f.usos }))}
            rotulo={rotuloFerramenta} vazio="Nenhuma ferramenta aberta ainda." />

          <section className="mb-7">
            <TituloSecao>Entradas por dia</TituloSecao>
            <div className={cn(cartao, 'overflow-x-auto')}>
              {p.entradas.length === 0 ? (
                <p className="px-5 py-4 text-apoio text-tinta-sussurro">Nenhuma entrada no período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dia</TableHead>
                      <TableHead className="text-right">Entradas</TableHead>
                      <TableHead className="text-right">Pessoas diferentes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.entradas.map((e) => (
                      <TableRow key={e.dia}>
                        <TableCell>{dataPura(e.dia)}</TableCell>
                        <TableCell className="text-right tabular-nums">{numero(e.entradas)}</TableCell>
                        <TableCell className="text-right tabular-nums">{numero(e.pessoas)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <p className="mt-2 text-apoio text-tinta-sussurro">
              Lidas dos registros de acesso (LG9). A troca de unidade ou de papel não conta como entrada.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

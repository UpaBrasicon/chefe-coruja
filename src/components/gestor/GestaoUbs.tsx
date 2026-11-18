// Gestão ambulatorial da UBS (percurso da UBS, U13, PR 2): as seis frentes do
// gestor por período (produção, agenda, espera, medicamentos, rede e
// vigilância), pela função public.gestao_ubs. Na UBS, a página Indicadores
// mostra este bloco no lugar do censo, da ocupação e da porta.
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import * as React from 'react'

import { Chip, Chips, TituloCartao } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'
import { SITUACAO } from '@/domain/agenda'
import { CLASSIFICACAO_CAB28, TIPOS_ATENDIMENTO_APS } from '@/domain/aps'
import { SITUACAO_ENVIO, type SituacaoEnvio } from '@/domain/encaminhamento'
import {
  FAIXAS, PERIODOS, inicioDoPeriodo, minutos, ordenarContagem, proporcao, type GestaoUbs as Dados,
} from '@/domain/gestaoUbs'
import { dataIso, dataPura, numero } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

const rotuloTipo = (v: string) => TIPOS_ATENDIMENTO_APS.find((t) => t.valor === v)?.curto ?? v
const rotuloCor = (v: string) => CLASSIFICACAO_CAB28.find((c) => c.cor === v)?.rotulo ?? v
const rotuloSituacao = (v: string) => (SITUACAO as Record<string, { rotulo: string }>)[v]?.rotulo ?? v
const rotuloEnvio = (v: string) => SITUACAO_ENVIO[v as SituacaoEnvio]?.rotulo ?? v

function Frente({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie px-4 py-3">
      <TituloCartao className="mb-0">{titulo}</TituloCartao>
      {children}
    </section>
  )
}

/** Linhas rótulo e valor; o valor alinha à direita. */
function Linhas({ itens }: { itens: [string, ReactNode][] }) {
  if (itens.length === 0) return <p className="text-apoio text-tinta-sussurro">Nada no período.</p>
  return (
    <dl className="flex flex-col">
      {itens.map(([r, v]) => (
        <div key={r} className="flex items-baseline justify-between gap-3 border-t border-trilha py-1 first:border-t-0">
          <dt className="text-apoio text-tinta-apoio">{r}</dt>
          <dd className="text-apoio font-medium tabular-nums text-tinta">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Subtitulo({ children }: { children: ReactNode }) {
  return <h4 className="mt-1 text-rotulo font-medium text-tinta-sussurro">{children}</h4>
}

export function GestaoUbs({ unidadeId }: { unidadeId: string }) {
  const [dias, setDias] = React.useState<number>(30)
  const q = useQuery({
    queryKey: ['gestao-ubs', unidadeId, dias],
    queryFn: async () => {
      const ate = dataIso()
      const { data, error } = await supabase.rpc('gestao_ubs', { p_unidade: unidadeId, p_de: inicioDoPeriodo(ate, dias), p_ate: ate })
      if (error) throw error
      return data as unknown as Dados
    },
  })

  const corpo = (() => {
    if (q.isLoading) return <Spinner />
    if (q.error || !q.data) return <p className="text-apoio text-critico">{(q.error as Error | null)?.message ?? 'Sem dados.'}</p>
    const { producao: p, agenda: a, espera: e, medicamentos: m, rede: r, vigilancia: v } = q.data
    const marcadas = Object.values(a.por_situacao).reduce((s, n) => s + n, 0)
    const pctTotal = (n: number) => {
      const x = proporcao(n, p.total)
      return x === null ? numero(n) : `${numero(n)} (${x}%)`
    }
    return (
      <>
        <p className="text-apoio text-tinta-apoio">De {dataPura(q.data.de)} a {dataPura(q.data.ate)}.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Frente titulo={`Produção: ${numero(p.total)} atendimentos de médico e enfermeiro`}>
            <Subtitulo>Por tipo</Subtitulo>
            <Linhas itens={ordenarContagem(p.por_tipo).map(([k, n]) => [rotuloTipo(k), pctTotal(n)])} />
            <Subtitulo>Por faixa etária</Subtitulo>
            <Linhas itens={FAIXAS.filter((f) => p.por_faixa[f.chave] > 0).map((f) => [f.rotulo, pctTotal(p.por_faixa[f.chave])])} />
            <Subtitulo>Por turno</Subtitulo>
            <Linhas itens={([['manhã', p.por_turno.manha], ['tarde', p.por_turno.tarde], ['noite', p.por_turno.noite]] as [string, number][])
              .filter(([, n]) => n > 0).map(([k, n]) => [k, pctTotal(n)])} />
            <Subtitulo>Grupos</Subtitulo>
            <Linhas itens={[
              ['gestantes (pré-natal)', numero(p.gestantes)], ['crianças até 2 anos', numero(p.criancas_ate_2)],
              ['hipertensão', numero(p.hipertensos)], ['diabetes', numero(p.diabeticos)],
            ]} />
            <Subtitulo>Por profissional</Subtitulo>
            <Linhas itens={p.por_profissional.map((x) => [x.nome, numero(x.n)])} />
            <Subtitulo>Escuta inicial por classificação (CAB 28)</Subtitulo>
            <Linhas itens={ordenarContagem(p.escutas_por_cor).map(([k, n]) => [rotuloCor(k), numero(n)])} />
          </Frente>

          <div className="flex flex-col gap-3">
            <Frente titulo={`Agenda: ${numero(marcadas)} consultas marcadas`}>
              <Linhas itens={[
                ...ordenarContagem(a.por_situacao).map(([k, n]): [string, ReactNode] => [rotuloSituacao(k), numero(n)]),
                ...(a.comparecimento === null ? [] : [['comparecimento', `${numero(a.comparecimento)}%`] as [string, ReactNode]]),
              ]} />
              {a.por_profissional.length > 0 && (
                <>
                  <Subtitulo>Por profissional (marcadas · faltas)</Subtitulo>
                  <Linhas itens={a.por_profissional.map((x) => [x.nome, `${numero(x.marcadas)} · ${numero(x.faltas)}`])} />
                </>
              )}
            </Frente>

            <Frente titulo="Espera">
              <Linhas itens={[
                ['até a escuta inicial (média · mediana)', `${minutos(e.escuta_media_min)} · ${minutos(e.escuta_mediana_min)}`],
                ['até a consulta (média · mediana)', `${minutos(e.consulta_media_min)} · ${minutos(e.consulta_mediana_min)}`],
                ['não aguardou', numero(e.nao_aguardou)],
                ['fichas vencidas', numero(e.fichas_vencidas)],
              ]} />
            </Frente>

            <Frente titulo="Medicamentos">
              <Linhas itens={[
                ['itens dispensados', numero(m.itens)], ['pacientes atendidos', numero(m.pacientes)],
                ['dispensados sem farmacêutico', numero(m.sem_farmaceutico)],
                ['administrações na unidade', numero(m.administracoes)],
                ['estoque abaixo do mínimo', numero(m.estoque_critico)], ['estoque em falta', numero(m.estoque_falta)],
              ]} />
              {m.mais_dispensados.length > 0 && (
                <>
                  <Subtitulo>Mais dispensados</Subtitulo>
                  <Linhas itens={m.mais_dispensados.map((x) => [x.nome, numero(x.quantidade)])} />
                </>
              )}
            </Frente>

            <Frente titulo="Rede e vigilância">
              <Linhas itens={[
                ...ordenarContagem(r.envios_upa).map(([k, n]): [string, ReactNode] => [`envios à UPA: ${rotuloEnvio(k).toLowerCase()}`, numero(n)]),
                ['retornos da UPA e do hospital', numero(r.retornos)], ['retornos a ver', numero(r.retornos_a_ver)],
                ['notificações compulsórias pendentes', `${numero(v.pendentes)} de ${numero(v.total)}`],
              ]} />
            </Frente>
          </div>
        </div>
      </>
    )
  })()

  return (
    <div className="flex flex-col gap-3">
      <Chips rotulo="Período">
        {PERIODOS.map((x) => (
          <Chip key={x.dias} ativo={dias === x.dias} radio onClick={() => setDias(x.dias)}>{x.rotulo}</Chip>
        ))}
      </Chips>
      {corpo}
      <p className="text-rotulo text-pretty text-tinta-sussurro">
        Atendimentos de médico e enfermeiro pelo papel na unidade, encerrados no período; a ficha vencida fica fora da produção e conta em "fichas vencidas".
      </p>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Siren } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { GRAVIDADES, PAPEL_REGISTRO, type RelatorioIntercorrencias } from '@/lib/intercorrencia'
import { supabase } from '@/lib/supabase'

// Relatório de intercorrências do gestor (Fase 2, tarefa 4; migration
// 20261031000003). Conta a versão vigente de cada registro (a retificada sai);
// os nomes dos pacientes ficam na trilha de auditoria.

const dia = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

export default function IntercorrenciasRelatorio() {
  const unidadeId = useUnidade().unidadeAtiva?.unidade_id
  const [de, setDe] = React.useState(() => dia(new Date(Date.now() - 29 * 86400000)))
  const [ate, setAte] = React.useState(() => dia(new Date()))

  const rel = useQuery({
    queryKey: ['relatorio-intercorrencias', unidadeId, de, ate],
    enabled: !!unidadeId && !!de && !!ate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('relatorio_intercorrencias', { p_unidade: unidadeId!, p_de: de, p_ate: ate })
      if (error) throw error
      return data as unknown as RelatorioIntercorrencias
    },
  })
  const r = rel.data

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina icone={Siren} titulo="Intercorrências"
        descricao="Registradas por médico, enfermeiro e técnico de enfermagem no atendimento e na internação. Vale a versão mais nova de cada registro." />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="ir-de">De</Label><Input id="ir-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="ir-ate">Até</Label><Input id="ir-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
      </div>
      {rel.isLoading ? <Spinner /> : rel.error ? (
        <p role="alert" className="text-apoio text-critico">{(rel.error as Error).message}</p>
      ) : !r || r.total === 0 ? (
        <Vazio icone={Siren} titulo="Nenhuma intercorrência no período" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Numero rotulo="Total" valor={r.total} />
            {GRAVIDADES.map((g) => <Numero key={g.valor} rotulo={g.rotulo} valor={r.por_gravidade[g.valor] ?? 0} />)}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <section className="flex flex-col gap-2">
              <TituloSecao>Por tipo</TituloSecao>
              {r.por_tipo.map((t) => (
                <div key={t.tipo} className="flex items-center justify-between gap-3 rounded-lg border border-fio bg-superficie px-3 py-2 text-apoio">
                  <span className="text-tinta">{t.tipo}</span>
                  <span className="text-tinta-apoio">{t.total}{t.graves ? <span className="text-critico"> · {t.graves} grave(s)</span> : null}</span>
                </div>
              ))}
            </section>
            <section className="flex flex-col gap-2">
              <TituloSecao>Por setor</TituloSecao>
              {r.por_setor.map((s) => (
                <div key={s.setor} className="flex items-center justify-between gap-3 rounded-lg border border-fio bg-superficie px-3 py-2 text-apoio">
                  <span className="text-tinta">{s.setor}</span><span className="text-tinta-apoio">{s.total}</span>
                </div>
              ))}
              <span className="text-rotulo text-tinta-sussurro">
                Quem registrou: {Object.entries(r.por_papel).map(([p, n]) => `${PAPEL_REGISTRO[p] ?? p} ${n}`).join(' · ')}
              </span>
            </section>
          </div>
          <section className="flex flex-col gap-2">
            <TituloSecao>Casos (até 300, do mais novo)</TituloSecao>
            {r.casos.map((c) => (
              <div key={c.id} className="flex flex-col gap-0.5 rounded-lg border border-fio bg-superficie px-3 py-2 text-apoio">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-tinta">{c.paciente}</span>
                  <span className="text-tinta-apoio">{c.tipo_rotulo}</span>
                  <Badge variant={c.gravidade === 'grave' ? 'destructive' : c.gravidade === 'moderada' ? 'warning' : 'outline'}>{c.gravidade}</Badge>
                  <span className="ml-auto text-tinta-sussurro">{fmtDataHora(c.ocorrida_em)}{c.setor ? ` · ${c.setor}` : ''}</span>
                </div>
                <span className="text-tinta">{c.descricao}</span>
                <span className="text-tinta-apoio">Conduta: {c.conduta}</span>
                <span className="text-rotulo text-tinta-sussurro">{c.registrado_por ?? '—'} ({PAPEL_REGISTRO[c.papel] ?? c.papel})</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-cartao border border-fio bg-superficie px-4 py-3">
      <span className="text-apoio text-tinta-sussurro">{rotulo}</span>
      <span className="text-titulo font-semibold text-tinta">{valor}</span>
    </div>
  )
}

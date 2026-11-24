import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileWarning, Save } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { duracaoContingencia, textoForaDoAcesso, type AtendimentosContingencia, type Contingencia as Linha } from '@/lib/contingencia'
import { supabase } from '@/lib/supabase'

// Contingência em papel (Fase 1, tarefa 12 do BACKLOG). Quando o sistema volta,
// o coordenador do plantão (médico ou enfermeiro na escala) ou o gestor
// registra o período em que a unidade trabalhou no papel; cada atendimento
// daquele período recebe, na tela do atendimento, a marca de reentrada.
// Plano e formulários: produto/docs/contingencia/ (migration 20261030000006).

export default function Contingencia() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()
  const [inicio, setInicio] = React.useState('')
  const [fim, setFim] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [aberta, setAberta] = React.useState<string | null>(null)

  const lista = useQuery({
    queryKey: ['contingencias', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contingencias_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as Linha[]
    },
  })

  const registrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_contingencia', {
        p_unidade: unidadeId!, p_inicio: new Date(inicio).toISOString(), p_fim: new Date(fim).toISOString(), p_motivo: motivo.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setInicio(''); setFim(''); setMotivo('')
      void queryClient.invalidateQueries({ queryKey: ['contingencias', unidadeId] })
    },
  })

  const pronto = !!inicio && !!fim && motivo.trim().length >= 10

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina
        icone={FileWarning}
        titulo="Contingência"
        descricao="Quando o sistema volta, registre o período em que a unidade trabalhou no papel. Depois, em cada atendimento daquele período, anexe as folhas e marque a reentrada."
      />

      <section className="flex flex-col gap-3 rounded-container border border-fio bg-superficie px-4 py-4">
        <TituloSecao>Registrar contingência encerrada</TituloSecao>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cont-inicio">Início (hora em que passou para o papel)</Label>
            <Input id="cont-inicio" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cont-fim">Fim (sistema de volta)</Label>
            <Input id="cont-fim" type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cont-motivo">Motivo</Label>
          <Textarea id="cont-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: queda de internet da operadora; luz da unidade" />
          <span className="text-rotulo text-tinta-sussurro">Mínimo de 10 letras. Quem registra é o coordenador do plantão (médico ou enfermeiro na escala) ou o gestor; fica na auditoria e não se altera.</span>
        </div>
        {registrar.error && <p role="alert" className="text-apoio text-critico">{(registrar.error as Error).message}</p>}
        <div><Button disabled={!pronto || registrar.isPending} onClick={() => registrar.mutate()}><Save /> Registrar</Button></div>
      </section>

      <section className="flex flex-col gap-2">
        <TituloSecao>Contingências da unidade</TituloSecao>
        {lista.isLoading ? <Spinner /> : lista.error ? (
          <p role="alert" className="text-apoio text-critico">{(lista.error as Error).message}</p>
        ) : (lista.data ?? []).length === 0 ? (
          <Vazio icone={FileWarning} titulo="Nenhuma contingência registrada" />
        ) : (lista.data ?? []).map((c) => (
          <div key={c.id} className="flex flex-col gap-2 rounded-controle border border-fio bg-superficie px-4 py-2.5 text-apoio">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium text-tinta">{fmtDataHora(c.inicio)} a {fmtDataHora(c.fim)}</span>
              <span className="text-tinta-apoio">{duracaoContingencia(c.inicio, c.fim)}</span>
              <span className="text-tinta-apoio">"{c.motivo}"</span>
              <span className={c.reentradas < c.atendimentos_no_periodo ? 'text-atencao' : 'text-conforme'}>
                {c.reentradas} de {c.atendimentos_no_periodo} atendimentos com reentrada
              </span>
              <span className="text-rotulo text-tinta-sussurro">registrado por {c.registrado_por ?? '—'}</span>
              {c.atendimentos_no_periodo > 0 && (
                <Button size="xs" variant="outline" className="ml-auto" aria-expanded={aberta === c.id}
                  onClick={() => setAberta(aberta === c.id ? null : c.id)}>
                  {aberta === c.id ? 'Esconder atendimentos' : 'Ver atendimentos'}
                </Button>
              )}
            </div>
            {aberta === c.id && <AtendimentosDaContingencia contingenciaId={c.id} />}
          </div>
        ))}
      </section>
    </div>
  )
}

// Ajustes da revisão, item 3 (RT, 24/11/2026; migration 20270421000072): os
// atendimentos do período, com a reentrada feita ou pendente. O paciente fora
// do acesso de quem olha entra só na contagem.
function AtendimentosDaContingencia({ contingenciaId }: { contingenciaId: string }) {
  const q = useQuery({
    queryKey: ['contingencia-atendimentos', contingenciaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contingencia_atendimentos', { p_contingencia: contingenciaId })
      if (error) throw error
      return data as unknown as AtendimentosContingencia
    },
  })
  if (q.isLoading) return <Spinner />
  if (q.error) return <p role="alert" className="text-apoio text-critico">{(q.error as Error).message}</p>
  const d = q.data
  if (!d) return null
  const fora = textoForaDoAcesso(d.fora_do_seu_acesso, d.pendentes_fora)
  return (
    <div className="flex flex-col gap-1.5 border-t border-fio pt-2">
      {d.atendimentos.length > 0 && (
        <ul className="flex flex-col divide-y divide-fio" aria-label="Atendimentos do período">
          {d.atendimentos.map((a) => (
            <li key={a.episodio_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
              <Link to={`/prontuarios/${a.paciente_id}`} className="font-medium text-acao hover:text-acao-pressionada">
                {a.paciente_nome ?? 'Paciente sem nome'}
              </Link>
              <span className="text-tinta-apoio">chegou {fmtDataHora(a.chegada_em)}</span>
              {a.reentrada_em ? (
                <span className="text-conforme">reentrada feita em {fmtDataHora(a.reentrada_em)}{a.reentrada_por ? ` por ${a.reentrada_por}` : ''}</span>
              ) : (
                <span className="text-atencao">reentrada pendente</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {d.atendimentos.length === 0 && !fora && <span className="text-tinta-sussurro">Nenhum atendimento no período.</span>}
      {fora && <span className="text-rotulo text-tinta-sussurro">{fora}. A reentrada deles é de quem cuida do paciente ou do gestor.</span>}
      <span className="text-rotulo text-tinta-sussurro">A reentrada se marca na tela do atendimento, depois de anexar as folhas.</span>
    </div>
  )
}

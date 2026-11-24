import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileWarning, Plus, Save, X } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { dataHoraInput } from '@/lib/formato'
import {
  duracaoContingencia, faltaParaRegistrar, instanteDoCampo, MOTIVO_MINIMO, ultimaContingencia, type Contingencia as Linha,
} from '@/lib/contingencia'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Contingência em papel (Fase 1, tarefa 12 do BACKLOG). Quando o sistema volta,
// o coordenador do plantão (médico ou enfermeiro na escala) ou o gestor
// registra o período em que a unidade trabalhou no papel; cada atendimento
// daquele período recebe, na tela do atendimento, a marca de reentrada.
// Plano e formulários: produto/docs/contingencia/ (migration 20261030000006).
// Revisão de tela (RT 24/11/2026): estado no topo e formulário só quando
// pedido (M1); reentrada como barra "X de Y" (M2, versão mínima: a RPC só traz
// as contagens, não a lista dos atendimentos do período).

function BarraReentrada({ feitas, total }: { feitas: number; total: number }) {
  if (total === 0) return <span className="text-apoio text-tinta-sussurro">Nenhum atendimento no período</span>
  const pct = Math.min(100, Math.round((feitas / total) * 100))
  const completa = feitas >= total
  return (
    <span className="flex min-w-48 flex-1 items-center gap-2.5">
      <span className="h-1.5 flex-1 overflow-hidden rounded-capsula bg-trilha" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={feitas}
        aria-label="Atendimentos com reentrada">
        <span className={cn('block h-full rounded-capsula', completa ? 'bg-conforme' : 'bg-atencao')} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn('text-apoio tabular whitespace-nowrap', completa ? 'text-conforme' : 'text-atencao')}>
        {feitas} de {total} com reentrada
      </span>
    </span>
  )
}

export default function Contingencia() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()
  const [aberto, setAberto] = React.useState(false)
  const [inicio, setInicio] = React.useState('')
  const [fim, setFim] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [registrado, setRegistrado] = React.useState(false)

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
      const ini = instanteDoCampo(inicio)
      const fi = instanteDoCampo(fim)
      if (!ini || !fi) throw new Error('Preencha o início e o fim.')
      const { error } = await supabase.rpc('registrar_contingencia', {
        p_unidade: unidadeId!, p_inicio: ini.toISOString(), p_fim: fi.toISOString(), p_motivo: motivo.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setInicio(''); setFim(''); setMotivo(''); setAberto(false); setRegistrado(true)
      void queryClient.invalidateQueries({ queryKey: ['contingencias', unidadeId] })
    },
  })

  function abrirFormulario() {
    // fim = agora por padrão: quase sempre se registra logo que o sistema volta
    setFim(dataHoraInput())
    setRegistrado(false)
    registrar.reset()
    setAberto(true)
  }

  const falta = faltaParaRegistrar({ inicio, fim, motivo })
  const ini = instanteDoCampo(inicio)
  const fi = instanteDoCampo(fim)
  const duracao = ini && fi && fi.getTime() > ini.getTime() ? duracaoContingencia(ini.toISOString(), fi.toISOString()) : null
  const letras = motivo.trim().length
  const ultima = ultimaContingencia(lista.data ?? [])

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina
        icone={FileWarning}
        titulo="Contingência"
        descricao="Quando o sistema volta, registre o período em que a unidade trabalhou no papel. Depois, em cada atendimento daquele período, anexe as folhas e marque a reentrada."
      />

      <section aria-label="Estado do sistema" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-container border border-fio bg-superficie px-4 py-3">
        <span className="inline-flex items-center gap-2 text-apoio font-medium text-tinta">
          <span className="size-2 rounded-capsula bg-conforme" aria-hidden />
          Sistema no ar
        </span>
        <span className="text-apoio text-tinta-sussurro">
          {lista.isLoading ? 'Lendo as contingências…'
            : ultima ? `última contingência terminou em ${fmtDataHora(ultima.fim)} (${duracaoContingencia(ultima.inicio, ultima.fim)})`
              : 'nenhuma contingência registrada nesta unidade'}
        </span>
        {!aberto && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={abrirFormulario}>
            <Plus /> Registrar contingência
          </Button>
        )}
      </section>

      {registrado && <p role="status" className="-mt-3 text-apoio text-conforme">Contingência registrada. Agora marque a reentrada em cada atendimento do período.</p>}

      {aberto && (
        <section className="flex flex-col gap-3 rounded-container border border-fio bg-superficie px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <TituloSecao className="mb-0">Registrar contingência encerrada</TituloSecao>
            <Button variant="ghost" size="sm" onClick={() => setAberto(false)}><X /> Fechar</Button>
          </div>
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
          <p className="text-apoio text-tinta-apoio tabular" aria-live="polite">
            {duracao ? `Duração: ${duracao}` : 'A duração aparece quando o início e o fim estiverem preenchidos.'}
          </p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="cont-motivo">Motivo</Label>
              <span className={cn('text-rotulo tabular', letras >= MOTIVO_MINIMO ? 'text-conforme' : 'text-tinta-sussurro')}>
                {letras} {letras === 1 ? 'letra' : 'letras'} · mínimo {MOTIVO_MINIMO}
              </span>
            </div>
            <Textarea id="cont-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: queda de internet da operadora; luz da unidade" />
            <span className="text-rotulo text-tinta-sussurro">Quem registra é o coordenador do plantão (médico ou enfermeiro na escala) ou o gestor; fica na auditoria e não se altera.</span>
          </div>
          {registrar.error && <p role="alert" className="text-apoio text-critico">{(registrar.error as Error).message}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={falta.length > 0 || registrar.isPending} onClick={() => registrar.mutate()} aria-describedby="cont-falta">
              {registrar.isPending ? <Spinner /> : <Save />} Registrar
            </Button>
            <span id="cont-falta" className="text-apoio text-tinta-sussurro">
              {falta.length ? `Falta ${falta.join(', ')}.` : 'Pronto para registrar.'}
            </span>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <TituloSecao>Contingências da unidade</TituloSecao>
        {lista.isLoading ? <Spinner /> : lista.error ? (
          <p role="alert" className="text-apoio text-critico">{(lista.error as Error).message}</p>
        ) : (lista.data ?? []).length === 0 ? (
          <Vazio icone={FileWarning} titulo="Nenhuma contingência registrada"
            texto="Se o sistema cair, a unidade segue no papel. Quando ele voltar, registre aqui o período; os atendimentos daquele intervalo passam a pedir a reentrada das folhas." />
        ) : (lista.data ?? []).map((c) => (
          <div key={c.id} className="flex flex-col gap-1.5 rounded-controle border border-fio bg-superficie px-4 py-2.5 text-apoio">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-medium text-tinta">{fmtDataHora(c.inicio)} a {fmtDataHora(c.fim)}</span>
              <span className="text-tinta-apoio">{duracaoContingencia(c.inicio, c.fim)}</span>
              <span className="ml-auto text-rotulo text-tinta-sussurro">registrado por {c.registrado_por ?? '—'}</span>
            </div>
            <span className="text-tinta-apoio">{c.motivo}</span>
            <BarraReentrada feitas={c.reentradas} total={c.atendimentos_no_periodo} />
          </div>
        ))}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Isolamento do pedido de regulação (modelo do RT, 25/11/2026).
// • RG2: tipo (cinco), situação (suspeito ou confirmado) e agente ou motivo.
//   O formulário da nova solicitação e a edição do regulador usam o mesmo
//   campo; quem grava a situação e o agente é regulacao_definir_isolamento
//   (migration 20270425000020).
// • RG5: a faixa do dossiê mostra o tipo, a situação, o agente e as precauções
//   (quarto, paramentação, transporte) com a fonte de cada item
//   (src/clinico/isolamento/precaucoes.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { AvisoPlantao } from '@/components/regulacao/AvisoPlantao'
import { usePlantaoOrigem } from '@/components/regulacao/usePlantaoOrigem'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { FONTES_PRECAUCAO, fontesDaPrecaucao, precaucaoDoTipo, type ItemPrecaucao } from '@/clinico/isolamento/precaucoes'
import { AGENTE_ISOLAMENTO_MAX, ISOLAMENTOS, SITUACOES_ISOLAMENTO, type SituacaoIsolamento } from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'

export type ValorIsolamento = { tipo: string; situacao: SituacaoIsolamento | ''; agente: string }

/** Tipo, situação e agente. Tipo vazio = sem isolamento (situação e agente somem). */
export function CampoIsolamento({ id, valor, onChange, semVazio = false }: {
  id: string; valor: ValorIsolamento; onChange: (v: ValorIsolamento) => void
  /** no formulário a marca "precisa de isolamento" já decide; aqui só o tipo */
  semVazio?: boolean
}) {
  const set = <K extends keyof ValorIsolamento>(k: K, v: ValorIsolamento[K]) => onChange({ ...valor, [k]: v })
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-tipo`} className="text-rotulo">Tipo de isolamento</Label>
        <CampoSelecao id={`${id}-tipo`} tamanho="compacto" value={valor.tipo}
          onChange={(e) => onChange(e.target.value ? { ...valor, tipo: e.target.value } : { tipo: '', situacao: '', agente: '' })}>
          <option value="">{semVazio ? 'Tipo…' : 'Sem isolamento (precaução padrão)'}</option>
          {Object.entries(ISOLAMENTOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </CampoSelecao>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-sit`} className="text-rotulo">Situação</Label>
        <CampoSelecao id={`${id}-sit`} tamanho="compacto" value={valor.situacao} disabled={!valor.tipo}
          onChange={(e) => set('situacao', e.target.value as SituacaoIsolamento | '')}>
          <option value="">Não informada</option>
          {(Object.keys(SITUACOES_ISOLAMENTO) as SituacaoIsolamento[]).map((k) => <option key={k} value={k}>{SITUACOES_ISOLAMENTO[k]}</option>)}
        </CampoSelecao>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-ag`} className="text-rotulo">Agente ou motivo</Label>
        <Input id={`${id}-ag`} className="h-8" maxLength={AGENTE_ISOLAMENTO_MAX} disabled={!valor.tipo} value={valor.agente}
          onChange={(e) => set('agente', e.target.value)} />
      </div>
    </div>
  )
}

/** Edição no dossiê (regulador) ou no pedido (origem): grava pela RPC e chama aoFim. */
export function EditarIsolamento({ solicitacaoId, inicial, aoFim, aoCancelar }: {
  solicitacaoId: string; inicial: ValorIsolamento; aoFim: () => void; aoCancelar: () => void
}) {
  const [v, setV] = React.useState(inicial)
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_definir_isolamento', {
        p_id: solicitacaoId, p_tipo: v.tipo || null, p_situacao: v.tipo ? v.situacao || null : null, p_agente: v.tipo ? v.agente.trim() || null : null,
      })
      if (error) throw error
    },
    onSuccess: aoFim,
  })
  // B-07 (RT, 25/11/2026): fora do plantão a origem não muda o isolamento do pedido (o regulador da central não passa por isso)
  const plantao = usePlantaoOrigem(salvar.error)
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio bg-superficie p-3">
      <span className="font-medium text-tinta">Isolamento do pedido</span>
      <CampoIsolamento id={`iso-${solicitacaoId}`} valor={v} onChange={setV} />
      <span className="text-rotulo text-tinta-sussurro">Fica na linha do tempo do pedido e muda as vagas compatíveis.</span>
      <AvisoPlantao texto={plantao.recusa} />
      <MensagemErro texto={salvar.error && !plantao.recusa ? (salvar.error as Error).message : null} />
      <div className="flex flex-wrap gap-2">
        <Button size="xs" onClick={() => salvar.mutate()} disabled={salvar.isPending || !!plantao.motivo} title={plantao.motivo ?? undefined}>Salvar isolamento</Button>
        <Button size="xs" variant="outline" onClick={aoCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}

function ItensPrecaucao({ titulo, itens }: { titulo: string; itens: ItemPrecaucao[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-rotulo font-medium text-tinta">{titulo}</dt>
      {itens.map((i, k) => (
        <dd key={k} className="text-apoio text-tinta">
          {i.texto} <span className="text-rotulo text-tinta-sussurro">({FONTES_PRECAUCAO[i.fonte].titulo.split(' — ')[0]}, {i.secao})</span>
        </dd>
      ))}
    </div>
  )
}

/** Faixa do dossiê: tipo, situação, agente e as precauções da fonte. */
export function FaixaIsolamento({ tipo, situacao, agente, acao }: {
  tipo: string; situacao?: string | null; agente?: string | null; acao?: React.ReactNode
}) {
  const p = precaucaoDoTipo(tipo)
  return (
    <section aria-label="Isolamento" className="flex flex-col gap-2 rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="size-4 text-atencao" aria-hidden />
        <span className="font-medium text-tinta">Isolamento: {ISOLAMENTOS[tipo] ?? tipo}</span>
        <span className="text-tinta-apoio">· {situacao ? SITUACOES_ISOLAMENTO[situacao as SituacaoIsolamento] ?? situacao : 'situação não informada'}</span>
        {agente && <span className="text-tinta">· {agente}</span>}
        {acao && <span className="ml-auto">{acao}</span>}
      </div>
      {p && (
        <details className="group">
          <summary className="cursor-pointer text-rotulo text-acao">Precauções: quarto, paramentação e transporte</summary>
          <dl className="mt-2 flex flex-col gap-2">
            <ItensPrecaucao titulo="Quarto / leito" itens={p.quarto} />
            <ItensPrecaucao titulo="Paramentação" itens={p.paramentacao} />
            <ItensPrecaucao titulo="Transporte" itens={p.transporte} />
          </dl>
          <p className="mt-2 text-rotulo text-tinta-sussurro">
            Fonte:{' '}
            {fontesDaPrecaucao(p).map((f, i) => (
              <React.Fragment key={f.id}>
                {i > 0 && '; '}
                <a href={f.link} target="_blank" rel="noreferrer" className="underline">{f.titulo}{f.ano ? ` (${f.ano})` : ''}</a>
              </React.Fragment>
            ))}.
          </p>
        </details>
      )}
    </section>
  )
}

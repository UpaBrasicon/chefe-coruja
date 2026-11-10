// ─────────────────────────────────────────────────────────────────────────────
// Validade da prescrição (lacuna 6; decisão do RT em 10/11/2026, A em V1 a V9;
// migration 20270327000001).
//
// Cada item vale 24 h desde a prescrição ou a última renovação (Resolução
// COFEN 689/2022, art. 4º). O servidor grava a validade, recusa a checagem e a
// dispensação do vencido e avisa o médico de plantão. Aqui: o selo do item,
// o aviso do leito e a tela "Renovar prescrição", onde o médico marca cada
// item (manter, alterar ou suspender) e confirma tudo de uma vez. Não há
// "renovar tudo" sem olhar.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, RefreshCw } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import {
  decisoesParaServidor, diaHora, faltaNaRenovacao, FONTE_VALIDADE, paraRenovar, resumoValidade, seloValidade, textoResumoValidade,
  validadeDoItem, type AcaoRenovacao, type ComValidade, type DecisaoRenovacao,
} from '@/lib/validadePrescricao'
import { useAgora } from '@/hooks/useAgora'
import type { Json } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Chip } from '@/components/monitor/Pagina'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const VIAS = ['VO', 'EV', 'IM', 'SC', 'SL', 'INAL', 'TÓPICA', 'RETAL', 'SNE', 'OCULAR']

/** Selo do item: "Vencido, peça renovação" ou "Vence em 1h20". Em dia, nada. */
export function SeloValidadeItem({ item, agora }: { item: ComValidade; agora?: number }) {
  const relogio = useAgora()
  const s = seloValidade(item, agora ?? relogio)
  if (!s) return null
  return (
    <Badge variant={s.tom === 'critico' ? 'destructive' : 'warning'} title={s.titulo}>
      <CalendarClock aria-hidden /> {s.texto}
    </Badge>
  )
}

/** Pedido de renovação da enfermagem, para o médico ver na linha do item. */
export function PedidoDeRenovacao({ em }: { em: string | null | undefined }) {
  if (!em) return null
  return <p className="text-rotulo text-atencao">A enfermagem pediu a renovação às {diaHora(em)}.</p>
}

type ItemVigenteValidade = ComValidade & { tipo: string }

/**
 * Aviso do leito (V6): itens vencidos ou vencendo do paciente, da prescrição do
 * leito e dos vindos da porta. Mesmas leituras (e o mesmo cache) da aba Prescrição.
 */
export function AvisoValidadePrescricao({ pacienteId }: { pacienteId: string }) {
  const agora = useAgora()
  const vigente = useQuery({
    queryKey: ['prescricao-vigente', pacienteId],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemVigenteValidade[]
    },
  })
  const porta = useQuery({
    queryKey: ['prescricao-porta-ativa', pacienteId],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_porta_ativa', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemVigenteValidade[]
    },
  })
  const t = textoResumoValidade(resumoValidade([...(vigente.data ?? []), ...(porta.data ?? [])], agora), agora)
  if (!t) return null
  return (
    <p role="status" title={t.titulo}
      className={cn('flex items-start gap-2 rounded-controle border px-3 py-2 text-apoio',
        t.tom === 'critico' ? 'border-critico/30 bg-alerta-critico text-critico' : 'border-atencao/40 bg-alerta-atencao text-atencao')}>
      <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <strong>{t.texto}.</strong>{' '}
        {t.tom === 'critico' ? 'A enfermagem não administra o item vencido. O médico renova na aba Prescrição.' : 'O médico renova na aba Prescrição.'}
      </span>
    </p>
  )
}

export type ItemParaRenovar = ComValidade & {
  id: string; tipo: string; descricao: string; dose: string | null; via: string | null; posologia: string | null; se_necessario: boolean
  /** Item que veio da porta (prescricao_porta_ativa): a versão nova vai para a prescrição do leito. */
  daPorta?: boolean
}

const novaDecisao = (i: ItemParaRenovar): DecisaoRenovacao => ({
  acao: null, motivo: '', mudancas: { dose: i.dose ?? '', via: i.via ?? '', posologia: i.posologia ?? '', se_necessario: i.se_necessario },
})

const mudou = (i: ItemParaRenovar, d: DecisaoRenovacao) =>
  d.mudancas.dose.trim() !== (i.dose ?? '') || d.mudancas.via !== (i.via ?? '') || d.mudancas.posologia.trim() !== (i.posologia ?? '')
  || d.mudancas.se_necessario !== i.se_necessario

const ACOES: { v: AcaoRenovacao; rotulo: string }[] = [
  { v: 'manter', rotulo: 'Manter' }, { v: 'alterar', rotulo: 'Alterar' }, { v: 'suspender', rotulo: 'Suspender' },
]

/**
 * "Renovar prescrição" (V4): os itens vencendo (2 h) ou vencidos, cada um com
 * a marca do médico. Manter cria a versão nova igual (autor: quem renova; o
 * aprazamento e a validação da farmácia continuam); alterar e suspender pedem
 * o motivo. O servidor confere tudo e grava numa transação só.
 */
export function RenovarPrescricao({ pacienteId, itens, aoMudar }: { pacienteId: string; itens: ItemParaRenovar[]; aoMudar: () => void }) {
  const agora = useAgora()
  const lista = paraRenovar(itens, agora)
  const [aberto, setAberto] = React.useState(false)
  const [decisoes, setDecisoes] = React.useState<Record<string, DecisaoRenovacao>>({})
  const [erro, setErro] = React.useState<string | null>(null)
  const [gravando, setGravando] = React.useState(false)
  if (!lista.length) return null

  const vencidos = lista.filter((i) => validadeDoItem(i, agora) === 'vencido').length
  const dec = (i: ItemParaRenovar) => decisoes[i.id] ?? novaDecisao(i)
  const marcar = (i: ItemParaRenovar, d: Partial<DecisaoRenovacao>) => setDecisoes((x) => ({ ...x, [i.id]: { ...dec(i), ...d } }))
  const falta = faltaNaRenovacao(lista.map((i) => ({ descricao: i.descricao, tipo: i.tipo, d: dec(i), mudou: mudou(i, dec(i)) })))

  async function confirmar() {
    setGravando(true)
    const { error } = await supabase.rpc('renovar_prescricao', {
      p_paciente: pacienteId, p_decisoes: decisoesParaServidor(lista.map((i) => ({ id: i.id, d: dec(i) }))) as unknown as Json,
    })
    setGravando(false)
    if (error) return setErro(error.message)
    setErro(null); setDecisoes({}); setAberto(false); aoMudar()
  }

  return (
    <Card className={vencidos ? 'border-critico/40' : 'border-atencao/40'}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-corpo"><RefreshCw className="size-4" aria-hidden /> Renovar prescrição</CardTitle>
        <CardDescription>
          {vencidos ? `${vencidos} ${vencidos === 1 ? 'item vencido' : 'itens vencidos'}` : 'Nenhum item vencido'}
          {lista.length > vencidos ? `, ${lista.length - vencidos} vencendo em até 2 horas` : ''}. Cada item vale 24 horas; vencido, a
          enfermagem não administra. {FONTE_VALIDADE}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {!aberto ? (
          <div>
            <Button size="sm" onClick={() => setAberto(true)}><RefreshCw /> Revisar e renovar</Button>
          </div>
        ) : (
          <>
            <p className="text-rotulo text-tinta-apoio">Marque cada item. Manter repete o item como está, com você como autor; o aprazamento continua.</p>
            {lista.map((i) => {
              const d = dec(i)
              return (
                <div key={i.id} className="flex flex-col gap-2 rounded-controle border border-fio px-3 py-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-tinta">{i.descricao}</span>
                    {i.tipo === 'medicamento' && <span>{i.dose} · {i.via} · {i.posologia}{i.se_necessario ? ' · se necessário' : ''}</span>}
                    {i.daPorta && <span className="text-rotulo text-tinta-sussurro">da porta</span>}
                    <SeloValidadeItem item={i} agora={agora} />
                    {i.valida_ate && <span className="ml-auto text-rotulo text-tinta-sussurro">válido até {diaHora(i.valida_ate)}</span>}
                  </div>
                  <div role="radiogroup" aria-label={`O que fazer com ${i.descricao}`} className="flex flex-wrap gap-2">
                    {ACOES.filter((a) => a.v !== 'alterar' || i.tipo === 'medicamento').map((a) => (
                      <Chip key={a.v} radio variante="opcao" ativo={d.acao === a.v} tom={a.v === 'suspender' ? 'critico' : 'acao'}
                        onClick={() => marcar(i, { acao: a.v })}>{a.rotulo}</Chip>
                    ))}
                  </div>
                  {d.acao === 'alterar' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input className="h-8 w-40" aria-label="Dose" placeholder="Dose" value={d.mudancas.dose}
                        onChange={(e) => marcar(i, { mudancas: { ...d.mudancas, dose: e.target.value } })} />
                      <CampoSelecao tamanho="compacto" aria-label="Via" className="text-rotulo" value={d.mudancas.via}
                        onChange={(e) => marcar(i, { mudancas: { ...d.mudancas, via: e.target.value } })}>
                        {[...new Set([d.mudancas.via, ...VIAS])].filter(Boolean).map((v) => <option key={v}>{v}</option>)}
                      </CampoSelecao>
                      <Input className="h-8 w-36" aria-label="Frequência" placeholder="Frequência" value={d.mudancas.posologia}
                        onChange={(e) => marcar(i, { mudancas: { ...d.mudancas, posologia: e.target.value } })} />
                      <label className="flex items-center gap-1.5 text-rotulo">
                        <input type="checkbox" checked={d.mudancas.se_necessario}
                          onChange={(e) => marcar(i, { mudancas: { ...d.mudancas, se_necessario: e.target.checked } })} /> se necessário
                      </label>
                    </div>
                  )}
                  {(d.acao === 'alterar' || d.acao === 'suspender') && (
                    <Input className="h-8" value={d.motivo} onChange={(e) => marcar(i, { motivo: e.target.value })}
                      placeholder={d.acao === 'alterar' ? 'Motivo da alteração (obrigatório)' : 'Por que suspende (obrigatório)'} />
                  )}
                </div>
              )
            })}
            {falta.length > 0 && (
              <ul className="list-disc pl-5 text-rotulo text-tinta-apoio" aria-label="Falta para confirmar">
                {falta.map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}
            {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={falta.length > 0 || gravando} onClick={() => void confirmar()}>Confirmar renovação</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAberto(false); setErro(null) }}>Voltar</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

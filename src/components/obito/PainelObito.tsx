// O óbito registrado e o que falta depois dele (lacuna 5, O4 a O7): a
// comunicação à família (médico ou enfermeiro), à polícia na morte violenta, a
// conferência e a liberação do corpo (enfermagem ou recepção), o destino das
// vias da D.O. e a D.O. anulada. O que cada um pode fazer vem do servidor
// (obito_do_paciente → pode). Nome e parentesco do familiar só aparecem aqui.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Chip } from '@/components/monitor/Pagina'
import { dataHora, dataHoraInput } from '@/lib/formato'
import {
  AVISO_PRONTUARIO, destinoDoCorpo, doCampo, linhasCausas, ROTULO_DESTINO, ROTULO_ENCAMINHAMENTO, ROTULO_IDENTIFICACAO,
  ROTULO_PENDENCIA, ROTULO_TIPO_MORTE, type ObitoRegistro,
} from '@/lib/obito'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

/** As pendências do óbito como selos (a lista da enfermagem e o cartão do leito). */
export function SelosObito({ pendencias }: { pendencias: string[] }) {
  if (!pendencias.length) return <Badge variant="success">nada pendente</Badge>
  return (
    <span className="flex flex-wrap gap-1">
      {pendencias.map((p) => <Badge key={p} variant={p === 'comunicacao_familia' || p === 'liberacao' || p === 'policia' ? 'warning' : 'secondary'}>{ROTULO_PENDENCIA[p] ?? p}</Badge>)}
    </span>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <p className="text-apoio text-tinta"><span className="text-tinta-sussurro">{rotulo}: </span>{children}</p>
}

const quem = (x: { em: string; por: string | null } | null) => (x ? `${dataHora(x.em)}${x.por ? `, ${x.por}` : ''}` : null)

export function PainelObito({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient()
  const { data, error } = useQuery({
    queryKey: ['obito', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('obito_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return ((data as { obito: ObitoRegistro | null } | null)?.obito ?? null)
    },
  })
  const [aberto, setAberto] = React.useState<'familia' | 'policia' | 'identificacao' | 'liberacao' | 'anular' | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const agir = useMutation({
    mutationFn: async (fn: () => PromiseLike<{ error: unknown }>) => {
      const { error } = await fn()
      if (error) throw error
    },
    onSuccess: () => {
      setErro(null); setAberto(null)
      void qc.invalidateQueries({ queryKey: ['obito', pacienteId] })
      void qc.invalidateQueries({ queryKey: ['obitos-pendentes'] })
      void qc.invalidateQueries({ queryKey: ['situacao-leitos'] })
    },
    onError: (e) => setErro(msg(e)),
  })

  if (error) return <p className="text-apoio text-critico">{msg(error)}</p>
  if (!data) return null
  const o = data
  const pode = o.pode ?? { comunicar: false, policia: false, corpo: false, vias: false, anular_do: false }
  const ativo = !o.anulado_em

  return (
    <section aria-label="Óbito" className="flex flex-col gap-2.5 rounded-cartao border border-fio px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-controle font-semibold text-tinta">Óbito · {dataHora(o.hora_obito)}</span>
        <Badge variant="secondary">{ROTULO_TIPO_MORTE[o.tipo_morte]}</Badge>
        {o.anulado_em ? <Badge variant="outline">desfeito</Badge> : <SelosObito pendencias={o.pendencias} />}
      </div>
      {o.anulado_em && <p className="text-apoio text-tinta-apoio">Desfeito com o cancelamento da alta em {dataHora(o.anulado_em)}{o.motivo_anulacao ? `: ${o.motivo_anulacao}` : ''}.</p>}
      <div className="flex flex-col gap-0.5">
        <Linha rotulo="Caminho">{ROTULO_ENCAMINHAMENTO[o.encaminhamento]}</Linha>
        {o.numero_do && <Linha rotulo="Nº da D.O.">{o.numero_do}{o.atestado_por ? ` · atestada por ${o.atestado_por} (${o.atestado_condicao})` : ''}</Linha>}
        {linhasCausas(o.causas).map((c) => <Linha key={c.rotulo} rotulo={c.rotulo}>{c.texto}</Linha>)}
        {o.avisos.length > 0 && <p className="text-apoio text-atencao">{o.avisos.join(' ')}</p>}
        {o.tipo_morte === 'violenta_ou_suspeita' && (
          <Linha rotulo="Polícia">{o.policia ? `comunicada ${quem(o.policia)}${o.policia.ocorrencia ? ` · ocorrência ${o.policia.ocorrencia}` : ''}` : 'não comunicada'}</Linha>
        )}
        {(o.comunicacoes ?? []).map((c) => (
          <Linha key={c.id} rotulo="Família">
            {c.destinatario_nome} ({c.parentesco}), {c.meio === 'telefone' ? 'por telefone' : 'presencial'}, {dataHora(c.em)}, por {c.por ?? '?'}
            {c.testemunha ? ` · testemunha: ${c.testemunha}` : ''}
          </Linha>
        ))}
        {o.identificacao && <Linha rotulo="Identificação do corpo">{ROTULO_IDENTIFICACAO[o.identificacao.meio] ?? o.identificacao.meio}, {quem(o.identificacao)}</Linha>}
        {o.liberacao && <Linha rotulo="Corpo liberado">{ROTULO_DESTINO[o.liberacao.destino]}, {quem(o.liberacao)}</Linha>}
        {o.leito_aguardando && <Linha rotulo="Leito">{o.leito ?? ''} aguardando liberação do corpo</Linha>}
        {o.numero_do && (
          <Linha rotulo="Vias da D.O.">
            {[['branca', 'branca guardada para a SMS'], ['amarela', 'amarela entregue à família'], ['rosa', 'rosa no prontuário']]
              .map(([k, r]) => `${r}: ${quem(o.vias[k as 'branca']) ?? 'falta'}`).join(' · ')}
          </Linha>
        )}
        {(o.do_anuladas ?? []).map((a) => <Linha key={a.em} rotulo="D.O. anulada">{a.numero_anulado} → {a.numero_novo}: {a.motivo} ({dataHora(a.em)})</Linha>)}
      </div>

      {ativo && (
        <div className="flex flex-wrap gap-2">
          {pode.comunicar && <Button size="sm" variant="outline" onClick={() => setAberto('familia')}>Registrar comunicação à família</Button>}
          {pode.policia && !o.policia && <Button size="sm" variant="outline" onClick={() => setAberto('policia')}>Registrar comunicação à polícia</Button>}
          {pode.corpo && !o.identificacao && <Button size="sm" variant="outline" onClick={() => setAberto('identificacao')}>Conferir identificação do corpo</Button>}
          {pode.corpo && o.identificacao && !o.liberacao && <Button size="sm" variant="outline" onClick={() => setAberto('liberacao')}>Liberar o corpo</Button>}
          {pode.vias && (['branca', 'amarela', 'rosa'] as const).filter((k) => !o.vias[k]).map((k) => (
            <Button key={k} size="sm" variant="outline" disabled={agir.isPending}
              onClick={() => agir.mutate(() => supabase.rpc('registrar_via_do', { p_obito: o.id, p_via: k }))}>
              {k === 'branca' ? 'Registrar via branca guardada' : k === 'amarela' ? 'Registrar via amarela entregue' : 'Registrar via rosa no prontuário'}
            </Button>
          ))}
          {pode.anular_do && <Button size="sm" variant="outline" onClick={() => setAberto('anular')}>Registrar D.O. anulada ou rasurada</Button>}
        </div>
      )}
      {aberto === 'familia' && <FormFamilia obitoId={o.id} enviar={(d) => agir.mutate(() => supabase.rpc('comunicar_obito_familia', { p_obito: o.id, p_dados: d as Json }))} fechar={() => setAberto(null)} />}
      {aberto === 'policia' && <FormPolicia enviar={(d) => agir.mutate(() => supabase.rpc('comunicar_obito_policia', { p_obito: o.id, p_dados: d as Json }))} fechar={() => setAberto(null)} />}
      {aberto === 'identificacao' && <FormIdentificacao enviar={(d) => agir.mutate(() => supabase.rpc('conferir_identificacao_corpo', { p_obito: o.id, p_dados: d as Json }))} fechar={() => setAberto(null)} />}
      {aberto === 'liberacao' && (
        <FormLiberacao destino={destinoDoCorpo(o.encaminhamento)} temDo={!!o.numero_do && !o.vias.amarela}
          enviar={(d) => agir.mutate(() => supabase.rpc('liberar_corpo', { p_obito: o.id, p_dados: d as Json }))} fechar={() => setAberto(null)} />
      )}
      {aberto === 'anular' && <FormAnular enviar={(n, m) => agir.mutate(() => supabase.rpc('anular_do', { p_obito: o.id, p_numero_novo: n, p_motivo: m }))} fechar={() => setAberto(null)} />}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
      <p className="text-rotulo text-tinta-sussurro">{AVISO_PRONTUARIO}</p>
    </section>
  )
}

function Rodape({ ok, fechar, rotulo }: { ok: () => void; fechar: () => void; rotulo: string }) {
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={ok}>{rotulo}</Button>
      <Button size="sm" variant="ghost" onClick={fechar}>Cancelar</Button>
    </div>
  )
}

const quando = (v: string) => (v ? doCampo(v).toISOString() : undefined)

function FormFamilia({ obitoId, enviar, fechar }: { obitoId: string; enviar: (d: Record<string, unknown>) => void; fechar: () => void }) {
  const [nome, setNome] = React.useState('')
  const [parentesco, setParentesco] = React.useState('')
  const [meio, setMeio] = React.useState<'presencial' | 'telefone' | ''>('')
  const [em, setEm] = React.useState(() => dataHoraInput())
  const [testemunha, setTestemunha] = React.useState('')
  const id = `fam-${obitoId}`
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
      <p className="text-rotulo text-tinta-sussurro">O médico ou o enfermeiro registra, depois da constatação do óbito (Parecer COREN-SP 003/2016). Quem comunicou é o seu login.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1"><Label htmlFor={`${id}-n`}>A quem (nome)</Label><Input id={`${id}-n`} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor={`${id}-p`}>Parentesco ou relação</Label><Input id={`${id}-p`} maxLength={60} value={parentesco} onChange={(e) => setParentesco(e.target.value)} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor={`${id}-q`}>Quando</Label><Input id={`${id}-q`} type="datetime-local" value={em} onChange={(e) => setEm(e.target.value)} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor={`${id}-t`}>Testemunha (opcional)</Label><Input id={`${id}-t`} maxLength={120} value={testemunha} onChange={(e) => setTestemunha(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Como">
        <Chip radio variante="opcao" ativo={meio === 'presencial'} onClick={() => setMeio('presencial')}>Presencial</Chip>
        <Chip radio variante="opcao" ativo={meio === 'telefone'} onClick={() => setMeio('telefone')}>Por telefone</Chip>
      </div>
      <Rodape rotulo="Registrar comunicação" fechar={fechar}
        ok={() => enviar({ destinatario_nome: nome.trim(), parentesco: parentesco.trim(), meio, comunicado_em: quando(em), testemunha: testemunha.trim() || undefined })} />
    </div>
  )
}

function FormPolicia({ enviar, fechar }: { enviar: (d: Record<string, unknown>) => void; fechar: () => void }) {
  const [em, setEm] = React.useState(() => dataHoraInput())
  const [ocorrencia, setOcorrencia] = React.useState('')
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1"><Label htmlFor="pol-em">Quando</Label><Input id="pol-em" type="datetime-local" value={em} onChange={(e) => setEm(e.target.value)} /></div>
        <div className="flex flex-col gap-1"><Label htmlFor="pol-oc">Nº da ocorrência (opcional)</Label><Input id="pol-oc" maxLength={60} value={ocorrencia} onChange={(e) => setOcorrencia(e.target.value)} /></div>
      </div>
      <Rodape rotulo="Registrar comunicação" fechar={fechar} ok={() => enviar({ comunicada_em: quando(em), ocorrencia: ocorrencia.trim() || undefined })} />
    </div>
  )
}

function FormIdentificacao({ enviar, fechar }: { enviar: (d: Record<string, unknown>) => void; fechar: () => void }) {
  const [meio, setMeio] = React.useState('')
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
      <span className="text-controle text-tinta">Como a identificação foi conferida</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Como a identificação foi conferida">
        {Object.entries(ROTULO_IDENTIFICACAO).map(([k, r]) => <Chip key={k} radio variante="opcao" ativo={meio === k} onClick={() => setMeio(k)}>{r}</Chip>)}
      </div>
      <Rodape rotulo="Registrar conferência" fechar={fechar} ok={() => enviar({ meio })} />
    </div>
  )
}

function FormLiberacao({ destino, temDo, enviar, fechar }: {
  destino: 'funeraria' | 'svo' | 'iml'; temDo: boolean; enviar: (d: Record<string, unknown>) => void; fechar: () => void
}) {
  const [em, setEm] = React.useState(() => dataHoraInput())
  const [amarela, setAmarela] = React.useState(false)
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
      <p className="text-apoio text-tinta">Destino: <b>{ROTULO_DESTINO[destino]}</b> (segue o caminho do óbito). O leito vai para a higienização.</p>
      <div className="flex flex-col gap-1 sm:max-w-64"><Label htmlFor="lib-em">Quando</Label><Input id="lib-em" type="datetime-local" value={em} onChange={(e) => setEm(e.target.value)} /></div>
      {temDo && (
        <label className="flex items-center gap-2 text-controle text-tinta">
          <input type="checkbox" checked={amarela} onChange={(e) => setAmarela(e.target.checked)} /> A via amarela da D.O. foi entregue à família
        </label>
      )}
      <Rodape rotulo="Registrar liberação" fechar={fechar} ok={() => enviar({ destino, liberado_em: quando(em), via_amarela_entregue: amarela })} />
    </div>
  )
}

function FormAnular({ enviar, fechar }: { enviar: (numero: string, motivo: string) => void; fechar: () => void }) {
  const [numero, setNumero] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  return (
    <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
      <p className="text-rotulo text-tinta-sussurro">Sem ressalva possível, o formulário é anulado e devolvido à Secretaria de Saúde (manual MS 2022). O número anulado fica no registro.</p>
      <div className="flex flex-col gap-1 sm:max-w-64"><Label htmlFor="anu-n">Nº da nova D.O.</Label><Input id="anu-n" inputMode="numeric" maxLength={11} value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
      <div className="flex flex-col gap-1"><Label htmlFor="anu-m">Motivo</Label><Textarea id="anu-m" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
      <Rodape rotulo="Registrar D.O. anulada" fechar={fechar} ok={() => enviar(numero, motivo)} />
    </div>
  )
}

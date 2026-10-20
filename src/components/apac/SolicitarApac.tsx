// Solicitação de APAC pelo médico que atende (Fase 3, tarefa 5). Só
// procedimento que o SIGTAP registra como principal de APAC. As críticas
// são as da AIH (o que bloqueia é configurado pelo gestor) mais a de
// instrumento; o servidor confere de novo em solicitar_apac. Quem autoriza é
// o médico regulador, em /apac.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CARATER_APAC, STATUS_APAC, TIPO_APAC, numeroApac, type Apac, type CriticaApac, type TipoApac } from '@/lib/apac'
import { codigoSigtapNaTela } from '@/lib/bpa'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

const VAZIO = { procedimento: '', procNome: '', cid: '', cidSec: '', cidCausa: '', carater: '01', tipo: '3' as TipoApac,
  anterior: '', sinais: '', exames: '', justificativa: '' }

export function SolicitarApac({ pacienteId, episodioId, internacaoId }: { pacienteId: string; episodioId?: string | null; internacaoId?: string | null }) {
  const qc = useQueryClient()
  const [f, setF] = React.useState(VAZIO)
  const [termo, setTermo] = React.useState('')
  const [abrindo, setAbrindo] = React.useState(false)
  const set = (p: Partial<typeof VAZIO>) => setF((v) => ({ ...v, ...p }))

  const lista = useQuery({
    queryKey: ['apacs-do-paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('apacs_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as Apac[]
    },
  })
  const busca = useQuery({
    queryKey: ['buscar-sigtap-apac', termo.trim()],
    enabled: abrindo && termo.trim().length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_sigtap_apac', { p_termo: termo.trim() })
      if (error) throw error
      return (data ?? []) as unknown as { codigo: string; nome: string }[]
    },
  })
  const conferencia = useQuery({
    queryKey: ['conferir-apac', pacienteId, f.procedimento, f.cid.trim(), f.cidSec.trim(), f.cidCausa.trim()],
    enabled: abrindo && !!f.procedimento && f.cid.trim().length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('conferir_apac', {
        p_paciente: pacienteId, p_procedimento: f.procedimento, p_cid: f.cid.trim(),
        p_cid_sec: f.cidSec.trim() || undefined, p_cid_causa: f.cidCausa.trim() || undefined,
      })
      if (error) throw error
      return (data as unknown as { criticas: CriticaApac[] }).criticas
    },
  })
  const criticas = conferencia.data ?? []
  const bloqueantes = criticas.filter((c) => c.bloqueante)

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('solicitar_apac', {
        p_paciente: pacienteId,
        p_dados: {
          procedimento: f.procedimento, cid: f.cid.trim(), cid_secundario: f.cidSec.trim(), cid_causa: f.cidCausa.trim(),
          carater: f.carater, tipo: f.tipo, apac_anterior: numeroApac(f.anterior),
          episodio_id: episodioId ?? '', internacao_id: internacaoId ?? '',
          justificativa: { sinais: f.sinais.trim(), exames: f.exames.trim(), justificativa: f.justificativa.trim() },
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setF(VAZIO); setTermo(''); setAbrindo(false)
      void qc.invalidateQueries({ queryKey: ['apacs-do-paciente', pacienteId] })
    },
  })
  const pronto = !!f.procedimento && f.cid.trim().length >= 3 && f.justificativa.trim().length >= 10
    && (f.tipo !== '2' || numeroApac(f.anterior).length === 13) && bloqueantes.length === 0

  return (
    <section className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-4 py-3.5" aria-label="APAC">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-corpo font-semibold text-tinta">APAC</h3>
          <p className="text-rotulo text-tinta-sussurro">Procedimento ambulatorial de alta complexidade. Você solicita; o médico regulador autoriza com o número.</p>
        </div>
        {!abrindo && <Button size="sm" variant="outline" onClick={() => setAbrindo(true)}>Solicitar APAC</Button>}
      </div>

      {abrindo && (
        <div className="flex flex-col gap-3 rounded-controle border border-fio p-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`apac-proc-${pacienteId}`} className="text-rotulo">Procedimento (só os de APAC no SIGTAP)</Label>
            {f.procedimento ? (
              <div className="flex flex-wrap items-center gap-2 text-apoio">
                <span className="text-tinta">{codigoSigtapNaTela(f.procedimento)} · {f.procNome}</span>
                <Button size="xs" variant="ghost" onClick={() => set({ procedimento: '', procNome: '' })}>Trocar</Button>
              </div>
            ) : (
              <>
                <Input id={`apac-proc-${pacienteId}`} className="h-8" placeholder="Código ou nome (mínimo 3 letras)" value={termo} onChange={(e) => setTermo(e.target.value)} />
                {(busca.data ?? []).length > 0 && (
                  <div className="flex max-h-48 flex-col overflow-y-auto rounded-controle border border-fio">
                    {(busca.data ?? []).map((p) => (
                      <Button key={p.codigo} type="button" variant="ghost" size="sm" className="justify-start"
                        onClick={() => { set({ procedimento: p.codigo, procNome: p.nome }); setTermo('') }}>
                        {codigoSigtapNaTela(p.codigo)} · {p.nome}
                      </Button>
                    ))}
                  </div>
                )}
                {termo.trim().length >= 3 && busca.data && busca.data.length === 0 && (
                  <span className="text-rotulo text-tinta-sussurro">Nenhum procedimento de APAC com esse termo no SIGTAP carregado.</span>
                )}
              </>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {([['cid', 'CID-10 principal'], ['cidSec', 'CID-10 secundário'], ['cidCausa', 'CID de causa associada']] as const).map(([k, r]) => (
              <div key={k} className="flex flex-col gap-1">
                <Label htmlFor={`apac-${k}-${pacienteId}`} className="text-rotulo">{r}</Label>
                <Input id={`apac-${k}-${pacienteId}`} className="h-8" placeholder="ex.: C50.9" value={f[k]} onChange={(e) => set({ [k]: e.target.value.toUpperCase() })} />
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`apac-tipo-${pacienteId}`} className="text-rotulo">Tipo</Label>
              <CampoSelecao id={`apac-tipo-${pacienteId}`} value={f.tipo} onChange={(e) => set({ tipo: e.target.value as TipoApac })}>
                {(Object.keys(TIPO_APAC) as TipoApac[]).map((t) => <option key={t} value={t}>{TIPO_APAC[t]}</option>)}
              </CampoSelecao>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <Label htmlFor={`apac-carater-${pacienteId}`} className="text-rotulo">Caráter do atendimento</Label>
              <CampoSelecao id={`apac-carater-${pacienteId}`} value={f.carater} onChange={(e) => set({ carater: e.target.value })}>
                {Object.entries(CARATER_APAC).map(([k, r]) => <option key={k} value={k}>{k} · {r}</option>)}
              </CampoSelecao>
            </div>
            {f.tipo === '2' && (
              <div className="flex flex-col gap-1">
                <Label htmlFor={`apac-ant-${pacienteId}`} className="text-rotulo">Número da APAC anterior</Label>
                <Input id={`apac-ant-${pacienteId}`} className="h-8" inputMode="numeric" placeholder="13 dígitos" value={f.anterior} onChange={(e) => set({ anterior: e.target.value })} />
              </div>
            )}
          </div>
          {([['sinais', 'Principais sinais e sintomas'], ['exames', 'Exames e resultados que justificam (com data)'], ['justificativa', 'Justificativa do procedimento']] as const).map(([k, r]) => (
            <div key={k} className="flex flex-col gap-1">
              <Label htmlFor={`apac-${k}-${pacienteId}`} className="text-rotulo">{r}{k === 'justificativa' ? ' (obrigatória)' : ''}</Label>
              <Textarea id={`apac-${k}-${pacienteId}`} className="min-h-[56px]" value={f[k]} onChange={(e) => set({ [k]: e.target.value })} />
            </div>
          ))}
          {criticas.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-rotulo">
              {criticas.map((c, i) => <li key={i} className={c.bloqueante ? 'text-critico' : 'text-atencao'}>{c.bloqueante ? 'Impede: ' : 'Aviso: '}{c.texto}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!pronto || enviar.isPending} onClick={() => enviar.mutate()}>Solicitar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAbrindo(false); setF(VAZIO); enviar.reset() }}>Cancelar</Button>
          </div>
          {enviar.error && <p role="alert" className="text-rotulo text-critico">{(enviar.error as Error).message}</p>}
        </div>
      )}

      {lista.error ? <p role="alert" className="text-rotulo text-critico">{(lista.error as Error).message}</p> : (lista.data ?? []).length > 0 && (
        <ul className="flex flex-col gap-1">
          {(lista.data ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-controle border border-fio px-2.5 py-1.5 text-apoio">
              <Badge variant={a.status === 'autorizada' ? 'success' : a.status === 'solicitada' ? 'info' : 'secondary'}>{STATUS_APAC[a.status]}</Badge>
              <span className="text-tinta">{codigoSigtapNaTela(a.procedimento)} · {a.procedimento_nome ?? '—'}</span>
              <span className="text-rotulo text-tinta-sussurro">
                {TIPO_APAC[a.tipo]} · CID {a.cid_principal} · {fmtDataHora(a.solicitada_em)}
                {a.numero && <> · nº {a.numero} · validade {fmtData(a.validade_inicio!)} a {fmtData(a.validade_fim!)}</>}
                {a.motivo && <> · “{a.motivo}”</>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Aba "Desfecho" (protótipo, "Desfecho do atendimento" + "Dados da alta",
// manual 3.17). As regras aparecem ANTES de enviar, marcadas uma a uma; o
// servidor (registrar_desfecho e os gatilhos da fase 4) confere todas de
// novo — a tela só adianta. Prestador = usuário do login.
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, CircleAlert, DoorOpen } from 'lucide-react'
import * as React from 'react'

import { SeletorMotivoEvasao } from '@/components/porta/MotivoEvasao'
import type { MotivoEvasao } from '@/lib/evasao'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { CampoCid, type RegistroSoap } from './AbaAtendimento'
import {
  COM_DADOS_ALTA, DESFECHOS, EXIGE_CID, NOTA, RELATO, hora, msg, rotuloDesfecho, soapVazio,
  type Desfecho, type PainelPS, type Soap,
} from './comum'

type Proc = { codigo: string; nome: string; compativel: boolean; como_principal: boolean }

const localAgora = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}
const soDigitos = (s: string) => s.replace(/\D/g, '')
const CID_OK = /^[A-Z][0-9]{2}(\.?[0-9A-Z]{1,2})?$/

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick}
      className={cn('rounded-capsula border px-3.5 py-1.5 text-controle transition-colors', ativo ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
      {children}
    </button>
  )
}

function CampoProcedimento({ cid, valor, onChange }: { cid: string; valor: string; onChange: (v: string) => void }) {
  const [foco, setFoco] = React.useState(false)
  const [termo, setTermo] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(termo.trim()), 300)
    return () => window.clearTimeout(t)
  }, [termo])
  const cidOk = CID_OK.test(cid.trim()) ? cid.trim() : ''
  const lista = useQuery({
    queryKey: ['procedimentos-do-cid', cidOk, debounced],
    enabled: foco && (!!cidOk || debounced.length >= 3),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('procedimentos_do_cid', { p_cid: cidOk, p_termo: debounced || undefined, p_limite: 12 })
      if (error) throw error
      return (data ?? []) as Proc[]
    },
  })
  return (
    <div className="relative">
      <Input id="alta-proc" value={foco ? termo || valor : valor} placeholder="SIGTAP (código ou nome)" autoComplete="off"
        onFocus={() => { setFoco(true); setTermo('') }} onBlur={() => window.setTimeout(() => setFoco(false), 150)}
        onChange={(e) => { setTermo(e.target.value); onChange(e.target.value) }} />
      {foco && (lista.data ?? []).length > 0 && (
        <div role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
          {(lista.data ?? []).map((p) => (
            <button key={p.codigo} type="button" role="option" aria-selected={false}
              onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(p.codigo); setTermo(''); setFoco(false) }}
              className="flex w-full flex-col border-b border-trilha px-3 py-2 text-left text-apoio last:border-0 hover:bg-trilha">
              <span className="text-tinta"><strong className="tabular-nums">{p.codigo}</strong> · {p.nome}</span>
              {p.compativel && <span className="text-rotulo text-conforme">compatível com {cidOk}{p.como_principal ? ' (principal)' : ''}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AbaDesfecho({
  episodioId, pacienteId, nome, chegadaEm, painel, registros, soap, agora, onConfirmado,
}: {
  episodioId: string; pacienteId: string; nome: string; chegadaEm: string; painel: PainelPS; registros: RegistroSoap[]
  soap: Soap; agora: number; onConfirmado: (aviso: string) => void
}) {
  const { perfil } = useAuth()
  const { unidadeAtiva } = useUnidade()
  const [d, setD] = React.useState<Desfecho | null>(null)
  const [relato, setRelato] = React.useState('')
  const [motivoEvasao, setMotivoEvasao] = React.useState<MotivoEvasao | null>(null) // Fase 1, tarefa 6
  const [destino, setDestino] = React.useState('')
  const [horaObito, setHoraObito] = React.useState('')
  const [numeroDo, setNumeroDo] = React.useState('')
  const [setorObito, setSetorObito] = React.useState('')
  const [cidObito, setCidObito] = React.useState('')
  const [altaEm, setAltaEm] = React.useState('')   // vazio = agora
  const [retroJust, setRetroJust] = React.useState('')
  const [cidAlta, setCidAlta] = React.useState<string | null>(null) // null = o do atendimento
  const [proc, setProc] = React.useState('')
  const [obsAlta, setObsAlta] = React.useState('')
  const [setorInt, setSetorInt] = React.useState('')
  const [leitoInt, setLeitoInt] = React.useState('')

  const destinos = useQuery({
    queryKey: ['destinos-internacao', unidadeAtiva?.unidade_id],
    enabled: d === 'internacao' && !!unidadeAtiva,
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('id, nome, leitos(id, identificador, status, ativo)')
        .eq('unidade_id', unidadeAtiva!.unidade_id).eq('ativo', true).in('tipo', ['internacao', 'uti', 'isolamento']).order('ordem')
      if (error) throw error
      return data ?? []
    },
  })
  // livres + reservados para este paciente (ou por motivo livre) — item 12 da Fase 0
  const ocupaveis = useQuery({
    queryKey: ['leitos-para-ocupar', setorInt, pacienteId],
    enabled: d === 'internacao' && !!setorInt,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('leitos_para_ocupar', { p_setor: setorInt, p_paciente: pacienteId })
      if (error) throw error
      return data ?? []
    },
  })
  const leitosLivres = ocupaveis.data ?? []
  const [horasReserva, setHorasReserva] = React.useState(2)
  const [msgReserva, setMsgReserva] = React.useState<string | null>(null)
  async function reservarLeito() {
    setMsgReserva(null)
    const { error } = await supabase.rpc('reservar_leito', { p_leito: leitoInt, p_horas: horasReserva, p_paciente: pacienteId })
    if (error) { setMsgReserva(error.message); return }
    setMsgReserva(`Leito reservado para ${nome} por ${horasReserva} h.`)
    void ocupaveis.refetch()
  }

  // CID do atendimento: o do rascunho (vai ser registrado) ou o último SOAP
  const cidAtendimento = soap.cid.trim() || [...registros].reverse().find((r) => r.cid)?.cid || ''
  const cid = (cidAlta ?? cidAtendimento).trim().toUpperCase()
  const altaMs = altaEm ? Date.parse(altaEm) : agora
  const retroativa = !!altaEm && agora - altaMs > 30 * 60_000
  const pendRascunho = !soapVazio(soap)

  // ── regras visíveis (protótipo confirmarFim / altaErro) ─────────────────────
  const regras: { ok: boolean; texto: string }[] = []
  if (d) {
    if (d !== 'evasao') {
      regras.push({ ok: registros.length > 0 || pendRascunho, texto: 'Registro do atendimento (SOAP)' })
      regras.push({ ok: registros.some((r) => r.avaliacao?.trim()) || !!soap.a.trim(), texto: 'Hipótese diagnóstica (Avaliação) na aba Atendimento' })
    }
    if (d === 'alta' || d === 'alta_apos_medicacao') {
      const falta = painel.exames.filter((x) => x.situacao === 'pedido').map((x) => x.exame)
      regras.push({ ok: falta.length === 0, texto: falta.length ? `Exames com resultado — sem resultado: ${falta.join(', ')}` : 'Exames pedidos com resultado' })
    }
    if (d === 'alta_apos_medicacao') {
      const meds = painel.prescricao.filter((i) => i.tipo === 'medicamento' && !i.suspenso_em)
      const falta = meds.filter((i) => !i.se_necessario && i.checagem?.situacao !== 'feito').map((i) => i.descricao)
      regras.push({ ok: meds.length > 0, texto: 'Medicação prescrita no PS' })
      regras.push({ ok: meds.length > 0 && falta.length === 0, texto: falta.length ? `Medicação administrada — falta checar: ${falta.join(', ')}` : 'Medicação administrada (checada pela enfermagem)' })
    }
    if (EXIGE_CID.includes(d)) regras.push({ ok: CID_OK.test(cid), texto: 'Diagnóstico de alta (CID)' })
    if (d === 'evasao') regras.push({ ok: !!motivoEvasao, texto: 'Motivo da evasão' })
    if (RELATO[d]) regras.push({ ok: relato.trim().length >= 15, texto: `${RELATO[d]} (mínimo de 15 letras)` })
    if (d === 'transferencia') regras.push({ ok: destino.trim().length >= 3, texto: 'Serviço de destino' })
    if (d === 'obito') {
      regras.push({ ok: !!horaObito && Date.parse(horaObito) <= agora + 60_000, texto: 'Hora do óbito (não no futuro)' })
      regras.push({ ok: CID_OK.test(cidObito.trim().toUpperCase()), texto: 'CID do óbito' })
      regras.push({ ok: /^\d{6,12}$/.test(soDigitos(numeroDo)), texto: 'Nº da Declaração de Óbito (6 a 12 dígitos)' })
    }
    if (COM_DADOS_ALTA.includes(d) && altaEm) {
      regras.push({ ok: altaMs <= agora + 60_000 && altaMs >= Date.parse(chegadaEm), texto: 'Data e hora da alta entre a chegada e agora' })
      if (retroativa) regras.push({ ok: retroJust.trim().length >= 10, texto: 'Alta retroativa: justificativa (mínimo de 10 letras)' })
    }
    if (d === 'internacao') regras.push({ ok: !!setorInt, texto: 'Setor de internação' })
  }
  const tudoOk = !!d && regras.every((r) => r.ok)

  const confirmar = useMutation({
    mutationFn: async () => {
      // o rascunho do SOAP é o texto do médico: vira registro antes do desfecho
      if (pendRascunho) {
        const r = await supabase.rpc('registrar_soap', {
          p_episodio: episodioId, p_subjetivo: soap.s, p_objetivo: soap.o, p_avaliacao: soap.a, p_plano: soap.p, p_cid: soap.cid || undefined,
        })
        if (r.error) throw r.error
      }
      const det: Record<string, string> = {}
      if (d === 'transferencia') det.destino = destino.trim()
      if (d === 'evasao' && motivoEvasao) det.motivo_evasao = motivoEvasao
      if (d === 'obito') {
        det.hora_obito = new Date(horaObito).toISOString()
        det.numero_do = numeroDo
        det.cid_obito = cidObito.trim().toUpperCase()
        if (setorObito.trim()) det.setor_obito = setorObito.trim()
      }
      if (d === 'internacao') {
        det.setor_id = setorInt
        if (leitoInt) det.leito_id = leitoInt
      }
      if (d && COM_DADOS_ALTA.includes(d)) {
        if (altaEm) det.alta_em = new Date(altaEm).toISOString()
        if (retroativa) det.justificativa_retroativa = retroJust.trim()
        if (cid) det.cid_alta = cid
        if (soDigitos(proc)) det.procedimento = soDigitos(proc)
        if (obsAlta.trim()) det.observacoes_alta = obsAlta.trim()
      }
      const { error } = await supabase.rpc('registrar_desfecho', {
        p_episodio: episodioId, p_desfecho: d!, p_relato: RELATO[d!] ? relato.trim() : undefined, p_detalhes: det,
      })
      if (error) throw error
    },
    onSuccess: () => onConfirmado(`${nome} · ${rotuloDesfecho(d)} às ${hora(new Date().toISOString())}.`),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-controle font-semibold text-tinta"><DoorOpen className="size-4 text-acao" aria-hidden /> Desfecho do atendimento</span>
        <div className="flex flex-wrap gap-2">
          {DESFECHOS.map((x) => <Chip key={x.valor} ativo={d === x.valor} onClick={() => setD(x.valor)}>{x.rotulo}</Chip>)}
        </div>
        {d && NOTA[d] && <span className="text-apoio text-tinta-sussurro">{NOTA[d]}</span>}
      </div>

      {d === 'transferencia' && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="d-destino">Serviço de destino</Label>
          <Input id="d-destino" value={destino} onChange={(e) => setDestino(e.target.value)} />
        </div>
      )}
      {d === 'obito' && (
        <div className="flex flex-col gap-1.5 sm:max-w-64">
          <Label htmlFor="d-hora">Hora do óbito</Label>
          <Input id="d-hora" type="datetime-local" value={horaObito} max={localAgora(agora)} onChange={(e) => setHoraObito(e.target.value)} />
        </div>
      )}
      {d === 'evasao' && <SeletorMotivoEvasao valor={motivoEvasao} onChange={setMotivoEvasao} />}
      {d && RELATO[d] && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="d-relato">{RELATO[d]}</Label>
          <Textarea id="d-relato" rows={3} value={relato} onChange={(e) => setRelato(e.target.value)} />
        </div>
      )}
      {d === 'internacao' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="int-setor">Setor de internação</Label>
            <select id="int-setor" className="h-9 rounded-controle border border-fio bg-campo px-2 text-controle" value={setorInt}
              onChange={(e) => { setSetorInt(e.target.value); setLeitoInt('') }}>
              <option value="">Escolha…</option>
              {(destinos.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="int-leito">Leito (opcional)</Label>
            <select id="int-leito" className="h-9 rounded-controle border border-fio bg-campo px-2 text-controle" value={leitoInt}
              onChange={(e) => setLeitoInt(e.target.value)} disabled={!setorInt}>
              <option value="">Definir depois</option>
              {leitosLivres.map((l) => <option key={l.id} value={l.id}>{l.identificador}{l.reservado ? ' (reservado)' : ''}</option>)}
            </select>
          </div>
          {/* Reserva (item 12): guarda o leito para este paciente sem finalizar o atendimento */}
          {leitoInt && !leitosLivres.find((l) => l.id === leitoInt)?.reservado && (
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <span className="text-apoio text-tinta-apoio">Ainda não vai subir? Reservar este leito por</span>
              <select aria-label="Validade da reserva" className="h-8 rounded-controle border border-fio bg-campo px-2 text-controle"
                value={horasReserva} onChange={(e) => setHorasReserva(Number(e.target.value))}>
                {[1, 2, 4, 8].map((h) => <option key={h} value={h}>{h} h</option>)}
              </select>
              <Button type="button" size="sm" variant="outline" onClick={() => void reservarLeito()}>Reservar leito</Button>
            </div>
          )}
          {msgReserva && <p role="status" className="text-apoio text-tinta sm:col-span-2">{msgReserva}</p>}
        </div>
      )}

      {d && COM_DADOS_ALTA.includes(d) && (
        <section className="flex flex-col gap-3 rounded-cartao border border-fio bg-campo px-4 py-3.5">
          <span className="rotulo text-tinta-sussurro">Dados da alta</span>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="alta-em">Data e hora da alta</Label>
              <Input id="alta-em" type="datetime-local" value={altaEm || localAgora(agora)} max={localAgora(agora)}
                onChange={(e) => setAltaEm(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="alta-cid">Diagnóstico de alta (CID){d === 'evasao' ? ' · opcional' : ''}</Label>
              <CampoCid id="alta-cid" valor={cidAlta ?? cidAtendimento} onChange={(v) => setCidAlta(v)} />
              {cidAlta === null && cidAtendimento && <span className="text-rotulo text-tinta-sussurro">Do atendimento. Mude se o diagnóstico de alta for outro.</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="alta-proc">Procedimento (opcional)</Label>
              <CampoProcedimento cid={cid} valor={proc} onChange={setProc} />
            </div>
          </div>
          {retroativa && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="alta-retro">Alta retroativa: justifique</Label>
              <Input id="alta-retro" value={retroJust} onChange={(e) => setRetroJust(e.target.value)} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="alta-obs">Observações de alta</Label>
            <Textarea id="alta-obs" rows={2} value={obsAlta} onChange={(e) => setObsAlta(e.target.value)} />
          </div>
          {d === 'obito' && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-setor">Setor do óbito</Label>
                <Input id="ob-setor" value={setorObito} placeholder={painel.setor ?? ''} onChange={(e) => setSetorObito(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-cid">CID do óbito</Label>
                <CampoCid id="ob-cid" valor={cidObito} onChange={setCidObito} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ob-do">Nº da Declaração de Óbito</Label>
                <Input id="ob-do" inputMode="numeric" value={numeroDo} onChange={(e) => setNumeroDo(e.target.value)} />
              </div>
            </div>
          )}
          <span className="text-rotulo text-tinta-sussurro">
            Prestador: {perfil?.nome_completo ?? '—'}{perfil?.crm ? ` · CRM ${perfil.crm}${perfil.uf_crm ? `/${perfil.uf_crm}` : ''}` : ''} (quem confirma)
          </span>
        </section>
      )}

      {d && (
        <section aria-label="Regras do desfecho" className="flex flex-col gap-1.5 rounded-container border border-fio px-4 py-3">
          <span className="rotulo text-tinta-sussurro">Antes de confirmar</span>
          {regras.length === 0 && <span className="text-apoio text-tinta-sussurro">Nada a conferir para este desfecho.</span>}
          {regras.map((r) => (
            <span key={r.texto} className={cn('flex items-start gap-2 text-apoio', r.ok ? 'text-conforme' : 'text-atencao')}>
              {r.ok ? <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
              <span>{r.texto}</span>
            </span>
          ))}
          {pendRascunho && <span className="text-rotulo text-tinta-sussurro">O rascunho da aba Atendimento será registrado no prontuário ao confirmar.</span>}
          <span className="text-rotulo text-tinta-sussurro">Agravo suspeito sem notificação também impede as altas (conferido no servidor).</span>
        </section>
      )}

      {confirmar.error && <p role="alert" className="rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">{msg(confirmar.error)}</p>}
      <div className="flex justify-end">
        <Button disabled={!tudoOk || confirmar.isPending} onClick={() => confirmar.mutate()}>
          <Check /> Confirmar desfecho
        </Button>
      </div>
    </div>
  )
}

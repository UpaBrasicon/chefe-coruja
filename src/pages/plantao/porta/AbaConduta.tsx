// Aba "Conduta" da consulta da UBS (5A, tarefa 2, parte 2.3; opção C do RT em
// 02/11/2026): tipo de atendimento, problema/condição avaliada numa busca só
// (lista da ficha primeiro, depois a CID-10) com o escolhido em etiquetas, e a
// conduta em caixas de marcar, tudo da Ficha de Atendimento Individual do
// e-SUS APS (src/domain/aps.ts). Toma o lugar do Desfecho da porta. As regras
// aparecem antes de enviar; o servidor (registrar_conduta_aps) confere de novo.
// Nada aqui sugere problema, CID ou conduta.
import { useMutation } from '@tanstack/react-query'
import { Check, CircleAlert, ClipboardCheck, UserX, X } from 'lucide-react'
import * as React from 'react'

import { SeletorMotivoEvasao } from '@/components/porta/MotivoEvasao'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { Label } from '@/components/ui/label'
import { OpcaoLista } from '@/components/ui/botao-linha'
import { Textarea } from '@/components/ui/textarea'
import { CONDUTAS_APS, PROBLEMAS_APS, TIPOS_ATENDIMENTO_APS, rotuloProblemaAps } from '@/domain/aps'
import { useTerminologia } from '@/hooks/useTerminologia'
import type { MotivoEvasao } from '@/lib/evasao'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import type { RegistroSoap } from './AbaAtendimento'
import { RELATO, hora, msg, soapVazio, type Soap } from './comum'

/** Problema escolhido: da lista da ficha (código do banco) ou da CID-10. */
type Problema = { lista: string } | { cid: string; descricao: string }

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const chave = (p: Problema) => ('lista' in p ? `l:${p.lista}` : `c:${p.cid}`)
const GRUPOS_CONDUTA = [...new Set(CONDUTAS_APS.map((c) => c.grupo!))]

function BuscaProblema({ escolhidos, onAdicionar, onTirar }: {
  escolhidos: Problema[]; onAdicionar: (p: Problema) => void; onTirar: (p: Problema) => void
}) {
  const [termo, setTermo] = React.useState('')
  const [foco, setFoco] = React.useState(false)
  const t = semAcento(termo.trim())
  const ja = new Set(escolhidos.map(chave))
  const daLista = t.length < 2 ? [] : PROBLEMAS_APS
    .filter((o) => semAcento(o.rotulo).includes(t) && !ja.has(`l:${o.valor}`))
  const cid = useTerminologia('cid10', foco ? termo : '', 6)
  const daCid = termo.trim().length < 2 ? [] : (cid.data ?? []).filter((r) => !ja.has(`c:${r.codigo.toUpperCase()}`))
  const opcoes: Problema[] = [
    ...daLista.map((o) => ({ lista: o.valor })),
    ...daCid.map((r) => ({ cid: r.codigo.toUpperCase(), descricao: r.descricao })),
  ]
  const aberta = foco && opcoes.length > 0
  const escolher = (p: Problema) => { onAdicionar(p); setTermo('') }

  return (
    <div className="relative">
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-controle border border-fio bg-campo px-2 py-1.5 transition-[border-color] focus-within:border-acao">
        {escolhidos.map((p) => {
          const rotulo = 'lista' in p ? rotuloProblemaAps(p.lista) : `${p.cid} · ${p.descricao}`
          return (
            <span key={chave(p)} className="inline-flex max-w-full items-center gap-1 rounded-controle border border-acao/30 bg-acao/10 py-1 pr-1 pl-2.5 text-apoio font-medium text-acao">
              <span className="truncate">{rotulo}</span>
              <button type="button" aria-label={`Tirar ${rotulo}`} onClick={() => onTirar(p)}
                className="grid size-6 shrink-0 place-items-center rounded-[5px] hover:bg-acao/15">
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          )
        })}
        <input id="conduta-problema" role="combobox" aria-expanded={aberta} aria-controls="conduta-problema-opcoes" aria-autocomplete="list"
          value={termo} autoComplete="off" spellCheck={false} placeholder={escolhidos.length ? 'Mais um…' : 'Digite o problema ou a CID-10'}
          className="min-w-40 flex-1 bg-transparent px-1 py-1 text-corpo text-tinta outline-none placeholder:text-tinta-sussurro md:text-controle"
          onFocus={() => setFoco(true)} onBlur={() => window.setTimeout(() => setFoco(false), 150)}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && opcoes[0]) { e.preventDefault(); escolher(opcoes[0]) }
            if (e.key === 'Backspace' && !termo && escolhidos.length) onTirar(escolhidos[escolhidos.length - 1])
          }} />
      </div>
      {aberta && (
        <div id="conduta-problema-opcoes" role="listbox" className="absolute top-full left-0 z-20 mt-1 max-h-72 w-full max-w-2xl overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
          {opcoes.map((p) => (
            <OpcaoLista key={chave(p)} onClick={() => escolher(p)} className="items-baseline">
              {'lista' in p
                ? <><span className="text-tinta">{rotuloProblemaAps(p.lista)}</span><span className="text-rotulo text-tinta-sussurro">lista da ficha</span></>
                : <><span className="text-tinta"><strong className="tabular-nums">{p.cid}</strong> · {p.descricao}</span><span className="text-rotulo text-tinta-sussurro">CID-10</span></>}
            </OpcaoLista>
          ))}
        </div>
      )}
    </div>
  )
}

export function AbaConduta({ episodioId, nome, tipoInicial, registros, soap, onIrPara, onConfirmado }: {
  episodioId: string; nome: string; tipoInicial: string | null | undefined
  registros: RegistroSoap[]; soap: Soap
  /** leva a outra aba da janela (Atendimento, Encaminhar) */
  onIrPara: (aba: 'atend' | 'enc') => void
  onConfirmado: (aviso: string) => void
}) {
  const [tipo, setTipo] = React.useState(tipoInicial ?? '')
  const [problemas, setProblemas] = React.useState<Problema[]>([])
  const [condutas, setCondutas] = React.useState<string[]>([])
  const [obs, setObs] = React.useState('')
  const pendRascunho = !soapVazio(soap)

  const regras = [
    { ok: registros.some((r) => r.avaliacao?.trim()) || !!soap.a.trim(), texto: 'Registro do atendimento (SOAP) com a Avaliação, na aba Atendimento' },
    { ok: !!tipo, texto: 'Tipo de atendimento' },
    { ok: problemas.length > 0, texto: 'Ao menos um problema ou condição avaliada' },
    { ok: condutas.length > 0, texto: 'Ao menos uma conduta' },
  ]
  const tudoOk = regras.every((r) => r.ok)
  const encaminha = condutas.some((c) => c === 'encaminhamento_interno' || c === 'encaminhamento_especializado')

  const encerrar = useMutation({
    mutationFn: async () => {
      // o rascunho do SOAP é o texto do médico: vira registro antes da conduta
      if (pendRascunho) {
        const r = await supabase.rpc('registrar_soap', {
          p_episodio: episodioId, p_subjetivo: soap.s, p_objetivo: soap.o, p_avaliacao: soap.a, p_plano: soap.p, p_cid: soap.cid || undefined,
        })
        if (r.error) throw r.error
      }
      const { error } = await supabase.rpc('registrar_conduta_aps', {
        p_episodio: episodioId,
        p_tipo: tipo,
        p_problemas: problemas.flatMap((p) => ('lista' in p ? [p.lista] : [])),
        p_cids: problemas.flatMap((p) => ('cid' in p ? [p.cid] : [])),
        p_condutas: condutas,
        p_obs: obs.trim() || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => onConfirmado(`${nome} · consulta encerrada às ${hora(new Date().toISOString())}.`),
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-controle font-semibold text-tinta">Tipo de atendimento</span>
        <div role="radiogroup" aria-label="Tipo de atendimento" className="flex flex-wrap gap-2">
          {TIPOS_ATENDIMENTO_APS.map((o) => (
            <Chip key={o.valor} variante="opcao" radio ativo={tipo === o.valor} onClick={() => setTipo(o.valor)}>{o.rotulo}</Chip>
          ))}
        </div>
        {tipoInicial && <span className="text-rotulo text-tinta-sussurro">Vem da recepção; confirme ou corrija.</span>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="conduta-problema" className="text-controle font-semibold text-tinta">Problema/condição avaliada</Label>
        <BuscaProblema escolhidos={problemas}
          onAdicionar={(p) => setProblemas((x) => [...x, p])}
          onTirar={(p) => setProblemas((x) => x.filter((y) => chave(y) !== chave(p)))} />
        <span className="text-rotulo text-tinta-sussurro">O que foi avaliado e manejado nesta consulta. A busca mostra primeiro a lista da ficha e depois a CID-10.</span>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-controle font-semibold text-tinta">Conduta</legend>
        {GRUPOS_CONDUTA.map((g) => (
          <div key={g} className="flex flex-col gap-2">
            <span className="rotulo text-tinta-sussurro">{g}</span>
            <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {CONDUTAS_APS.filter((c) => c.grupo === g).map((c) => (
                <CaixaMarcar key={c.valor} marcado={condutas.includes(c.valor)}
                  onChange={(m) => setCondutas((x) => (m ? [...x, c.valor] : x.filter((y) => y !== c.valor)))}>
                  <span className="text-controle text-tinta">{c.curto ?? c.rotulo}</span>
                </CaixaMarcar>
              ))}
            </div>
          </div>
        ))}
        {encaminha && (
          <div role="note" className="flex flex-wrap items-center gap-2 rounded-controle border border-fio bg-campo px-3 py-2 text-apoio text-tinta-apoio">
            <span className="flex-1">O encaminhamento (interno, ou para outra unidade no SMS003a) se faz na aba Encaminhar.</span>
            <Button size="xs" variant="outline" onClick={() => onIrPara('enc')}>Abrir Encaminhar</Button>
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="conduta-obs">Observação <span className="font-normal text-tinta-sussurro">(opcional)</span></Label>
        <Textarea id="conduta-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>

      <section aria-label="Regras para encerrar" className="flex flex-col gap-1.5 rounded-container border border-fio px-4 py-3">
        <span className="rotulo text-tinta-sussurro">Antes de encerrar</span>
        {regras.map((r) => (
          <span key={r.texto} className={cn('flex items-start gap-2 text-apoio', r.ok ? 'text-conforme' : 'text-atencao')}>
            {r.ok ? <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
            <span>{r.texto}</span>
          </span>
        ))}
        {!regras[0].ok && (
          <Button size="xs" variant="outline" className="self-start" onClick={() => onIrPara('atend')}><ClipboardCheck /> Ir para o Atendimento</Button>
        )}
        {pendRascunho && <span className="text-rotulo text-tinta-sussurro">O rascunho da aba Atendimento será registrado no prontuário ao encerrar.</span>}
      </section>

      {encerrar.error && <p role="alert" className="rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">{msg(encerrar.error)}</p>}
      <div className="flex justify-end">
        <Button disabled={!tudoOk || encerrar.isPending} onClick={() => encerrar.mutate()}>
          <Check /> Encerrar consulta
        </Button>
      </div>

      <Evasao episodioId={episodioId} nome={nome} onConfirmado={onConfirmado} />
    </div>
  )
}

/** O paciente saiu sem a consulta: a única saída da UBS pelo desfecho da
 *  porta (registrar_desfecho aceita só a evasão no episódio da UBS). */
function Evasao({ episodioId, nome, onConfirmado }: { episodioId: string; nome: string; onConfirmado: (aviso: string) => void }) {
  const [aberto, setAberto] = React.useState(false)
  const [motivo, setMotivo] = React.useState<MotivoEvasao | null>(null)
  const [relato, setRelato] = React.useState('')
  const registrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_desfecho', {
        p_episodio: episodioId, p_desfecho: 'evasao', p_relato: relato.trim(), p_detalhes: { motivo_evasao: motivo! },
      })
      if (error) throw error
    },
    onSuccess: () => onConfirmado(`${nome} · evasão às ${hora(new Date().toISOString())}.`),
  })
  return (
    <section className="flex flex-col gap-3 rounded-container border border-fio px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-controle font-semibold text-tinta"><UserX className="size-4 text-tinta-sussurro" aria-hidden /> Saiu sem a consulta</h3>
        <span className="text-rotulo text-tinta-sussurro">Só quando o paciente foi embora antes de ser atendido.</span>
        {!aberto && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAberto(true)}>Registrar evasão</Button>}
      </div>
      {aberto && (
        <>
          <SeletorMotivoEvasao valor={motivo} onChange={setMotivo} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ubs-evasao-relato">{RELATO.evasao}</Label>
            <Textarea id="ubs-evasao-relato" rows={2} value={relato} onChange={(e) => setRelato(e.target.value)} />
            <span className="text-rotulo text-tinta-sussurro">Mínimo de 15 letras.</span>
          </div>
          {registrar.error && <p role="alert" className="text-apoio text-critico">{msg(registrar.error)}</p>}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={!motivo || relato.trim().length < 15 || registrar.isPending} onClick={() => registrar.mutate()}>Registrar evasão</Button>
          </div>
        </>
      )}
    </section>
  )
}

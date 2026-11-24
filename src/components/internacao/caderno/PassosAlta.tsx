// "Alta e documentos" do leito. AL1–AL3 (revisão da Internação aprovada pelo
// RT em 24/11/2026): começa pela decisão — o tipo de saída no topo — e os
// documentos aparecem conforme o tipo: na alta para casa, o sumário de alta,
// a receita para casa, o atestado e as orientações; na transferência, o
// sumário e o documento de transferência; no óbito, os dados do óbito; na
// evasão, só o registro. As travas de alta numa lista curta agrupada, com o
// que fazer em cada grupo, e a contagem no botão "Dar alta (N pendências)".
// Receita e atestado são as peças da porta, com o paciente fixo; o documento
// é emitido pelo rascunho do banco, que o liga à internação. A regra de alta
// continua no servidor (dar_alta).
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { faixaEtaria } from '@/domain/idade'
import { dataIso, hora as horaFmt } from '@/lib/formato'
import { sugestoesDaPrescricao, type EstadoDocs } from '@/lib/documentosAlta'
import { viaDeCasa } from '@/lib/doProntuario'
import { agruparTravas, rotuloDarAlta, tituloGrupo, type GrupoTravas } from '@/lib/travasAlta'
import { CartaoAtestado, ReceitaAlta } from '@/components/documentos/AtestadoReceita'
import { useEmissaoAtestadoReceita } from '@/components/documentos/emissaoAtestadoReceita'
import { AgravosNotificacao } from '@/components/clinico/ExamesEAgravos'
import { Chip } from '@/components/monitor/Pagina'
import { Estado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { type Acao, diaHora, type Internacao, type Pacote, TIPO_ALTA } from './comum'
import { BlocoAlta, BlocoPacote, CancelarAlta } from './Alta'
import { SumarioAlta } from './SumarioAlta'
import { PainelObito } from '@/components/obito/PainelObito'

const hora = (iso: string) => horaFmt(iso)

type DocAlta = { id: string; tipo_documento: string; created_at: string; emitido_em: string | null; versao: number }
type Impeditivo = { tipo: string; descricao: string; id?: string }

/** A ordem do RT: alta melhorada, a pedido, transferência, óbito, evasão. */
const ORDEM_SAIDA = ['alta_melhorada', 'alta_pedido', 'transferencia_externa', 'obito', 'alta_evasao']
const SAIDAS = ORDEM_SAIDA.map((k) => TIPO_ALTA.find(([t]) => t === k)!).filter(Boolean)
const PARA_CASA = ['alta_melhorada', 'alta_pedido']

function Passo({ n, titulo, feito, aberto, onAlternar, children }: {
  n: number; titulo: string; feito: string | null; aberto: boolean; onAlternar: () => void; children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <Button type="button" variant="ghost" onClick={onAlternar} aria-expanded={aberto}
        className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left hover:bg-campo">
        <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-capsula text-apoio font-semibold',
          feito ? 'bg-conforme text-superficie' : 'bg-trilha text-tinta-apoio')}>{n}</span>
        <span className="text-controle font-semibold text-tinta">{titulo}</span>
        <Estado tom={feito ? 'verde' : 'cinza'}>{feito ?? 'Não feito'}</Estado>
        <ChevronDown className={cn('ml-auto size-4 text-tinta-sussurro transition-transform', aberto && 'rotate-180')} aria-hidden />
      </Button>
      {aberto && <div className="flex flex-col gap-3 border-t border-trilha px-4 py-3">{children}</div>}
    </section>
  )
}

/** AL3: um grupo de travas com o que fazer (abrir, cancelar em lote com motivo, notificar ou descartar). */
export function GrupoTrava({ g, pacienteId, onIr }: { g: GrupoTravas; pacienteId: string; onIr?: (aba: 'exames' | 'resumo') => void }) {
  const qc = useQueryClient()
  const [aberto, setAberto] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  async function cancelarTodos() {
    setOcupado(true)
    const falhas: string[] = []
    for (const id of g.ids) {
      const { error } = await supabase.rpc('resolver_exame', { p_exame: id, p_motivo_cancelamento: motivo.trim() } as never)
      if (error) falhas.push(error.message)
    }
    setOcupado(false)
    setErro(falhas.length ? `Não foi possível cancelar ${falhas.length}: ${falhas[0]}` : null)
    if (!falhas.length) { setMotivo(''); setAberto(false) }
    for (const k of ['impeditivos', 'exames-pedidos', 'exames-da-internacao']) void qc.invalidateQueries({ queryKey: [k] })
  }
  return (
    <li className="flex flex-col gap-1.5 border-b border-trilha py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className={cn('size-4 shrink-0', g.tipo === 'agravo' ? 'text-critico' : 'text-atencao')} aria-hidden />
        <span className={cn('text-controle', g.tipo === 'agravo' ? 'font-semibold text-critico' : 'text-tinta')}>{tituloGrupo(g)}</span>
        {g.itens.length > 0 && (
          <Button size="xs" variant="outline" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
            {aberto ? 'Fechar' : g.tipo === 'agravo' ? 'Notificar ou descartar' : 'Ver'}
          </Button>
        )}
        {g.tipo === 'exame' && onIr && <Button size="xs" variant="outline" onClick={() => onIr('exames')}>Registrar resultado</Button>}
        {g.tipo === 'pendencia' && onIr && <Button size="xs" variant="outline" onClick={() => onIr('resumo')}>Abrir pendências</Button>}
      </div>
      {aberto && g.tipo !== 'agravo' && g.itens.length > 0 && <span className="pl-6 text-apoio text-tinta-apoio">{g.itens.join(' · ')}</span>}
      {aberto && g.tipo === 'exame' && g.ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <Input className="h-8 min-w-60 flex-1" aria-label="Motivo do cancelamento" placeholder="Motivo para cancelar todos (mínimo de 10 letras)"
            value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="xs" variant="outline" disabled={ocupado || motivo.trim().length < 10} onClick={() => void cancelarTodos()}>
            Cancelar os {g.ids.length} com este motivo
          </Button>
        </div>
      )}
      {aberto && g.tipo === 'agravo' && <div className="pl-6"><AgravosNotificacao pacienteId={pacienteId} medico sempre /></div>}
      {erro && <span className="pl-6 text-apoio text-critico">{erro}</span>}
    </li>
  )
}

export function PassosAlta({ i, pacienteId, pacienteNome, ativa, altaRecente, ehGestor, eu, acao, impeditivos, pacotes, cidSugerido, leito, diagnostico, estado, setEstado, onIr }: {
  i: Internacao; pacienteId: string; pacienteNome: string; ativa: boolean; altaRecente: boolean; ehGestor: boolean; eu: string | null
  acao: Acao; impeditivos: Impeditivo[]; pacotes: Pacote[]; cidSugerido: string | null
  leito: string; diagnostico: string
  /** a receita e o atestado em curso ficam no leito aberto (trocar de aba não perde o que foi escrito) */
  estado: EstadoDocs; setEstado: (f: (s: EstadoDocs) => EstadoDocs) => void
  /** leva à aba que resolve a trava (exames, pendências do Resumo) */
  onIr?: (aba: 'exames' | 'resumo') => void
}) {
  const podeEmitir = !ehGestor && (ativa || altaRecente)
  const [saida, setSaida] = React.useState('alta_melhorada')
  // mesma chave e colunas do cabeçalho do paciente: uma leitura só
  const paciente = useQuery({
    queryKey: ['cabecalho-paciente', pacienteId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('nome, nome_social, data_nascimento, sexo').eq('id', pacienteId).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const docs = useQuery({
    queryKey: ['documentos-alta', i.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_clinicos')
        .select('id, tipo_documento, created_at, emitido_em, versao')
        .eq('internacao_id', i.id).in('tipo_documento', ['receita', 'atestado', 'sumario_alta']).neq('estado', 'rascunho')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DocAlta[]
    },
  })
  // "Trazer da prescrição" (opção a do RT): só o medicamento; "como tomar" é do médico
  const prescricao = useQuery({
    queryKey: ['prescricao-vigente', pacienteId],
    enabled: podeEmitir,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as { tipo: string; descricao: string; medicamento_id: string | null; via: string | null }[]
    },
  })
  const sugestoes = sugestoesDaPrescricao(prescricao.data ?? [])
  // AL2: só as vias que fazem sentido em casa; injetáveis ficam atrás de "mostrar todos"
  const viasPorMed = new Map<string, (string | null)[]>()
  for (const it of prescricao.data ?? []) if (it.medicamento_id) viasPorMed.set(it.medicamento_id, [...(viasPorMed.get(it.medicamento_id) ?? []), it.via])
  const deCasa = (m: { id: string }) => (viasPorMed.get(m.id) ?? [null]).some((v) => viaDeCasa(v))

  const p = paciente.data
  const nascimento = p?.data_nascimento ? p.data_nascimento.slice(0, 10) : null
  const { erro, emitirAtestado, emitirReceita } = useEmissaoAtestadoReceita({
    pacienteId, nome: p?.nome_social || p?.nome || pacienteNome, nascimento, leito, diagnostico,
    ondePreencherCid: 'registre o diagnóstico em Evolução › Evoluir hoje', estado, setEstado, aoEmitir: () => void docs.refetch(),
  })

  const ultima = (tipo: string) => (docs.data ?? []).find((d) => d.tipo_documento === tipo)
  const receita = ultima('receita')
  const sumario = ultima('sumario_alta')
  const atestados = (docs.data ?? []).filter((d) => d.tipo_documento === 'atestado')
  const pacote = pacotes.find((x) => x.situacao === 'ativo') ?? pacotes[0]
  const feitoSumario = sumario ? `Emitido ${hora(sumario.emitido_em ?? sumario.created_at)}` : null
  const feitoReceita = receita ? `Emitida ${hora(receita.emitido_em ?? receita.created_at)}` : null
  const feitoAtestado = atestados[0] ? `Emitido ${hora(atestados[0].emitido_em ?? atestados[0].created_at)}` : null
  const feitoPacote = pacote ? 'Gerado' : null

  const [abertos, setAbertos] = React.useState<string[]>(() => ['sumario'])
  const alternar = (n: string) => setAbertos((xs) => (xs.includes(n) ? xs.filter((x) => x !== n) : [...xs, n]))
  const grupos = agruparTravas(impeditivos)
  const paraCasa = PARA_CASA.includes(saida)

  return (
    <div className="flex flex-col gap-3">
      {erro && <p role="alert" className="rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">{erro}</p>}

      {ativa && !ehGestor && (
        <>
          {/* AL1: a decisão primeiro */}
          <section aria-label="Tipo de saída" className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie px-4 py-3">
            <span className="text-controle font-semibold text-tinta">Tipo de saída</span>
            <div role="radiogroup" aria-label="Tipo de saída" className="flex flex-wrap gap-1.5">
              {SAIDAS.map(([k, r]) => <Chip key={k} variante="opcao" radio ativo={saida === k} onClick={() => setSaida(k)}>{r}</Chip>)}
            </div>
            <span className="text-rotulo text-tinta-sussurro">
              {paraCasa ? 'Para casa: sumário de alta, receita, atestado e orientações. Nenhum é obrigatório para a alta.'
                : saida === 'transferencia_externa' ? 'Transferência: sumário e documento de transferência (obrigatório, na alta abaixo); o que está em aberto é cancelado com o motivo.'
                  : saida === 'obito' ? 'Óbito: os dados do óbito e a declaração na alta abaixo; o que está em aberto é cancelado com o motivo.'
                    : 'Evasão: descreva o ocorrido na alta abaixo.'}
            </span>
          </section>

          {/* AL3: travas numa lista curta agrupada */}
          {grupos.length > 0 && (
            <section aria-label="O que impede a alta" className="flex flex-col gap-1 rounded-cartao border border-atencao/40 bg-superficie px-4 py-2">
              <span className="text-controle font-semibold text-tinta">Pendências para a alta</span>
              <ul className="flex flex-col">
                {grupos.map((g) => <GrupoTrava key={g.chave} g={g} pacienteId={pacienteId} onIr={onIr} />)}
              </ul>
            </section>
          )}
        </>
      )}

      {(paraCasa || saida === 'transferencia_externa' || !ativa) && (
        <Passo n={1} titulo={saida === 'transferencia_externa' ? 'Sumário da internação (vai com a transferência)' : 'Sumário de alta'}
          feito={feitoSumario} aberto={abertos.includes('sumario')} onAlternar={() => alternar('sumario')}>
          {podeEmitir
            ? <SumarioAlta i={i} pacienteId={pacienteId} tipoSaida={saida} receita={estado.receita} podeEmitir aoEmitir={() => void docs.refetch()} />
            : <p className="text-apoio text-tinta-sussurro">{sumario ? `Sumário emitido ${diaHora(sumario.emitido_em ?? sumario.created_at)}.` : 'Nenhum sumário de alta emitido nesta internação.'}</p>}
        </Passo>
      )}

      {(paraCasa || !ativa) && (
        <>
          <Passo n={2} titulo="Receita para casa" feito={feitoReceita} aberto={abertos.includes('receita')} onAlternar={() => alternar('receita')}>
            {podeEmitir ? (
              <ReceitaAlta titulo="Receita para casa" faixa={faixaEtaria(nascimento, dataIso())} estado={estado} setEstado={setEstado}
                sugestoes={sugestoes} deCasa={deCasa} onEmitir={() => void emitirReceita()} />
            ) : <p className="text-apoio text-tinta-sussurro">{receita ? `Receita emitida ${hora(receita.emitido_em ?? receita.created_at)}.` : 'Nenhuma receita emitida nesta internação.'}</p>}
          </Passo>

          <Passo n={3} titulo="Atestado" feito={feitoAtestado} aberto={abertos.includes('atestado')} onAlternar={() => alternar('atestado')}>
            {podeEmitir && <CartaoAtestado estado={estado} setEstado={setEstado} cid={cidSugerido ?? ''} onEmitir={() => void emitirAtestado(cidSugerido ?? '')} />}
            {atestados.length === 0 ? <p className="text-apoio text-tinta-sussurro">Nenhum atestado emitido nesta internação.</p> : (
              <div className="flex flex-col">
                {atestados.map((d) => (
                  <span key={d.id} className="border-t border-trilha py-1.5 text-apoio text-tinta first:border-0">
                    Atestado{d.versao > 1 ? ` · versão ${d.versao}` : ''} <span className="text-tinta-sussurro">· {diaHora(d.emitido_em ?? d.created_at)}</span>
                  </span>
                ))}
              </div>
            )}
          </Passo>

          <Passo n={4} titulo="Orientações" feito={feitoPacote} aberto={abertos.includes('orientacoes')} onAlternar={() => alternar('orientacoes')}>
            {(ativa || altaRecente || ehGestor) ? (
              <BlocoPacote i={i} pacienteId={pacienteId} pacienteNome={pacienteNome} lista={pacotes} podeGerar={!ehGestor && (ativa || altaRecente)} acao={acao} />
            ) : <p className="text-apoio text-tinta-sussurro">Alta há mais de 24 horas.</p>}
          </Passo>
        </>
      )}

      {ativa && !ehGestor && (
        <BlocoAlta i={i} pacienteId={pacienteId} impeditivos={impeditivos} acao={acao} cidSugerido={cidSugerido}
          tipoFixo={saida} rotuloBotao={rotuloDarAlta(grupos)} semListaImpeditivos />
      )}
      {!ativa && altaRecente && (i.alta_por === eu || ehGestor) && <CancelarAlta i={i} acao={acao} />}
      {/* lacuna 5 (O7): o óbito e o que falta depois dele */}
      {i.status === 'obito' && <PainelObito pacienteId={pacienteId} />}
      {!ativa && !altaRecente && <p className="text-apoio text-tinta-sussurro">Alta há mais de 24 horas: não pode mais ser cancelada. Se o paciente voltar, faça uma nova admissão.</p>}
    </div>
  )
}

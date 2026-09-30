// ─────────────────────────────────────────────────────────────────────────────
// Um box da observação (protótipo, index.html 3568–3606): box, quem é, queixa,
// estado, protocolo, reavaliação, espera até o primeiro registro médico,
// alergia e acuidade; à direita os relógios da permanência; as ações do estado.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Clock } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ehPediatrico, rotuloIdade } from '@/domain/idade'
import { SeloAlergia } from '@/components/paciente/AlergiasEventos'
import { Button } from '@/components/ui/button'

import {
  ESTADOS, ROTULO_DESFECHO, TOM_BARRA, TOM_TEXTO, hhmm, msgErro, relogioEspera, relogioPermanencia, rpc, textoReavaliacao,
  type Acao, type LinhaObservacao,
} from './modelo'
import {
  BlocoPassagemBox, PainelDesfecho, PainelEscolherProtocolo, PainelPassar, PainelProtocoloAberto, PainelReavaliar,
} from './PaineisCartao'

type Aberto = '' | 'reav' | 'fim' | 'proto' | 'passar'
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const BANDA = ['bg-conforme/10 text-conforme', 'bg-atencao/10 text-atencao', 'bg-critico/10 text-critico']

/** Acuidade calculada no servidor (NEWS2 no adulto, Bedside PEWS na criança): a mesma chave do leito. */
function ChipAcuidade({ pacienteId }: { pacienteId: string }) {
  const q = useQuery({
    queryKey: ['acuidade', pacienteId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('acuidade', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as { escala: string | null; total?: number; banda?: number; parcial?: boolean; aferido_em?: string | null }
    },
  })
  const a = q.data
  if (!a?.escala) return null
  if (!a.aferido_em || a.total === undefined) {
    return <span className="rounded-capsula bg-trilha px-2.5 py-[3px] text-rotulo font-semibold text-tinta-sussurro">{a.escala} · sem aferição</span>
  }
  return (
    <span title={`${a.escala} aferido às ${hhmm(a.aferido_em)}${a.parcial ? ' (parcial: falta vital)' : ''}`}
      className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold tabular-nums', BANDA[a.banda ?? 0])}>
      {a.escala} {a.total}{a.parcial ? '*' : ''}
    </span>
  )
}

export function CartaoObservacao({ linha, agora, eu, unidadeId, podeAgir, ehMedico, abrirPrancheta }: {
  linha: LinhaObservacao
  agora: number
  eu?: string
  unidadeId: string
  /** plantonista de escala no setor: o gestor só acompanha */
  podeAgir: boolean
  /** atender, reavaliar, finalizar e abrir protocolo são do médico */
  ehMedico: boolean
  abrirPrancheta: (l: LinhaObservacao) => void
}) {
  const qc = useQueryClient()
  const [aberto, setAberto] = React.useState<Aberto>('')
  const [erro, setErro] = React.useState<string | null>(null)
  const abrir = (qual: Aberto) => { setErro(null); setAberto((a) => (a === qual ? '' : qual)) }
  const fechar = () => { setErro(null); setAberto('') }

  const acao: Acao = async (fn) => {
    try {
      await fn()
      setErro(null)
      for (const k of ['painel-observacao', 'pendencias', 'passagens', 'passagens-aguardando', 'impeditivos', 'pacientes-internados', 'ocupacao-setores', 'pendencias-observacao', 'leito-aberto'])
        void qc.invalidateQueries({ queryKey: [k] })
      return true
    } catch (e) {
      setErro(msgErro(e))
      return false
    }
  }

  const est = ESTADOS.find((e) => e.id === linha.estado) ?? ESTADOS[0]
  const fim = linha.estado === 'finalizado'
  const ped = linha.data_nascimento ? ehPediatrico(linha.data_nascimento, hoje()) === true : false
  const idade = linha.data_nascimento ? rotuloIdade(linha.data_nascimento, hoje()) : null
  const rel = relogioPermanencia(linha.entrada, linha.prazo, fim && linha.finalizado_em ? Date.parse(linha.finalizado_em) : agora)
  const espera = relogioEspera(linha.entrada, linha.primeiro_atendimento_em, agora)
  const reav = linha.estado === 'reavaliacao' && linha.reavaliar_em ? textoReavaliacao(linha.reavaliar_em, agora) : null
  const pr = linha.protocolo
  const ps = linha.passagem
  const aguardandoPassagem = ps?.situacao === 'aguardando'

  // ações por estado (protótipo, 31408–31430)
  const acoes: { rotulo: string; primaria?: boolean; onClick: () => void }[] = []
  if (podeAgir && !fim) {
    if (ehMedico && linha.estado === 'nao') acoes.push({ rotulo: 'Atender', primaria: true, onClick: () => void acao(() => rpc('observacao_atender', { p_internacao: linha.internacao_id })) })
    if (ehMedico && (linha.estado === 'atendimento' || linha.estado === 'encaminhado')) acoes.push({ rotulo: 'Reavaliar às…', onClick: () => abrir('reav') })
    if (ehMedico && linha.estado === 'reavaliacao') acoes.push({ rotulo: 'Reavaliado', primaria: true, onClick: () => void acao(() => rpc('observacao_reavaliado', { p_internacao: linha.internacao_id })) })
    if (ehMedico && linha.estado !== 'nao') acoes.push({ rotulo: 'Finalizar', onClick: () => abrir('fim') })
    if (ehMedico || pr) acoes.push({ rotulo: pr ? `Protocolo ${pr.sigla}` : 'Protocolo', onClick: () => abrir('proto') })
    if (!aguardandoPassagem) acoes.push({ rotulo: ps?.situacao === 'recusada' ? 'Reenviar passagem' : 'Passar plantão', onClick: () => abrir('passar') })
  }

  return (
    <div className="border-b border-trilha last:border-b-0">
      <div className="flex flex-wrap items-center gap-3.5 px-5 py-[13px] hover:bg-campo">
        <span className="shrink-0 rounded-capsula bg-trilha px-[9px] py-1 text-apoio font-semibold text-tinta-apoio">{linha.box ?? 'Sem box'}</span>

        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
          <span className="text-corpo font-medium text-tinta">
            {linha.nome} {idade && <span className="text-apoio font-normal text-tinta-sussurro">{idade}</span>}
          </span>
          {linha.queixa && <span className="text-apoio text-tinta-sussurro">{linha.queixa}</span>}
          <span className="flex flex-wrap items-center gap-[7px]">
            <span className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap', est.classe)}>
              {est.rotulo}{fim && linha.desfecho ? ` · ${ROTULO_DESFECHO[linha.desfecho] ?? linha.desfecho} às ${hhmm(linha.finalizado_em)}` : ''}
            </span>
            {pr && (
              <>
                <span className="rounded-micro bg-suprimento px-[7px] py-0.5 text-rotulo font-bold text-white" title={pr.nome}>{pr.sigla}</span>
                <span className="text-rotulo text-tinta-apoio">Etapa {pr.etapa_atual + 1} de {pr.etapas.length} · {pr.etapas[pr.etapa_atual]?.texto}</span>
              </>
            )}
          </span>
          {reav && <span className={cn('text-rotulo font-semibold', reav.atrasada ? 'text-critico' : 'text-atencao')}>{reav.texto}</span>}
          {!fim && (
            <span className={cn('text-rotulo', espera.aguardando ? 'font-semibold text-observacao' : 'text-tinta-sussurro')}>
              {espera.texto}{!espera.aguardando && linha.primeiro_atendimento_por ? ` · ${linha.primeiro_atendimento_por}` : ''}
            </span>
          )}
          <span className="mt-0.5 flex flex-wrap items-center gap-2">
            <SeloAlergia pacienteId={linha.paciente_id} />
            {!fim && <ChipAcuidade pacienteId={linha.paciente_id} />}
          </span>
        </div>

        <div className="flex w-[132px] flex-[0_1_auto] flex-col items-end gap-1">
          <span className={cn('text-apoio tabular-nums', fim ? 'text-tinta-sussurro' : rel.acima ? 'font-semibold text-observacao' : 'text-tinta-apoio')}>{rel.permanencia}</span>
          {fim ? (
            <span className="flex items-center gap-1 text-rotulo whitespace-nowrap text-tinta-sussurro"><Clock className="size-3" aria-hidden /> Encerrada às {hhmm(linha.finalizado_em)}</span>
          ) : (
            <>
              <span className={cn('flex items-center gap-1 text-rotulo font-semibold tabular-nums whitespace-nowrap', TOM_TEXTO[rel.tom])}>
                <Clock className="size-3" aria-hidden /> {rel.contagem}
              </span>
              <span aria-hidden className="h-1 w-full overflow-hidden rounded-capsula bg-fio">
                <span className={cn('block h-full rounded-capsula transition-[width] duration-500', TOM_BARRA[rel.tom])} style={{ width: `${rel.pct}%` }} />
              </span>
            </>
          )}
          <span className={cn('text-right text-apoio', fim ? 'text-tinta-sussurro' : rel.acima ? 'text-observacao' : 'text-tinta-sussurro')}>
            {fim ? 'Fora da observação' : rel.acima ? 'Definir conduta ou internar' : 'Em acompanhamento'}
          </span>
        </div>

        <div className="flex flex-[0_1_auto] flex-wrap gap-[7px]">
          {acoes.map((a) => (
            <Button key={a.rotulo} size="sm" variant={a.primaria ? 'default' : 'outline'} onClick={a.onClick}>{a.rotulo}</Button>
          ))}
          {!fim && (
            <Button size="sm" variant="outline" onClick={() => abrirPrancheta(linha)}><ClipboardList /> Prancheta</Button>
          )}
        </div>
      </div>

      {erro && !aberto && <p className="mx-5 mb-3 text-apoio text-critico">{erro}</p>}
      {aberto === 'reav' && <PainelReavaliar linha={linha} acao={acao} fechar={fechar} erro={erro} />}
      {aberto === 'fim' && <PainelDesfecho linha={linha} unidadeId={unidadeId} acao={acao} fechar={fechar} erro={erro} />}
      {aberto === 'proto' && !pr && <PainelEscolherProtocolo linha={linha} pediatrico={ped} acao={acao} fechar={fechar} erro={erro} />}
      {aberto === 'proto' && pr && <PainelProtocoloAberto key={pr.id} linha={linha} acao={acao} fechar={fechar} erro={erro} />}
      {aberto === 'passar' && <PainelPassar linha={linha} acao={acao} fechar={fechar} erro={erro} />}
      {ps && !fim && (ps.situacao !== 'aceita' || ps.de_perfil === eu || ps.para_perfil === eu) && <BlocoPassagemBox linha={linha} />}
    </div>
  )
}

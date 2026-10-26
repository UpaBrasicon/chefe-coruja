// ─────────────────────────────────────────────────────────────────────────────
// Um box da observação (protótipo, index.html 3568–3606), uma linha da tabela
// (revisão visual 3.6, opção B do RT): box; quem é, queixa, alergia e acuidade;
// situação em ponto + texto com reavaliação, protocolo e espera até o primeiro
// registro médico; há quanto tempo; o prazo das 6 horas; as ações do estado. Os
// painéis da linha (reavaliar, desfecho, protocolo, passagem) abrem numa linha
// de largura inteira logo abaixo.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Clock } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { faixaEtaria, rotuloIdade } from '@/domain/idade'
import { SeloAlergia } from '@/components/paciente/AlergiasEventos'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { Estado } from '@/components/porta/Estado'
import { dataIso } from '@/lib/formato'

import {
  ESTADOS, ROTULO_DESFECHO, TOM_TEXTO, hhmm, msgErro, relogioEspera, relogioPermanencia, rpc, textoReavaliacao,
  type Acao, type LinhaObservacao,
} from './modelo'
import {
  BlocoPassagemBox, PainelDesfecho, PainelEscolherProtocolo, PainelPassar, PainelProtocoloAberto, PainelReavaliar,
} from './PaineisCartao'

type Aberto = '' | 'reav' | 'fim' | 'proto' | 'passar'
const hoje = () => dataIso()
const BANDA = ['text-conforme', 'text-observacao', 'text-critico']

/** Acuidade calculada no servidor (NEWS2 no adulto, Bedside PEWS na criança): a mesma chave do leito. */
function Acuidade({ pacienteId }: { pacienteId: string }) {
  const q = useQuery({
    queryKey: ['acuidade', pacienteId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('acuidade', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as { escala: string | null; motivo?: string; total?: number; banda?: number; parcial?: boolean; aferido_em?: string | null }
    },
  })
  const a = q.data
  if (!a) return null
  // sem escala (ex.: sem data de nascimento) o servidor diz o porquê, como no leito (Acuidade.tsx)
  if (!a.escala) {
    return a.motivo
      ? <span title={a.motivo} className="text-rotulo font-semibold text-atencao">{a.motivo}</span>
      : null
  }
  if (!a.aferido_em || a.total === undefined) {
    return <span className="text-rotulo text-tinta-sussurro">{a.escala} sem aferição</span>
  }
  return (
    <span title={`${a.escala} aferido às ${hhmm(a.aferido_em)}${a.parcial ? ' (parcial: falta vital)' : ''}`}
      className={cn('text-rotulo font-semibold tabular-nums', BANDA[a.banda ?? 0])}>
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
  // pela idade; sem data de nascimento é 'desconhecida', nunca adulto (decisão do RT, 02/10/2026)
  const faixa = faixaEtaria(linha.data_nascimento, hoje())
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

  const painel = aberto || (ps && !fim && (ps.situacao !== 'aceita' || ps.de_perfil === eu || ps.para_perfil === eu)) || (erro && !aberto)

  return (
    <>
      <TableRow className={cn('align-top', painel && 'border-b-0')}>
        <TableCell className="pl-5 font-semibold text-acao">{linha.box ?? 'Sem box'}</TableCell>

        <TableCell className="whitespace-normal">
          <div className="flex min-w-[200px] flex-col gap-1">
            <span className="text-corpo font-medium text-tinta">
              {linha.nome} {idade && <span className="text-apoio font-normal text-tinta-sussurro">{idade}</span>}
            </span>
            {linha.queixa && <span className="text-apoio text-tinta-sussurro">{linha.queixa}</span>}
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <SeloAlergia pacienteId={linha.paciente_id} />
              {!fim && <Acuidade pacienteId={linha.paciente_id} />}
            </span>
          </div>
        </TableCell>

        <TableCell className="whitespace-normal">
          <div className="flex min-w-[180px] flex-col items-start gap-0.5">
            <Estado tom={est.tom}>{est.rotulo}</Estado>
            {fim && linha.desfecho && <span className="pl-[17px] text-rotulo text-tinta-apoio">{ROTULO_DESFECHO[linha.desfecho] ?? linha.desfecho} às {hhmm(linha.finalizado_em)}</span>}
            {reav && <span className={cn('pl-[17px] text-rotulo font-semibold', reav.atrasada ? 'text-critico' : 'text-atencao')}>{reav.texto}</span>}
            {pr && (
              <span className="pl-[17px] text-rotulo text-tinta-apoio" title={pr.nome}>
                <span className="font-semibold text-suprimento">{pr.sigla}</span> · Etapa {pr.etapa_atual + 1} de {pr.etapas.length} · {pr.etapas[pr.etapa_atual]?.texto}
              </span>
            )}
            {!fim && (
              <span className={cn('pl-[17px] text-rotulo', espera.aguardando ? 'font-semibold text-observacao' : 'text-tinta-sussurro')}>
                {espera.texto}{!espera.aguardando && linha.primeiro_atendimento_por ? ` · ${linha.primeiro_atendimento_por}` : ''}
              </span>
            )}
          </div>
        </TableCell>

        <TableCell className="tabular-nums">
          <span className={cn(fim ? 'text-tinta-sussurro' : rel.acima ? 'font-semibold text-observacao' : 'text-tinta-apoio')}>{rel.permanencia}</span>
          <div className="text-rotulo text-tinta-sussurro">desde {hhmm(linha.entrada)}</div>
        </TableCell>

        <TableCell className="tabular-nums">
          {fim ? (
            <span className="flex items-center gap-1 text-rotulo text-tinta-sussurro"><Clock className="size-3" aria-hidden /> Encerrada às {hhmm(linha.finalizado_em)}</span>
          ) : (
            <>
              <span className={cn('flex items-center gap-1 font-semibold', TOM_TEXTO[rel.tom])}>
                <Clock className="size-3" aria-hidden /> {rel.contagem}
              </span>
              <div className={cn('text-rotulo', rel.acima ? 'text-observacao' : 'text-tinta-sussurro')}>
                {rel.acima ? 'Definir conduta ou internar' : `até ${hhmm(linha.prazo)}`}
              </div>
            </>
          )}
        </TableCell>

        <TableCell className="pr-5">
          <div className="flex flex-wrap justify-end gap-[7px]">
            {acoes.map((a) => (
              <Button key={a.rotulo} size="sm" variant={a.primaria ? 'default' : 'outline'} onClick={a.onClick}>{a.rotulo}</Button>
            ))}
            {!fim && (
              <Button size="sm" variant="outline" onClick={() => abrirPrancheta(linha)}><ClipboardList /> Prancheta</Button>
            )}
          </div>
        </TableCell>
      </TableRow>

      {painel && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="px-0 pt-0 pb-0 whitespace-normal">
            {erro && !aberto && <p className="mx-5 mb-3 text-apoio text-critico">{erro}</p>}
            {aberto === 'reav' && <PainelReavaliar linha={linha} acao={acao} fechar={fechar} erro={erro} />}
            {aberto === 'fim' && <PainelDesfecho linha={linha} unidadeId={unidadeId} acao={acao} fechar={fechar} erro={erro} />}
            {aberto === 'proto' && !pr && <PainelEscolherProtocolo linha={linha} faixa={faixa} acao={acao} fechar={fechar} erro={erro} />}
            {aberto === 'proto' && pr && <PainelProtocoloAberto key={pr.id} linha={linha} acao={acao} fechar={fechar} erro={erro} />}
            {aberto === 'passar' && <PainelPassar linha={linha} acao={acao} fechar={fechar} erro={erro} />}
            {ps && !fim && (ps.situacao !== 'aceita' || ps.de_perfil === eu || ps.para_perfil === eu) && <BlocoPassagemBox linha={linha} />}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

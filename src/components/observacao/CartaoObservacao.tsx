// ─────────────────────────────────────────────────────────────────────────────
// Um box da observação. Revisão da Observação aprovada pelo RT em 24/11/2026:
//
// OB1: uma linha por paciente, sem rolagem lateral — box; nome, idade, queixa,
// alergia e acuidade; a situação em palavras do plantão (Não atendido, Em
// conduta, Aguardando exame, Aguardando regulação); um tempo só ("há 5 h 20
// min", com a data quando passa de 24 h) com a barra das 6 horas.
// OB2: a ação principal conforme a situação (Atender se não atendido; atendido,
// Definir conduta); Regulação e o resto no menu "…".
// OB3: clicar na linha abre o paciente em tela inteira com as abas do leito.
// OO1: as ações abrem numa gaveta lateral, uma por vez, com o nome do
// paciente no topo, sem empurrar a lista; depois de "Atender" a linha mostra
// quem atendeu e quando.
// Toda regra continua no servidor (observacao_atender, observacao_reavaliar,
// finalizar_observacao…); as chamadas são as mesmas.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { loteAcuidade } from '@/lib/lotesPaciente'
import { cn } from '@/lib/utils'
import { faixaEtaria, rotuloIdade } from '@/domain/idade'
import { acaoPrincipal, situacaoObservacao, tempoNaObservacao } from '@/lib/observacaoLista'
import { SeloAlergia } from '@/components/paciente/AlergiasEventos'
import { AbaRegulacaoPaciente } from '@/components/regulacao/AbaRegulacaoPaciente'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca } from '@/components/ui/gaveta'
import { Estado } from '@/components/porta/Estado'
import { useUnidade } from '@/contexts/UnidadeContext'
import { MenuMais, type ItemMenu } from '@/components/plantao/MenuMais'
import { dataIso } from '@/lib/formato'

import {
  ROTULO_DESFECHO, TOM_BARRA, hhmm, msgErro, relogioPermanencia, rpc, textoReavaliacao,
  type Acao, type LinhaObservacao,
} from './modelo'
import {
  BlocoPassagemBox, Painel, PainelDesfecho, PainelEscolherProtocolo, PainelPassar, PainelProtocoloAberto, PainelReavaliar,
} from './PaineisCartao'

type Aberto = '' | 'reav' | 'fim' | 'proto' | 'passar' | 'reg'
const TITULO: Record<Exclude<Aberto, ''>, string> = {
  reav: 'Reavaliar às', fim: 'Definir conduta', proto: 'Protocolo', passar: 'Passar plantão', reg: 'Regulação',
}
const hoje = () => dataIso()
const BANDA = ['text-conforme', 'text-observacao', 'text-critico']

/** Acuidade calculada no servidor (NEWS2 no adulto, Bedside PEWS na criança): a mesma chave do leito. */
function Acuidade({ pacienteId }: { pacienteId: string }) {
  const q = useQuery({
    queryKey: ['acuidade', pacienteId],
    staleTime: 60_000,
    queryFn: async () => {
      // item 08 do kit de desempenho: um cartão por paciente, uma chamada para todos
      const data = await loteAcuidade.carregar(pacienteId)
      return data as { escala: string | null; motivo?: string; total?: number; banda?: number; parcial?: boolean; aferido_em?: string | null }
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

export function CartaoObservacao({ linha, agora, eu, unidadeId, podeAgir, ehMedico, examePendente = false, onAbrirPaciente }: {
  linha: LinhaObservacao
  agora: number
  eu?: string
  unidadeId: string
  /** plantonista de escala no setor: o gestor só acompanha */
  podeAgir: boolean
  /** atender, reavaliar, finalizar e abrir protocolo são do médico */
  ehMedico: boolean
  /** exame do paciente aguardando resultado (OB1: "Aguardando exame") */
  examePendente?: boolean
  /** OB3: abre o paciente em tela inteira, com as abas do leito */
  onAbrirPaciente: (l: LinhaObservacao) => void
}) {
  const qc = useQueryClient()
  const { papelAtivo } = useUnidade()
  // a regulação do paciente: médico e gestor (o NIR a vê na Internação dele)
  const veRegulacao = papelAtivo === 'plantonista' || papelAtivo === 'gestor'
  const [aberto, setAberto] = React.useState<Aberto>('')
  const [erro, setErro] = React.useState<string | null>(null)
  const abrir = (qual: Aberto) => { setErro(null); setAberto(qual) }
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

  const fim = linha.estado === 'finalizado'
  const sit = situacaoObservacao(linha.estado, { examePendente, encaminhado: !!linha.encaminhado })
  // pela idade; sem data de nascimento é 'desconhecida', nunca adulto (decisão do RT, 02/10/2026)
  const faixa = faixaEtaria(linha.data_nascimento, hoje())
  const idade = linha.data_nascimento ? rotuloIdade(linha.data_nascimento, hoje()) : null
  const ate = fim && linha.finalizado_em ? Date.parse(linha.finalizado_em) : agora
  const rel = relogioPermanencia(linha.entrada, linha.prazo, ate)
  const tempo = tempoNaObservacao(linha.entrada, ate)
  const reav = linha.estado === 'reavaliacao' && linha.reavaliar_em ? textoReavaliacao(linha.reavaliar_em, agora) : null
  const pr = linha.protocolo
  const ps = linha.passagem
  const aguardandoPassagem = ps?.situacao === 'aguardando'

  // OB2: um botão na linha conforme a situação; o resto no menu "…"
  const principal = podeAgir && ehMedico ? acaoPrincipal(linha.estado) : null
  const atender = () => void acao(() => rpc('observacao_atender', { p_internacao: linha.internacao_id }))
  const menu: ItemMenu[] = []
  if (podeAgir && !fim) {
    if (ehMedico && (linha.estado === 'atendimento' || linha.estado === 'encaminhado')) menu.push({ chave: 'reav', rotulo: 'Reavaliar às…', onSelecionar: () => abrir('reav') })
    if (ehMedico && linha.estado === 'reavaliacao') {
      menu.push({ chave: 'reavaliado', rotulo: 'Reavaliado', onSelecionar: () => void acao(() => rpc('observacao_reavaliado', { p_internacao: linha.internacao_id })) })
      menu.push({ chave: 'reav', rotulo: 'Mudar a hora da reavaliação', onSelecionar: () => abrir('reav') })
    }
    if (ehMedico && linha.estado === 'nao') menu.push({ chave: 'fim', rotulo: 'Definir conduta', onSelecionar: () => abrir('fim') })
    if (ehMedico || pr) menu.push({ chave: 'proto', rotulo: pr ? `Protocolo ${pr.sigla}` : 'Protocolo', onSelecionar: () => abrir('proto') })
    if (!aguardandoPassagem) menu.push({ chave: 'passar', rotulo: ps?.situacao === 'recusada' ? 'Reenviar passagem' : 'Passar plantão', onSelecionar: () => abrir('passar') })
  }
  if (veRegulacao) menu.push({ chave: 'reg', rotulo: 'Regulação', onSelecionar: () => abrir('reg') })
  menu.push({ chave: 'abrir', rotulo: 'Abrir o paciente', onSelecionar: () => onAbrirPaciente(linha) })

  const mostraPassagem = !!ps && !fim && (ps.situacao !== 'aceita' || ps.de_perfil === eu || ps.para_perfil === eu)
  // os botões da linha não abrem o paciente
  const parar = (e: React.SyntheticEvent) => e.stopPropagation()

  return (
    <div className="border-b border-trilha last:border-b-0">
      <div onClick={() => onAbrirPaciente(linha)}
        className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-campo">
        <span className="w-[64px] shrink-0 text-apoio font-semibold text-acao">{linha.box ?? 'Sem box'}</span>

        <div className="flex min-w-0 flex-[2_1_220px] flex-col gap-0.5">
          <Button variant="link" className="min-h-0 justify-start self-start px-0 py-0 text-corpo font-medium text-tinta"
            onClick={(e) => { parar(e); onAbrirPaciente(linha) }}>
            {linha.nome} {idade && <span className="text-apoio font-normal text-tinta-sussurro">{idade}</span>}
          </Button>
          {linha.queixa && <span className="text-apoio text-tinta-sussurro">{linha.queixa}</span>}
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1" onClick={parar}>
            <SeloAlergia pacienteId={linha.paciente_id} />
            {!fim && <Acuidade pacienteId={linha.paciente_id} />}
          </span>
        </div>

        <div className="flex min-w-0 flex-[1_1_200px] flex-col items-start gap-0.5">
          <Estado tom={sit.tom}>{sit.rotulo}</Estado>
          {fim && linha.desfecho && <span className="pl-[17px] text-rotulo text-tinta-apoio">{ROTULO_DESFECHO[linha.desfecho] ?? linha.desfecho} às {hhmm(linha.finalizado_em)}</span>}
          {/* OO1: depois de "Atender", quem atendeu e quando */}
          {!fim && linha.primeiro_atendimento_em && (
            <span className="pl-[17px] text-rotulo text-tinta-apoio">Atendido{linha.primeiro_atendimento_por ? ` por ${linha.primeiro_atendimento_por}` : ''} às {hhmm(linha.primeiro_atendimento_em)}</span>
          )}
          {reav && <span className={cn('pl-[17px] text-rotulo font-semibold', reav.atrasada ? 'text-critico' : 'text-atencao')}>{reav.texto}</span>}
          {pr && (
            <span className="pl-[17px] text-rotulo text-tinta-apoio" title={pr.nome}>
              <span className="font-semibold text-suprimento">{pr.sigla}</span> · etapa {pr.etapa_atual + 1} de {pr.etapas.length} · {pr.etapas[pr.etapa_atual]?.texto}
            </span>
          )}
        </div>

        {/* OB1: um tempo só, com a barra das 6 horas */}
        <div className="flex w-[150px] shrink-0 flex-col gap-1 tabular-nums">
          <span className={cn('text-apoio', fim ? 'text-tinta-sussurro' : rel.acima ? 'font-semibold text-critico' : 'text-tinta-apoio')}>{tempo.ha}</span>
          {!fim && (
            <div role="meter" aria-label="Prazo de 6 horas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rel.pct}
              title={rel.contagem} className="h-1.5 w-full overflow-hidden rounded-capsula bg-trilha">
              <div className={cn('h-full rounded-capsula', TOM_BARRA[rel.tom])} style={{ width: `${rel.pct}%` }} />
            </div>
          )}
          <span className="text-rotulo text-tinta-sussurro">{fim ? `encerrada às ${hhmm(linha.finalizado_em)}` : tempo.desde}</span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-[7px]" onClick={parar}>
          {principal === 'atender' && <Button size="sm" onClick={atender}>Atender</Button>}
          {principal === 'conduta' && <Button size="sm" onClick={() => abrir('fim')}>Definir conduta</Button>}
          <MenuMais icone rotuloAcessivel={`Mais ações para ${linha.nome}`} itens={menu} />
        </div>
      </div>

      {(mostraPassagem || (erro && !aberto)) && (
        <div className="pb-1">
          {erro && !aberto && <p className="mx-5 mb-3 text-apoio text-critico">{erro}</p>}
          {mostraPassagem && <BlocoPassagemBox linha={linha} />}
        </div>
      )}

      {/* OO1: uma ação por vez, numa gaveta lateral com o nome do paciente no topo */}
      <Gaveta aberta={!!aberto} onAbertaChange={(v) => { if (!v) fechar() }} rotulo={`${aberto ? TITULO[aberto] : ''} · ${linha.nome}`}
        className={aberto === 'fim' || aberto === 'reg' ? 'max-w-[680px]' : undefined}>
        {aberto && <GavetaCabeca sobre={TITULO[aberto]} titulo={linha.nome} detalhe={[linha.box, linha.queixa].filter(Boolean).join(' · ')} />}
        <div className="flex flex-col gap-2 py-3">
          {aberto === 'reav' && <PainelReavaliar linha={linha} acao={acao} fechar={fechar} erro={erro} />}
          {aberto === 'fim' && <PainelDesfecho linha={linha} unidadeId={unidadeId} acao={acao} fechar={fechar} erro={erro} irRegulacao={() => abrir('reg')} />}
          {aberto === 'proto' && !pr && <PainelEscolherProtocolo linha={linha} faixa={faixa} acao={acao} fechar={fechar} erro={erro} />}
          {aberto === 'proto' && pr && <PainelProtocoloAberto key={pr.id} linha={linha} acao={acao} fechar={fechar} erro={erro} />}
          {aberto === 'passar' && <PainelPassar linha={linha} acao={acao} fechar={fechar} erro={erro} />}
          {aberto === 'reg' && <Painel><AbaRegulacaoPaciente pacienteId={linha.paciente_id} unidadeId={unidadeId} /></Painel>}
        </div>
      </Gaveta>
    </div>
  )
}

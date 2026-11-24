// ─────────────────────────────────────────────────────────────────────────────
// Internação da enfermagem (protótipo "enf-int", P/index.html 8168–8203).
//
// Os setores de internação em que a pessoa está escalada agora (a porta e a
// observação ficam no Pronto Socorro da enfermagem, TE3). Revisão do perfil
// Enfermeiro (RT 24/11/2026): IN1, cada setor leito a leito, na ordem do
// leito, com todos os estados juntos; IN2, a passagem do plantão no topo do
// setor; IN3, a faixa do que está atrasado (com Fugulin ou Dini pendente) e
// uma pendência principal por linha; o resto abre em Cuidados.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Ambulance, Users } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { sairamAgora } from '@/lib/chegadaEnfermagem'
import { useAvisosFlutuantes } from '@/contexts/AvisosFlutuantesContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina } from '@/components/monitor/Pagina'
import { tem, type ChavePendencia } from '@/lib/pendenciasEnfermagem'

import { ChegadaReservada, type ChegadaEnfermagem } from './ChegadaReservada'
import { GavetaCuidados, type PacienteEmCuidado } from './GavetaCuidados'
import { PassagemEnfermagem } from './PassagemEnfermagem'
import { LinhaLeito } from './LeitosParaLiberar'
import { ObitosPendentes } from '@/components/obito/ObitosPendentes'
import { Bloco, FaixaPendencias, LinhaPaciente, VazioForaDaEscala } from './Pecas'
import { duracao, ehAdulto, idadeDe, leitoSemPaciente, useAgora, usePendenciasPorPaciente, useSetoresComTipo, useSituacaoLeitos, type LeitoEnfermagem } from './useEnfermagem'
import { erroDeLeitura } from '@/lib/offline/erroDeLeitura'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'

const CHAVES: ChavePendencia[] = ['vencida', 'atrasada', 'contencao', 'vencendo', 'escala']

export default function InternacaoEnfermagem() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const agora = useAgora(60_000)
  const [cuidando, setCuidando] = React.useState<PacienteEmCuidado | null>(null)
  const [filtro, setFiltro] = React.useState<ChavePendencia | null>(null)
  const [erroLeito, setErroLeito] = React.useState<string | null>(null)

  const comTipo = useSetoresComTipo()
  const setoresInt = comTipo.internacao
  const pendenciasDe = usePendenciasPorPaciente(agora)
  const situacao = useSituacaoLeitos(unidadeId, setoresInt.length > 0)

  const leitos = useQuery({
    queryKey: ['enfermagem-leitos', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('enfermagem_leitos', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as LeitoEnfermagem[]
    },
  })

  // Fugulin de hoje por internação (Fase 2, tarefa 5): nulo = pendente
  const idsInternacao = (leitos.data ?? []).map((l) => l.internacao_id)
  const fugulin = useQuery({
    queryKey: ['fugulin-hoje', idsInternacao.join(',')],
    enabled: idsInternacao.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fugulin_de_hoje', { p_internacoes: idsInternacao })
      if (error) throw error
      return (data ?? {}) as unknown as Record<string, { total: number; categoria: string } | null>
    },
  })
  // Dini de hoje (classificação pediátrica, A em D1 a D7): só das crianças
  const idsCriancas = (leitos.data ?? []).filter((l) => ehAdulto(l.data_nascimento) === false).map((l) => l.internacao_id)
  const dini = useQuery({
    queryKey: ['dini-hoje', idsCriancas.join(',')],
    enabled: idsCriancas.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dini_de_hoje', { p_internacoes: idsCriancas })
      if (error) throw error
      return (data ?? {}) as unknown as Record<string, { total: number; categoria: string } | null>
    },
  })

  // Chegada regulada (item 16 do teste da rede, opção B): o leito reservado
  // aparece na lista do setor, com quem chega e "Paciente chegou".
  const chegadas = useQuery({
    queryKey: ['enfermagem-chegadas', unidadeId],
    enabled: !!unidadeId && setoresInt.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('enfermagem_chegadas', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as ChegadaEnfermagem[]
    },
  })
  // o aviso de saída: quem passou a "em trânsito" desde a leitura anterior
  const { avisar } = useAvisosFlutuantes()
  const leituraAnterior = React.useRef<ChegadaEnfermagem[] | undefined>(undefined)
  React.useEffect(() => {
    if (!chegadas.data) return
    const sairam = sairamAgora(leituraAnterior.current, chegadas.data)
    leituraAnterior.current = chegadas.data
    if (sairam.length > 0) {
      avisar(sairam.map((c) => ({
        tag: 'Chegada regulada', icone: Ambulance, quando: 'agora',
        titulo: `${c.nome} saiu da ${c.origem}`,
        texto: `Vem para o leito ${c.leito} (regulação nº ${c.numero}).`,
      })))
    }
  }, [chegadas.data, avisar])
  const atualizarTudo = () => { void chegadas.refetch(); void leitos.refetch() }

  // IN1: cada setor de internação da escala, leito a leito na ordem do leito,
  // com todos os estados no mesmo lugar (ocupado, reservado com a chegada,
  // livre, em higienização, bloqueado); paciente sem leito vai ao fim do setor
  const setoresIds = new Set(setoresInt.map((s) => s.id))
  const ocupados = (leitos.data ?? []).filter((l) => setoresIds.has(l.setor_id))
  const escalaPendente = (l: LeitoEnfermagem): 'Fugulin' | 'Dini' | null => {
    if (ehAdulto(l.data_nascimento) === false) return dini.data && !dini.data[l.internacao_id] ? 'Dini' : null
    return fugulin.data && !fugulin.data[l.internacao_id] ? 'Fugulin' : null
  }
  const pendenciasDoLeito = (l: LeitoEnfermagem) => pendenciasDe(l.paciente_id, { atrasados: l.aprazamentos_atrasados, escala: escalaPendente(l) })
  const passa = (l: LeitoEnfermagem) => !filtro || tem(pendenciasDoLeito(l), filtro)

  const porSetor = setoresInt.map((s) => {
    const camas = (situacao.data ?? []).filter((b) => b.setor_id === s.id)
    const pacientes = ocupados.filter((l) => l.setor_id === s.id)
    const esperadas = (chegadas.data ?? []).filter((c) => c.setor_id === s.id)
    type Linha = { chave: string; ordem: string; el: React.ReactNode }
    const linhas: Linha[] = []
    const usados = new Set<string>()
    for (const b of camas) {
      const p = pacientes.find((l) => l.leito === b.identificador)
      const ch = esperadas.find((c) => c.leito_id === b.leito_id)
      if (p) { usados.add(p.internacao_id); if (passa(p)) linhas.push({ chave: p.internacao_id, ordem: b.identificador, el: linhaPaciente(p) }) }
      else if (ch) { if (!filtro) linhas.push({ chave: ch.regulacao_id, ordem: b.identificador, el: <ChegadaReservada key={ch.regulacao_id} c={ch} agora={agora} aoFim={atualizarTudo} /> }) }
      else if (!filtro && leitoSemPaciente(b)) linhas.push({ chave: b.leito_id, ordem: b.identificador, el: <LinhaLeito key={b.leito_id} l={b} unidadeId={unidadeId} onErro={setErroLeito} /> })
    }
    const semLeito = pacientes.filter((l) => !usados.has(l.internacao_id) && passa(l))
    linhas.sort((a, b) => a.ordem.localeCompare(b.ordem, 'pt-BR', { numeric: true }))
    for (const l of semLeito) linhas.push({ chave: l.internacao_id, ordem: l.leito ?? '', el: linhaPaciente(l) })
    for (const c of esperadas) if (!filtro && !camas.some((b) => b.leito_id === c.leito_id)) linhas.push({ chave: c.regulacao_id, ordem: c.leito, el: <ChegadaReservada key={c.regulacao_id} c={c} agora={agora} aoFim={atualizarTudo} /> })
    const livres = camas.filter((b) => b.status === 'livre').length
    return { setor: s, linhas, ocupados: pacientes.length, livres }
  })

  function linhaPaciente(l: LeitoEnfermagem) {
    return (
      <LinhaPaciente key={l.internacao_id} comCor={false} local={l.leito} nome={l.nome} idade={idadeDe(l.data_nascimento)}
        texto={l.cid_principal ? `CID ${l.cid_principal}` : l.queixa ?? ''} pendencias={pendenciasDoLeito(l)}
        tempo={`há ${duracao(l.data_admissao, agora)}`}
        onCuidados={() => setCuidando({
          pacienteId: l.paciente_id, episodioId: l.episodio_id, internacaoId: l.internacao_id, nome: l.nome,
          local: l.leito ? `Leito ${l.leito}` : l.setor_nome, setorId: l.setor_id,
          contexto: l.cid_principal ? `CID ${l.cid_principal}` : l.queixa, desde: l.data_admissao, rotuloDesde: 'internado há',
        })} />
    )
  }

  const carregando = comTipo.carregando || leitos.isLoading || situacao.isLoading
  const erro = comTipo.erro ?? leitos.error ?? situacao.error

  return (
    <div className="mx-auto w-full max-w-[896px]">
      <TituloPagina icone={Users} titulo="Internação · enfermagem" descricao="Os setores de internação da sua escala, leito a leito." />
      {erroDeLeitura(erro, !!leitos.data) && <p className="mb-3 text-apoio text-critico">{erroDeLeitura(erro, !!leitos.data)}</p>}

      {!carregando && !erro && !comTipo.naEscala ? (
        <VazioForaDaEscala onde="os leitos" />
      ) : (
        <div className="flex flex-col gap-4">
          {!carregando && <FaixaPendencias lista={ocupados.map(pendenciasDoLeito)} chaves={CHAVES} filtro={filtro} onFiltro={setFiltro} />}
          {erroLeito && <p role="alert" className="text-apoio text-critico">{erroLeito}</p>}
          {carregando && <EsqueletoLinhas linhas={4} rotulo="Carregando os leitos…" />}
          {!carregando && setoresInt.length === 0 && (
            <p className="text-apoio text-tinta-sussurro">
              Sua escala agora não tem setor de internação. A porta e a observação estão no <Link to="/enfermagem/pronto-socorro" className="text-acao hover:underline">Pronto-Socorro</Link>.
            </p>
          )}
          {porSetor.map(({ setor, linhas, ocupados: n, livres }) => (
            <Bloco key={setor.id} titulo={setor.nome} extra={`${n} ${n === 1 ? 'ocupado' : 'ocupados'} · ${livres} ${livres === 1 ? 'livre' : 'livres'}`}>
              {/* IN2: a passagem do plantão no topo do setor */}
              <PassagemEnfermagem setor={setor} />
              {linhas.length === 0 && (
                <p className="px-5 py-4 text-apoio text-tinta-sussurro">{filtro ? 'Nenhum leito com essa pendência.' : 'Nenhum leito cadastrado neste setor.'}</p>
              )}
              {linhas.map((x) => <React.Fragment key={x.chave}>{x.el}</React.Fragment>)}
            </Bloco>
          ))}
          {/* lacuna 5 (O7): óbitos com comunicação, corpo ou vias por fazer */}
          <ObitosPendentes unidadeId={unidadeId} />
        </div>
      )}
      <GavetaCuidados paciente={cuidando} onFechar={() => setCuidando(null)} />
    </div>
  )
}

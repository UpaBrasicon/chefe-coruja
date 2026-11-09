// ─────────────────────────────────────────────────────────────────────────────
// Internação da enfermagem (protótipo "enf-int", P/index.html 8168–8203).
//
// A lista por leito dos setores em que a pessoa está escalada agora (fora a
// observação, que fica no Pronto Socorro da enfermagem), com as pendências de
// enfermagem de cada leito (aprazamentos atrasados, do servidor) e o botão
// "Cuidados", que abre o painel de cuidados numa gaveta. Embaixo, a passagem
// de plantão da enfermagem do setor.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { Ambulance, Users } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { sairamAgora } from '@/lib/chegadaEnfermagem'
import { useAvisosFlutuantes } from '@/contexts/AvisosFlutuantesContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'

import { ChegadaReservada, type ChegadaEnfermagem } from './ChegadaReservada'
import { GavetaCuidados, type PacienteEmCuidado } from './GavetaCuidados'
import { PassagemEnfermagem } from './PassagemEnfermagem'
import { LeitosParaLiberar } from './LeitosParaLiberar'
import { Bloco, BotaoCuidados, PilulaAtraso } from './Pecas'
import { duracao, ehAdulto, idadeDe, useAgora, useSetoresDaEscala, type LeitoEnfermagem } from './useEnfermagem'
import { erroDeLeitura } from '@/lib/offline/erroDeLeitura'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'

export default function InternacaoEnfermagem() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const agora = useAgora(60_000)
  const [cuidando, setCuidando] = React.useState<PacienteEmCuidado | null>(null)

  const setores = useSetoresDaEscala()
  const meusSetores = setores.data ?? []
  const nomesSetores = useQuery({
    queryKey: ['setores-nomes', meusSetores],
    enabled: meusSetores.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('setores').select('id, nome').in('id', meusSetores).order('nome')
      if (error) throw error
      return data ?? []
    },
  })

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
    enabled: !!unidadeId && meusSetores.length > 0,
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

  // por setor, na ordem que vem do servidor (setor, leito); o setor com só uma
  // chegada esperada também aparece
  const porSetor = new Map<string, { leitos: LeitoEnfermagem[]; chegadas: ChegadaEnfermagem[] }>()
  const doSetor = (nome: string) => porSetor.get(nome) ?? porSetor.set(nome, { leitos: [], chegadas: [] }).get(nome)!
  for (const l of leitos.data ?? []) doSetor(l.setor_nome).leitos.push(l)
  for (const c of chegadas.data ?? []) doSetor(c.setor_nome).chegadas.push(c)

  const carregando = setores.isLoading || leitos.isLoading
  const erro = setores.error ?? leitos.error

  return (
    <div className="mx-auto w-full max-w-[896px]">
      <TituloPagina icone={Users} titulo="Internação · enfermagem"
        descricao={`Leitos dos setores da sua escala. Em Cuidados ficam SAE, aprazamento, checagem, sinais vitais, balanço hídrico, dispositivos e escalas.${papelAtivo === 'tecnico_enfermagem' ? ' Como técnico, você checa, afere e registra; a SAE é do enfermeiro.' : ''}`} />
      {erroDeLeitura(erro, !!leitos.data) && <p className="mb-3 text-apoio text-critico">{erroDeLeitura(erro, !!leitos.data)}</p>}

      {!carregando && !erro && meusSetores.length === 0 ? (
        <Vazio icone={Users} titulo="Você não está na escala agora"
          texto="A internação da enfermagem mostra os leitos dos setores em que você está de plantão neste momento." />
      ) : (
        <div className="flex flex-col gap-[18px]">
          {carregando && <EsqueletoLinhas linhas={4} rotulo="Carregando os leitos…" />}
          {!carregando && porSetor.size === 0 && (
            <Vazio icone={Users} titulo="Nenhum paciente internado nos setores da sua escala"
              texto="Quem está na observação aparece no Pronto-Socorro da enfermagem." />
          )}
          {[...porSetor.entries()].map(([nomeSetor, { leitos: lista, chegadas: esperadas }]) => (
            <Bloco key={nomeSetor} titulo={nomeSetor}>
              {esperadas.map((c) => <ChegadaReservada key={c.regulacao_id} c={c} agora={agora} aoFim={atualizarTudo} />)}
              {lista.map((l) => {
                const linha = [l.cid_principal ? `CID ${l.cid_principal}` : l.queixa, `internado há ${duracao(l.data_admissao, agora)}`].filter(Boolean).join(' · ')
                return (
                  <div key={l.internacao_id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0">
                    <span className="w-11 shrink-0 text-apoio font-semibold text-acao">{l.leito ?? '—'}</span>
                    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                      <span className="text-corpo font-medium text-tinta">{l.nome} <span className="text-apoio font-normal text-tinta-sussurro">{idadeDe(l.data_nascimento)}</span></span>
                      <span className="text-apoio text-tinta-sussurro [text-wrap:pretty]">{linha}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <PilulaAtraso n={l.aprazamentos_atrasados} />
                      {fugulin.data && ehAdulto(l.data_nascimento) !== false && (
                        fugulin.data[l.internacao_id]
                          ? <span className="rounded-capsula bg-trilha px-2 py-0.5 text-rotulo text-tinta-apoio" title={fugulin.data[l.internacao_id]!.categoria}>Fugulin {fugulin.data[l.internacao_id]!.total}</span>
                          : <span className="rounded-capsula bg-atencao/10 px-2 py-0.5 text-rotulo text-atencao">Fugulin de hoje pendente</span>
                      )}
                      {dini.data && ehAdulto(l.data_nascimento) === false && (
                        dini.data[l.internacao_id]
                          ? <span className="rounded-capsula bg-trilha px-2 py-0.5 text-rotulo text-tinta-apoio" title={dini.data[l.internacao_id]!.categoria}>Dini {dini.data[l.internacao_id]!.total}</span>
                          : <span className="rounded-capsula bg-atencao/10 px-2 py-0.5 text-rotulo text-atencao">Dini de hoje pendente</span>
                      )}
                    </div>
                    <BotaoCuidados onClick={() => setCuidando({
                      pacienteId: l.paciente_id, episodioId: l.episodio_id, internacaoId: l.internacao_id, nome: l.nome,
                      local: l.leito ? `Leito ${l.leito}` : l.setor_nome, setorId: l.setor_id,
                      contexto: l.cid_principal ? `CID ${l.cid_principal}` : l.queixa, desde: l.data_admissao, rotuloDesde: 'internado há',
                    })} />
                  </div>
                )
              })}
            </Bloco>
          ))}
          <LeitosParaLiberar unidadeId={unidadeId} setores={meusSetores} />
          <PassagemEnfermagem setores={nomesSetores.data ?? []} />
        </div>
      )}
      <GavetaCuidados paciente={cuidando} onFechar={() => setCuidando(null)} />
    </div>
  )
}

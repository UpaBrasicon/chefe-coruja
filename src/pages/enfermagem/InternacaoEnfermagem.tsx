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
import { Users } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'

import { GavetaCuidados, type PacienteEmCuidado } from './GavetaCuidados'
import { PassagemEnfermagem } from './PassagemEnfermagem'
import { LeitosParaLiberar } from './LeitosParaLiberar'
import { Bloco, BotaoCuidados, PilulaAtraso } from './Pecas'
import { duracao, ehAdulto, idadeDe, msgErro, useAgora, useSetoresDaEscala, type LeitoEnfermagem } from './useEnfermagem'

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

  // por setor, na ordem que vem do servidor (setor, leito)
  const porSetor = new Map<string, LeitoEnfermagem[]>()
  for (const l of leitos.data ?? []) porSetor.set(l.setor_nome, [...(porSetor.get(l.setor_nome) ?? []), l])

  const carregando = setores.isLoading || leitos.isLoading
  const erro = setores.error ?? leitos.error

  return (
    <div className="mx-auto w-full max-w-[896px]">
      <TituloPagina icone={Users} titulo="Internação · enfermagem"
        descricao={`Leitos dos setores da sua escala. Em Cuidados ficam SAE, aprazamento, checagem, sinais vitais, balanço hídrico, dispositivos e escalas.${papelAtivo === 'tecnico_enfermagem' ? ' Como técnico, você checa, afere e registra; a SAE é do enfermeiro.' : ''}`} />
      {erro && <p className="mb-3 text-apoio text-critico">{msgErro(erro)}</p>}

      {!carregando && !erro && meusSetores.length === 0 ? (
        <Vazio icone={Users} titulo="Você não está na escala agora"
          texto="A internação da enfermagem mostra os leitos dos setores em que você está de plantão neste momento." />
      ) : (
        <div className="flex flex-col gap-[18px]">
          {carregando && <div className="flex justify-center py-6"><Spinner /></div>}
          {!carregando && porSetor.size === 0 && (
            <Vazio icone={Users} titulo="Nenhum paciente internado nos setores da sua escala"
              texto="Quem está na observação aparece no Pronto Socorro da enfermagem." />
          )}
          {[...porSetor.entries()].map(([nomeSetor, lista]) => (
            <Bloco key={nomeSetor} titulo={nomeSetor}>
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

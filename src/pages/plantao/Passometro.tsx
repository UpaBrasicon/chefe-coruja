import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BedDouble, ChevronDown, ChevronRight, ClipboardList, Printer } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { dataIso, hora } from '@/lib/formato'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import {
  contagemPendencias, diasDesde, htmlFolha, motivoVazio, ordenarPorUrgencia, porSetor, resumoPassometro,
  type MotivoVazio, type PacientePassometro,
} from '@/domain/passometro'
import { CHAVE_PASSOMETRO, usePassometro } from '@/hooks/usePassometro'
import type { SituacaoCheckin } from '@/hooks/usePlantao'
import { ProximoPlantao } from '@/components/casca/ProximoPlantao'
import { Chip, TituloPagina, TituloSecao, Trilha, Vazio, VazioLinha } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { EsqueletoLinhas } from '@/components/ui/esqueleto-linhas'
import { BlocoPendencias } from '@/components/internacao/caderno/Pendencias'
import { type Acao, msg } from '@/components/internacao/caderno/comum'

// Passômetro do médico (pedido 8; PS1 a PS3 = A do RT em 23/11/2026,
// docs/plantonista/PASSOMETRO-DIAGNOSTICO.md): os pacientes da observação e
// da internação dos setores da escala agora, cada um com as pendências do
// leito (as mesmas de public.pendencias). Ninguém digita nome de paciente.
// Revisão de tela (RT 24/11/2026, M1 a M3): vazio com o motivo e a ação, uma
// linha por paciente que abre as pendências, setores que recolhem, vencidas
// primeiro, filtro "Só com pendência" e faixa de resumo no topo.

const STATUS: Record<string, string> = { em_observacao: 'Observação', internado: 'Internado', admitido: 'Admitido' }

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function Paciente({ p, eu, acao, agora, aberto, alternar }: {
  p: PacientePassometro; eu?: string; acao: Acao; agora: number; aberto: boolean; alternar: () => void
}) {
  const dias = diasDesde(p.desde, agora)
  const c = contagemPendencias(p, agora)
  const idBloco = `pend-${p.internacao_id}`
  return (
    <li className="border-b border-trilha last:border-0">
      <BotaoLinha
        variante="linha"
        onClick={alternar}
        aria-expanded={aberto}
        aria-controls={idBloco}
        className="flex-wrap items-baseline gap-x-3 gap-y-0.5 border-0 px-3 py-2.5"
      >
        {aberto
          ? <ChevronDown className="size-4 shrink-0 self-center text-tinta-sussurro" aria-hidden />
          : <ChevronRight className="size-4 shrink-0 self-center text-tinta-sussurro" aria-hidden />}
        <span className="inline-flex w-20 shrink-0 items-center gap-1.5 text-rotulo font-semibold text-tinta-apoio">
          <BedDouble className="size-4" aria-hidden />{p.leito ?? 'Sem leito'}
        </span>
        <span className="min-w-0 text-corpo font-semibold text-tinta">{p.nome}</span>
        <span className="text-apoio text-tinta-sussurro">
          {[
            p.data_nascimento ? rotuloIdade(p.data_nascimento, dataIso()) : null,
            STATUS[p.status] ?? p.status,
            dias === null ? null : dias === 0 ? 'desde hoje' : plural(dias, 'dia', 'dias'),
          ].filter(Boolean).join(' · ')}
        </span>
        <span className="ml-auto text-apoio tabular">
          {c.abertas === 0 ? (
            <span className="text-tinta-sussurro">sem pendência</span>
          ) : (
            <>
              <span className="text-tinta-apoio">{plural(c.abertas, 'aberta', 'abertas')}</span>
              {c.vencidas > 0 && <span className="font-semibold text-critico"> · {plural(c.vencidas, 'vencida', 'vencidas')}</span>}
            </>
          )}
        </span>
      </BotaoLinha>
      {aberto && (
        <div id={idBloco} className="flex flex-col gap-2 px-3 pt-1 pb-4">
          <p className="text-apoio text-tinta-sussurro">
            {p.cid_principal ? `CID ${p.cid_principal}` : p.queixa}
            {(p.cid_principal || p.queixa) && ' · '}
            <Link to={`/prontuarios/${p.paciente_id}`} className="font-medium text-acao hover:underline">Abrir prontuário</Link>
          </p>
          <BlocoPendencias internacaoId={p.internacao_id} ativa lista={p.pendencias} eu={eu} acao={acao} />
        </div>
      )}
    </li>
  )
}

/** Vazio que diz o motivo exato e oferece o próximo passo (M1). */
function VazioPassometro({ motivo, situacao }: { motivo: MotivoVazio; situacao: SituacaoCheckin | null }) {
  if (motivo === 'sem_checkin') {
    const p = situacao?.pendente
    return (
      <div className="flex flex-col gap-3">
        <Vazio icone={ClipboardList} titulo="Falta o check-in do plantão"
          texto={p
            ? `Você está na escala de ${p.setor_nome}, ${hora(p.inicio)} às ${hora(p.fim)}. Depois do check-in, os pacientes do setor aparecem aqui.`
            : 'Você está na escala agora. Depois do check-in, os pacientes do setor aparecem aqui.'} />
        <div className="flex justify-center">
          <Button render={<Link to="/plantao/check-in" />} nativeButton={false}>Fazer check-in</Button>
        </div>
      </div>
    )
  }
  if (motivo === 'sem_pacientes') {
    return (
      <Vazio icone={ClipboardList} titulo="Nenhum paciente nos setores do seu plantão"
        texto="Não há ninguém em observação ou internado agora nos setores em que você está na escala. Quando alguém entrar, aparece aqui." />
    )
  }
  const titulo = motivo === 'checkout' ? 'Você já fez o check-out deste plantão'
    : motivo === 'sem_escala' ? 'Você não está na escala agora'
      : 'Nenhum paciente no seu plantão'
  return (
    <div className="flex flex-col gap-4">
      <Vazio icone={ClipboardList} titulo={titulo}
        texto="O passômetro mostra a observação e a internação dos setores em que você está na escala agora, com o check-in feito." />
      <ProximoPlantao />
    </div>
  )
}

export default function Passometro() {
  const { perfil } = useAuth()
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const lista = usePassometro(unidadeId)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [agora, setAgora] = React.useState(() => Date.now())
  const [soComPendencia, setSoComPendencia] = React.useState(false)
  const [abertos, setAbertos] = React.useState<Set<string>>(() => new Set())
  const [recolhidos, setRecolhidos] = React.useState<Set<string>>(() => new Set())
  React.useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const alternar = (set: React.Dispatch<React.SetStateAction<Set<string>>>, k: string) =>
    set((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const acao: Acao = <T,>(fn: () => Promise<T>, ok?: string) =>
    fn()
      .then((r) => {
        setErro(null)
        setAviso(ok ?? null)
        for (const k of [CHAVE_PASSOMETRO, 'pendencias', 'pendencias-lista']) void qc.invalidateQueries({ queryKey: [k] })
        return r
      })
      .catch((e) => {
        setAviso(null)
        setErro(msg(e))
        return null
      })

  const pacientes = lista.data ?? []
  const vazio = !!lista.data && pacientes.length === 0

  // M1: só quando a lista vem vazia, pergunta ao servidor por quê (escala, check-in, check-out)
  const situacao = useQuery({
    queryKey: ['passometro-situacao-checkin', unidadeId],
    enabled: !!unidadeId && vazio,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('situacao_checkin', { p_unidade: unidadeId! })
      if (error) throw error
      return { ...(data as object), recebidoEm: Date.now() } as SituacaoCheckin
    },
  })

  // PS3 = A: a folha só abre depois de gravar a impressão no registro de acesso
  const [imprimindo, setImprimindo] = React.useState(false)
  async function imprimir() {
    if (!unidadeId) return
    // a janela abre já no clique (o navegador bloqueia a que abre depois de esperar o servidor)
    const janela = window.open('', '_blank')
    if (!janela) { setErro('O navegador bloqueou a janela de impressão. Permita janelas deste site e tente de novo.'); return }
    setImprimindo(true)
    try {
      const { data, error } = await supabase.rpc('registrar_impressao_passometro', { p_unidade: unidadeId })
      if (error) throw error
      const emitidoEm = String((data as { emitido_em?: string } | null)?.emitido_em ?? new Date().toISOString())
      janela.document.write(htmlFolha(pacientes, {
        unidade: unidadeAtiva?.unidade.nome ?? '', medico: perfil?.nome_completo ?? '', emitidoEm,
        idade: (n) => rotuloIdade(n, dataIso()),
      }))
      janela.document.close()
      janela.focus()
      setTimeout(() => janela.print(), 300)
      setErro(null)
    } catch (e) {
      janela.close()
      setErro(msg(e))
    } finally {
      setImprimindo(false)
    }
  }

  const resumo = resumoPassometro(pacientes, agora)
  const grupos = porSetor(pacientes)
    .map((g) => ({
      setor: g.setor,
      total: g.pacientes.length,
      pacientes: ordenarPorUrgencia(g.pacientes, agora)
        .filter((p) => !soComPendencia || contagemPendencias(p, agora).abertas > 0),
    }))
    .filter((g) => g.pacientes.length > 0)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <Trilha niveis={[{ rotulo: 'Plantão', to: '/plantao' }, { rotulo: 'Passômetro' }]} />
      <TituloPagina
        icone={ClipboardList}
        titulo="Passômetro"
        descricao="Os pacientes do seu plantão, com o que falta fazer em cada um"
        acoes={pacientes.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => void imprimir()} disabled={imprimindo} className="gap-1.5">
            <Printer className="size-4" aria-hidden /> Imprimir passômetro
          </Button>
        ) : undefined}
      />

      {erro && <p role="alert" className="mb-4 rounded-controle border border-critico/30 bg-alerta-critico p-3 text-apoio text-critico">{erro}</p>}
      {aviso && <p role="status" className="mb-4 rounded-controle border border-conforme/30 bg-alerta-conforme p-3 text-apoio text-conforme">{aviso}</p>}
      {lista.isLoading && <EsqueletoLinhas linhas={4} rotulo="Carregando o passômetro…" className="px-0" />}
      {lista.error && <p role="alert" className="text-apoio text-critico">{msg(lista.error)}</p>}

      {vazio && (situacao.isLoading
        ? <EsqueletoLinhas linhas={2} rotulo="Conferindo a sua escala…" className="px-0" />
        : <VazioPassometro motivo={situacao.error ? 'indefinido' : motivoVazio(situacao.data)} situacao={situacao.data ?? null} />)}

      {pacientes.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-container border border-fio bg-superficie px-4 py-2.5">
          <p className="text-apoio text-tinta tabular" aria-live="polite">
            <span className="font-semibold">{plural(resumo.pacientes, 'paciente', 'pacientes')}</span>
            <span className="text-tinta-apoio"> · {plural(resumo.abertas, 'aberta', 'abertas')}</span>
            {resumo.vencidas > 0
              ? <span className="font-semibold text-critico"> · {plural(resumo.vencidas, 'vencida', 'vencidas')}</span>
              : <span className="text-tinta-apoio"> · nenhuma vencida</span>}
          </p>
          <div className="ml-auto">
            <Chip ativo={soComPendencia} onClick={() => setSoComPendencia((v) => !v)}>Só com pendência</Chip>
          </div>
        </div>
      )}

      {pacientes.length > 0 && grupos.length === 0 && (
        <VazioLinha className="mb-5">Nenhum paciente com pendência aberta. Desligue o filtro para ver todos.</VazioLinha>
      )}

      {grupos.map((g) => {
        const recolhido = recolhidos.has(g.setor)
        const idLista = `setor-${g.setor}`
        return (
          <section key={g.setor} className="mb-5">
            <TituloSecao
              className="mb-2"
              extra={soComPendencia && g.pacientes.length !== g.total
                ? `${g.pacientes.length} de ${plural(g.total, 'paciente', 'pacientes')}`
                : plural(g.total, 'paciente', 'pacientes')}
            >
              <BotaoLinha
                variante="cartao"
                onClick={() => alternar(setRecolhidos, g.setor)}
                aria-expanded={!recolhido}
                aria-controls={idLista}
                className="flex-row items-center gap-1.5 border-0 bg-transparent px-0 py-0 hover:bg-transparent hover:text-acao"
              >
                {recolhido
                  ? <ChevronRight className="size-4 text-tinta-sussurro" aria-hidden />
                  : <ChevronDown className="size-4 text-tinta-sussurro" aria-hidden />}
                {g.setor}
              </BotaoLinha>
            </TituloSecao>
            {!recolhido && (
              <ul id={idLista} className={cn('overflow-hidden rounded-container border border-fio bg-superficie')}>
                {g.pacientes.map((p) => (
                  <Paciente key={p.internacao_id} p={p} eu={perfil?.id} acao={acao} agora={agora}
                    aberto={abertos.has(p.internacao_id)} alternar={() => alternar(setAbertos, p.internacao_id)} />
                ))}
              </ul>
            )}
          </section>
        )
      })}

      {pacientes.length > 0 && (
        <p className="mt-2 text-apoio text-tinta-sussurro">
          Toque no paciente para ver e concluir as pendências. Elas são as mesmas do leito e seguem com o paciente; ao passar o paciente, o resumo já começa com as que estão abertas.
        </p>
      )}
    </div>
  )
}

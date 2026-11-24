import { useQueryClient } from '@tanstack/react-query'
import { BedDouble, ClipboardList, Printer } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { dataIso } from '@/lib/formato'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { rotuloIdade } from '@/domain/idade'
import { diasDesde, htmlFolha, porSetor, vencidas, type PacientePassometro } from '@/domain/passometro'
import { CHAVE_PASSOMETRO, usePassometro } from '@/hooks/usePassometro'
import { TituloPagina, TituloSecao, Trilha, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { BlocoPendencias } from '@/components/internacao/caderno/Pendencias'
import { type Acao, msg } from '@/components/internacao/caderno/comum'

// Passômetro do médico (pedido 8; PS1 a PS3 = A do RT em 23/11/2026,
// docs/plantonista/PASSOMETRO-DIAGNOSTICO.md): os pacientes da observação e
// da internação dos setores da escala agora, cada um com as pendências do
// leito (as mesmas de public.pendencias). Ninguém digita nome de paciente.

const STATUS: Record<string, string> = { em_observacao: 'Observação', internado: 'Internado', admitido: 'Admitido' }

function Paciente({ p, eu, acao, agora }: { p: PacientePassometro; eu?: string; acao: Acao; agora: number }) {
  const dias = diasDesde(p.desde, agora)
  const nVencidas = vencidas(p, agora).length
  return (
    <article className="flex flex-col gap-2" aria-label={`${p.leito ?? 'Sem leito'}, ${p.nome}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
        <span className="inline-flex items-center gap-1.5 text-rotulo font-semibold text-tinta-apoio">
          <BedDouble className="size-4" aria-hidden />{p.leito ?? 'Sem leito'}
        </span>
        <Link to={`/prontuarios/${p.paciente_id}`} className="text-corpo font-semibold text-tinta hover:text-acao">{p.nome}</Link>
        <span className="text-apoio text-tinta-sussurro">
          {[
            p.data_nascimento ? rotuloIdade(p.data_nascimento, dataIso()) : null,
            STATUS[p.status] ?? p.status,
            dias === null ? null : dias === 0 ? 'desde hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`,
            p.cid_principal ? `CID ${p.cid_principal}` : p.queixa,
          ].filter(Boolean).join(' · ')}
        </span>
        {nVencidas > 0 && <span className="text-apoio font-semibold text-critico">{nVencidas} {nVencidas === 1 ? 'vencida' : 'vencidas'}</span>}
      </div>
      <BlocoPendencias internacaoId={p.internacao_id} ativa lista={p.pendencias} eu={eu} acao={acao} />
    </article>
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
  React.useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

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
  const grupos = porSetor(pacientes)
  const totalAbertas = pacientes.reduce((n, p) => n + p.pendencias.filter((x) => x.situacao === 'aberta').length, 0)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <Trilha niveis={[{ rotulo: 'Plantão', to: '/plantao' }, { rotulo: 'Passômetro' }]} />
      <TituloPagina
        icone={ClipboardList}
        titulo="Passômetro"
        descricao={lista.data
          ? `${pacientes.length} ${pacientes.length === 1 ? 'paciente' : 'pacientes'} nos setores da sua escala · ${totalAbertas} ${totalAbertas === 1 ? 'pendência aberta' : 'pendências abertas'}`
          : 'Os pacientes do seu plantão, com o que falta fazer em cada um'}
        acoes={pacientes.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => void imprimir()} disabled={imprimindo} className="gap-1.5">
            <Printer className="size-4" aria-hidden /> Imprimir passômetro
          </Button>
        ) : undefined}
      />

      {erro && <p role="alert" className="mb-4 rounded-controle border border-critico/30 bg-alerta-critico p-3 text-apoio text-critico">{erro}</p>}
      {aviso && <p role="status" className="mb-4 rounded-controle border border-conforme/30 bg-alerta-conforme p-3 text-apoio text-conforme">{aviso}</p>}
      {lista.isLoading && <div className="py-6"><Spinner /></div>}
      {lista.error && <p role="alert" className="text-apoio text-critico">{msg(lista.error)}</p>}

      {lista.data && pacientes.length === 0 && (
        <Vazio icone={ClipboardList} titulo="Nenhum paciente no seu plantão"
          texto="O passômetro mostra a observação e a internação dos setores em que você está na escala agora, com o check-in feito." />
      )}

      {grupos.map((g) => (
        <section key={g.setor} className="mb-7">
          <TituloSecao extra={`${g.pacientes.length} ${g.pacientes.length === 1 ? 'paciente' : 'pacientes'}`}>{g.setor}</TituloSecao>
          <div className={cn('flex flex-col gap-5')}>
            {g.pacientes.map((p) => <Paciente key={p.internacao_id} p={p} eu={perfil?.id} acao={acao} agora={agora} />)}
          </div>
        </section>
      ))}

      {pacientes.length > 0 && (
        <p className="mt-2 text-apoio text-tinta-sussurro">
          As pendências são as mesmas do leito e seguem com o paciente. Ao passar o paciente, o resumo já começa com as que estão abertas.
        </p>
      )}
    </div>
  )
}

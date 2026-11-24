import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloSecao } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { PAPEL_LABEL } from '@/lib/constants'
import { avisoDeRegistro, diferenca, papeisOferecidos, podeMexer, type QuemMuda } from '@/lib/secretariaCompleta'
import { supabase } from '@/lib/supabase'
import type { Papel } from '@/types/database'

// Pessoas da unidade (pedido do RT, 24/11/2026): o gestor da unidade, o gestor
// da secretaria e o administrador trocam, põem e tiram papel de quem já está
// na unidade, sem convite novo. Pessoa nova segue pelo convite. O banco confere
// quem pode, o registro profissional e grava a auditoria
// (definir_papeis_na_unidade, migration 20270421000024).

type Pessoa = {
  perfil_id: string
  nome: string
  email: string | null
  conselho: string | null
  registro: string | null
  papeis: string[]
  papeis_retirados: string[]
}

const rotulo = (p: string) => PAPEL_LABEL[p as Papel] ?? p

export default function PessoasDaUnidade({ quem }: { quem: QuemMuda }) {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const [editando, setEditando] = React.useState<Pessoa | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)

  const lista = useQuery({
    queryKey: ['pessoas-da-unidade', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pessoas_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as Pessoa[]
    },
  })

  if (lista.isLoading) return <div className="flex h-32 items-center justify-center"><Spinner /></div>
  if (lista.error) return <MensagemErro erro={lista.error} acao="carregar as pessoas da unidade" />

  const ativas = (lista.data ?? []).filter((p) => p.papeis.length > 0)
  const sairam = (lista.data ?? []).filter((p) => p.papeis.length === 0)
  const linha = (p: Pessoa, acao: string) => (
    <li key={p.perfil_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-apoio font-medium text-tinta">{p.nome}</p>
        <p className="truncate text-rotulo text-tinta-sussurro">
          {[p.email, p.conselho && p.registro ? `${p.conselho} ${p.registro}` : null].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {(p.papeis.length > 0 ? p.papeis : p.papeis_retirados).map((x) => (
            <Badge key={x} variant={p.papeis.length > 0 ? 'secondary' : 'outline'}>{rotulo(x)}</Badge>
          ))}
        </div>
      </div>
      {p.perfil_id !== perfil?.id && podeMexer(quem, p.papeis) && (
        <Button size="sm" variant="outline" onClick={() => { setAviso(null); setEditando(p) }}>{acao}</Button>
      )}
    </li>
  )

  return (
    <section aria-label="Pessoas da unidade" className="flex flex-col gap-3">
      <p className="text-apoio text-tinta-apoio">
        Troque, ponha ou tire o papel de quem já está na unidade. Pessoa nova entra pelo convite. Tudo fica na auditoria.
      </p>
      {aviso && <p role="status" className="rounded-controle border border-atencao/40 bg-superficie px-4 py-2 text-apoio text-atencao">{aviso}</p>}
      {ativas.length === 0 ? (
        <p className="text-apoio text-tinta-sussurro">Ninguém com vínculo ativo na unidade.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-fio rounded-cartao border border-fio bg-superficie">
          {ativas.map((p) => linha(p, 'Mudar papéis'))}
        </ul>
      )}
      {sairam.length > 0 && (
        <>
          <TituloSecao className="mb-0 mt-2">Saíram da unidade</TituloSecao>
          <ul className="flex flex-col divide-y divide-fio rounded-cartao border border-fio bg-superficie">
            {sairam.map((p) => linha(p, 'Devolver papel'))}
          </ul>
        </>
      )}
      {editando && unidadeId && (
        <JanelaPapeis
          pessoa={editando}
          unidadeId={unidadeId}
          quem={quem}
          onFechar={() => setEditando(null)}
          onFeito={(futuros) => {
            setEditando(null)
            setAviso(futuros > 0
              ? `${editando.nome} tem ${futuros} ${futuros === 1 ? 'plantão' : 'plantões'} na escala com o papel que saiu. Confira a escala.`
              : null)
          }}
        />
      )}
    </section>
  )
}

function JanelaPapeis({ pessoa, unidadeId, quem, onFechar, onFeito }: {
  pessoa: Pessoa
  unidadeId: string
  quem: QuemMuda
  onFechar: () => void
  onFeito: (plantoesFuturos: number) => void
}) {
  const qc = useQueryClient()
  const oferecidos = papeisOferecidos(quem)
  const [papeis, setPapeis] = React.useState<string[]>(pessoa.papeis)
  const [novo, setNovo] = React.useState('')
  const restantes = oferecidos.filter((p) => !papeis.includes(p))
  const { entram, saem } = diferenca(pessoa.papeis, papeis)
  const avisos = entram.map((p) => avisoDeRegistro(p as Papel, pessoa.conselho)).filter((a): a is string => !!a)

  const salvar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('definir_papeis_na_unidade', {
        p_unidade: unidadeId, p_perfil: pessoa.perfil_id, p_papeis: papeis as Papel[],
      })
      if (error) throw error
      return data as unknown as { mudou: boolean; plantoes_futuros: number }
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['pessoas-da-unidade', unidadeId] })
      void qc.invalidateQueries({ queryKey: ['escala-profissionais', unidadeId] })
      void qc.invalidateQueries({ queryKey: ['secretaria-indicadores'] })
      onFeito(r?.plantoes_futuros ?? 0)
    },
  })

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Papéis de {pessoa.nome}</DialogTitle>
          <DialogDescription>Vale na hora, sem convite novo. A pessoa vê o papel novo quando abrir o app de novo.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {papeis.length === 0 && <span className="text-apoio text-tinta-sussurro">Sem papel: a pessoa sai da unidade.</span>}
            {papeis.map((p) => (
              <Badge key={p} variant="secondary" className="gap-1 pr-1">
                {rotulo(p)}
                {oferecidos.includes(p as Papel) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Tirar o papel ${rotulo(p)}`}
                    onClick={() => setPapeis((l) => l.filter((x) => x !== p))}
                  >
                    <X />
                  </Button>
                )}
              </Badge>
            ))}
          </div>
          {restantes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="papel-novo">Pôr papel</Label>
              <div className="flex gap-2">
                <CampoSelecao id="papel-novo" value={novo} onChange={(e) => setNovo(e.target.value)} className="flex-1">
                  <option value="">Escolha o papel</option>
                  {restantes.map((p) => <option key={p} value={p}>{rotulo(p)}</option>)}
                </CampoSelecao>
                <Button
                  type="button" variant="outline" disabled={!novo}
                  onClick={() => { setPapeis((l) => [...l, novo]); setNovo('') }}
                >
                  Pôr
                </Button>
              </div>
            </div>
          )}
          {(entram.length > 0 || saem.length > 0) && (
            <p className="text-apoio text-tinta-apoio">
              {[entram.length ? `Entra: ${entram.map(rotulo).join(', ')}.` : '', saem.length ? `Sai: ${saem.map(rotulo).join(', ')}.` : '']
                .filter(Boolean).join(' ')}
            </p>
          )}
          {avisos.map((a) => <p key={a} className="text-apoio text-atencao">{a}</p>)}
          {salvar.error && <MensagemErro erro={salvar.error} acao="mudar os papéis" />}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={(entram.length === 0 && saem.length === 0) || avisos.length > 0 || salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending && <Spinner />}
            {papeis.length === 0 ? 'Tirar da unidade' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

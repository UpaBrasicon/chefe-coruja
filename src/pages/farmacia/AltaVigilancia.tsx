import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { origemAltaVigilancia, type DuplaPendente, type ItemAltaVigilancia } from '@/lib/duplaChecagem'
import { supabase } from '@/lib/supabase'

// Alta vigilância (Fase 2, tarefa 1 do BACKLOG). Duas partes:
//  • fila da 2ª conferência — o enfermeiro ou o farmacêutico confere o que a
//    enfermagem já conferiu uma vez (nunca quem fez a 1ª);
//  • lista da unidade — vem das regras do ISMP Brasil 2019 (Boletim v. 8, n. 1,
//    fev. 2019); o farmacêutico ou o gestor marca e desmarca, com motivo.
// Migration 20261031000001_dupla_checagem.sql.

export default function AltaVigilancia() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const podeConferir = papelAtivo === 'farmaceutico' || papelAtivo === 'enfermeiro'
  const podeAjustar = papelAtivo === 'farmaceutico' || papelAtivo === 'gestor'

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina
        icone={ShieldAlert}
        titulo="Alta vigilância"
        descricao="Medicamentos que só são registrados como administrados depois de duas conferências, por profissionais diferentes."
      />
      {unidadeId && podeConferir && <FilaSegunda unidadeId={unidadeId} />}
      {unidadeId && <ListaUnidade unidadeId={unidadeId} podeAjustar={podeAjustar} />}
    </div>
  )
}

function FilaSegunda({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const fila = useQuery({
    queryKey: ['duplas-pendentes', unidadeId],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('duplas_pendentes', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as DuplaPendente[]
    },
  })
  const conferir = useMutation({
    mutationFn: async (d: DuplaPendente) => {
      const { error } = await supabase.rpc('conferir_alta_vigilancia', { p_item: d.item_id, p_horario: d.horario ?? undefined })
      if (error) throw error
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['duplas-pendentes', unidadeId] }),
  })

  return (
    <section className="flex flex-col gap-2">
      <TituloSecao>Aguardando a 2ª conferência</TituloSecao>
      {conferir.error && <p role="alert" className="text-apoio text-critico">{(conferir.error as Error).message}</p>}
      {fila.isLoading ? <Spinner /> : fila.error ? (
        <p role="alert" className="text-apoio text-critico">{(fila.error as Error).message}</p>
      ) : (fila.data ?? []).length === 0 ? (
        <Vazio icone={ShieldAlert} titulo="Nada aguardando" texto="Quando a enfermagem fizer a 1ª conferência de um item de alta vigilância, ele aparece aqui (vale por 2 horas)." />
      ) : (fila.data ?? []).map((d) => (
        <div key={`${d.item_id}-${d.horario ?? ''}`} className="flex flex-col gap-1.5 rounded-lg border border-critico/30 bg-superficie px-4 py-3 text-apoio">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-medium text-tinta">{d.paciente}</span>
            <span className="text-tinta-sussurro">{d.local ?? '—'}</span>
            {d.horario && <Badge variant="outline">horário {d.horario}</Badge>}
            <Badge variant="destructive" className="ml-auto">{d.regra}</Badge>
          </div>
          <span className="text-tinta">{d.descricao} · {d.dose ?? '—'} · {d.via ?? '—'} · {d.posologia ?? '—'}</span>
          {d.diluicao && <span className="text-xs text-tinta-apoio">Diluição: {d.diluicao}</span>}
          <span className="text-xs text-tinta-sussurro">1ª conferência: {d.primeiro_por}, {fmtDataHora(d.primeiro_em)}</span>
          <div>
            {d.sou_o_primeiro ? (
              <span className="text-xs text-tinta-apoio">Você fez a 1ª conferência: a 2ª é de outro profissional.</span>
            ) : (
              <Button size="xs" disabled={conferir.isPending} onClick={() => conferir.mutate(d)}>Conferi: registrar 2ª conferência</Button>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

function ListaUnidade({ unidadeId, podeAjustar }: { unidadeId: string; podeAjustar: boolean }) {
  const qc = useQueryClient()
  const [busca, setBusca] = React.useState('')
  const [termo, setTermo] = React.useState('')
  const lista = useQuery({
    queryKey: ['alta-vigilancia', unidadeId, termo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('alta_vigilancia_da_unidade', { p_unidade: unidadeId, p_busca: termo || undefined })
      if (error) throw error
      return (data ?? []) as unknown as ItemAltaVigilancia[]
    },
  })

  return (
    <section className="flex flex-col gap-2">
      <TituloSecao>{termo ? `Cadastro: “${termo}”` : 'Lista da unidade'}</TituloSecao>
      <p className="text-rotulo text-tinta-sussurro">
        Base: ISMP Brasil, “Medicamentos potencialmente perigosos de uso hospitalar — lista atualizada 2019” (Boletim v. 8, n. 1, fev. 2019),
        aplicada por regra ao cadastro. Vias epidural/intratecal e antineoplásicos dependem da marcação da farmácia.
      </p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setTermo(busca.trim()) }}>
        <Input className="max-w-sm" placeholder="Buscar no cadastro para marcar ou desmarcar" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Button type="submit" variant="outline"><Search /> Buscar</Button>
        {termo && <Button type="button" variant="ghost" onClick={() => { setBusca(''); setTermo('') }}>Ver a lista</Button>}
      </form>
      {lista.isLoading ? <Spinner /> : lista.error ? (
        <p role="alert" className="text-apoio text-critico">{(lista.error as Error).message}</p>
      ) : (lista.data ?? []).length === 0 ? (
        <Vazio icone={ShieldAlert} titulo={termo ? 'Nada encontrado no cadastro' : 'Nenhum medicamento de alta vigilância'} />
      ) : (lista.data ?? []).map((i) => (
        <LinhaItem key={i.id} i={i} unidadeId={unidadeId} podeAjustar={podeAjustar}
          aoMudar={() => void qc.invalidateQueries({ queryKey: ['alta-vigilancia', unidadeId] })} />
      ))}
    </section>
  )
}

function LinhaItem({ i, unidadeId, podeAjustar, aoMudar }: { i: ItemAltaVigilancia; unidadeId: string; podeAjustar: boolean; aoMudar: () => void }) {
  const [abrindo, setAbrindo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const ajustar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_alta_vigilancia', {
        p_unidade: unidadeId, p_medicamento: i.id, p_exige: !i.exige, p_motivo: motivo.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => { setAbrindo(false); setMotivo(''); aoMudar() },
  })

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-fio bg-superficie px-4 py-2.5 text-apoio">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-tinta">{i.principio_ativo}</span>
        <span className="text-tinta-apoio">{i.apresentacao}{i.concentracao ? ` · ${i.concentracao}` : ''}</span>
        <Badge variant={i.exige ? 'destructive' : 'outline'} className="ml-auto">{i.exige ? 'exige dupla checagem' : 'não exige'}</Badge>
      </div>
      <span className="text-xs text-tinta-sussurro">
        {origemAltaVigilancia(i)}
        {i.ajuste && ` — “${i.ajuste.motivo}” (${i.ajuste.por ?? '—'}, ${fmtDataHora(i.ajuste.em)})`}
      </span>
      {podeAjustar && !abrindo && (
        <div><Button size="xs" variant="outline" onClick={() => setAbrindo(true)}>{i.exige ? 'Desmarcar na unidade' : 'Marcar na unidade'}</Button></div>
      )}
      {abrindo && (
        <div className="flex flex-wrap gap-2">
          <Input className="h-8 max-w-md" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="xs" disabled={motivo.trim().length < 10 || ajustar.isPending} onClick={() => ajustar.mutate()}>Confirmar</Button>
          <Button size="xs" variant="ghost" onClick={() => setAbrindo(false)}>Voltar</Button>
          {ajustar.error && <span role="alert" className="text-xs text-critico">{(ajustar.error as Error).message}</span>}
        </div>
      )}
    </div>
  )
}

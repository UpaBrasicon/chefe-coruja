// ─────────────────────────────────────────────────────────────────────────────
// Minhas preferências de prescrição (protótipo, D6 — tela "preferencias").
//
// Os favoritos pessoais do plantonista: aparecem no Receituário ao lado dos
// protocolos da instituição. A lista é de quem a fez — a RLS da tabela
// preferencias_prescricao só deixa o dono ler e gravar; o gestor não vê.
//
// Diferença para o protótipo: lá havia um catálogo fixo para marcar/desmarcar.
// Aqui não há catálogo inventado: o favorito parte do medicamento do CADASTRO
// (como a prescrição estruturada) e a posologia é escrita pelo médico — o
// sistema não sugere dose.
//
// Não havia favoritos de prescrição guardados no navegador (os favoritos de
// `useFavoritos` são de FERRAMENTAS), então não há importação a fazer.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, SlidersHorizontal, Star } from 'lucide-react'
import * as React from 'react'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase'

type Medicamento = { id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null }
type Favorito = {
  id: string
  dose: string | null
  via: string | null
  posologia: string
  quantidade: string | null
  classe_alergenica: string | null
  medicamento: Medicamento | null
}

const CHAVE = ['preferencias-prescricao'] as const
const FORM_VAZIO = { dose: '', via: '', posologia: '', quantidade: '', classe: '' }

const nomeMed = (m: Medicamento | null) =>
  m ? [m.principio_ativo, m.concentracao, m.apresentacao].filter(Boolean).join(' · ') : 'Medicamento fora do cadastro'
const msg = (e: unknown) => {
  const t = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)
  return /preferencias_prescricao_sem_repetir|duplicate key/.test(t) ? 'Este medicamento, com esta posologia, já está nos seus favoritos.' : t
}
const ouNulo = (s: string) => (s.trim() ? s.trim() : null)

export default function PreferenciasPrescricao() {
  const qc = useQueryClient()

  const favoritos = useQuery({
    queryKey: CHAVE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preferencias_prescricao')
        .select('id, dose, via, posologia, quantidade, classe_alergenica, medicamento:medicamento_id(id, principio_ativo, apresentacao, concentracao)')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as Favorito[]
    },
  })

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('preferencias_prescricao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: CHAVE }),
  })

  const lista = favoritos.data ?? []
  const total = lista.length === 1 ? '1 favorito' : `${lista.length} favoritos`

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={SlidersHorizontal}
        titulo="Minhas preferências"
        className="mb-2"
      />
      <p className="mb-[22px] max-w-[62ch] text-corpo leading-[1.55] text-tinta-apoio [text-wrap:pretty]">
        Seus favoritos de prescrição aparecem no Receituário, ao lado dos protocolos da instituição. Esta lista é sua: o gestor não a vê e não a edita.
      </p>

      <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5 border-b border-trilha px-5 py-3.5">
          <Star className="size-4 text-atencao" aria-hidden />
          <h2 className="text-corpo font-semibold tracking-[-0.01em] text-tinta">Favoritos de prescrição</h2>
          {favoritos.data && <span className="ml-auto text-apoio text-tinta-sussurro">{total}</span>}
        </div>

        {favoritos.isLoading && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {favoritos.error && <p className="px-5 py-3 text-apoio text-critico">{msg(favoritos.error)}</p>}
        {favoritos.data && lista.length === 0 && (
          <p className="border-b border-trilha px-5 py-6 text-apoio text-tinta-sussurro">
            Nenhum favorito ainda. Adicione abaixo os itens que você prescreve sempre do mesmo jeito.
          </p>
        )}

        <ul>
          {lista.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 hover:bg-campo">
              <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-corpo font-medium text-tinta">{nomeMed(f.medicamento)}</span>
                <span className="text-apoio text-tinta-sussurro">
                  {[f.dose, f.via, f.posologia, f.quantidade].filter(Boolean).join(' · ')}
                </span>
              </div>
              {f.classe_alergenica && <span className="text-apoio whitespace-nowrap text-tinta-sussurro">Classe {f.classe_alergenica}</span>}
              <Button
                size="sm"
                variant="outline"
                className="border-acao/35 bg-marca/10 text-acao"
                disabled={remover.isPending && remover.variables === f.id}
                onClick={() => remover.mutate(f.id)}
              >
                Remover
              </Button>
            </li>
          ))}
        </ul>
        {remover.error && <p className="px-5 py-2 text-apoio text-critico">{msg(remover.error)}</p>}

        <NovoFavorito aoSalvar={() => void qc.invalidateQueries({ queryKey: CHAVE })} />

        <div className="bg-campo px-5 py-3 text-apoio text-tinta-sussurro [text-wrap:pretty]">
          Um favorito nunca contorna a alergia: no Receituário ele chega bloqueado se o paciente for alérgico à classe.
        </div>
      </section>
    </div>
  )
}

/** Acrescentar um favorito: medicamento do cadastro + como você costuma prescrever. */
function NovoFavorito({ aoSalvar }: { aoSalvar: () => void }) {
  const [busca, setBusca] = React.useState('')
  const [med, setMed] = React.useState<Medicamento | null>(null)
  const [f, setF] = React.useState(FORM_VAZIO)

  const resultados = useQuery({
    queryKey: ['busca-medicamento', busca],
    enabled: busca.trim().length >= 3 && !med,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medicamento')
        .select('id, principio_ativo, apresentacao, concentracao')
        .eq('ativo', true)
        .ilike('principio_ativo', `%${busca.trim()}%`)
        .order('principio_ativo')
        .limit(15)
      if (error) throw error
      return (data ?? []) as Medicamento[]
    },
  })

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('preferencias_prescricao').insert({
        medicamento_id: med!.id,
        dose: ouNulo(f.dose),
        via: ouNulo(f.via),
        posologia: f.posologia.trim(),
        quantidade: ouNulo(f.quantidade),
        classe_alergenica: ouNulo(f.classe),
      })
      if (error) throw error
    },
    onSuccess: () => {
      setMed(null)
      setBusca('')
      setF(FORM_VAZIO)
      aoSalvar()
    },
  })

  const campo = (k: keyof typeof FORM_VAZIO, rotulo: string, exemplo: string) => (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`fav-${k}`}>{rotulo}</Label>
      <Input id={`fav-${k}`} placeholder={exemplo} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} />
    </div>
  )

  return (
    <div className="flex flex-col gap-3 border-b border-trilha px-5 py-4">
      <span className="rotulo text-tinta-sussurro">Adicionar favorito</span>
      {med ? (
        <div className="flex flex-wrap items-center gap-2 rounded-controle border border-fio px-3 py-2">
          <span className="text-corpo font-medium text-tinta">{med.principio_ativo}</span>
          <span className="text-apoio text-tinta-apoio">{[med.concentracao, med.apresentacao].filter(Boolean).join(' · ')}</span>
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setMed(null)}>Trocar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Label htmlFor="fav-busca">Medicamento</Label>
          <Input id="fav-busca" placeholder="Buscar no cadastro (3 letras ou mais)" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {resultados.isFetching && <Spinner />}
          {resultados.error && <p className="text-apoio text-critico">{msg(resultados.error)}</p>}
          <div className="max-h-48 overflow-y-auto">
            {(resultados.data ?? []).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMed(m)}
                className="flex w-full gap-2 border-b border-trilha px-2 py-1.5 text-left text-apoio last:border-0 hover:bg-campo"
              >
                <span className="font-medium text-tinta">{m.principio_ativo}</span>
                <span className="text-tinta-apoio">{[m.concentracao, m.apresentacao].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
            {resultados.data?.length === 0 && <p className="px-2 py-1 text-apoio text-tinta-sussurro">Nada no cadastro com esse nome.</p>}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {campo('dose', 'Dose', 'Ex.: 1 comprimido')}
        {campo('via', 'Via', 'Ex.: VO')}
        {campo('posologia', 'Posologia', 'Ex.: de 6/6h se dor ou febre')}
        {campo('quantidade', 'Quantidade', 'Ex.: 20 comprimidos')}
        {campo('classe', 'Classe alergênica (opcional)', 'Ex.: Sulfa, Penicilina')}
      </div>

      {salvar.error && <p className="text-apoio text-critico">{msg(salvar.error)}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!med || f.posologia.trim().length < 3 || salvar.isPending} onClick={() => salvar.mutate()}>
          <Plus /> Adicionar aos favoritos
        </Button>
        {med && f.posologia.trim().length < 3 && <Badge variant="ghost">Escreva a posologia</Badge>}
      </div>
    </div>
  )
}

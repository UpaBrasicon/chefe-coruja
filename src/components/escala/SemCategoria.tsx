// M7 (teste ponta a ponta da escala; opção A do RT em 31/10/2026, "Categoria em
// comum"): no mês do gestor, o aviso "N plantões sem categoria" e o atalho para
// definir a categoria de cada plantão, ou de todos de uma pessoa de uma vez.
// Enquanto o plantão não tem categoria, troca e passagem só valem com quem tem
// categoria em comum com o dono (o banco confere).
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { PAPEL_LABEL } from '@/lib/constants'
import { dataPorExtenso } from '@/lib/formato'
import { type GrupoSemCategoria } from '@/lib/semCategoria'
import { Button } from '@/components/ui/button'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import type { Papel } from '@/types/database'

type Profissional = { perfil_id: string; papel: Papel }
const TURNO: Record<string, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' }
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function SemCategoria({ unidadeId, grupos, onFeito }: { unidadeId: string; grupos: GrupoSemCategoria[]; onFeito: () => void }) {
  const [aberto, setAberto] = React.useState(false)
  const total = grupos.reduce((n, g) => n + g.plantoes.length, 0)
  const profissionais = useQuery({
    queryKey: ['escala-profissionais', unidadeId],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('profissionais_da_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as Profissional[]
    },
  })
  if (total === 0) return null
  const categoriasDe = (perfil: string) => (profissionais.data ?? []).filter((p) => p.perfil_id === perfil).map((p) => p.papel)

  return (
    <section aria-label="Plantões sem categoria" className="overflow-hidden rounded-controle border border-atencao/40 bg-superficie text-apoio">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
        <span className="font-medium text-atencao">{plural(total, 'plantão sem categoria', 'plantões sem categoria')}</span>
        <span className="text-tinta-sussurro">Troca e passagem deles só valem com quem tem categoria em comum.</span>
        <Button variant="link" onClick={() => setAberto((a) => !a)} className="ml-auto h-auto min-h-0 p-0 text-apoio font-medium">
          {aberto ? 'Fechar' : 'Definir a categoria'}
        </Button>
      </div>
      {aberto && (
        <ul className="flex flex-col border-t border-trilha">
          {profissionais.isLoading && <li className="px-4 py-2"><Spinner /></li>}
          {grupos.map((g) => (
            <Pessoa key={g.perfil_id} grupo={g} categorias={categoriasDe(g.perfil_id)} onFeito={onFeito} />
          ))}
        </ul>
      )}
    </section>
  )
}

function Pessoa({ grupo, categorias, onFeito }: { grupo: GrupoSemCategoria; categorias: Papel[]; onFeito: () => void }) {
  const [papel, setPapel] = React.useState<Papel | ''>('')
  const [cadaUm, setCadaUm] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)

  async function definir(plantoes: string[], escolhido: Papel) {
    setErro(null); setSalvando(true)
    const { error } = await supabase.rpc('definir_categoria_plantoes', { p_plantoes: plantoes, p_papel: escolhido })
    setSalvando(false)
    if (error) return setErro(error.message)
    onFeito()
  }

  return (
    <li className="flex flex-col gap-1.5 border-b border-trilha px-4 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-[1_1_200px] text-tinta">
          <b className="font-medium">{grupo.nome}</b>
          <span className="text-tinta-sussurro"> · {plural(grupo.plantoes.length, 'plantão', 'plantões')}</span>
        </span>
        <EscolherCategoria categorias={categorias} valor={papel} onChange={setPapel} />
        <Button size="xs" disabled={!papel || salvando} onClick={() => papel && void definir(grupo.plantoes.map((p) => p.plantao_id), papel)}>
          {salvando ? <Spinner /> : null} Definir {grupo.plantoes.length === 1 ? 'no plantão' : `nos ${grupo.plantoes.length}`}
        </Button>
        {grupo.plantoes.length > 1 && (
          <Button variant="link" size="xs" className="h-auto min-h-0 p-0 text-rotulo" onClick={() => setCadaUm((c) => !c)}>
            {cadaUm ? 'Esconder cada um' : 'Um por um'}
          </Button>
        )}
      </div>
      {cadaUm && (
        <ul className="flex flex-col gap-1 pl-3">
          {grupo.plantoes.map((p) => (
            <Plantao key={p.plantao_id} rotulo={`${dataPorExtenso(`${p.data}T12:00:00Z`)} · ${TURNO[p.turno] ?? p.turno}`}
              categorias={categorias} salvando={salvando} onDefinir={(escolhido) => void definir([p.plantao_id], escolhido)} />
          ))}
        </ul>
      )}
      <MensagemErro texto={erro} />
    </li>
  )
}

function Plantao({ rotulo, categorias, salvando, onDefinir }: { rotulo: string; categorias: Papel[]; salvando: boolean; onDefinir: (p: Papel) => void }) {
  const [papel, setPapel] = React.useState<Papel | ''>('')
  return (
    <li className="flex flex-wrap items-center gap-2 text-rotulo">
      <span className="min-w-0 flex-[1_1_180px] text-tinta-apoio">{rotulo}</span>
      <EscolherCategoria categorias={categorias} valor={papel} onChange={setPapel} />
      <Button size="xs" variant="outline" disabled={!papel || salvando} onClick={() => papel && onDefinir(papel)}>Definir</Button>
    </li>
  )
}

function EscolherCategoria({ categorias, valor, onChange }: { categorias: Papel[]; valor: Papel | ''; onChange: (p: Papel | '') => void }) {
  return (
    <Select value={valor || null} onValueChange={(v) => onChange((v ?? '') as Papel | '')}>
      <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Categoria">{valor ? PAPEL_LABEL[valor] : undefined}</SelectValue></SelectTrigger>
      <SelectContent>
        {categorias.map((c) => <SelectItem key={c} value={c}>{PAPEL_LABEL[c]}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

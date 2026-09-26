import { Command as CommandPrimitive } from 'cmdk'
import { CornerDownLeft, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SECOES } from '@/content/registry'
import { SECOES_PLANTAO } from '@/content/plantaoRegistry'
import { fuzzyMatch, normalizar } from '@/lib/search'

import type { ItemNav } from './navegacao'

// Paleta de busca (09-comum-casca §4): Ctrl+K, "/" fora de campo, ou a lupa da
// topbar. Indexa telas e ferramentas; fuzzy com normalização de acento.
// A busca de pacientes (e a recusa com motivo para quem está fora do censo)
// entra com o censo da Fase 3 — hoje o índice não traz nome de paciente.

type Entrada = { id: string; grupo: string; rotulo: string; detalhe?: string; to: string; termos: string }

export function Paleta({
  aberta, onAbertaChange, telas, comFerramentas, comPlantao,
}: {
  aberta: boolean
  onAbertaChange: (v: boolean) => void
  telas: ItemNav[]
  comFerramentas: boolean
  comPlantao: boolean
}) {
  const navigate = useNavigate()
  const [termo, setTermo] = useState('')

  const indice = useMemo<Entrada[]>(() => {
    const e: Entrada[] = telas.map((t) => ({ id: `tela:${t.to}`, grupo: 'Telas', rotulo: t.rotulo, to: t.to, termos: t.rotulo }))
    if (comPlantao) {
      for (const s of SECOES_PLANTAO) {
        for (const f of s.tools) {
          e.push({
            id: `plantao:${s.slug}/${f.slug}`, grupo: 'Plantão', rotulo: f.label, detalhe: s.label,
            to: `/plantao/${s.slug}/${f.slug}`, termos: `${f.label} ${s.label} ${f.description}`,
          })
        }
      }
    }
    if (comFerramentas) {
      for (const s of SECOES) {
        for (const f of s.tools) {
          e.push({
            id: `tool:${s.slug}/${f.slug}`, grupo: 'Ferramentas', rotulo: f.label, detalhe: s.label,
            to: `/plantonista/${s.slug}/${f.slug}`, termos: `${f.label} ${s.label} ${f.description} ${(f.tags ?? []).join(' ')}`,
          })
        }
      }
    }
    return e
  }, [telas, comFerramentas, comPlantao])

  // Sem termo: amostra curta por grupo. Com termo: até 9 resultados.
  const resultados = useMemo(() => {
    const q = termo.trim()
    if (!q) {
      const porGrupo = new Map<string, number>()
      return indice.filter((x) => {
        const n = porGrupo.get(x.grupo) ?? 0
        porGrupo.set(x.grupo, n + 1)
        return x.grupo === 'Telas' || n < 2
      })
    }
    // Ranking: trecho no nome > trecho em qualquer termo > letras em ordem no
    // nome. Letras em ordem sobre a descrição inteira casavam quase tudo.
    const n = normalizar(q)
    const pontuar = (x: Entrada) =>
      normalizar(x.rotulo).includes(n) ? 3 : normalizar(x.termos).includes(n) ? 2 : fuzzyMatch(x.rotulo, q) ? 1 : 0
    return indice
      .map((x) => ({ x, p: pontuar(x) }))
      .filter((r) => r.p > 0)
      .sort((a, b) => b.p - a.p)
      .slice(0, 9)
      .map((r) => r.x)
  }, [indice, termo])

  const grupos = useMemo(() => {
    const m = new Map<string, Entrada[]>()
    for (const r of resultados) m.set(r.grupo, [...(m.get(r.grupo) ?? []), r])
    return [...m.entries()]
  }, [resultados])

  function abrir(to: string) {
    onAbertaChange(false)
    setTermo('')
    navigate(to)
  }

  return (
    <Dialog open={aberta} onOpenChange={(v) => { onAbertaChange(v); if (!v) setTermo('') }}>
      <DialogContent showCloseButton={false} className="top-[12vh] translate-y-0 gap-0 p-0 sm:max-w-[560px]">
        <DialogTitle className="sr-only">Buscar no Chefe Coruja</DialogTitle>
        <CommandPrimitive shouldFilter={false} label="Buscar" className="flex flex-col">
          <div className="flex items-center gap-2.5 border-b border-fio px-4">
            <Search className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />
            <CommandPrimitive.Input
              autoFocus
              value={termo}
              onValueChange={setTermo}
              placeholder="Buscar tela, ferramenta, droga, escore…"
              className="h-12 w-full bg-transparent text-corpo text-tinta outline-none placeholder:text-tinta-sussurro focus-visible:shadow-none"
            />
            <kbd className="rounded-[5px] border border-fio px-1.5 font-mono text-[11px] text-tinta-sussurro">Esc</kbd>
          </div>
          <CommandPrimitive.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            <CommandPrimitive.Empty className="px-3 py-8 text-center text-apoio text-tinta-sussurro">
              Nada encontrado para “{termo}”.
            </CommandPrimitive.Empty>
            {grupos.map(([grupo, itens]) => (
              <CommandPrimitive.Group
                key={grupo}
                heading={grupo}
                className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-tinta-sussurro [&_[cmdk-group-heading]]:uppercase"
              >
                {itens.map((x) => (
                  <CommandPrimitive.Item
                    key={x.id}
                    value={x.id}
                    onSelect={() => abrir(x.to)}
                    className="group flex cursor-pointer items-center gap-3 rounded-controle px-2.5 py-2 text-apoio text-tinta data-[selected=true]:bg-marca/10 data-[selected=true]:text-acao"
                  >
                    <span className="min-w-0 flex-1 truncate">{x.rotulo}</span>
                    {x.detalhe && <span className="shrink-0 text-rotulo text-tinta-sussurro">{x.detalhe}</span>}
                    <CornerDownLeft className="size-3.5 shrink-0 opacity-0 group-data-[selected=true]:opacity-100" aria-hidden />
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            ))}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  )
}

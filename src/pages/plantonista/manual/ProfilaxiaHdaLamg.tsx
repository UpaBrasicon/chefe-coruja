import { useState } from 'react'

import {
  CRITERIOS_ISOLADOS, CRITERIOS_PAREADOS, ERRATA_ALCOOL, FORA_DO_LIVRO_ULCERA, IBP_DUPLA_ANTIAGREGACAO, NOTA_AVC_ULCERA, NOTA_IAM_SUPRA,
  ULCERA_ESTRESSE, avaliarIbpDupla, fichaProfilaxiaUlceraEstresse,
} from '@/clinico/adulto/profilaxiaUlceraEstresse'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'

import { Bloco, LinhaManual } from './PecasLoteC'

function Marca({ rotulo, marcado, onChange }: { rotulo: string; marcado: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
      <input type="checkbox" className="size-4" checked={marcado} onChange={(e) => onChange(e.target.checked)} />
      {rotulo}
    </label>
  )
}

const alternar = (lista: string[], id: string, v: boolean) => (v ? [...lista, id] : lista.filter((x) => x !== id))

/** Profilaxia de úlcera de estresse e gastroproteção (manual do HCFMUSP). */
export function ProfilaxiaHdaLamg() {
  const [dupla, setDupla] = useState(false)
  const [isolados, setIsolados] = useState<string[]>([])
  const [pareados, setPareados] = useState<string[]>([])
  const [alcool, setAlcool] = useState(false)
  const r = avaliarIbpDupla({ duplaAntiagregacao: dupla, isolados, pareados, alcool })

  return (
    <ToolLayout
      title="Profilaxia de úlcera de estresse e gastroproteção — adulto"
      description="O que o manual do HC traz: omeprazol na sepse com VM, coagulopatia ou choque, e IBP na dupla antiagregação com risco de sangramento. Adulto (14 anos ou mais)."
      ficha={fichaProfilaxiaUlceraEstresse}
    >
      <Bloco titulo="Úlcera de estresse (LAMG)" descricao={NOTA_AVC_ULCERA}>
        {ULCERA_ESTRESSE.map((u) => (
          <LinhaManual key={u.contexto} nome={u.contexto} texto={u.texto} conta={u.droga && <strong>{u.droga}</strong>} pagina={u.pagina} nota={u.nota} />
        ))}
      </Bloco>

      <Bloco titulo="IBP na dupla antiagregação plaquetária" descricao={`${IBP_DUPLA_ANTIAGREGACAO.texto}: ${IBP_DUPLA_ANTIAGREGACAO.droga} (${IBP_DUPLA_ANTIAGREGACAO.pagina}).`}>
        <Marca rotulo="Em uso de dupla antiagregação plaquetária" marcado={dupla} onChange={setDupla} />
        <p className="pt-1 text-sm font-semibold">Qualquer um destes</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CRITERIOS_ISOLADOS.map((c) => <Marca key={c.id} rotulo={c.rotulo} marcado={isolados.includes(c.id)} onChange={(v) => setIsolados((x) => alternar(x, c.id, v))} />)}
        </div>
        <p className="pt-1 text-sm font-semibold">Dois dos seguintes</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CRITERIOS_PAREADOS.map((c) => <Marca key={c.id} rotulo={c.rotulo} marcado={pareados.includes(c.id)} onChange={(v) => setPareados((x) => alternar(x, c.id, v))} />)}
          <Marca rotulo="Uso de álcool (ver errata)" marcado={alcool} onChange={setAlcool} />
        </div>
        <div className="rounded-lg border p-3 text-sm">
          {r.semDuplaAntiagregacao ? (
            <p className="text-muted-foreground">O critério da p. 208 vale para quem usa dupla antiagregação.</p>
          ) : r.criterioPresente ? (
            <p><Badge variant="warning" className="mr-2">critério do manual presente</Badge>{r.motivos.join('; ')}</p>
          ) : (
            <p className="text-muted-foreground">Nenhum critério da p. 208 marcado{r.alcoolAmbiguo ? ' (o álcool não é somado; ver errata)' : ''}.</p>
          )}
        </div>
        <p className="text-sm text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{ERRATA_ALCOOL}</p>
        <p className="text-sm text-muted-foreground">{NOTA_IAM_SUPRA}</p>
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {FORA_DO_LIVRO_ULCERA.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}

// LG8, decisão M2: endereço profissional do médico, que vai nos documentos
// emitidos à distância (teleinterconsulta; Res. CFM 2.314/2022, art. 13, a).
// Sem ele, o documento traz o endereço da unidade. Gravado pelo servidor
// (definir_meu_endereco_profissional): o perfil tem a escrita direta travada.
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export function CampoEnderecoProfissional({ inicial }: { inicial: string | null }) {
  const [atual, setAtual] = React.useState(inicial ?? '')
  const [valor, setValor] = React.useState(inicial ?? '')
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const texto = valor.trim()
  const mudou = texto !== atual
  const invalido = texto.length > 0 && (texto.length < 5 || texto.length > 300)

  async function salvar() {
    setSalvando(true)
    const { error } = await supabase.rpc('definir_meu_endereco_profissional', { p_endereco: texto || undefined })
    setSalvando(false)
    if (error) return setErro(error.message)
    setErro(null)
    setAtual(texto)
  }

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Label htmlFor="perf-endereco">Endereço profissional — vai nos documentos de telemedicina</Label>
      <div className="flex gap-2">
        <Input id="perf-endereco" maxLength={300} value={valor} placeholder="Rua, número, cidade/UF"
          aria-invalid={invalido || undefined} onChange={(e) => setValor(e.target.value)} />
        <Button type="button" variant="outline" disabled={!mudou || invalido || salvando} onClick={() => void salvar()}>Salvar</Button>
      </div>
      {invalido && <span className="text-rotulo text-atencao">De 5 a 300 caracteres.</span>}
      {!atual && !invalido && <span className="text-rotulo text-tinta-sussurro">Sem ele, os documentos de telemedicina trazem o endereço da unidade.</span>}
      {erro && <span role="alert" className="text-rotulo text-critico">{erro}</span>}
    </div>
  )
}

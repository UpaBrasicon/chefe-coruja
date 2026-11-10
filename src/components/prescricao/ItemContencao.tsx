import * as React from 'react'

import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// Item "Contenção mecânica" da prescrição (lacuna 4, K4; migration
// 20270325000001). O médico escreve o motivo, os pontos, o período previsto e
// os critérios de retirada; a ordem vale 24 horas e a nova é a renovação da
// anterior (Nota Técnica ANVISA GVIMS/GGTES/DIRE5 nº 07/2026). O servidor
// confere os campos e monta a descrição do item.

export type ItemContencaoNovo = { tipo: 'contencao'; pontos: number; periodo_h: number; motivo: string; criterios_retirada: string }

export function NovoItemContencao({ aoPrescrever }: { aoPrescrever: (item: ItemContencaoNovo) => Promise<void> }) {
  const [pontos, setPontos] = React.useState('')
  const [periodo, setPeriodo] = React.useState('')
  const [motivo, setMotivo] = React.useState('')
  const [criterios, setCriterios] = React.useState('')
  const [ocupado, setOcupado] = React.useState(false)
  const horas = Number(periodo)
  const pronto = !!pontos && Number.isInteger(horas) && horas >= 1 && horas <= 24 && motivo.trim().length >= 10 && criterios.trim().length >= 10
  async function prescrever() {
    setOcupado(true)
    try {
      await aoPrescrever({ tipo: 'contencao', pontos: Number(pontos), periodo_h: horas, motivo: motivo.trim(), criterios_retirada: criterios.trim() })
    } finally {
      setOcupado(false)
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-rotulo text-tinta-sussurro">
        Só quando é o único meio de prevenir dano imediato ou iminente (Resolução COFEN 746/2024). A prescrição vale 24 horas: para manter, prescreva de novo (a anterior é substituída).
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="cont-pontos">Pontos *</Label>
          <CampoSelecao id="cont-pontos" tamanho="compacto" value={pontos} onChange={(e) => setPontos(e.target.value)}>
            <option value="">Escolha…</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'ponto' : 'pontos'}</option>)}
          </CampoSelecao>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cont-periodo">Período previsto, em horas (até 24) *</Label>
          <Input id="cont-periodo" className="h-8" inputMode="numeric" value={periodo} onChange={(e) => setPeriodo(e.target.value.replace(/\D/g, ''))} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cont-motivo-presc">Motivo *</Label>
        <Textarea id="cont-motivo-presc" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="cont-criterios">Critérios de retirada *</Label>
        <Textarea id="cont-criterios" rows={2} value={criterios} onChange={(e) => setCriterios(e.target.value)} />
      </div>
      <Button size="sm" className="self-start" disabled={!pronto || ocupado} onClick={() => void prescrever()}>Prescrever contenção</Button>
    </div>
  )
}

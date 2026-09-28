import { useState } from 'react'

import {
  METODOS_REAQUECIMENTO, OUTROS_HIPOTERMIA, estagioHipotermia, fichaHipotermiaAdulto, rcpNaHipotermia, taxaReaquecimento,
} from '@/clinico/adulto/ambientais'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Bloco, LinhaManual } from './PecasLoteC'
import { Erratas, Escolhas, ListaLivro } from './PecasLoteE7'
import { br, lerNumero } from './loteE7Formato'

function CampoTemp({ id, rotulo, valor, onChange }: { id: string; rotulo: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} inputMode="decimal" value={valor} onChange={(e) => onChange(e.target.value)} className="max-w-40" />
    </div>
  )
}

/** Hipotermia acidental do adulto (cap. 102 do manual do HCFMUSP). */
export function HipotermiaAdulto() {
  const [temp, setTemp] = useState('')
  const [sinais, setSinais] = useState<'sim' | 'nao'>('sim')
  const [t1, setT1] = useState('')
  const [t2, setT2] = useState('')
  const [horas, setHoras] = useState('')

  const t = lerNumero(temp)
  const est = Number.isFinite(t) ? estagioHipotermia(t, sinais === 'nao') : null
  const rcp = rcpNaHipotermia(Number.isFinite(t) ? t : null)
  const taxa = taxaReaquecimento(lerNumero(t1), lerNumero(t2), lerNumero(horas))

  return (
    <ToolLayout
      title="Hipotermia acidental — estágio, RCP e reaquecimento (adulto)"
      description="Estágio pela temperatura central (Tabela 1), regras de RCP, adrenalina e desfibrilação por temperatura, método de reaquecimento (Tabelas 5 e 6) e taxa de reaquecimento, pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaHipotermiaAdulto}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <CampoTemp id="hip-t" rotulo="Temperatura central (°C)" valor={temp} onChange={setTemp} />
          <div className="flex flex-col gap-1.5">
            <Label>Sinais vitais presentes?</Label>
            <Escolhas valor={sinais} opcoes={[['sim', 'Sim'], ['nao', 'Não (sem sinais vitais)']] as const} onChange={setSinais} />
          </div>
        </CardContent>
      </Card>

      <Bloco titulo="Estágio — Tabela 1 (p. 1360) e reaquecimento — Tabela 6 (p. 1370)">
        {est ? (
          <>
            <LinhaManual nome={est.estagio} texto={est.nome} pagina="p. 1360" />
            {est.reaquecimento !== '—' && <LinhaManual nome="Reaquecimento (Tabela 6)" texto={est.reaquecimento} pagina="p. 1370" />}
            {est.nota && <p className="text-sm text-atencao">{est.nota}</p>}
          </>
        ) : <p className="text-sm text-muted-foreground">Informe a temperatura central.</p>}
      </Bloco>

      <Bloco titulo="RCP na hipotermia (p. 1366–1367)" descricao={Number.isFinite(t) ? `Para ${br(t)} °C.` : 'Temperatura desconhecida.'}>
        <LinhaManual nome="Ciclos de RCP" texto={rcp.ciclo} pagina="p. 1366" />
        <LinhaManual nome="Adrenalina e medicações" texto={rcp.adrenalina} pagina="p. 1366" />
        <LinhaManual nome="Desfibrilação" texto={rcp.desfibrilacao} pagina="p. 1367" />
      </Bloco>

      <Bloco titulo="Taxa de reaquecimento (Tabela 5, p. 1368–1369)" descricao="Falha do aquecimento passivo: aumento < 0,5 °C/hora.">
        <div className="grid gap-3 md:grid-cols-3">
          <CampoTemp id="hip-t1" rotulo="Temperatura inicial (°C)" valor={t1} onChange={setT1} />
          <CampoTemp id="hip-t2" rotulo="Temperatura atual (°C)" valor={t2} onChange={setT2} />
          <CampoTemp id="hip-h" rotulo="Intervalo (horas)" valor={horas} onChange={setHoras} />
        </div>
        <p className="text-sm tabular-nums">
          {taxa ? <><strong>{br(taxa.cPorHora, 2)} °C/h</strong>{taxa.falhaPassivo ? ' — abaixo de 0,5 °C/h (critério do livro de falha do passivo)' : ''}</> : 'informe as duas temperaturas e o intervalo'}
        </p>
        {METODOS_REAQUECIMENTO.map((m) => <LinhaManual key={m.metodo} nome={m.metodo} texto={`${m.tecnica}; indicação: ${m.indicacao}; ganho: ${m.taxa}`} pagina="p. 1368–1369" />)}
      </Bloco>

      <Bloco titulo="Outros números do capítulo">
        <ListaLivro itens={OUTROS_HIPOTERMIA} />
      </Bloco>

      <Bloco titulo="Errata e notas">
        <Erratas itens={[
          'p. 1360 — as faixas da Tabela 1 se tocam (35-32 e 32-28 °C): a ferramenta põe 32 °C em HT I e 28 °C em HT II.',
          'p. 1366 — o livro não traz intervalo de RCP próprio acima de 28 °C.',
          'p. 1368 — aquecimento ativo externo "aumenta de 0,6-2,5 °C" sem unidade de tempo.',
          'p. 1370 — a Tabela 6 escreve "Grau I / Graus 2 e 3 / Grau 4" para os estágios HT I a IV.',
        ]} />
      </Bloco>
    </ToolLayout>
  )
}

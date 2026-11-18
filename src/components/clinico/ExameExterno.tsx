// Exame feito fora da UBS, trazido em papel (percurso da UBS, U12 = A): o médico
// ou o enfermeiro registra o resultado sem pedido no app. Conta no hiperdia
// (HbA1c) e nos testes do pré-natal pela data do exame
// (registrar_exame_externo, migration 20270415000017).
import { useQueryClient } from '@tanstack/react-query'
import { FileInput } from 'lucide-react'
import * as React from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EXAMES_EXTERNOS, TITULOS_VDRL, valorExterno } from '@/domain/examesExternos'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

export function ExameExterno({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient()
  const [codigo, setCodigo] = React.useState('')
  const [data, setData] = React.useState('')
  const [valor, setValor] = React.useState('')
  const [lab, setLab] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [feito, setFeito] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const exame = EXAMES_EXTERNOS.find((x) => x.codigo === codigo)
  const hoje = dataIso()

  async function registrar() {
    if (!exame) return setErro('Escolha o exame.')
    if (!data) return setErro('Informe a data do exame.')
    const v = valorExterno(exame.tipo, valor)
    if (!v.ok) return setErro(v.erro)
    setErro(null); setSalvando(true)
    const { error } = await supabase.rpc('registrar_exame_externo', {
      p_paciente: pacienteId, p_procedimento: exame.codigo, p_data: data, p_valor: v.valor, p_laboratorio: lab.trim() || undefined,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    setFeito(`${exame.nome} registrado.`)
    setCodigo(''); setData(''); setValor(''); setLab('')
    void qc.invalidateQueries({ queryKey: ['hiperdia'] })
    void qc.invalidateQueries({ queryKey: ['pre-natal'] })
  }

  return (
    <section className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileInput className="size-4 text-acao" aria-hidden />
        <span className="text-controle font-semibold text-tinta">Exame feito fora</span>
        <span className="text-apoio text-tinta-sussurro">Resultado trazido em papel, sem pedido no app. Conta no hiperdia e no pré-natal pela data do exame.</span>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-[1_1_240px] flex-col gap-1.5">
          <Label htmlFor="externo-exame">Exame</Label>
          <CampoSelecao id="externo-exame" value={codigo} onChange={(e) => { setCodigo(e.target.value); setValor(''); setFeito(null) }}>
            <option value="">Escolha o exame</option>
            {EXAMES_EXTERNOS.map((x) => <option key={x.codigo} value={x.codigo}>{x.nome}</option>)}
          </CampoSelecao>
        </div>
        <div className="flex flex-[0_1_180px] flex-col gap-1.5">
          <Label htmlFor="externo-data">Data do exame</Label>
          <Input id="externo-data" type="date" max={hoje} value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="flex flex-[1_1_200px] flex-col gap-1.5">
          <Label htmlFor="externo-lab">Laboratório (opcional)</Label>
          <Input id="externo-lab" value={lab} onChange={(e) => setLab(e.target.value)} maxLength={160} />
        </div>
      </div>
      {exame?.tipo === 'percentual' && (
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="externo-valor">Valor (%)</Label>
          <Input id="externo-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 7,2" />
        </div>
      )}
      {exame && exame.tipo !== 'percentual' && (
        <div role="radiogroup" aria-label="Resultado" className="flex flex-wrap items-center gap-1.5">
          <Chip radio ativo={valor === 'nao_reagente'} onClick={() => setValor('nao_reagente')}>Não reagente</Chip>
          {exame.tipo === 'reagente'
            ? <Chip radio ativo={valor === 'reagente'} onClick={() => setValor('reagente')}>Reagente</Chip>
            : TITULOS_VDRL.map((t) => <Chip key={t} radio ativo={valor === t} onClick={() => setValor(t)}>{t}</Chip>)}
        </div>
      )}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
      {feito && <p role="status" className="text-apoio text-conforme">{feito}</p>}
      <div><Button size="sm" disabled={salvando || !exame} onClick={() => void registrar()}>Registrar exame feito fora</Button></div>
    </section>
  )
}

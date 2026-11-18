import * as React from 'react'

import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AVISO_FITA, CORES_BROSELOW, pesoDaCor, rotuloAlturaIdade, rotuloPesoDaCor, type CorBroselow } from '@/clinico/pediatria/fitaBroselow'
import { alterarPaciente, usePacienteCentral } from '@/lib/pacienteCentral'
import { leituraDaFita, origemDaCor } from '@/lib/fitaDoPeso'

// Campos grandes do Guia rápido (peso, idade e cor da fita), usados no início do
// guia e nas telas que ele abre (parada e reanimação da criança). Leem e gravam
// a Central do paciente desta aba.

export function CampoGrande({ id, rotulo, valor, unidade, aoMudar, modo }: {
  id: string; rotulo: string; valor: string; unidade: React.ReactNode; aoMudar: (v: string) => void; modo: 'decimal' | 'numeric'
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-corpo font-bold text-tinta">{rotulo}</label>
      <div className="flex h-15 items-center gap-1.5 rounded-container border-2 border-tinta bg-superficie px-3.5">
        <Input id={id} inputMode={modo} value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder="—"
          // padrao-ok: número grande no celular (pedido do RT), sem borda própria dentro da caixa
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-[24px] font-bold shadow-none focus-visible:shadow-none" />
        {typeof unidade === 'string' ? <span className="text-controle font-semibold text-tinta-apoio">{unidade}</span> : unidade}
      </div>
    </div>
  )
}

export function CorDaFita() {
  const p = usePacienteCentral()
  const { cor } = leituraDaFita(p)
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-corpo font-bold text-tinta">Cor Broselow</span>
      {/* lista própria, arredondada (pedido do RT): a do navegador não aceita canto arredondado */}
      <Select value={cor?.id ?? null} onValueChange={(v) => {
        const c = CORES_BROSELOW.find((x) => x.id === v)
        if (c) alterarPaciente({ peso: String(pesoDaCor(c)).replace('.', ','), origem: origemDaCor(c) })
      }}>
        <SelectTrigger aria-label="Cor da fita de Broselow"
          className="h-15 w-full rounded-container border-2 border-tinta bg-superficie px-3.5 text-corpo font-bold">
          <SelectValue placeholder="Selecione">
            {cor && (
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-5 rounded-capsula border border-tinta/40" style={{ background: cor.amostra }} />
                {cor.nome}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="rounded-cartao border-2 border-tinta p-1.5">
          {CORES_BROSELOW.map((c) => (
            <SelectItem key={c.id} value={c.id} className="min-h-14 rounded-container px-3 py-2">
              <span className="flex items-center gap-3">
                <span aria-hidden className="size-6 shrink-0 rounded-capsula border border-tinta/40" style={{ background: c.amostra }} />
                <span className="flex flex-col">
                  <span className="text-corpo font-bold text-tinta">{c.nome}</span>
                  <span className="text-rotulo text-tinta-apoio">{rotuloPesoDaCor(c)} · {rotuloAlturaIdade(c)}</span>
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function DetalheDaFita() {
  const p = usePacienteCentral()
  const { cor, pelaLista, leitura } = leituraDaFita(p)
  if (leitura.tipo === 'vazio') return null
  const faixa = (c: CorBroselow) => `${c.nome.toLowerCase()} (${c.pesoKg[0]}–${c.pesoKg[1]} kg)`
  const titulo = cor
    ? (pelaLista ? `Cor ${cor.nome.toLowerCase()} · ${rotuloPesoDaCor(cor)}` : `Peso ${p.peso.trim()} kg → cor ${faixa(cor)}`)
    : leitura.tipo === 'entre'
      ? `Peso ${p.peso.trim()} kg fica entre a cor ${faixa(leitura.abaixo)} e a ${faixa(leitura.acima)}`
      : `Peso ${p.peso.trim()} kg fora da fita (3 a 36 kg)`
  return (
    <div className="col-span-2 flex flex-col gap-1 rounded-container border border-fio-forte bg-superficie px-3.5 py-2.5">
      <span className="text-controle font-semibold text-tinta">{titulo}</span>
      <span className="text-rotulo text-tinta-apoio">{cor ? `${rotuloAlturaIdade(cor)}. ` : ''}{AVISO_FITA}</span>
    </div>
  )
}

import { Check, Clipboard, Printer, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DadosPaciente } from '../shared/DadosPaciente'
import { useEscalaSetores } from '../shared/useEscalaSetores'
import { carregarEnvelope, fmtData, hojeLocal, useRascunho, type DadosPaciente as DadosPacienteType } from '../shared/rascunho'

export type Receita = {
  tipo: 'branca' | 'azul' | 'amarela' | 'verde'
  itens: { id: string; medicamento: string; dose: string; posologia: string; quantidade: string }[]
  obs: string
}

export type RascunhoReceita = {
  paciente: DadosPacienteType
  receita: Receita
}

const RECEITA_INICIAL: RascunhoReceita = {
  paciente: {
    nome: '',
    nascimento: '',
    dataAtual: '',
    idade: '',
    peso: '',
    alergias: '',
    dieta: 'Dieta livre',
    leito: '',
    diagnostico: '',
  },
  receita: {
    tipo: 'branca',
    itens: [{ id: 'r1', medicamento: '', dose: '', posologia: '', quantidade: '' }],
    obs: '',
  },
}

function carregarReceita(chave: string): RascunhoReceita {
  const carregado = carregarEnvelope<RascunhoReceita>(chave)
  if (!carregado) return RECEITA_INICIAL
  try {
    const p = carregado.dados as Partial<RascunhoReceita>
    return {
      paciente: { ...RECEITA_INICIAL.paciente, ...(p.paciente ?? {}), dataAtual: hojeLocal() },
      receita: {
        tipo: 'branca',
        itens: [{ id: 'r1', medicamento: '', dose: '', posologia: '', quantidade: '' }],
        obs: '',
        ...(p.receita ?? {}),
      },
    }
  } catch {
    return RECEITA_INICIAL
  }
}

const TIPO_RECEITUARIO: { value: Receita['tipo']; label: string; cor: string }[] = [
  { value: 'branca', label: 'Branca (comum)', cor: '#ffffff' },
  { value: 'verde', label: 'Verde (antibióticos — B1)', cor: '#dcfce7' },
  { value: 'azul', label: 'Azul (controle especial — B2)', cor: '#dbeafe' },
  { value: 'amarela', label: 'Amarela (entorpecentes/psicotrópicos — A)', cor: '#fef3c7' },
]

export function ReceituarioMedico({
  unidadeId,
  perfilId,
}: {
  unidadeId?: string
  perfilId?: string
}) {
  const { dados, atualizar, salvoEm, limpar } = useRascunho<RascunhoReceita>(
    'receituario',
    unidadeId,
    perfilId,
    carregarReceita
  )
  const { data: escalaSetores } = useEscalaSetores(unidadeId, perfilId)
  const [copiado, setCopiado] = React.useState(false)

  function mudarItem(id: string, campo: keyof RascunhoReceita['receita']['itens'][number], valor: string) {
    atualizar({
      receita: {
        ...dados.receita,
        itens: dados.receita.itens.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)),
      },
    })
  }

  function adicionarItem() {
    atualizar({
      receita: {
        ...dados.receita,
        itens: [...dados.receita.itens, { id: crypto.randomUUID(), medicamento: '', dose: '', posologia: '', quantidade: '' }],
      },
    })
  }

  function removerItem(id: string) {
    atualizar({
      receita: { ...dados.receita, itens: dados.receita.itens.filter((i) => i.id !== id) },
    })
  }

  function corTipo(tipo: Receita['tipo']) {
    return TIPO_RECEITUARIO.find((t) => t.value === tipo)?.cor ?? '#ffffff'
  }

  async function copiar() {
    const linhas = dados.receita.itens
      .filter((i) => i.medicamento.trim())
      .map((i) => `${i.medicamento} — ${i.dose} · ${i.posologia} · Qtd: ${i.quantidade}`)
    const texto = [
      `RECEITUÁRIO ${TIPO_RECEITUARIO.find((t) => t.value === dados.receita.tipo)?.label.toUpperCase() ?? ''}`,
      `Paciente: ${dados.paciente.nome}`,
      `Data: ${fmtData(dados.paciente.dataAtual)}`,
      '',
      ...linhas,
      dados.receita.obs ? `\nObservações: ${dados.receita.obs}` : '',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  function imprimir() {
    const itens = dados.receita.itens.filter((i) => i.medicamento.trim())
    const linhas = itens
      .map(
        (i, idx) =>
          `<tr><td style="border:1px solid #000;padding:6px;width:6%;text-align:center;">${idx + 1}</td><td style="border:1px solid #000;padding:6px;"><strong>${i.medicamento.toUpperCase()}</strong>${i.dose ? ` <span style="font-weight:normal;">· ${i.dose}</span>` : ''}</td><td style="border:1px solid #000;padding:6px;width:9%;">${i.quantidade}</td></tr><tr><td style="border:1px solid #000;padding:2px 6px;font-style:italic;" colspan="3">Uso: ${i.posologia || '…'}</td></tr>`
      )
      .join('')
    const alergia =
      dados.paciente.alergias && dados.paciente.alergias.toUpperCase() !== 'NEGA'
        ? `<div style="background:#dc2626;color:#fff;padding:6px;text-align:center;font-weight:800;margin-bottom:10px;">⚠️ ALERGIA: ${dados.paciente.alergias.toUpperCase()} ⚠️</div>`
        : ''
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>Receituário</title>
      <style>
        @page{size:A4 portrait;margin:0}
        html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .folha{position:relative;width:210mm;min-height:297mm;padding:18mm;box-sizing:border-box;background:#fff}
        .rec{border:2px solid #000;background:#fff;padding:8mm;border-radius:6px;min-height:245mm;box-sizing:border-box}
        .rec-titulo{text-align:center;font-size:15px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #000;padding-bottom:4mm;margin-bottom:8mm}
        .rec-cabec{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6mm;border:1px solid #000;padding:4mm 5mm}
        table{border-collapse:collapse;width:100%;font-size:12px;color:#000}
        th{background:#f1f5f9;border:1px solid #000;padding:5px;font-size:10px;text-transform:uppercase}
        .ass{margin-top:18mm;text-align:center;font-size:12px}
        .obs{margin-top:8mm;border:1px dashed #000;padding:4mm;font-size:11px}
      </style></head>
      <body>
        <div class="folha"><div class="rec" style="background:${corTipo(dados.receita.tipo)};">
          <div class="rec-titulo">Receituário ${TIPO_RECEITUARIO.find((t) => t.value === dados.receita.tipo)?.label.toUpperCase()}</div>
          <div class="rec-cabec"><span><strong>Paciente:</strong> ${dados.paciente.nome || '____________________'}</span><span><strong>Data:</strong> ${fmtData(dados.paciente.dataAtual) || '____/___/____'}</span></div>
          ${alergia}
          ${itens.length ? `<table><thead><tr><th style="width:6%;text-align:center;">Nº</th><th>Medicamento</th><th style="width:9%;">Qtd</th></tr></thead><tbody>${linhas}</tbody></table>` : '<p style="text-align:center;color:#999;">Nenhum item preenchido.</p>'}
          <div class="ass">_________________________________________<br>Assinatura / Carimbo do Médico</div>
          ${dados.receita.obs ? `<div class="obs">Observações: ${dados.receita.obs}</div>` : ''}
        </div></div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      limpar() // LGPD: remove dados de paciente do navegador após emissão
    }, 300)
  }

  return (
    <div className="flex flex-col gap-4">
      <DadosPaciente
        unidadeId={unidadeId}
        perfilId={perfilId}
        dados={dados.paciente}
        onChange={(p) => atualizar({ paciente: { ...dados.paciente, ...p } })}
        escalaSetores={escalaSetores}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens do Receituário</CardTitle>
          <CardDescription>Tipo de receituário, medicamentos e posologias. Salvo automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Tipo de Receituário</Label>
            <div className="flex flex-wrap gap-2">
              {TIPO_RECEITUARIO.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => atualizar({ receita: { ...dados.receita, tipo: t.value } })}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    dados.receita.tipo === t.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {dados.receita.itens.map((item, idx) => (
              <div key={item.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Medicamento {idx + 1}
                  </span>
                  {dados.receita.itens.length > 1 && (
                    <Button size="xs" variant="ghost" onClick={() => removerItem(item.id)}>
                      <Trash2 /> Remover
                    </Button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Medicamento</Label>
                    <Input value={item.medicamento} onChange={(e) => mudarItem(item.id, 'medicamento', e.target.value)} placeholder="Ex: Dipirona 500 mg" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Dose / Concentração</Label>
                    <Input value={item.dose} onChange={(e) => mudarItem(item.id, 'dose', e.target.value)} placeholder="Ex: 01 comprimido" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Posologia</Label>
                    <Input value={item.posologia} onChange={(e) => mudarItem(item.id, 'posologia', e.target.value)} placeholder="Ex: 06/06h se dor ou febre" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Quantidade</Label>
                    <Input value={item.quantidade} onChange={(e) => mudarItem(item.id, 'quantidade', e.target.value)} placeholder="Ex: 20 comprimidos" />
                  </div>
                </div>
              </div>
            ))}
            <div>
              <Button variant="outline" onClick={adicionarItem}>
                <Plus /> Adicionar medicamento
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-obs">Observações</Label>
            <Textarea
              id="rec-obs"
              value={dados.receita.obs}
              onChange={(e) => atualizar({ receita: { ...dados.receita, obs: e.target.value } })}
              placeholder="Uso contínuo, jejum, validade, etc."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button onClick={imprimir} disabled={!dados.receita.itens.some((i) => i.medicamento.trim())}>
                <Printer /> Imprimir
              </Button>
              <Button variant="outline" onClick={copiar}>
                {copiado ? <Check className="text-emerald-600" /> : <Clipboard />} {copiado ? 'Copiado!' : 'Copiar'}
              </Button>
              <Button variant="ghost" onClick={limpar}>
                <Trash2 /> Limpar
              </Button>
            </div>
            {salvoEm && <span className="text-xs text-emerald-700">Salvo às {salvoEm}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { Check, Clipboard, Printer } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { DadosPaciente, Prescricao } from './rascunho'
import { CATEGORIAS, ITENS } from './prescricaoItens'

function fmtData(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function PrescricaoTab({
  dados,
  prescricao,
  onChange,
}: {
  dados: DadosPaciente
  prescricao: Prescricao
  onChange: (p: Partial<Prescricao>) => void
}) {
  const [copiado, setCopiado] = React.useState(false)
  const marcados = new Set(prescricao.marcados)

  function toggle(n: number) {
    const next = new Set(marcados)
    if (next.has(String(n))) next.delete(String(n))
    else next.add(String(n))
    onChange({ marcados: [...next] })
  }

  const itensSelecionados = ITENS.filter((i) => marcados.has(String(i.n)))

  async function copiar() {
    const linhas = itensSelecionados.map((i, idx) => `${String(idx + 1).padStart(2, '0')}\t${i.med}\t${i.via}\t${i.pos}`)
    const texto = [`Nome: ${dados.nome}`, `Data: ${fmtData(dados.dataAtual)}`, '', ...linhas].join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }

  function imprimir() {
    const tbody = itensSelecionados
      .map(
        (i, idx) => `<tr><td>${String(idx + 1).padStart(2, '0')}</td><td><strong>${i.med}</strong></td><td>${i.via}</td><td>${i.pos}</td><td>${i.apr ?? ''}</td></tr>`
      )
      .join('')
    const alergia = dados.alergias && dados.alergias.toUpperCase() !== 'NEGA'
      ? `<div style="background:#dc2626;color:#fff;padding:8px;text-align:center;font-weight:800;margin-bottom:10px;">⚠️ ALERGIA: ${dados.alergias.toUpperCase()} ⚠️</div>`
      : ''
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>Prescrição</title>
      <style>
        @page{size:A4 portrait;margin:0}
        html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .folha{position:relative;width:210mm;min-height:297mm;overflow:hidden}
        .folha>img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1}
        .conteudo{position:relative;z-index:10;margin:120px auto 0;width:90%}
        .cabec{border:1px solid #000;padding:6px 10px;margin-bottom:12px;font-size:13px;line-height:1.6;text-transform:uppercase;background:#fff}
        table{border-collapse:collapse;width:100%;background:#fff;color:#000;font-size:12px}
        th,td{border:1px solid #000;padding:6px;text-align:left;vertical-align:top}
        th{background:#fff;font-size:11px}
        td:first-child,th:first-child{width:6%;text-align:center}
        td:nth-child(2){width:44%}
        td:nth-child(3){width:8%;text-align:center}
        td:nth-child(4){width:9.5%}
        .ass{margin-top:2cm;text-align:center;font-size:13px;background:#fff}
        .obs{margin-top:10px;border:1px dashed #000;padding:8px;font-size:11px;background:#fff}
      </style></head>
      <body>
        <div class="folha">
          <img src="/plantao/background.png">
          <div class="conteudo">
            <div class="cabec">
              <div style="display:flex;justify-content:space-between"><strong>Nome:</strong> ${dados.nome || '____________________'}</div>
              <div style="display:flex;justify-content:space-between;margin-top:4px"><strong>Leito:</strong> ${dados.leito || '___'} <strong>Data:</strong> ${fmtData(dados.dataAtual)} <strong>Diagnóstico:</strong> ${dados.diagnostico || '____'}</div>
            </div>
            ${alergia}
            <table>
              <thead><tr><th>ITEM</th><th>NOME</th><th>VIA</th><th>POSOLOGIA</th><th>APRAZAMENTO</th></tr></thead>
              <tbody>${tbody}</tbody>
            </table>
            <div class="ass">_________________________________________<br>Assinatura / Carimbo do Médico</div>
            ${prescricao.obs ? `<div class="obs">Observações: ${prescricao.obs}</div>` : ''}
          </div>
        </div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens da Prescrição</CardTitle>
          <CardDescription>Marque os itens desejados. O preview mostra apenas os selecionados.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {CATEGORIAS.map((cat) => {
            const itens = ITENS.filter((i) => i.cat === cat.id)
            if (!itens.length) return null
            return (
              <div key={cat.id}>
                <div className="mb-2 border-b-2 border-primary pb-1 text-sm font-bold text-primary">
                  {cat.label}{' '}
                  {cat.desc && <span className="font-normal text-muted-foreground">({cat.desc})</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  {itens.map((i) => (
                    <label
                      key={i.n}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm transition-colors ${
                        marcados.has(String(i.n)) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                      }`}
                    >
                      <input type="checkbox" className="mt-0.5 size-4" checked={marcados.has(String(i.n))} onChange={() => toggle(i.n)} />
                      <span>
                        <span className="font-medium">
                          {i.n}. {i.med}
                        </span>
                        {i.via !== '---' && (
                          <span className="block text-xs text-muted-foreground">
                            {i.via} · {i.pos}
                            {i.apr ? ` · ${i.apr}` : ''}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Pré-visualização</CardTitle>
          <CardDescription>Reflete os itens selecionados.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {dados.alergias && dados.alergias.toUpperCase() !== 'NEGA' && (
            <div className="rounded-lg bg-red-600 px-4 py-3 text-center text-sm font-bold text-white">
              ⚠ ALERGIA: {dados.alergias.toUpperCase()}
            </div>
          )}
          <div className="rounded-lg border bg-white p-3 text-xs">
            <div className="mb-2 text-center font-bold uppercase">Prescrição Médica</div>
            <div className="mb-3 space-y-1 text-[11px]">
              <div className="flex justify-between gap-2">
                <span><strong>Nome:</strong> {dados.nome || '…'}</span>
                <span><strong>Nascimento:</strong> {dados.nascimento || '…'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span><strong>Leito:</strong> {dados.leito || '…'}</span>
                <span><strong>Data:</strong> {fmtData(dados.dataAtual) || '…'}</span>
                <span><strong>Diagnóstico:</strong> {dados.diagnostico || '…'}</span>
              </div>
            </div>
            {itensSelecionados.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">Nenhum item selecionado.</p>
            ) : (
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-y border-black bg-black text-white">
                    <th className="w-8 p-1.5">ITEM</th>
                    <th className="p-1.5">NOME</th>
                    <th className="w-10 p-1.5 text-center">VIA</th>
                    <th className="w-16 p-1.5">POSOLOGIA</th>
                  </tr>
                </thead>
                <tbody>
                  {itensSelecionados.map((i, idx) => (
                    <tr key={i.n} className="border-b border-black/20">
                      <td className="p-1.5 text-center font-bold text-muted-foreground">{String(idx + 1).padStart(2, '0')}</td>
                      <td className="p-1.5 font-medium">{i.med}</td>
                      <td className="p-1.5 text-center font-semibold text-primary">{i.via}</td>
                      <td className="p-1.5">{i.pos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="presc-obs">Observações</Label>
            <Textarea id="presc-obs" value={prescricao.obs} onChange={(e) => onChange({ obs: e.target.value })} placeholder="Dúvidas com a equipe de enfermagem, assinatura, etc." />
          </div>
          <div className="flex gap-2">
            <Button onClick={imprimir} disabled={!itensSelecionados.length}>
              <Printer /> Imprimir
            </Button>
            <Button variant="outline" onClick={copiar} disabled={!itensSelecionados.length}>
              {copiado ? <Check className="text-emerald-600" /> : <Clipboard />} {copiado ? 'Copiado!' : 'Copiar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

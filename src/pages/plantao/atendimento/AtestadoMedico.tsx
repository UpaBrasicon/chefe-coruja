import { Printer, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'
import { DadosPaciente } from '../shared/DadosPaciente'
import { useEscalaSetores } from '../shared/useEscalaSetores'
import { escapeHtml } from '@/lib/utils'
import { carregarEnvelope, fmtData, hojeLocal, useRascunho, type DadosPaciente as DadosPacienteType } from '../shared/rascunho'

export type Atestado = {
  tipo: 'comparecimento' | 'afastamento' | 'repouso'
  dias: string
  cid: string
  texto: string
}

export type RascunhoAtestado = {
  paciente: DadosPacienteType
  atestado: Atestado
}

const ATESTADO_INICIAL: RascunhoAtestado = {
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
  atestado: {
    tipo: 'comparecimento',
    dias: '1',
    cid: '',
    texto: '',
  },
}

function carregarAtestado(chave: string): RascunhoAtestado {
  const carregado = carregarEnvelope<RascunhoAtestado>(chave)
  if (!carregado) return ATESTADO_INICIAL
  try {
    const p = carregado.dados as Partial<RascunhoAtestado>
    return {
      paciente: { ...ATESTADO_INICIAL.paciente, ...(p.paciente ?? {}), dataAtual: hojeLocal() },
      atestado: { ...ATESTADO_INICIAL.atestado, ...(p.atestado ?? {}) },
    }
  } catch {
    return ATESTADO_INICIAL
  }
}

export function AtestadoMedico({
  unidadeId,
  perfilId,
}: {
  unidadeId?: string
  perfilId?: string
}) {
  const { dados, atualizar, salvoEm, limpar } = useRascunho<RascunhoAtestado>(
    'atestado',
    unidadeId,
    perfilId,
    carregarAtestado
  )
  const { data: escalaSetores } = useEscalaSetores(unidadeId, perfilId)

  const titulo = dados.atestado.tipo === 'comparecimento' ? 'ATESTADO DE COMPARECIMENTO' : dados.atestado.tipo === 'afastamento' ? 'ATESTADO DE AFASTAMENTO' : 'ATESTADO DE REPOUSO'

  function imprimir() {
    const nome = escapeHtml(dados.paciente.nome).toUpperCase() || '_________________________________'
    const data = fmtData(dados.paciente.dataAtual)
    const corpo =
      dados.atestado.tipo === 'comparecimento'
        ? `Atesto, para os devidos fins, que ${nome} compareceu a esta unidade em ${data}, necessitando de ${escapeHtml(dados.atestado.dias) || '…'} dia(s) de afastamento de suas atividades.`
        : dados.atestado.tipo === 'afastamento'
          ? `Atesto, para os devidos fins, que ${nome} esteve sob cuidados médicos, necessitando de ${escapeHtml(dados.atestado.dias) || '…'} dia(s) de afastamento de suas atividades laborais${dados.atestado.cid ? ` (CID: ${escapeHtml(dados.atestado.cid)})` : ''}.`
          : `Atesto, para os devidos fins, que ${nome} necessita de ${escapeHtml(dados.atestado.dias) || '…'} dia(s) de repouso, devendo manter-se em observação clínica.`
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>${titulo}</title>
      <style>
        @page{size:A4 portrait;margin:0}
        html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .folha{width:210mm;min-height:297mm;padding:20mm;box-sizing:border-box;background:#fff}
        .doc{border:2px solid #000;padding:12mm;min-height:250mm;box-sizing:border-box;display:flex;flex-direction:column}
        .titulo{text-align:center;font-size:16px;font-weight:800;letter-spacing:1px;border-bottom:2px solid #000;padding-bottom:5mm;margin-bottom:12mm;text-transform:uppercase}
        .corpo{flex-grow:1;font-size:13px;line-height:1.8;text-align:justify}
        .ass{margin-top:20mm;text-align:center;font-size:12px}
        .rodape{margin-top:8mm;text-align:center;font-size:10px;color:#666}
      </style></head>
      <body>
        <div class="folha"><div class="doc">
          <div class="titulo">${titulo}</div>
          <div class="corpo">${corpo}</div>
          ${dados.atestado.texto ? `<div class="corpo" style="margin-top:6mm;">Observações: ${escapeHtml(dados.atestado.texto)}</div>` : ''}
          <div class="ass">${data || '____/___/____'}<br>_________________________________________<br>Assinatura / Carimbo do Médico</div>
          <div class="rodape">Documento válido somente com assinatura e carimbo do profissional responsável.</div>
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
          <CardTitle className="text-base">Emitir Atestado</CardTitle>
          <CardDescription>Tipo, período e motivo. O texto é gerado automaticamente e salvo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de Atestado</Label>
              <Select value={dados.atestado.tipo || null} onValueChange={(v) => atualizar({ atestado: { ...dados.atestado, tipo: (v as Atestado['tipo']) ?? 'comparecimento' } })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comparecimento">Comparecimento</SelectItem>
                  <SelectItem value="afastamento">Afastamento</SelectItem>
                  <SelectItem value="repouso">Repouso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="at-dias">Período (dias)</Label>
              <Input id="at-dias" type="number" min={1} value={dados.atestado.dias} onChange={(e) => atualizar({ atestado: { ...dados.atestado, dias: e.target.value } })} />
            </div>
            {dados.atestado.tipo === 'afastamento' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="at-cid">CID (opcional)</Label>
                <BuscaTerminologia
                  tipo="cid10"
                  onSelecionar={(r) => atualizar({ atestado: { ...dados.atestado, cid: r.codigo } })}
                  placeholder="Buscar CID…"
                  className="w-full"
                />
                <Input
                  id="at-cid"
                  value={dados.atestado.cid}
                  onChange={(e) => atualizar({ atestado: { ...dados.atestado, cid: e.target.value } })}
                  placeholder="Ex: J06"
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="at-texto">Observações (opcional)</Label>
              <Input id="at-texto" value={dados.atestado.texto} onChange={(e) => atualizar({ atestado: { ...dados.atestado, texto: e.target.value } })} placeholder="Informações complementares" />
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 text-sm leading-relaxed">
            <div className="mb-2 text-center font-bold uppercase">{titulo}</div>
            <p>
              {dados.atestado.tipo === 'comparecimento' &&
                `Atesto, para os devidos fins, que ${dados.paciente.nome || '________'} compareceu a esta unidade em ${fmtData(dados.paciente.dataAtual) || '____/___/____'}, necessitando de ${dados.atestado.dias || '…'} dia(s) de afastamento de suas atividades.`}
              {dados.atestado.tipo === 'afastamento' &&
                `Atesto, para os devidos fins, que ${dados.paciente.nome || '________'} esteve sob cuidados médicos, necessitando de ${dados.atestado.dias || '…'} dia(s) de afastamento de suas atividades laborais${dados.atestado.cid ? ` (CID: ${dados.atestado.cid})` : ''}.`}
              {dados.atestado.tipo === 'repouso' &&
                `Atesto, para os devidos fins, que ${dados.paciente.nome || '________'} necessita de ${dados.atestado.dias || '…'} dia(s) de repouso, devendo manter-se em observação clínica.`}
            </p>
            {dados.atestado.texto && <p className="mt-2">Observações: {dados.atestado.texto}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button onClick={imprimir}>
                <Printer /> Imprimir
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

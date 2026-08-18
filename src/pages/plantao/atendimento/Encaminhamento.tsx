import { Printer, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DadosPaciente } from '../shared/DadosPaciente'
import { useEscalaSetores } from '../shared/useEscalaSetores'
import { carregarEnvelope, fmtData, hojeLocal, useRascunho, type DadosPaciente as DadosPacienteType } from '../shared/rascunho'

export type Encaminhamento = {
  especialidade: string
  prioridade: string
  resumo: string
}

export type RascunhoEnc = {
  paciente: DadosPacienteType
  encaminhamento: Encaminhamento
}

const ENC_INICIAL: RascunhoEnc = {
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
  encaminhamento: {
    especialidade: '',
    prioridade: 'Rotina',
    resumo: '',
  },
}

function carregarEnc(chave: string): RascunhoEnc {
  const carregado = carregarEnvelope<RascunhoEnc>(chave)
  if (!carregado) return ENC_INICIAL
  try {
    const p = carregado.dados as Partial<RascunhoEnc>
    return {
      paciente: { ...ENC_INICIAL.paciente, ...(p.paciente ?? {}), dataAtual: hojeLocal() },
      encaminhamento: { ...ENC_INICIAL.encaminhamento, ...(p.encaminhamento ?? {}) },
    }
  } catch {
    return ENC_INICIAL
  }
}

const ESPECIALIDADES = [
  'Clínica Geral',
  'Cardiologia',
  'Dermatologia',
  'Endocrinologia',
  'Gastroenterologia',
  'Ginecologia / Obstetrícia',
  'Neurologia',
  'Oftalmologia',
  'Ortopedia',
  'Otorrinolaringologia',
  'Pediatria',
  'Psiquiatria',
  'Urologia',
  'Cirurgia Geral',
  'Outra',
]

export function Encaminhamento({
  unidadeId,
  perfilId,
}: {
  unidadeId?: string
  perfilId?: string
}) {
  const { dados, atualizar, salvoEm, limpar } = useRascunho<RascunhoEnc>(
    'encaminhamento',
    unidadeId,
    perfilId,
    carregarEnc
  )
  const { data: escalaSetores } = useEscalaSetores(unidadeId, perfilId)

  function imprimir() {
    const nome = dados.paciente.nome.toUpperCase() || '_________________________________'
    const data = fmtData(dados.paciente.dataAtual)
    const hipotese = dados.paciente.diagnostico || '____________________'
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>Encaminhamento</title>
      <style>
        @page{size:A4 portrait;margin:0}
        html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .folha{width:210mm;min-height:297mm;padding:20mm;box-sizing:border-box;background:#fff}
        .doc{border:2px solid #000;padding:12mm;min-height:250mm;box-sizing:border-box;display:flex;flex-direction:column}
        .titulo{text-align:center;font-size:16px;font-weight:800;letter-spacing:1px;border-bottom:2px solid #000;padding-bottom:5mm;margin-bottom:10mm;text-transform:uppercase}
        .linha{display:flex;gap:8mm;font-size:12px;margin-bottom:4mm}
        .campo{flex:1;border:1px solid #000;padding:3mm}
        .campo strong{display:block;font-size:9px;text-transform:uppercase;margin-bottom:2mm;color:#444}
        .corpo{flex-grow:1;border:1px solid #000;padding:4mm;font-size:12px;line-height:1.7;margin-top:4mm;text-align:justify}
        .ass{margin-top:14mm;text-align:center;font-size:12px}
      </style></head>
      <body>
        <div class="folha"><div class="doc">
          <div class="titulo">Encaminhamento Médico</div>
          <div class="linha"><div class="campo"><strong>Paciente</strong>${nome}</div><div class="campo"><strong>Data</strong>${data || '____/___/____'}</div></div>
          <div class="linha"><div class="campo"><strong>Especialidade de destino</strong>${dados.encaminhamento.especialidade || '______________________'}</div><div class="campo"><strong>Prioridade</strong>${dados.encaminhamento.prioridade || 'Rotina'}</div></div>
          <div class="campo" style="margin-top:4mm;"><strong>Hipótese diagnóstica</strong>${hipotese}</div>
          <div class="corpo"><strong style="font-size:9px;text-transform:uppercase;color:#444;">Resumo clínico</strong><br><br>${(dados.encaminhamento.resumo || 'Resumo clínico do atendimento. ').replace(/\n/g, '<br>')}</div>
          <div class="ass">${data || ''}<br>_________________________________________<br>Assinatura / Carimbo do Médico</div>
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
          <CardTitle className="text-base">Encaminhamento</CardTitle>
          <CardDescription>Especialidade de destino, prioridade e resumo clínico. Salvo automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Especialidade de destino</Label>
              <Select value={dados.encaminhamento.especialidade || null} onValueChange={(v) => atualizar({ encaminhamento: { ...dados.encaminhamento, especialidade: v ?? '' } })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a especialidade" />
                </SelectTrigger>
                <SelectContent>
                  {ESPECIALIDADES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Prioridade</Label>
              <Select value={dados.encaminhamento.prioridade || null} onValueChange={(v) => atualizar({ encaminhamento: { ...dados.encaminhamento, prioridade: v ?? 'Rotina' } })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Urgência">Urgência</SelectItem>
                  <SelectItem value="Prioridade">Prioridade</SelectItem>
                  <SelectItem value="Rotina">Rotina</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="enc-resumo">Resumo clínico</Label>
            <Textarea
              id="enc-resumo"
              value={dados.encaminhamento.resumo}
              onChange={(e) => atualizar({ encaminhamento: { ...dados.encaminhamento, resumo: e.target.value } })}
              placeholder="Resumo do quadro clínico, exames e motivo do encaminhamento…"
              className="min-h-[180px]"
            />
          </div>

          <div className="rounded-lg border bg-muted p-3 text-sm text-muted-foreground">
            Hipótese diagnóstica (de Dados do Paciente):{' '}
            <strong className="text-foreground">{dados.paciente.diagnostico || '—'}</strong>
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

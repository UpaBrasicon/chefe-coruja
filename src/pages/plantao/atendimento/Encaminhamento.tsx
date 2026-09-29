import { Printer, Trash2 } from 'lucide-react'
import { abrirImpressao } from '@/lib/prontuario'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
import { usePacienteDaUrl } from '../shared/usePacienteDaUrl'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DadosPaciente } from '../shared/DadosPaciente'
import { useEscalaSetores } from '../shared/useEscalaSetores'
import { carregarEnvelope, hojeLocal, useRascunho, type DadosPaciente as DadosPacienteType } from '../shared/rascunho'

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
  const conteudoDoc = JSON.stringify(dados)
  const servidor = useRascunhoServidor(dados.paciente.paciente_id, 'encaminhamento', conteudoDoc)
  usePacienteDaUrl(dados.paciente, (p) => atualizar({ paciente: { ...dados.paciente, ...p } }))
  const { data: escalaSetores } = useEscalaSetores(unidadeId, perfilId)

  async function imprimir() {
    const impressao = await abrirImpressao({ pacienteId: dados.paciente.paciente_id, internacaoId: null, tipo: 'Encaminhamento', documento: { tipo: 'encaminhamento', conteudo: conteudoDoc }, rascunhoId: servidor.rascunhoId() })
    if (!impressao) return
    const printWindow = impressao.janela
    // a folha já veio pronta do servidor (Fase 4.2), ou é a provisória
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      servidor.emitido(conteudoDoc)
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

          <div className="rounded-lg border bg-trilha p-3 text-sm text-tinta-sussurro">
            Hipótese diagnóstica (de Dados do Paciente):{' '}
            <strong className="text-tinta">{dados.paciente.diagnostico || '—'}</strong>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button onClick={imprimir}>
                <Printer /> Imprimir
              </Button>
              <Button variant="ghost" onClick={() => { void servidor.descartar(); limpar() }}>
                <Trash2 /> Limpar
              </Button>
            </div>
            {salvoEm && <span className="text-xs text-conforme">Salvo às {salvoEm}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

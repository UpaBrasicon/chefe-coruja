import { Check, Clipboard, Printer, Plus, Trash2 } from 'lucide-react'
import { abrirImpressao } from '@/lib/prontuario'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'
import { usePacienteDaUrl } from '../shared/usePacienteDaUrl'
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
  const conteudoDoc = JSON.stringify(dados)
  const servidor = useRascunhoServidor(dados.paciente.paciente_id, 'receita', conteudoDoc)
  usePacienteDaUrl(dados.paciente, (p) => atualizar({ paciente: { ...dados.paciente, ...p } }))
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

  async function imprimir() {
    const impressao = await abrirImpressao({ pacienteId: dados.paciente.paciente_id, internacaoId: null, tipo: 'Receituário', documento: { tipo: 'receita', conteudo: conteudoDoc }, rascunhoId: servidor.rascunhoId() })
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
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                {copiado ? <Check className="text-conforme" /> : <Clipboard />} {copiado ? 'Copiado!' : 'Copiar'}
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

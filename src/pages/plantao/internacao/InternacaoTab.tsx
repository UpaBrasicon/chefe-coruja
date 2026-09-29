import { Printer } from 'lucide-react'
import { abrirImpressao } from '@/lib/prontuario'
import { useRascunhoServidor } from '@/hooks/useRascunhoServidor'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { Aih, DadosPaciente, Evolucao, Exames } from './rascunho'
import { AihTerminologia } from './AihTerminologia'

function hojeBR() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function InternacaoTab({
  dados,
  aih,
  evolucao,
  exames,
  onChange,
}: {
  dados: DadosPaciente
  aih: Aih
  evolucao: Evolucao
  exames: Exames
  onChange: (p: Partial<Aih>) => void
}) {
  function set(nome: keyof Aih, valor: string) {
    onChange({ [nome]: valor } as Partial<Aih>)
  }

  function preencherCamposPaciente() {
    const patch: Partial<Aih> = {}
    if (dados.nome) patch.campo5 = dados.nome.toUpperCase()
    if (dados.nascimento) patch.campo8 = dados.nascimento
    if (dados.diagnostico) patch.campo23 = dados.diagnostico.toUpperCase()
    if (!aih.campo34) patch.campo34 = hojeBR()
    onChange(patch)
  }

  function importarResumo() {
    const t = evolucao.texto.trim()
    if (!t) return
    let texto = t
    const idx = texto.search(/conduta:/i)
    if (idx > 0) texto = texto.substring(0, idx).trim()
    texto = texto.replace(/\n{3,}/g, '\n\n')
    set('campo20', texto)
    if (exames.texto.trim()) set('campo22', exames.texto.trim())
  }

  const campos: { nome: keyof Aih; rotulo: string; grid?: string; textarea?: boolean; min?: string; className?: string }[] = [
    { nome: 'campo1', rotulo: '1 - Nome do Estabelecimento Solicitante', className: 'col-span-2' },
    { nome: 'campo2', rotulo: '2 - CNES' },
    { nome: 'campo3', rotulo: '3 - Nome do Estabelecimento Executante', className: 'col-span-2' },
    { nome: 'campo4', rotulo: '4 - CNES' },
    { nome: 'campo5', rotulo: '5 - Nome do Paciente', className: 'col-span-2' },
    { nome: 'campo6', rotulo: '6 - Nº do Prontuário' },
    { nome: 'campo7', rotulo: '7 - Cartão Nacional de Saúde (CNS)', className: 'col-span-2' },
    { nome: 'campo8', rotulo: '8 - Data de Nascimento' },
    { nome: 'campo9', rotulo: '9 - Sexo' },
    { nome: 'campo10', rotulo: '10 - Raça/Cor' },
    { nome: 'campo10_1', rotulo: '10.1 - Etnia' },
    { nome: 'campo11', rotulo: '11 - Nome da Mãe', className: 'col-span-2' },
    { nome: 'campo12', rotulo: '12 - Telefone de Contato' },
    { nome: 'campo13', rotulo: '13 - Nome do Responsável', className: 'col-span-2' },
    { nome: 'campo14', rotulo: '14 - Telefone de Contato' },
    { nome: 'campo15', rotulo: '15 - Endereço (Rua, Nº, Bairro)', className: 'col-span-3' },
    { nome: 'campo16', rotulo: '16 - Município de Residência', className: 'col-span-2' },
    { nome: 'campo17', rotulo: '17 - Cód. IBGE' },
    { nome: 'campo18', rotulo: '18 - UF' },
    { nome: 'campo19', rotulo: '19 - CEP' },
    { nome: 'campo20', rotulo: '20 - Principais Sinais e Sintomas Clínicos', textarea: true, min: '130px', className: 'col-span-3' },
    { nome: 'campo21', rotulo: '21 - Condições que Justificam a Internação', textarea: true, min: '90px', className: 'col-span-3' },
    { nome: 'campo22', rotulo: '22 - Principais Resultados de Provas Diagnósticas', textarea: true, min: '90px', className: 'col-span-3' },
    { nome: 'campo23', rotulo: '23 - Diagnóstico Inicial', className: 'col-span-2' },
    { nome: 'campo24', rotulo: '24 - CID 10 Principal' },
    { nome: 'campo25', rotulo: '25 - CID 10 Secundário' },
    { nome: 'campo26', rotulo: '26 - CID 10 Causas Assoc.' },
    { nome: 'campo27', rotulo: '27 - Descrição do Procedimento Solicitado', className: 'col-span-2' },
    { nome: 'campo28', rotulo: '28 - Código do Procedimento' },
    { nome: 'campo29', rotulo: '29 - Clínica' },
    { nome: 'campo30', rotulo: '30 - Caráter da Internação' },
    { nome: 'campo31', rotulo: '31 - Documento' },
    { nome: 'campo32', rotulo: '32 - Nº Documento (CNS/CPF) do Profissional', className: 'col-span-2' },
    { nome: 'campo33', rotulo: '33 - Nome do Profissional Solicitante/Assistente', className: 'col-span-2' },
    { nome: 'campo34', rotulo: '34 - Data da Solicitação' },
    { nome: 'campo35', rotulo: '35 - Assinatura e Carimbo (Nº Reg. Conselho)' },
    { nome: 'campo46', rotulo: '46 - Nome do Profissional Autorizador', className: 'col-span-2' },
    { nome: 'campo47', rotulo: '47 - Cód. Órgão Emissor' },
    { nome: 'campo52', rotulo: '52 - Nº da AIH' },
    { nome: 'campo50', rotulo: '50 - Data da Autorização' },
    { nome: 'campo51', rotulo: '51 - Assinatura e Carimbo (Nº do Registro do Conselho)', className: 'col-span-2' },
  ]
  const conteudoDoc = JSON.stringify({
    paciente: dados,
    campos: campos.map((c) => ({ rotulo: c.rotulo, valor: aih[c.nome], textarea: !!c.textarea })),
  })
  const servidor = useRascunhoServidor(dados.paciente_id, 'laudo_aih', conteudoDoc)

  async function imprimir() {
    const impressao = await abrirImpressao({
      pacienteId: dados.paciente_id, internacaoId: null, tipo: 'Laudo de internação (AIH)',
      documento: { tipo: 'laudo_aih', conteudo: conteudoDoc }, rascunhoId: servidor.rascunhoId(),
    })
    if (impressao) servidor.emitido(conteudoDoc)
    if (!impressao) return
    const printWindow = impressao.janela
    // a folha já veio pronta do servidor (Fase 4.2), ou é a provisória
    printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-4">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Dados para Internação</CardTitle>
          <CardDescription>Importe o resumo e os exames das abas anteriores.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button variant="outline" onClick={preencherCamposPaciente} className="w-full">
            Preencher com dados do paciente
          </Button>
          <Button variant="outline" onClick={importarResumo} className="w-full">
            Importar resumo (Aba 3) + exames
          </Button>
          <div className="rounded-lg border border-dashed p-3 text-xs text-tinta-sussurro">
            O formulário abaixo é o Laudo para Solicitação de AIH. Todos os campos são editáveis e
            salvos automaticamente.
          </div>
        </CardContent>
      </Card>
      <AihTerminologia pacienteId={dados.paciente_id} aih={aih} set={set} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Laudo AIH — Pré-visualização</CardTitle>
          <CardDescription>Formulário editável · campos preenchidos automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border-2 border-black bg-white p-3" id="aih-form-print">
            <div className="mb-3 grid grid-cols-[80px_1fr_1fr] items-center gap-2 border-b-2 border-black pb-2">
              <div>
                <div className="text-lg font-black text-[#003d7a]">SUS</div>
                <div className="text-[10px] leading-tight">Sistema Único<br />de Saúde</div>
              </div>
              <div className="text-[11px]">Ministério da Saúde</div>
              <div className="text-center text-sm font-extrabold uppercase leading-tight">
                Laudo para Solicitação de<br />Autorização de Internação Hospitalar
              </div>
            </div>

            <div className="mb-2 border-y border-black bg-trilha px-2 py-1 text-[11px] font-extrabold uppercase">
              Identificação do Estabelecimento de Saúde
            </div>
            <div className="mb-2 border-y border-black bg-trilha px-2 py-1 text-[11px] font-extrabold uppercase">
              Identificação do Paciente
            </div>

            <div className="grid grid-cols-3 gap-px border border-black bg-black">
              {campos.map((c) => (
                <div key={c.nome} className={`flex flex-col bg-white p-1 ${c.className ?? ''}`}>
                  <Label className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-tinta">
                    {c.rotulo}
                  </Label>
                  {c.textarea ? (
                    <textarea
                      value={aih[c.nome]}
                      onChange={(e) => set(c.nome, e.target.value)}
                      style={{ minHeight: c.min }}
                      className="w-full resize-y bg-transparent text-xs outline-none"
                    />
                  ) : (
                    <input
                      value={aih[c.nome]}
                      onChange={(e) => set(c.nome, e.target.value)}
                      className="w-full bg-transparent text-xs outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button onClick={imprimir}>
              <Printer /> Imprimir Laudo AIH
            </Button>
            <span className="text-xs text-tinta-sussurro">salvo automaticamente</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

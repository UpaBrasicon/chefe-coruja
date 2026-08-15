import { Download, Loader2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Aih, DadosPaciente, Evolucao, Exames, Prescricao } from './rascunho'
import { ITENS } from './prescricaoItens'

function fmtData(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function esc(s: string) {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function ExportarTab({
  dados,
  prescricao,
  evolucao,
  exames,
  aih,
}: {
  dados: DadosPaciente
  prescricao: Prescricao
  evolucao: Evolucao
  exames: Exames
  aih: Aih
}) {
  const [selecionados, setSelecionados] = React.useState({ aba2: true, aba3: true, aba4: true, aba5: true })
  const [gerando, setGerando] = React.useState(false)
  const [erro, setErro] = React.useState<string | null>(null)

  const qtd = Object.values(selecionados).filter(Boolean).length

  function alternar(aba: keyof typeof selecionados) {
    setSelecionados((s) => ({ ...s, [aba]: !s[aba] }))
  }

  async function gerar() {
    const escolhidas = Object.entries(selecionados)
      .filter(([, v]) => v)
      .map(([k]) => k) as (keyof typeof selecionados)[]
    if (!escolhidas.length) {
      setErro('Selecione ao menos uma aba para exportar.')
      return
    }
    setGerando(true)
    setErro(null)
    try {
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const html2canvas = (html2canvasMod as unknown as { default: (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement> }).default
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      let primeira = true

      async function capturar(html: string, paisagem = false) {
        const div = document.createElement('div')
        div.style.cssText = 'position:fixed;left:-9999px;top:0;width:210mm;background:#fff;z-index:-9999;'
        if (paisagem) div.style.width = '297mm'
        div.innerHTML = html
        document.body.appendChild(div)
        const imgs = div.querySelectorAll('img')
        await Promise.all(
          [...imgs].map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete && img.naturalHeight > 0) return resolve()
                img.onload = () => resolve()
                img.onerror = () => resolve()
              })
          )
        )
        await new Promise((r) => setTimeout(r, 200))
        const canvas = await html2canvas(div, {
          scale: 2,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
        })
        document.body.removeChild(div)
        const imgData = canvas.toDataURL('image/jpeg', 0.92)
        if (!primeira) {
          pdf.addPage(paisagem ? [297, 210] : [210, 297])
        } else if (paisagem) {
          pdf.deletePage(1)
          pdf.addPage([297, 210])
        }
        const w = paisagem ? 297 : 210
        const h = paisagem ? 210 : 297
        pdf.addImage(imgData, 'JPEG', 0, 0, w, h)
        primeira = false
      }

      if (escolhidas.includes('aba2') && prescricao.marcados.length) {
        const itens = prescricao.marcados
          .map((n) => Number(n))
          .filter((n) => !isNaN(n))
        const tbody = itens
          .map((n, idx) => {
            const item = ITENS.find((i) => i.n === n)
            if (!item) return ''
            return `<tr><td>${String(idx + 1).padStart(2, '0')}</td><td><strong>${item.med}</strong></td><td>${item.via}</td><td>${item.pos}</td><td>${item.apr ?? ''}</td></tr>`
          })
          .join('')
        const alergia =
          dados.alergias && dados.alergias.toUpperCase() !== 'NEGA'
            ? `<div style="background:#dc2626;color:#fff;padding:8px;text-align:center;font-weight:800;margin-bottom:10px;">⚠️ ALERGIA: ${esc(dados.alergias.toUpperCase())} ⚠️</div>`
            : ''
        const obs = prescricao.obs
          ? `<div style="margin-top:10px;border:1px dashed #000;padding:8px;font-size:11px;background:#fff;">Observações: ${esc(prescricao.obs)}</div>`
          : ''
        await capturar(`
          <div style="position:relative;width:210mm;min-height:297mm;overflow:hidden;">
            <img src="/plantao/background.png" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;">
            <div style="position:relative;z-index:10;margin:120px auto 0;width:90%;background:#fff;">
              <div style="border:1px solid #000;padding:6px 10px;margin-bottom:12px;font-size:13px;line-height:1.6;text-transform:uppercase;">
                <div style="display:flex;justify-content:space-between"><strong>Nome:</strong> ${esc(dados.nome || '____________________')} <strong>Data de Nascimento:</strong> ${esc(dados.nascimento || '____/___/____')}</div>
                <div style="display:flex;justify-content:space-between;margin-top:4px"><strong>Leito:</strong> ${esc(dados.leito || '___')} <strong>Data:</strong> ${fmtData(dados.dataAtual)} <strong>Diagnóstico:</strong> ${esc(dados.diagnostico || '____')}</div>
              </div>
              ${alergia}
              <table style="border-collapse:collapse;width:100%;color:#000;font-size:12px;">
                <thead><tr><th style="border:1px solid #000;padding:6px;width:6%;text-align:center">ITEM</th><th style="border:1px solid #000;padding:6px;width:44%">NOME</th><th style="border:1px solid #000;padding:6px;width:8%;text-align:center">VIA</th><th style="border:1px solid #000;padding:6px;width:9.5%">POSOLOGIA</th><th style="border:1px solid #000;padding:6px">APRAZAMENTO</th></tr></thead>
                <tbody>${tbody}</tbody>
              </table>
              <div style="margin-top:2cm;text-align:center;font-size:13px;">_________________________________________<br>Assinatura / Carimbo do Médico</div>
              ${obs}
            </div>
          </div>`)
      }

      if (escolhidas.includes('aba3') && evolucao.texto.trim()) {
        const alergiaHtml =
          dados.alergias && dados.alergias.toUpperCase() !== 'NEGA'
            ? `<div style="background:#dc2626;color:#fff;padding:4px;text-align:center;font-weight:800;font-size:11px;margin-bottom:8px;">⚠️ ALERGIA: ${esc(dados.alergias.toUpperCase())} ⚠️</div>`
            : ''
        const cabecalho = evolucao.tipo === 'admissao' ? 'TERMO DE ADMISSÃO' : 'EVOLUÇÃO MÉDICA'
        const textoHtml = esc(evolucao.texto).replace(/\n/g, '<br>')
        await capturar(`
          <div style="position:relative;width:210mm;height:297mm;overflow:hidden;">
            <img src="/plantao/background.png" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;">
            <div style="position:relative;z-index:10;margin:120px auto 0;width:90%;display:flex;flex-direction:column;height:calc(297mm - 150px);">
              <div style="border:1px solid #000;padding:6px 10px;margin-bottom:6px;font-size:13px;line-height:1.6;text-transform:uppercase;background:#fff;">
                <div style="display:flex;justify-content:space-between"><strong>Nome:</strong> ${esc(dados.nome || '____________________')} <strong>Data de Nascimento:</strong> ${esc(dados.nascimento || '____/___/____')}</div>
                <div style="display:flex;justify-content:space-between;margin-top:4px"><strong>Leito:</strong> ${esc(dados.leito || '___')} <strong>Data:</strong> ${fmtData(dados.dataAtual)} <strong>Diagnóstico:</strong> ${esc(dados.diagnostico || '____')}</div>
              </div>
              <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:6px;text-decoration:underline;background:#fff;">${cabecalho}</div>
              ${alergiaHtml}
              <div style="flex-grow:1;border:1px solid #000;padding:10px 14px;font-size:11.5pt;line-height:1.5;overflow:hidden;background:#fff;white-space:pre-wrap;">${textoHtml}</div>
              <div style="margin-top:auto;padding-top:15px;padding-bottom:20px;text-align:center;font-size:11pt;background:#fff;">_________________________________________<br>Assinatura / Carimbo do Médico</div>
            </div>
          </div>`)
      }

      if (escolhidas.includes('aba4') && exames.texto.trim()) {
        const paciente = esc(dados.nome.trim().toUpperCase()) || 'PACIENTE NÃO IDENTIFICADO'
        const data = fmtData(dados.dataAtual)
        const linhas = exames.texto
          .split(/\n+/)
          .map((l) => l.replace(/^[-*•]\s*/, ''))
          .filter(Boolean)
        const listaHtml = linhas.map((l) => `<div style="margin-bottom:6px;">• ${esc(l)}</div>`).join('')
        await capturar(
          `<div style="position:relative;width:297mm;height:209mm;overflow:hidden;">
            <img src="/plantao/MODELO_EXAMES.png" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:1;display:block;">
            <div style="position:absolute;z-index:10;top:40mm;left:33mm;font-family:Arial;font-weight:bold;font-size:14px;color:black;white-space:nowrap;">${paciente}</div>
            <div style="position:absolute;z-index:10;top:193mm;left:20mm;font-family:Arial;font-weight:bold;font-size:14px;color:black;white-space:nowrap;">DATA: ${data}</div>
            <div style="position:absolute;z-index:10;top:80mm;left:20mm;width:250mm;height:110mm;font-family:Arial;font-weight:bold;font-size:14px;color:black;">${listaHtml}</div>
          </div>`,
          true
        )
      }

      if (escolhidas.includes('aba5')) {
        const rows = camposAIH(aih)
          .map(
            (c) =>
              `<div style="display:grid;grid-template-columns:34% 1fr;border-bottom:1px solid #000;min-height:24px;"><div style="font-size:7px;font-weight:700;text-transform:uppercase;padding:2px 4px;border-right:1px solid #000;display:flex;align-items:center;">${esc(c.rotulo)}</div><div style="font-size:10px;padding:2px 4px;word-wrap:break-word;white-space:${c.ta ? 'pre-wrap' : 'normal'};${c.ta ? 'font-size:9px;' : ''}">${(c.valor || '&nbsp;').replace(/\n/g, '<br>')}</div></div>`
          )
          .join('')
        await capturar(`
          <div style="width:210mm;min-height:297mm;background:#fff;padding:8mm;box-sizing:border-box;">
            <div style="border:2px solid #000;">
              <div style="display:grid;grid-template-columns:60px 1fr 1fr;align-items:center;border-bottom:2px solid #000;padding:4px 8px;min-height:38px;">
                <div style="font-size:14px;font-weight:900;color:#003d7a;">SUS<div style="font-size:6px;">Sistema Único de Saúde</div></div>
                <div style="font-size:11px;">Ministério da Saúde</div>
                <div style="font-size:12px;font-weight:800;text-align:center;text-transform:uppercase;">Laudo para Solicitação de<br>Autorização de Internação Hospitalar</div>
              </div>
              <div style="background:#e8e8e8;font-weight:800;font-size:10px;padding:3px 6px;border-bottom:1px solid #000;text-transform:uppercase;">Identificação do Estabelecimento de Saúde</div>
              ${rows}
            </div>
          </div>`)
      }

      const nome = dados.nome.trim()
      const nomeArquivo = nome
        ? `Internacao_${nome.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9\u00C0-\u024F_-]/g, '')}.pdf`
        : 'Internacao_Sem_Nome.pdf'
      pdf.save(nomeArquivo)
    } catch (e) {
      setErro('Erro ao gerar o PDF: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exportar Documentos em PDF</CardTitle>
          <CardDescription>Selecione as abas desejadas e baixe tudo em um único arquivo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="rounded-lg bg-muted p-4">
            <label className="mb-3 flex cursor-pointer items-center gap-2.5 font-bold text-primary">
              <input
                type="checkbox"
                className="size-[18px] accent-primary"
                checked={qtd === 4}
                onChange={() =>
                  setSelecionados(
                    qtd === 4 ? { aba2: false, aba3: false, aba4: false, aba5: false } : { aba2: true, aba3: true, aba4: true, aba5: true }
                  )
                }
              />
              Selecionar Tudo / Desmarcar Tudo
            </label>
            <div className="flex flex-col gap-2">
              {(
                [
                  ['aba2', '💊', 'Prescrição Médica'],
                  ['aba3', '📝', 'Admissão / Evolução'],
                  ['aba4', '🩸', 'Pedidos de Exames'],
                  ['aba5', '🏥', 'Laudo de Internação (AIH)'],
                ] as const
              ).map(([aba, icone, rotulo]) => (
                <label
                  key={aba}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-white p-2.5 text-sm font-medium"
                >
                  <input type="checkbox" className="size-4 accent-primary" checked={selecionados[aba]} onChange={() => alternar(aba)} />
                  <span>{icone}</span> {rotulo}
                </label>
              ))}
            </div>
          </div>

          {erro && <p className="text-sm font-semibold text-destructive">{erro}</p>}

          <Button onClick={gerar} disabled={gerando} size="lg" className="w-full text-base">
            {gerando ? <Loader2 className="animate-spin" /> : <Download />} Baixar Documentos Selecionados (PDF)
          </Button>

          <p className="text-xs text-amber-800">
            💡 O nome do arquivo será gerado a partir do nome do paciente preenchido em Dados do
            Paciente. As abas salvas automaticamente já estão prontas para exportação.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function camposAIH(aih: Aih) {
  return [
    { rotulo: '1 - Nome do Estabelecimento Solicitante', valor: aih.campo1 },
    { rotulo: '2 - CNES', valor: aih.campo2 },
    { rotulo: '3 - Nome do Estabelecimento Executante', valor: aih.campo3 },
    { rotulo: '4 - CNES', valor: aih.campo4 },
    { rotulo: '5 - Nome do Paciente', valor: aih.campo5 },
    { rotulo: '6 - Nº do Prontuário', valor: aih.campo6 },
    { rotulo: '7 - Cartão Nacional de Saúde (CNS)', valor: aih.campo7 },
    { rotulo: '8 - Data de Nascimento', valor: aih.campo8 },
    { rotulo: '9 - Sexo', valor: aih.campo9 },
    { rotulo: '10 - Raça/Cor', valor: aih.campo10 },
    { rotulo: '10.1 - Etnia', valor: aih.campo10_1 },
    { rotulo: '11 - Nome da Mãe', valor: aih.campo11 },
    { rotulo: '12 - Telefone de Contato', valor: aih.campo12 },
    { rotulo: '13 - Nome do Responsável', valor: aih.campo13 },
    { rotulo: '14 - Telefone de Contato', valor: aih.campo14 },
    { rotulo: '15 - Endereço (Rua, Nº, Bairro)', valor: aih.campo15 },
    { rotulo: '16 - Município de Residência', valor: aih.campo16 },
    { rotulo: '17 - Cód. IBGE', valor: aih.campo17 },
    { rotulo: '18 - UF', valor: aih.campo18 },
    { rotulo: '19 - CEP', valor: aih.campo19 },
    { rotulo: '20 - Principais Sinais e Sintomas Clínicos', valor: aih.campo20, ta: true },
    { rotulo: '21 - Condições que Justificam a Internação', valor: aih.campo21, ta: true },
    { rotulo: '22 - Principais Resultados de Provas Diagnósticas', valor: aih.campo22, ta: true },
    { rotulo: '23 - Diagnóstico Inicial', valor: aih.campo23 },
    { rotulo: '24 - CID 10 Principal', valor: aih.campo24 },
    { rotulo: '25 - CID 10 Secundário', valor: aih.campo25 },
    { rotulo: '26 - CID 10 Causas Assoc.', valor: aih.campo26 },
    { rotulo: '27 - Descrição do Procedimento Solicitado', valor: aih.campo27 },
    { rotulo: '28 - Código do Procedimento', valor: aih.campo28 },
    { rotulo: '29 - Clínica', valor: aih.campo29 },
    { rotulo: '30 - Caráter da Internação', valor: aih.campo30 },
    { rotulo: '31 - Documento', valor: aih.campo31 },
    { rotulo: '32 - Nº Documento (CNS/CPF) do Profissional', valor: aih.campo32 },
    { rotulo: '33 - Nome do Profissional Solicitante/Assistente', valor: aih.campo33 },
    { rotulo: '34 - Data da Solicitação', valor: aih.campo34 },
    { rotulo: '35 - Assinatura e Carimbo (Nº Reg. Conselho)', valor: aih.campo35 },
    { rotulo: '46 - Nome do Profissional Autorizador', valor: aih.campo46 },
    { rotulo: '47 - Cód. Órgão Emissor', valor: aih.campo47 },
    { rotulo: '52 - Nº da AIH', valor: aih.campo52 },
    { rotulo: '50 - Data da Autorização', valor: aih.campo50 },
    { rotulo: '51 - Assinatura e Carimbo (Nº do Registro do Conselho)', valor: aih.campo51 },
  ] as { rotulo: string; valor: string; ta?: boolean }[]
}

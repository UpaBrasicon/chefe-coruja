// Rodapé de conferência da folha assinada (LG7): QR code para o VALIDAR do ITI
// e o código impresso. Entra no HTML da folha antes de virar PDF e ser assinado.
import QRCode from 'qrcode'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export async function htmlDoRodape(url: string, codigo: string): Promise<string> {
  const svg = await QRCode.toString(url, { type: 'svg', margin: 0, width: 96, errorCorrectionLevel: 'M' })
  return `
<div class="cc-assinatura-icp" style="break-inside:avoid;margin-top:12px;border-top:1px solid #999;padding-top:8px;display:flex;gap:12px;align-items:center;font:9pt/1.35 Arial,Helvetica,sans-serif;color:#111">
  <div style="width:96px;height:96px;flex:none">${svg}</div>
  <div>
    <div style="font-weight:bold">Documento assinado digitalmente com certificado ICP-Brasil</div>
    <div>Confira em <b>validar.iti.gov.br</b> lendo o QR code e informando o código:</div>
    <div style="font:bold 11pt/1.4 'Courier New',monospace;letter-spacing:1px">${esc(codigo.replace(/(.{4})(?=.)/g, '$1 '))}</div>
    <div style="color:#444">Endereço: ${esc(url)}</div>
  </div>
</div>`
}

/** Põe o rodapé antes do fim do corpo da folha (ou no fim, se não houver </body>). */
export function comRodape(html: string, rodape: string): string {
  const i = html.toLowerCase().lastIndexOf('</body>')
  return i < 0 ? html + rodape : html.slice(0, i) + rodape + html.slice(i)
}

/** Resposta do endereço do QR code no formato que o VALIDAR pede. */
export function respostaValidar(urlPdf: string) {
  return { version: '1.0.0', prescription: { signatureFiles: [{ url: urlPdf }] } }
}

// O pacote qrcode não traz tipos; só o que o assinador usa.
declare module 'qrcode' {
  const QRCode: {
    toString(texto: string, opcoes: { type: 'svg'; margin?: number; width?: number; errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): Promise<string>
  }
  export default QRCode
}

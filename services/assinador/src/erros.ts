// Erro com o status HTTP que o servidor devolve e a mensagem que o médico lê.
// Fica fora do fluxo.ts para o cliente do provedor e o prazo usarem sem ciclo
// de importação (o fluxo.ts reexporta, e quem importava de lá continua igual).
export class ErroAssinador extends Error {
  status: number
  /** falha passageira (prazo estourado, rede, 502/503/504): só a consulta tenta de novo */
  transitorio: boolean
  constructor(status: number, mensagem: string, transitorio = false) {
    super(mensagem)
    this.status = status
    this.transitorio = transitorio
  }
}

// LG12, V2 = A: texto do e-mail ao responsável técnico quando chega um relato
// grave (óbito, dano permanente ou internação). Sem dado do paciente e sem a
// descrição livre: só o número, a ferramenta, a unidade e o prazo. O RT lê o
// resto na fila, dentro do sistema.

export type DadosAviso = {
  numero: number
  ferramenta_id: string
  versao: string | null
  desfecho: string | null
  unidade: string | null
  relatado_em: string
  prazo_em: string
  destinatarios: string[]
}

const DESFECHO: Record<string, string> = { grave: 'dano permanente ou internação', obito: 'óbito' }

const quando = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

export function assuntoAviso(d: DadosAviso): string {
  return `Tecnovigilância: relato grave nº ${d.numero} (${DESFECHO[d.desfecho ?? ''] ?? 'grave'})`
}

export function textoAviso(d: DadosAviso, origem: string): string {
  return [
    `Chegou um relato grave de tecnovigilância no módulo clínico.`,
    ``,
    `Relato nº ${d.numero}`,
    `Ferramenta: ${d.ferramenta_id}${d.versao ? `, versão ${d.versao}` : ''}`,
    `Desfecho informado: ${DESFECHO[d.desfecho ?? ''] ?? 'grave'}`,
    `Unidade: ${d.unidade ?? 'não informada'}`,
    `Recebido em: ${quando(d.relatado_em)} (Brasília)`,
    `Prazo (RDC 67/2009, art. 8º): ${quando(d.prazo_em)} (Brasília)`,
    ``,
    `Leia o relato e registre o andamento em Revisão Clínica, Tecnovigilância: ${origem}/revisao-clinica`,
    `Se for preciso, suspenda a versão na rede pela mesma tela.`,
    ``,
    `Este e-mail não traz dado do paciente.`,
  ].join('\n')
}

/** JSON só com ASCII (acentos chegam certos na Resend; ver enviar-codigo-2fa). */
export function jsonAscii(valor: unknown): string {
  return JSON.stringify(valor).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
}

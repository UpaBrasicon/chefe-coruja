// LG8, decisão M1 (RT, 18/11/2026): termo de consentimento para telemedicina
// (Res. CFM 2.314/2022, art. 15). O texto que vale é o do banco
// (private.texto_tcle_telemedicina, migration 20270418000092); este é o que a
// tela mostra para o médico ler ao paciente. Um teste confere que são iguais.

export const TEXTO_TCLE_TELEMEDICINA = [
  'O médico que está atendendo vai pedir a opinião de outro médico, que está em outro lugar, por meio da plataforma Chefe Coruja. '
    + 'Para isso, ele vai compartilhar com esse médico os dados e as imagens do seu atendimento que forem necessários.',
  'O médico à distância dá a opinião; quem decide o seu tratamento continua sendo o médico que está com você.',
  'Os dados ficam no seu prontuário, protegidos pela Lei Geral de Proteção de Dados, e só os médicos envolvidos têm acesso.',
  'Você pode recusar. Se recusar, o atendimento continua, sem a opinião do médico à distância.',
]

export type FormaConsentimento = 'assinatura_papel' | 'verbal_testemunha' | 'emergencia'

/** O que falta para solicitar (vazio = pode). Mesmas regras de solicitar_teleinterconsulta_com_termo. */
export function faltasDoConsentimento(c: {
  consentimento: string
  forma: FormaConsentimento | ''
  testemunha: string
  representante: string
  justificativa: string
}): string[] {
  const f: string[] = []
  if (!c.consentimento) return ['o consentimento']
  if (c.consentimento === 'emergencia_sem_condicao') {
    if (c.justificativa.trim().length < 15) f.push('por que não houve consentimento (15 caracteres ou mais)')
    return f
  }
  if (!c.forma || c.forma === 'emergencia') f.push('como o consentimento foi dado')
  if (c.forma === 'verbal_testemunha' && c.testemunha.trim().length < 5) f.push('o nome da testemunha da equipe')
  if (c.consentimento === 'representante_legal' && c.representante.trim().length < 5) f.push('o nome e o vínculo do representante legal')
  return f
}

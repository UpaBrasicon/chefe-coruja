import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto } from './fonte.ts'

// Meningite e encefalite do adulto (lacunas da Central, lote 2, 24/10/2026).
// Fonte: Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022), cap. 43
// Neuroinfecção no departamento de emergência (p. 589–597), lido no PDF (página do
// livro = página do PDF + 1); Tabela 1 (LCR, p. 590) e Tabela 2 (drogas e doses,
// p. 591–592). A Figura 2 (TC antes do LCR) é imagem e não entra como regra. O
// capítulo não traz quimioprofilaxia de contatos: ela vem do Guia de Vigilância em
// Saúde do MS (6ª ed. revisada, 2024, v. 1), lido no PDF (página impressa = página do
// PDF − 1): doença meningocócica, p. 116–118 e Quadro 3 (p. 117); Hib, p. 142–143 e
// Quadro 11 (p. 143). A ESCMID 2016 do levantamento não foi lida no texto e fica de
// fora. A conduta é do médico (ADR 0007).

const PAG_MENINGITE = 'cap. 43 Neuroinfecção no departamento de emergência, p. 589–597 (Tabelas 1 e 2, p. 590–592)'

const base = fichaAdulto('adulto-meningite', 'Meningite e encefalite — conduta inicial (adulto)', PAG_MENINGITE)

export const GUIA_VIGILANCIA_2024: Fonte = {
  citacao: 'Brasil. Ministério da Saúde. Secretaria de Vigilância em Saúde e Ambiente. Guia de vigilância em saúde: volume 1. 6. ed. rev. Brasília: Ministério da Saúde, 2024. Doença meningocócica, quimioprofilaxia (p. 116–118, Quadro 3, p. 117); outras meningites, quimioprofilaxia do H. influenzae tipo b (p. 142–143, Quadro 11, p. 143). Lido no PDF.',
  url: 'https://bvsms.saude.gov.br/bvs/publicacoes/guia_vigilancia_saude_6edrev_v1.pdf',
  pediatrica: true,
}

export const fichaMeningiteAdulto: Ficha = {
  ...base,
  versao: '2026-10-27.1',
  fontes: [...base.fontes, GUIA_VIGILANCIA_2024],
  revisadoEm: '27/10/2026 (quimioprofilaxia de contatos pelo Guia de Vigilância em Saúde 2024, com página)',
}

export type Esquema = { quem: string; antibiotico: string; corticoide: string }

/** Tabela 2 (p. 591–592), como o livro traz. */
export const TABELA2_MENINGITE: Esquema[] = [
  { quem: 'Bactéria não identificada (empírico)', antibiotico: 'ceftriaxona 2 g EV 12/12 h ± ampicilina 2 g EV 4/4 h, por 10–14 dias', corticoide: 'dexametasona 0,15 mg/kg/dose EV 6/6 h por 4 dias' },
  { quem: 'Streptococcus pneumoniae', antibiotico: 'ceftriaxona 2 g EV 12/12 h por 10–14 dias', corticoide: 'dexametasona 0,15 mg/kg/dose EV 6/6 h por 4 dias' },
  { quem: 'Neisseria meningitidis', antibiotico: 'ceftriaxona 2 g EV 12/12 h por 7 dias', corticoide: 'sem benefício, mas seguro' },
  { quem: 'Listeria monocytogenes', antibiotico: 'ampicilina 2 g EV 4/4 h por 21 dias', corticoide: 'não usar' },
  { quem: 'Haemophilus influenzae', antibiotico: 'ceftriaxona 2 g EV 12/12 h por 7 dias', corticoide: 'sem benefício, mas seguro' },
  { quem: 'Encefalite herpética', antibiotico: 'aciclovir 10 mg/kg/dose EV 8/8 h por 14–21 dias', corticoide: 'não usar' },
  { quem: 'Neurotuberculose', antibiotico: 'RIPE 4 comprimidos VO 1 vez ao dia por 2 meses + RI 2 comprimidos VO 1 vez ao dia por 7 meses (para mais de 50 kg)', corticoide: 'dexametasona 12–40 mg/dia EV inicialmente; desmame em 8 semanas' },
  { quem: 'Neurossífilis', antibiotico: 'penicilina cristalina 4 milhões UI EV 4/4 h por 14 dias', corticoide: 'não usar' },
  { quem: 'Meningite viral', antibiotico: 'suporte clínico', corticoide: 'podem ser usados' },
]

/** Grupos com risco de Listeria (p. 593); a nota da Tabela 2 sugere ampicilina acima de 50 anos (p. 592). */
export type RiscoListeria = { idadeAnos?: number; imunossuprimido?: boolean; corticoide?: boolean; gestante?: boolean }

export function riscoListeria(r: RiscoListeria): string[] {
  const motivos: string[] = []
  if (r.idadeAnos !== undefined && Number.isFinite(r.idadeAnos) && r.idadeAnos > 50) motivos.push('acima de 50 anos')
  if (r.imunossuprimido) motivos.push('imunossupressão')
  if (r.corticoide) motivos.push('uso de corticoide')
  if (r.gestante) motivos.push('gestação')
  return motivos
}

export type DosesPeso = { dexametasonaMg: number; aciclovirMg: number }

/** Dexametasona 0,15 mg/kg/dose e aciclovir 10 mg/kg/dose (Tabela 2, p. 591). */
export function dosesPorPeso(pesoKg: number): DosesPeso | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return { dexametasonaMg: 0.15 * pesoKg, aciclovirMg: 10 * pesoKg }
}

/** Suspeita clínica (p. 589): ao menos dois dos quatro sinais clássicos. */
export const SINAIS_CLASSICOS = ['Febre', 'Cefaleia', 'Alteração do nível de consciência', 'Rigidez de nuca'] as const

export function suspeitaMeningite(presentes: number): boolean {
  return presentes >= 2
}

/** Tabela 1 (p. 590): padrões do LCR. */
export const TABELA1_LCR: { exame: string; viral: string; herpetica: string; bacteriana: string; tuberculosa: string }[] = [
  { exame: 'Pressão de abertura', viral: 'normal', herpetica: 'normal', bacteriana: 'aumentada', tuberculosa: 'aumentada' },
  { exame: 'Celularidade', viral: '5–500', herpetica: '5–500', bacteriana: '> 1.000', tuberculosa: '5–1.000' },
  { exame: 'Diferencial', viral: 'linfócitos/monócitos', herpetica: 'linfócitos/monócitos', bacteriana: 'predomínio neutrofílico', tuberculosa: 'perfil misto' },
  { exame: 'Glicose', viral: 'normal', herpetica: 'normal', bacteriana: '< 40 mg/dL*', tuberculosa: '< 40 mg/dL*' },
  { exame: 'Proteína', viral: '< 100 mg/dL', herpetica: '< 100 mg/dL', bacteriana: '> 100 mg/dL', tuberculosa: '> 100 mg/dL' },
  { exame: 'Pró-calcitonina', viral: '< 0,25', herpetica: '< 0,25', bacteriana: '> 1,0', tuberculosa: 'incerto' },
  { exame: 'PCR sérica (mg/L)', viral: '< 8,0', herpetica: '< 8,0', bacteriana: '> 90,0', tuberculosa: 'incerto' },
]

/** Pontos do capítulo para a primeira hora (p. 589–594). */
export const PRIMEIRA_HORA: { texto: string; pagina: string }[] = [
  { texto: 'Sala de emergência ou UTI; isolamento respiratório em toda suspeita de meningite bacteriana.', pagina: 'p. 589' },
  { texto: 'Antibiótico é a prioridade máxima: a mortalidade pode subir até 15% por hora de atraso. Dar antes da hemocultura e do LCR se houver qualquer perspectiva de demora na coleta.', pagina: 'p. 590' },
  { texto: 'Dexametasona de preferência com a primeira dose do antibiótico, nos primeiros minutos, por ao menos 4 dias na meningite pneumocócica ou de agente não identificado.', pagina: 'p. 593–594' },
  { texto: 'Suspeita de encefalite herpética: aciclovir EV desde a suspeita, sem esperar a PCR (resultado a partir do 3º dia); monitorizar a função renal para reajuste.', pagina: 'p. 592, 594' },
  { texto: 'Vancomicina, muito citada nas diretrizes norte-americanas pela resistência do pneumococo à cefalosporina nos Estados Unidos: o uso de rotina não se justifica no Brasil.', pagina: 'p. 593' },
  { texto: 'Antes do LCR, verificar a segurança (hipertensão intracraniana grave ou lesão com efeito de massa); a Figura 2 mostra as duas abordagens de TC antes da punção.', pagina: 'p. 592' },
  { texto: 'Pedir de início: PCR para enterovírus, herpes 1/2 e M. tuberculosis, culturas, pBAAR, hemocultura, sorologias para HIV e sífilis e coagulação.', pagina: 'p. 592–593' },
]

// ── Quimioprofilaxia de contatos (Guia de Vigilância em Saúde 2024) ──────────

export type LinhaQuimio = { droga: string; idade: string; dose: string; intervalo: string; duracao: string }

/** Quadro 3 (p. 117): doença meningocócica, como o Guia traz. */
export const QUIMIO_MENINGOCOCO: LinhaQuimio[] = [
  { droga: 'Rifampicina', idade: '< 1 mês', dose: '5 mg/kg/dose', intervalo: '12 em 12 horas', duracao: '2 dias' },
  { droga: 'Rifampicina', idade: 'crianças ≥ 1 mês e adultos', dose: '10 mg/kg/dose (máximo de 600 mg)', intervalo: '12 em 12 horas', duracao: '2 dias' },
  { droga: 'Ceftriaxona', idade: '< 12 anos', dose: '125 mg intramuscular', intervalo: '—', duracao: 'dose única' },
  { droga: 'Ceftriaxona', idade: '≥ 12 anos', dose: '250 mg intramuscular', intervalo: '—', duracao: 'dose única' },
  { droga: 'Ciprofloxacino', idade: '> 18 anos', dose: '500 mg via oral', intervalo: '—', duracao: 'dose única' },
]

/** Quadro 11 (p. 143): H. influenzae, só rifampicina. */
export const QUIMIO_HIB: LinhaQuimio[] = [
  { droga: 'Rifampicina', idade: 'adultos', dose: '600 mg/dose', intervalo: '24 em 24 horas', duracao: '4 dias' },
  { droga: 'Rifampicina', idade: '≥ 1 mês até 10 anos', dose: '20 mg/kg/dose (dose máxima de 600 mg)', intervalo: '24 em 24 horas', duracao: '4 dias' },
  { droga: 'Rifampicina', idade: '< 1 mês', dose: '10 mg/kg/dose (dose máxima de 600 mg)', intervalo: '24 em 24 horas', duracao: '4 dias' },
]

/** Rifampicina no meningococo, adulto: 10 mg/kg/dose, máximo de 600 mg (Quadro 3, p. 117). */
export function rifampicinaMeningococoMg(pesoKg: number): number | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return Math.min(10 * pesoKg, 600)
}

/** Quem recebe e quando (p. 116–118 e 142), resumido do texto do Guia. */
export const INDICACOES_QUIMIO: { texto: string; pagina: string }[] = [
  { texto: 'Doença meningocócica: contatos próximos de caso suspeito — moradores do mesmo domicílio, quem divide o dormitório (alojamentos, quartéis), comunicantes de creches e escolas e pessoas diretamente expostas às secreções do paciente. Todos, qualquer que seja o estado vacinal.', pagina: 'p. 117–118' },
  { texto: 'Rifampicina é a escolha, dada a todos os contatos ao mesmo tempo e de preferência até 48 horas da exposição; ceftriaxona e ciprofloxacino são alternativas (Quadro 3).', pagina: 'p. 117' },
  { texto: 'O próprio paciente recebe o mesmo esquema na alta ou na internação, exceto se foi tratado com ceftriaxona.', pagina: 'p. 117' },
  { texto: 'Profissional de saúde só quando fez procedimento invasivo (intubação, sonda nasogástrica) sem EPI adequado.', pagina: 'p. 117' },
  { texto: 'Gestante: a rifampicina tem sido usada (sem evidência de teratogenicidade); o médico avalia risco e benefício.', pagina: 'p. 117, 142' },
  { texto: 'H. influenzae tipo b: no domicílio, contatos de qualquer idade quando há criança menor de 4 anos não vacinada ou parcialmente vacinada, ou criança imunocomprometida. Em creche, com dois ou mais casos em até 60 dias, todas as crianças e os cuidadores. O doente também, se não recebe cefalosporina de 3ª geração.', pagina: 'p. 142' },
  { texto: 'Contato domiciliar no Hib: quem mora com o doente ou passou 4 horas ou mais com ele em pelo menos 5 dos 7 dias antes dos sintomas.', pagina: 'p. 142' },
  { texto: 'Pneumococo e outras etiologias: o Guia indica quimioprofilaxia só para meningococo e Hib.', pagina: 'p. 142' },
]

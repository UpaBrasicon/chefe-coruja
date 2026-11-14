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
// Quadro 11 (p. 143). A ESCMID 2016 e a EAN–ESCMID 2026 entram ao lado do manual
// (lote 3 da revisão do HCFMUSP, abaixo). A conduta é do médico (ADR 0007).

const PAG_MENINGITE = 'cap. 43 Neuroinfecção no departamento de emergência, p. 589–597 (Tabelas 1 e 2, p. 590–592)'

const base = fichaAdulto('adulto-meningite', 'Meningite e encefalite — conduta inicial (adulto)', PAG_MENINGITE)

export const GUIA_VIGILANCIA_2024: Fonte = {
  citacao: 'Brasil. Ministério da Saúde. Secretaria de Vigilância em Saúde e Ambiente. Guia de vigilância em saúde: volume 1. 6. ed. rev. Brasília: Ministério da Saúde, 2024. Doença meningocócica, quimioprofilaxia (p. 116–118, Quadro 3, p. 117); outras meningites, quimioprofilaxia do H. influenzae tipo b (p. 142–143, Quadro 11, p. 143). Lido no PDF.',
  url: 'https://bvsms.saude.gov.br/bvs/publicacoes/guia_vigilancia_saude_6edrev_v1.pdf',
  pediatrica: true,
}

// Lote 3 da revisão do HCFMUSP, N2 (decisão do RT de 14/11/2026), cap. 43: a
// ESCMID 2016 de meningite bacteriana foi lida no texto integral (site da CMI,
// pelo Chrome do RT), com as Tabelas 4.1 a 4.3; a EAN–ESCMID 2026 de encefalite
// infecciosa foi lida no PMC. A ESCMID gradua de A (apoio forte) a D (contra);
// a EAN–ESCMID usa GRADE e "boa prática". Doses e contas do manual não mudam.
export const ESCMID_MENINGITE_2016: Fonte = {
  citacao: 'van de Beek D, Cabellos C, Dzupova O, et al. ESCMID guideline: diagnosis and treatment of acute bacterial meningitis. Clin Microbiol Infect. 2016;22(Suppl 3):S37–S62 (PMID 27062097). Texto integral lido, com as Tabelas 4.1 (empírico por idade), 4.2 (por agente) e 4.3 (profilaxia de contatos).',
  url: 'https://doi.org/10.1016/j.cmi.2016.01.007',
}

export const EAN_ESCMID_ENCEFALITE_2026: Fonte = {
  citacao: 'Granerod J, Sellner J, Stahl JP, et al. Diagnosis and Management of Infectious Encephalitis in Adults: Guidelines From the European Academy of Neurology and European Society of Clinical Microbiology and Infectious Diseases. Eur J Neurol. 2026;33(10):e70647 (PMID 42851210; PMC13650609). Texto integral lido.',
  url: 'https://doi.org/10.1111/ene.70647',
}

const SEM_ITEM_MEN = 'sem item do manual na ferramenta'

/** ESCMID 2016 (bacteriana) e EAN–ESCMID 2026 (encefalite) × manual e Guia do MS, um tema por linha. */
export const DIRETRIZ_MENINGITE: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Hemocultura e LCR', diretriz: 'Hemocultura antes da primeira dose do antibiótico; no LCR, celularidade, proteína, glicose, cultura e Gram', grau: 'A', fonte: 'ESCMID 2016', livro: 'antibiótico antes da hemocultura e do LCR se houver demora (p. 590); Tabela 1 (p. 590)' },
  { tema: 'Tomografia antes da punção', diretriz: 'Só com déficit neurológico focal (exceto paralisia de nervo craniano), crise convulsiva nova, Glasgow < 10 ou imunossupressão grave. Sem esses achados, a TC antes da punção não é recomendada', grau: 'A', fonte: 'ESCMID 2016', livro: 'verificar a segurança; a Figura 2 mostra duas abordagens de TC antes da punção (p. 592)' },
  { tema: 'Tempo até o antibiótico', diretriz: 'O quanto antes, sem passar de 1 h da chegada. Se a punção atrasar (por exemplo, pela TC), começar o empírico já na suspeita', grau: 'A', fonte: 'ESCMID 2016', livro: 'prioridade máxima; mortalidade sobe até 15% por hora de atraso (p. 590)' },
  { tema: 'Empírico de 18 a 50 anos', diretriz: 'Ceftriaxona 2 g 12/12 h (ou 4 g/dia) ou cefotaxima; somar vancomicina ou rifampicina onde há pneumococo com sensibilidade reduzida à penicilina', grau: 'A (Tabela 4.1)', fonte: 'ESCMID 2016', livro: 'ceftriaxona 2 g 12/12 h; vancomicina de rotina não se justifica no Brasil (p. 591–593)' },
  { tema: 'Acima de 50 anos ou risco de Listeria', diretriz: 'Somar amoxicilina ou ampicilina 2 g 4/4 h ao esquema acima', grau: 'A (Tabela 4.1)', fonte: 'ESCMID 2016', livro: 'ampicilina 2 g 4/4 h acima de 50 anos, na imunossupressão, com corticoide ou na gestação (p. 592–593)' },
  { tema: 'Duração', diretriz: 'Pneumococo 10–14 dias; meningococo 7; H. influenzae 7–10; Listeria 21 ou mais; sem agente isolado, no mínimo 2 semanas. Curso curto não é recomendado', grau: 'A; curso curto D', fonte: 'ESCMID 2016', livro: '10–14 dias (pneumococo e empírico), 7 (meningococo e Hib), 21 (Listeria) (Tabela 2, p. 591–592)' },
  { tema: 'Dexametasona: dose e início', diretriz: 'Adulto: 10 mg 6/6 h por 4 dias (A), começando com a primeira dose do antibiótico (A); se o antibiótico já foi dado, ainda até 4 h depois (C)', grau: 'A e C', fonte: 'ESCMID 2016', livro: '0,15 mg/kg/dose 6/6 h por 4 dias, de preferência com a primeira dose (Tabela 2, p. 591; p. 593–594)' },
  { tema: 'Dexametasona: quando suspender', diretriz: 'Suspender se não for meningite bacteriana ou se o agente não for H. influenzae nem pneumococo', grau: 'B', fonte: 'ESCMID 2016', livro: 'meningococo e Hib: sem benefício, mas seguro; Listeria: não usar (Tabela 2, p. 591–592)' },
  { tema: 'Adjuvantes de rotina', diretriz: 'Manitol, paracetamol, antiepiléptico, salina hipertônica, imunoglobulina e heparina de rotina não são recomendados; hipotermia também não', grau: 'D', fonte: 'ESCMID 2016', livro: SEM_ITEM_MEN },
  { tema: 'Profilaxia dos contatos (meningococo)', diretriz: 'Contatos domiciliares e próximos: ceftriaxona 250 mg IM dose única, ciprofloxacino 500 mg VO dose única ou rifampicina 600 mg 12/12 h por 2 dias (adulto), começando em até 24 h da identificação', grau: 'A (Tabela 4.3)', fonte: 'ESCMID 2016', livro: 'Guia do MS 2024: rifampicina 10 mg/kg (máx. 600 mg) 12/12 h por 2 dias, ceftriaxona 250 mg IM ou ciprofloxacino 500 mg, de preferência até 48 h (Quadro 3, p. 117)' },
  { tema: 'Depois da internação', diretriz: 'Audiometria durante a internação (A); vacina pneumocócica depois de meningite pneumocócica (B)', grau: 'A e B', fonte: 'ESCMID 2016', livro: SEM_ITEM_MEN },
  { tema: 'Encefalite: aciclovir', diretriz: 'Aciclovir EV o quanto antes na suspeita, idealmente em até 6 h da chegada, sem esperar imagem nem punção', grau: 'forte; certeza baixa', fonte: 'EAN–ESCMID 2026', livro: 'aciclovir desde a suspeita, sem esperar a PCR (p. 592, 594)' },
  { tema: 'Encefalite herpética: duração e suspensão', diretriz: 'HSV comprovado: no mínimo 14 dias de aciclovir EV. Suspender na baixa suspeita só se a PCR para HSV no LCR for negativa (punção > 72 h do início), a celularidade for normal e a RM não mostrar lesão temporal', grau: 'boa prática', fonte: 'EAN–ESCMID 2026', livro: 'aciclovir 10 mg/kg/dose 8/8 h por 14–21 dias (Tabela 2, p. 591)' },
  { tema: 'Encefalite: imagem e corticoide', diretriz: 'RM é a preferida, em até 24 h (no máximo 48 h). No HSV comprovado, não há recomendação a favor nem contra o corticoide', grau: 'boa prática; sem recomendação', fonte: 'EAN–ESCMID 2026', livro: 'corticoide: não usar na encefalite herpética (Tabela 2, p. 591)' },
]

export const DIFERENCAS_MENINGITE: string[] = [
  'Dexametasona: a ESCMID dá 10 mg fixos 6/6 h no adulto; o manual, 0,15 mg/kg/dose. A ESCMID aceita começar até 4 h depois do antibiótico (C).',
  'A ESCMID suspende a dexametasona se o agente não for pneumococo nem H. influenzae (B); o manual a mantém no meningococo como "segura".',
  'TC antes da punção: a ESCMID só a indica com déficit focal, crise nova, Glasgow < 10 ou imunossupressão grave (A); o manual remete à Figura 2.',
  'Profilaxia: a ESCMID começa em até 24 h e dá rifampicina 600 mg fixos; o Guia do MS fala em até 48 h e 10 mg/kg (máx. 600 mg).',
  'Vancomicina: a ESCMID soma vancomicina ou rifampicina onde há resistência do pneumococo; o manual não a usa de rotina no Brasil. As duas dependem da resistência local.',
  'Encefalite: a EAN–ESCMID 2026 fixa o aciclovir em até 6 h (forte) e diz que não há recomendação para corticoide no HSV; o manual diz "não usar".',
]

export const fichaMeningiteAdulto: Ficha = {
  ...base,
  versao: '2026-11-14.1',
  fontes: [...base.fontes, GUIA_VIGILANCIA_2024, ESCMID_MENINGITE_2016, EAN_ESCMID_ENCEFALITE_2026],
  revisadoEm: '14/11/2026 (ESCMID 2016 e EAN–ESCMID 2026 lidas no texto integral, ao lado do manual; lote 3 da revisão do HCFMUSP; aguarda aprovação do RT); 27/10/2026 (quimioprofilaxia de contatos pelo Guia de Vigilância em Saúde 2024, com página)',
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

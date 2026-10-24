import type { Ficha } from '../ficha.ts'
import { fichaAdulto } from './fonte.ts'

// Meningite e encefalite do adulto (lacunas da Central, lote 2, 24/10/2026).
// Fonte: Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022), cap. 43
// Neuroinfecção no departamento de emergência (p. 589–597), lido no PDF (página do
// livro = página do PDF + 1); Tabela 1 (LCR, p. 590) e Tabela 2 (drogas e doses,
// p. 591–592). A Figura 2 (TC antes do LCR) é imagem e não entra como regra. O
// capítulo não traz quimioprofilaxia de contatos; a ESCMID 2016 do levantamento não
// foi lida no texto e fica de fora. A conduta é do médico (ADR 0007).

const PAG_MENINGITE = 'cap. 43 Neuroinfecção no departamento de emergência, p. 589–597 (Tabelas 1 e 2, p. 590–592)'

export const fichaMeningiteAdulto: Ficha = {
  ...fichaAdulto('adulto-meningite', 'Meningite e encefalite — conduta inicial (adulto)', PAG_MENINGITE),
  versao: '2026-10-24.1',
  revisadoEm: '24/10/2026 (lacunas da Central, lote 2; doses conferidas no texto do manual, com página)',
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

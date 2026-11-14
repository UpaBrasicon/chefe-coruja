import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto } from './fonte.ts'
import { ATS_IRPA_2026 } from './ventilacaoMecanica.ts'
import { numero as numeroBr } from '../../lib/formato.ts'

// Intubação em sequência rápida do adulto — Anexo 1 do Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022), p. 1480–1482. Dose por kg e
// concentração da apresentação; o volume é calculado (as tabelas do livro vão
// de 40 a 100 kg e batem com a conta).

// .2: nota da divergência do midazolam (cap. 3 × Anexo 1)
// 2026-11-06.1: revisão PubMed de 09/10/2026, itens médios (decisão do RT em
// 06/11/2026, H4 = A): a nota da ATS 2026 sobre a pré-oxigenação entra na
// tela. O livro não tem texto ao lado; doses e volumes não mudam.
export const NOTA_ATS_PRE_OXIGENACAO =
  'ATS 2026: recomendação forte de CNAF ou VNI na pré-oxigenação antes da intubação, para prevenir hipoxemia peri-intubação.'

const fichaIsrLivro = fichaAdulto('adulto-isr', 'Intubação em sequência rápida — adulto', 'Anexo 1 — Padrão de diluição de medicações HC – adultos, p. 1480–1482; cap. 3, p. 60 e 64')
// Lote 2 da revisão do HCFMUSP, M2 (decisão do RT de 13/11/2026), cap. 3: a
// diretriz da Difficult Airway Society 2025 foi lida em 14/11/2026 no texto
// integral da BJA (acesso aberto), pelo Chrome do RT. São recomendações de
// consenso (Delphi), sem classe. O cap. 3 do manual (p. 54–65) foi conferido no
// PDF. Doses e volumes do Anexo 1 não mudam.
export const DAS_2025: Fonte = {
  citacao: 'Ahmad I, El-Boghdadly K, Iliff H, et al. Difficult Airway Society 2025 guidelines for management of unanticipated difficult tracheal intubation in adults. Br J Anaesth. 2026;136(1):283–307 (PMID 41203471). Texto integral lido (acesso aberto); recomendações de consenso, sem classe; Tabela 1 (sequência rápida).',
  url: 'https://doi.org/10.1016/j.bja.2025.10.006',
}

export const fichaIsrAdulto: Ficha = {
  ...fichaIsrLivro,
  versao: '2026-11-14.1',
  fontes: [...fichaIsrLivro.fontes, ATS_IRPA_2026, DAS_2025],
  revisadoEm: '14/11/2026 (DAS 2025 lida no texto integral, ao lado do manual; lote 2 da revisão do HCFMUSP; aguarda aprovação do RT); 06/11/2026 (nota da ATS 2026 na pré-oxigenação; revisão PubMed, itens médios)',
}

const SEM_ITEM_VA = 'sem item do manual na ferramenta'

/** DAS 2025 × manual (cap. 3), um tema por linha. A DAS não dá classe; "onde" é a seção. */
export const DIRETRIZ_DAS_2025: { tema: string; das: string; onde: string; livro: string }[] = [
  { tema: 'Avaliação da via aérea', das: 'Avaliar antes da indução, com história, exame e testes à beira do leito, incluindo a via aérea fisiologicamente difícil; localizar a membrana cricotireóidea (palpação ou USG) já na avaliação', onde: 'Airway assessment', livro: SEM_ITEM_VA },
  { tema: 'Pré-oxigenação', das: 'Em todos, com cabeceira elevada e técnica com pressão positiva (CNAF, VNI ou máscara com CPAP) quando possível; com máscara, alvo de fração expirada de O2 ≥ 0,9', onde: 'Peroxygenation; Monitoring', livro: 'O2 máximo por 3–5 min, inclinação de 30–45°, bolsa-válvula-máscara com reservatório a 15 L/min ou máscara não reinalante; VNI se SpO2 < 93% (Tabela 2, p. 57)' },
  { tema: 'Oxigenação apneica (peroxigenação)', das: 'Manter O2 da pré-oxigenação até a via aérea garantida; no risco de via aérea difícil, idealmente com CNAF. Não iniciar CNAF como resgate quando a máscara falhou', onde: 'Peroxygenation', livro: 'cateter a 15 L/min ou CNAF, "ainda sem grandes evidências" (Tabela 2, p. 57)' },
  { tema: 'Bloqueador neuromuscular', das: 'Usar de rotina e não atrasar para testar a máscara. Na sequência rápida, dose suficiente: rocurônio 1,2 mg/kg ou succinilcolina 1,5 mg/kg, sem intervalo após o indutor', onde: 'Drugs; Tabela 1', livro: 'rocurônio 1,2 mg/kg e succinilcolina 1,5 mg/kg (Anexo 1, p. 1480–1482)' },
  { tema: 'Indutor e hemodinâmica', das: 'Otimizar a hemodinâmica antes da indução e designar alguém para manejá-la. O propofol pode instabilizar; quetamina, etomidato ou remimazolam são alternativas no paciente fisiologicamente difícil', onde: 'Drugs; Physiologically difficult airway', livro: 'corrigir a PA com volume ou vasopressor; adrenalina em push-dose na hipotensão crítica (Tabela 2, p. 57–58)' },
  { tema: 'Laringoscópio', das: 'Videolaringoscópio de primeira linha sempre que possível. Com lâmina hiperangulada, usar fio-guia, bougie ou broncoscópio', onde: 'Plan A', livro: 'preferencialmente videolaringoscópio, método de escolha no DE (Tabela 2, p. 57)' },
  { tema: 'Número de tentativas', das: 'No máximo 3, mais 1 final por colega mais experiente (3 + 1), cada uma com alguma mudança. Hipoxemia interrompe a tentativa e volta à máscara', onde: 'Plan A', livro: 'no máximo 3 antes de SpO2 < 93% (p. 58); 3 tentativas sem sucesso definem via aérea falha (p. 62)' },
  { tema: 'Confirmação do tubo', das: 'Checagem em dois pontos: CO2 expirado sustentado na capnografia e tubo visto passando pelas cordas', onde: 'Plan A', livro: 'CO2 expirado obrigatório; capnografia com onda é o padrão-ouro (p. 58)' },
  { tema: 'Manobras laríngeas', das: 'Manipulação laríngea externa se a visão for ruim. Pressão cricoide pode ser usada no alto risco de aspiração, por assistente treinado, e deve ser retirada se piorar a visão ou na passagem do supraglótico', onde: 'Plan A; Rapid sequence induction', livro: 'Sellick contraindicada, BURP controversa; preferir laringoscopia bimanual (p. 58)' },
  { tema: 'Ventilação com máscara', das: 'Usar para manter a oxigenação entre as tentativas; na dificuldade, avisar a equipe e pedir ajuda', onde: 'Facemask ventilation', livro: 'não ventilar com bolsa-válvula-máscara se SpO2 ≥ 93% (Tabela 2, p. 57)' },
  { tema: 'Plano B: supraglótico', das: 'Se a intubação falhar, dispositivo supraglótico de 2ª geração, no máximo 3 tentativas; com oxigenação eficaz, parar, pensar e comunicar. Intubação às cegas pelo supraglótico não é recomendada', onde: 'Plan B', livro: 'dispositivo extraglótico no não intuba, não ventila, enquanto se prepara a cricotireoidostomia (p. 62)' },
  { tema: 'Plano C: máscara final', das: 'Última tentativa com máscara: bloqueio pleno, posição otimizada, cânulas e técnica a quatro mãos. Se falhar, declarar "não intuba, não oxigena"', onde: 'Plan C', livro: SEM_ITEM_VA },
  { tema: 'Plano D: cricotireoidostomia', das: 'Bisturi (lâmina 10), bougie e tubo 6,0. Incisão vertical na pele como padrão quando a membrana não for claramente palpável; pescoço em extensão máxima e dose plena de bloqueador antes', onde: 'Plan D', livro: 'cricotireoidostomia cirúrgica por incisão laterolateral, com bougie e tubo de 6 mm; punção com cateter 14G (Tabela 14, p. 62–63)' },
  { tema: 'Obeso', das: 'Cabeceira ≥ 30° na pré-oxigenação, CNAF na peroxigenação, supraglótico precoce se a máscara for ruim; considerar intubação acordada', onde: 'Obesity', livro: 'rampa torácica no posicionamento (Tabela 2, p. 58)' },
]

export const DIFERENCAS_DAS_2025: string[] = [
  'Tentativas: a DAS 2025 aceita 3 + 1 (a última por colega mais experiente); o manual fala em no máximo 3.',
  'Pressão cricoide: a DAS 2025 a permite no alto risco de aspiração, retirando-a se atrapalhar; o manual a contraindica.',
  'Cricotireoidostomia: a DAS 2025 usa incisão vertical na pele como padrão quando a membrana não é claramente palpável; o manual descreve incisão laterolateral.',
  'Pré-oxigenação: a DAS 2025 prefere técnica com pressão positiva (CNAF, VNI ou CPAP) em todos; o manual usa VNI só se SpO2 < 93%.',
  'Oxigenação apneica com CNAF: recomendada pela DAS 2025 no risco de via aérea difícil; o manual diz que ainda não tem grandes evidências.',
  'Doses de rocurônio (1,2 mg/kg) e succinilcolina (1,5 mg/kg) iguais nas duas fontes.',
  'A DAS 2025 foi escrita para anestesia; a sequência de planos A a D vale para o DE, mas o cenário (centro cirúrgico, acordar o paciente) nem sempre se aplica.',
]

export type DrogaIsr = {
  id: string
  nome: string
  papel: 'inducao' | 'analgesia' | 'bloqueio'
  /** mg/kg (ou dose fixa em µg quando `fixa`) */
  mgKg?: number
  fixa?: { minUg: number; maxUg: number }
  /** mg por mL (µg por mL no fentanil) */
  porMl: number
  /** conteúdo de uma ampola, na mesma unidade da dose */
  porAmpola: number
  apresentacao: string
  /** divergência dentro do próprio livro */
  nota?: string
}

export const DROGAS_ISR: DrogaIsr[] = [
  { id: 'propofol', nome: 'Propofol', papel: 'inducao', mgKg: 1.5, porMl: 10, porAmpola: 200, apresentacao: '10 mg/mL, ampola de 20 mL' },
  { id: 'midazolam', nome: 'Midazolam', papel: 'inducao', mgKg: 0.2, porMl: 5, porAmpola: 15, apresentacao: '5 mg/mL, ampola de 3 mL',
    nota: 'O cap. 3 (Tabelas 6 e 16, p. 60 e 64) traz 0,3 mg/kg; o Anexo 1 (p. 1480), usado aqui, traz 0,2 mg/kg.' },
  { id: 'etomidato', nome: 'Etomidato', papel: 'inducao', mgKg: 0.3, porMl: 2, porAmpola: 20, apresentacao: '2 mg/mL, ampola de 10 mL' },
  { id: 'quetamina', nome: 'Quetamina (cetamina)', papel: 'inducao', mgKg: 1.5, porMl: 50, porAmpola: 100, apresentacao: '50 mg/mL, ampola de 2 mL' },
  { id: 'fentanil', nome: 'Fentanil', papel: 'analgesia', fixa: { minUg: 50, maxUg: 150 }, porMl: 50, porAmpola: 500, apresentacao: '50 µg/mL, ampola de 10 mL' },
  { id: 'succinilcolina', nome: 'Succinilcolina', papel: 'bloqueio', mgKg: 1.5, porMl: 10, porAmpola: 100, apresentacao: '100 mg em 10 mL de diluente (10 mg/mL)' },
  { id: 'rocuronio', nome: 'Rocurônio', papel: 'bloqueio', mgKg: 1.2, porMl: 10, porAmpola: 50, apresentacao: '10 mg/mL, ampola de 5 mL' },
  { id: 'cisatracurio', nome: 'Cisatracúrio', papel: 'bloqueio', mgKg: 0.15, porMl: 2, porAmpola: 10, apresentacao: '2 mg/mL, ampola de 5 mL' },
]

export type DoseIsr = { dose: string; volumeMl: string; ampolas: number }

const br = (x: number) => numeroBr(Math.round(x * 100) / 100)

/** Dose, volume e nº de ampolas para o peso. Peso inválido não calcula. */
export function calcularIsr(d: DrogaIsr, pesoKg: number): DoseIsr | null {
  if (d.fixa) {
    return { dose: `${d.fixa.minUg}–${d.fixa.maxUg} µg`, volumeMl: `${br(d.fixa.minUg / d.porMl)}–${br(d.fixa.maxUg / d.porMl)}`, ampolas: 1 }
  }
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const mg = d.mgKg! * pesoKg
  return { dose: `${br(mg)} mg`, volumeMl: br(mg / d.porMl), ampolas: Math.ceil(mg / d.porAmpola - 1e-9) }
}

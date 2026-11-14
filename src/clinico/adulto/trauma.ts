import type { Ficha, Fonte } from '../ficha.ts'
import { completo, escolha, marcadas, numero, somar, type Escore, type Respostas } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'
import type { Faixa } from './pcr.ts'

// Trauma do adulto — Manual de Medicina de Emergência do HCFMUSP (3ª ed.,
// 2022): cap. 47 Atendimento inicial do politraumatizado (p. 636–657) e cap.
// 48 Atendimento pré-hospitalar (p. 658–677). NEXUS e regra canadense como o
// livro imprime (Tabela 1, p. 641–642), MGAP e Triage-RTS (p. 671–672), e as
// contas de tempo e volume do cap. 47. Hipotensão permissiva e ABC score já
// estão em ressuscitacaoVolemica.ts e transfusao.ts (não duplicados). O livro
// não traz índice de choque, classes do choque hemorrágico nem o RTS
// completo (com coeficientes). A decisão é do médico (ADR 0007).

// Revisão PubMed, itens médios (decisão do RT de 06/11/2026): ensaios
// posteriores ao livro entram como nota — o PATCH-Trauma no bloco do ácido
// tranexâmico e os ensaios sem benefício no bloco da circulação. Reforçam o
// protocolo do livro; nenhuma dose ou volume muda.
export const PATCH_TRAUMA_2023: Fonte = {
  citacao: 'PATCH-Trauma Investigators and the ANZICS Clinical Trials Group; Gruen RL, Mitra B, et al. Prehospital Tranexamic Acid for Severe Trauma. N Engl J Med. 2023;389(2):127–136 (PMID 37314244).',
  url: 'https://doi.org/10.1056/NEJMoa2215457',
}
export const CRYOSTAT2_2023: Fonte = {
  citacao: 'Davenport R, Curry N, Fox EE, et al. Early and Empirical High-Dose Cryoprecipitate for Hemorrhage After Traumatic Injury: The CRYOSTAT-2 Randomized Clinical Trial. JAMA. 2023;330(19):1882–1891 (PMID 37824155).',
  url: 'https://doi.org/10.1001/jama.2023.21019',
}
export const UK_REBOA_2023: Fonte = {
  citacao: 'Jansen JO, Hudson J, Cochran C, et al. Emergency Department Resuscitative Endovascular Balloon Occlusion of the Aorta in Trauma Patients With Exsanguinating Hemorrhage: The UK-REBOA Randomized Clinical Trial. JAMA. 2023;330(19):1862–1871 (PMID 37824132).',
  url: 'https://doi.org/10.1001/jama.2023.20850',
}
export const PROCOAG_2023: Fonte = {
  citacao: 'Bouzat P, Charbit J, Abback PS, et al. Efficacy and Safety of Early Administration of 4-Factor Prothrombin Complex Concentrate in Patients With Trauma at Risk of Massive Transfusion: The PROCOAG Randomized Clinical Trial. JAMA. 2023;329(16):1367–1375 (PMID 36942533).',
  url: 'https://doi.org/10.1001/jama.2023.4080',
}
export const SANGUE_TOTAL_SMITH_2026: Fonte = {
  citacao: 'Smith JE, Cardigan R, Sanderson E, et al. Prehospital Whole Blood in Traumatic Hemorrhage — A Randomized Controlled Trial. N Engl J Med. 2026;394(23):2305–2316 (PMID 41841706).',
  url: 'https://doi.org/10.1056/NEJMoa2516043',
}
export const SANGUE_TOTAL_SPERRY_2026: Fonte = {
  citacao: 'Sperry JL, Guyette FX, Cotton BA, et al. Prehospital Resuscitation with Type O Whole Blood for Trauma and Hemorrhage. N Engl J Med. 2026;394(23):2317–2328 (PMID 42150044).',
  url: 'https://doi.org/10.1056/NEJMoa2602167',
}

export const NOTA_PATCH_TRAUMA =
  'PATCH-Trauma (NEJM 2023): 1.310 adultos com trauma grave e suspeita de coagulopatia; TXA pré-hospitalar no mesmo esquema do livro (1 g + 1 g em 8 h) × placebo. Não aumentou a sobrevida com bom desfecho funcional em 6 meses (53,7% × 53,5%); a morte em 28 dias foi menor (17,3% × 21,8%), como desfecho secundário, sem diferença em eventos oclusivos. Reforça o esquema do livro.'

export const NOTA_ENSAIOS_NEGATIVOS_TRAUMA =
  'Ensaios posteriores ao livro, todos sem benefício — nada disto como rotina: crioprecipitado empírico precoce em dose alta (CRYOSTAT-2) não reduziu a morte em 28 dias; REBOA na sala de emergência (UK-REBOA) não reduziu e pode ter aumentado a mortalidade; complexo protrombínico sistemático no risco de transfusão maciça (PROCOAG) não reduziu hemocomponentes e teve mais eventos tromboembólicos (35% × 24%); sangue total pré-hospitalar (dois ECRs, NEJM 2026) não foi superior aos componentes. Reforçam o protocolo do livro.'

// Lote 3 da revisão do HCFMUSP, N2 (decisão do RT de 14/11/2026), cap. 47: a
// diretriz europeia de sangramento no trauma (6ª ed., 2023) foi lida no texto
// integral no PMC, com as 39 recomendações graduadas (1 = recomenda, 2 = sugere;
// A–C = qualidade). A EAST 2025 de ácido tranexâmico tem texto pago: entra só
// pelo resumo do PubMed. Doses e contas do manual não mudam.
export const EUROPEIA_SANGRAMENTO_TRAUMA_2023: Fonte = {
  citacao: 'Rossaint R, Afshari A, Bouillon B, et al. The European guideline on management of major bleeding and coagulopathy following trauma: sixth edition. Crit Care. 2023;27(1):80 (PMID 36859355; PMC9977110). Texto integral lido, com as 39 recomendações graduadas.',
  url: 'https://doi.org/10.1186/s13054-023-04327-7',
}

export const EAST_TXA_2025: Fonte = {
  citacao: 'Dumas RP, Succar BE, Vella MA, et al. The use of tranexamic acid in the management of injured patients at risk of hemorrhage: a systematic review and meta-analysis and an Eastern Association for the Surgery of Trauma Practice Management Guideline. J Trauma Acute Care Surg. 2025;99(5):785–794 (PMID 40956301). Texto pago: recomendações lidas no resumo do PubMed.',
  url: 'https://doi.org/10.1097/TA.0000000000004773',
}

const SEM_ITEM_TRAUMA = 'sem item do manual na ferramenta'

/** Europeia 2023 (sangramento no trauma) e EAST 2025 (ácido tranexâmico) × manual; um tema por linha. */
export const DIRETRIZ_TRAUMA: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Via aérea e ventilação', diretriz: 'Intubar sem demora com obstrução, Glasgow ≤ 8, hipoventilação ou hipoxemia (1B). Evitar hipoxemia (1A) e hiperóxia, salvo exsanguinação iminente (2B). Normoventilação (1B); hiperventilar só na herniação (2C)', grau: '1A a 2C', fonte: 'Europeia 2023', livro: 'IOT com Glasgow < 8 (p. 640) e via aérea definitiva com ≤ 8 (p. 649); saturação adequada ≥ 95% (p. 639)' },
  { tema: 'Compressão e torniquete', diretriz: 'Compressão local da ferida aberta; torniquete como adjunto no sangramento de extremidade com risco de vida, antes da cirurgia', grau: '1B', fonte: 'Europeia 2023', livro: 'torniquete por no máximo 2 h (p. 646)' },
  { tema: 'Gravidade do choque', diretriz: 'Avaliar fisiologia, padrão de lesão, mecanismo e resposta à reposição (1C). Usar índice de choque e/ou pressão de pulso para estimar o choque e a necessidade de transfusão (1C)', grau: '1C', fonte: 'Europeia 2023', livro: 'escore ABC > 2 para transfusão maciça (p. 647)' },
  { tema: 'Imagem', diretriz: 'POCUS com FAST no trauma toracoabdominal (1C); TC de corpo inteiro com contraste, precoce (1B)', grau: '1C e 1B', fonte: 'Europeia 2023', livro: 'FAST; sem ultrassom, lavado peritoneal diagnóstico (p. 648)' },
  { tema: 'Laboratório', diretriz: 'Hb ou Ht seriados (1B); lactato, ou déficit de bases na falta dele, para estimar o sangramento (1B); PT/INR, fibrinogênio de Clauss e plaquetas cedo e repetidos, ou método viscoelástico (1C)', grau: '1B e 1C', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'Alvo de pressão', diretriz: 'Reposição restrita com PAS 80–90 mmHg (PAM 50–60) até parar o sangramento, sem TCE (1B). TCE grave (Glasgow ≤ 8): PAM ≥ 80 (1C)', grau: '1B e 1C', fonte: 'Europeia 2023', livro: 'PAS 80–90 e PAM 50–60; TCE grave com PAM > 80 (p. 646)' },
  { tema: 'Vasopressor', diretriz: 'Se a reposição restrita não atingir o alvo, noradrenalina junto com fluidos (1C); dobutamina na disfunção miocárdica (1C)', grau: '1C', fonte: 'Europeia 2023', livro: 'vasopressor na hipotensão grave e inotrópico na disfunção miocárdica (p. 646)' },
  { tema: 'Tipo de fluido', diretriz: 'SF 0,9% ou cristaloide balanceado no hipotenso que sangra (1B); evitar soluções hipotônicas como o Ringer lactato no TCE grave (1B); restringir coloides (1C)', grau: '1B e 1C', fonte: 'Europeia 2023', livro: 'alíquotas de 250–500 mL; transfusão bem indicada se instável após 1–3 L de cristaloide (p. 646–647)' },
  { tema: 'Alvo de Hb', diretriz: 'Se transfundir hemácias, alvo de Hb 7–9 g/dL', grau: '1C', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'Hipotermia', diretriz: 'Medidas precoces contra a perda de calor e aquecimento até a normotermia', grau: '1C', fonte: 'Europeia 2023', livro: 'cristaloide aquecido a 38 °C (p. 644)' },
  { tema: 'Pelve', diretriz: 'Cinta pélvica no pré-hospitalar na suspeita de fratura (1C); fechar e estabilizar o anel pélvico no choque o quanto antes (1B)', grau: '1C e 1B', fonte: 'Europeia 2023', livro: 'dispositivo pélvico ou, sem ele, lençol na altura dos trocânteres (p. 648)' },
  { tema: 'REBOA', diretriz: 'Considerar no sangramento não compressível com risco de vida, como ponte até o controle (2C). O UK-REBOA (2023), posterior à busca da diretriz, não teve benefício: ver a nota da ficha', grau: '2C', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'Ácido tranexâmico', diretriz: 'O quanto antes, se possível no caminho, em até 3 h do trauma: 1 g em 10 min e 1 g EV em 8 h (1A). Não esperar o viscoelástico (1B)', grau: '1A e 1B', fonte: 'Europeia 2023', livro: '1 g EV em 10 min e 1 g em 8 h, com menos de 3 h do trauma (p. 649)' },
  { tema: 'Hemorragia maciça esperada', diretriz: 'Concentrado de fibrinogênio ou crioprecipitado com hemácias, ou plasma:hemácias de pelo menos 1:2 (1C); proporção alta de plaquetas (2B). Depois, guiar por exames ou viscoelástico (1B)', grau: '1C, 2B e 1B', fonte: 'Europeia 2023', livro: 'transfusão maciça na proporção 1:1:1 de plasma, plaquetas e hemácias (p. 647)' },
  { tema: 'Fibrinogênio', diretriz: 'Repor com fibrinogênio ≤ 1,5 g/L ou déficit no viscoelástico (1C); dose inicial de 3–4 g, ou 15–20 unidades de crioprecipitado (2C)', grau: '1C e 2C', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'Plaquetas e cálcio', diretriz: 'Plaquetas acima de 50.000/µL no sangramento e de 100.000/µL no TCE (2C). Cálcio iônico no normal, com cloreto de cálcio na hipocalcemia (1C)', grau: '2C e 1C', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'Fator VIIa', diretriz: 'Não usar como primeira linha (1B); só se o sangramento persistir apesar de todo o resto (2C)', grau: '1B e 2C', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'Varfarina', diretriz: 'Reverter na urgência com complexo protrombínico precoce e vitamina K 5–10 mg EV', grau: '1A', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'DOAC', diretriz: 'Apixabana ou rivaroxabana com sangramento grave: andexanete (2C); sem ele, ou na edoxabana, CCP 25–50 UI/kg (2C). Dabigatrana: idarucizumabe 5 g EV (1C)', grau: '2C e 1C', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'Antiagregante', diretriz: 'Não transfundir plaquetas de rotina no sangramento de quem usa antiagregante', grau: '1C', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'Hemocomponentes no pré-hospitalar', diretriz: 'Sem recomendação a favor nem contra', grau: 'sem recomendação', fonte: 'Europeia 2023', livro: SEM_ITEM_TRAUMA },
  { tema: 'Ácido tranexâmico (EAST)', diretriz: 'Em risco de hemorragia (PAS ≤ 90, FC ≥ 110 ou suspeita de sangramento ativo): uso de rotina no pré-hospitalar e no hospital, inclusive na hipotensão grave. Sem recomendação sobre bolus inicial maior', grau: 'condicional (GRADE); lido no resumo', fonte: 'EAST 2025', livro: '1 g EV em 10 min e 1 g em 8 h, com menos de 3 h do trauma (p. 649)' },
]

export const DIFERENCAS_TRAUMA: string[] = [
  'Transfusão maciça: o manual dá 1:1:1 de plasma, plaquetas e hemácias; a europeia de 2023 aceita fibrinogênio ou crioprecipitado com hemácias, ou plasma:hemácias de pelo menos 1:2, com plaquetas em proporção alta.',
  'A europeia de 2023 traz metas que o manual não traz: Hb 7–9 g/dL, fibrinogênio > 1,5 g/L (dose inicial de 3–4 g), plaquetas > 50.000 (> 100.000 no TCE) e cálcio iônico normal.',
  'Fluido: a europeia evita Ringer lactato no TCE grave e restringe coloides; o manual fala em alíquotas de cristaloide, sem separar o tipo.',
  'Gravidade: a europeia usa índice de choque e pressão de pulso; o manual usa o escore ABC para a transfusão maciça.',
  'Ácido tranexâmico, PAS/PAM alvo e vasopressor: a europeia e a EAST concordam com o manual.',
  'Anticoagulados: a europeia dá a reversão no trauma (CCP e vitamina K na varfarina; andexanete ou CCP nos anti-Xa; idarucizumabe 5 g); o cap. 47 não traz.',
]

const fichaTraumaLivro = fichaAdulto(
  'adulto-trauma-inicial',
  'Politraumatizado — tempos e volumes do atendimento inicial (adulto)',
  'cap. 47 Atendimento inicial do politraumatizado, p. 636–657; cap. 48 Atendimento pré-hospitalar, Tabela 3, p. 664',
)
export const fichaTraumaAdulto: Ficha = {
  ...fichaTraumaLivro,
  versao: '2026-11-14.1',
  fontes: [...fichaTraumaLivro.fontes, PATCH_TRAUMA_2023, CRYOSTAT2_2023, UK_REBOA_2023, PROCOAG_2023, SANGUE_TOTAL_SMITH_2026, SANGUE_TOTAL_SPERRY_2026, EUROPEIA_SANGRAMENTO_TRAUMA_2023, EAST_TXA_2025],
  revisadoEm: '14/11/2026 (europeia 2023 de sangramento no trauma lida no texto integral e EAST 2025 pelo resumo, ao lado do manual; lote 3 da revisão do HCFMUSP; aguarda aprovação do RT); 06/11/2026 (nota do PATCH-Trauma no ácido tranexâmico e dos ensaios sem benefício na circulação; revisão PubMed, itens médios)',
}

const valido = (x: number) => Number.isFinite(x) && x > 0
const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const sim = (e: Escore, r: Respostas, id: string) => escolha(e, r, id)?.valor === 1

/** Menor de 14 anos: os escores do livro não foram validados em pediatria (p. 643). */
const pediatrico = (idade: number | undefined) => idade !== undefined && idade < 14

// ── NEXUS (Tabela 1, p. 641; p. 643) ────────────────────────────────────────

const NEXUS_ITENS = [
  ['dor', 'Ausência de dor ou fragilidade na linha média cervical posterior'],
  ['intox', 'Sem evidência de intoxicação'],
  ['alerta', 'Paciente alerta (GCS 13–15)'],
  ['deficit', 'Sem déficit neurológico focal'],
  ['distrator', 'Sem outras fontes de dor significativas que prejudicam a atenção do paciente'],
] as const

export const nexus: Escore = {
  ficha: fichaAdulto('adulto-nexus', 'NEXUS — retirada do colar cervical (adulto)', 'cap. 47, Tabela 1, p. 641; restrições na p. 643'),
  descricao: 'Cinco critérios; todos presentes permitem, segundo o livro, retirar o colar sem exame de imagem. Não vale acima de 60 anos nem em criança.',
  itens: [
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 0, max: 130 },
    ...NEXUS_ITENS.map(([id, rotulo]) => ({ tipo: 'escolha' as const, id, rotulo, opcoes: NAO_SIM })),
  ],
  calcular(r) {
    if (!completo(nexus, r)) return null
    const idade = numero(nexus, r, 'idade')!
    const faltam = NEXUS_ITENS.filter(([id]) => !sim(nexus, r, id)).map(([, rotulo]) => rotulo)
    const cuidados = [
      'O livro: "NEXUS não pode ser usado em indivíduos > 60 anos" e "CCR e NEXUS não foram validados para utilização na pediatria" (p. 643).',
      'Em paciente inconsciente a lesão cervical não é descartada pelo exame físico; a proteção é prioritária (p. 641).',
    ]
    if (pediatrico(idade) || idade > 60) {
      return {
        rotulo: 'NEXUS', valor: 'não se aplica', nota: idade > 60 ? 'idade acima de 60 anos: fora do uso que o livro admite' : 'menor de 14 anos: sem validação pediátrica no livro',
        estado: 1, derivados: [['Critérios presentes', `${NEXUS_ITENS.length - faltam.length} de 5`]], cuidados,
      }
    }
    return {
      rotulo: 'NEXUS',
      valor: faltam.length === 0 ? 'todos presentes' : `${faltam.length} ausente${faltam.length > 1 ? 's' : ''}`,
      nota: faltam.length === 0 ? 'o livro: pode-se retirar o colar cervical sem exame de imagem' : 'nem todos os critérios estão presentes; o livro só libera sem imagem com os cinco',
      estado: faltam.length === 0 ? 0 : 1,
      derivados: faltam.map((f) => ['Ausente', f] as [string, string]),
      cuidados,
    }
  },
}

// ── Regra canadense da coluna cervical, como o livro imprime (p. 641–642) ────

const MECANISMO = [
  ['queda', 'Queda de mais de 1 m ou 5 degraus'],
  ['axial', 'Carga axial na cabeça (acidente por mergulho)'],
  ['velocidade', 'Colisão em alta velocidade (> 100 km/h)'],
  ['recreacional', 'Acidente com veículo motorizado recreacional'],
  ['ejecao', 'Ejeção de veículo'],
  ['bicicleta', 'Colisão de bicicleta/moto com objeto imóvel'],
] as const
const BAIXO = [
  ['traseira', 'Colisão automobilística simples, sentado na traseira'],
  ['deambulando', 'Estava ou esteve deambulando após o acidente'],
  ['tardia', 'Aparecimento tardio de dor no pescoço'],
] as const

export const regraCanadenseColuna: Escore = {
  ficha: fichaAdulto('adulto-regra-canadense-coluna', 'Regra canadense da coluna cervical (adulto)', 'cap. 47, Tabela 1, p. 641–642; restrição pediátrica na p. 643'),
  descricao: 'Três passos: fatores de alto risco, fatores de baixo risco e rotação ativa do pescoço a 45°, na forma da Tabela 1 do livro',
  itens: [
    { tipo: 'numero', id: 'idade', rotulo: 'Idade (alto risco: > 65 anos)', unidade: 'anos', min: 0, max: 130 },
    ...MECANISMO.map(([id, rotulo]) => ({ tipo: 'marca' as const, id, rotulo, pontos: 1, grupo: '1. Mecanismo perigoso (alto risco)' })),
    { tipo: 'marca', id: 'parestesia', rotulo: 'Parestesias nas extremidades', pontos: 1, grupo: '1. Alto risco' },
    ...BAIXO.map(([id, rotulo]) => ({ tipo: 'marca' as const, id, rotulo, pontos: 1, grupo: '2. Baixo risco' })),
    { tipo: 'escolha', id: 'rotacao', rotulo: '3. Capaz de girar o pescoço 45° para direita e esquerda', opcoes: [
      { rotulo: 'Ainda não avaliado', valor: 0 }, { rotulo: 'Capaz', valor: 1 }, { rotulo: 'Não capaz', valor: 2 },
    ] },
  ],
  calcular(r) {
    if (!completo(regraCanadenseColuna, r)) return null
    const e = regraCanadenseColuna
    const idade = numero(e, r, 'idade')!
    const alto = [...(idade > 65 ? ['Idade > 65 anos'] : []), ...marcadas(e, r).filter((m) => MECANISMO.some(([, t]) => t === m) || m.startsWith('Parestesias'))]
    const baixo = somar(e, r, BAIXO.map(([id]) => id)) > 0
    const rot = escolha(e, r, 'rotacao')!.valor
    const cuidados = [
      'O livro chama a regra de "CCTR (Canadian CT Trauma Rule)" e depois "CCR", e imprime os itens sob o título NEXUS (p. 641–642).',
      'A Tabela 1 indica radiografia quando não há fator de baixo risco, mas a mesma página diz que não há razão para radiografia de coluna cervical se houver TC (sensibilidade 52% x 98%, p. 642).',
      'Não validada em pediatria (p. 643).',
    ]
    if (pediatrico(idade)) return { rotulo: 'Regra canadense', valor: 'não se aplica', nota: 'menor de 14 anos: sem validação pediátrica no livro', estado: 1, derivados: [], cuidados }
    if (alto.length > 0) {
      return { rotulo: 'Regra canadense', valor: 'alto risco', nota: 'o livro: fator de alto risco presente, realizar tomografia de coluna cervical', estado: 2, derivados: alto.map((a) => ['Alto risco', a] as [string, string]), cuidados }
    }
    if (!baixo) {
      return { rotulo: 'Regra canadense', valor: 'sem baixo risco', nota: 'o livro: nenhuma situação de baixo risco, está indicada radiografia (ver cuidado sobre a TC)', estado: 1, derivados: [], cuidados }
    }
    if (rot === 0) return { rotulo: 'Regra canadense', valor: 'passo 3 pendente', nota: 'há fator de baixo risco; falta a rotação ativa a 45°', estado: 1, derivados: [], cuidados }
    if (rot === 2) return { rotulo: 'Regra canadense', valor: 'não gira 45°', nota: 'o livro: está indicada a tomografia de coluna cervical', estado: 2, derivados: [], cuidados }
    return {
      rotulo: 'Regra canadense', valor: 'gira 45°', estado: 0, derivados: [], cuidados,
      nota: 'a Tabela 1 não escreve a conclusão deste passo; o texto diz que a regra pode ser usada para retirar o colar sem exame de imagem em paciente alerta (p. 641)',
    }
  },
}

// ── MGAP (p. 671) ───────────────────────────────────────────────────────────

export const mgap: Escore = {
  ficha: fichaAdulto('adulto-mgap', 'MGAP — gravidade do trauma no pré-hospitalar (adulto)', 'cap. 48 Atendimento pré-hospitalar, p. 670–671'),
  descricao: 'Mecanismo, Glasgow, idade e pressão sistólica; soma de 3 a 29, com as faixas que o livro imprime',
  itens: [
    { tipo: 'escolha', id: 'mecanismo', rotulo: 'Mecanismo de trauma', opcoes: [{ rotulo: 'Fechado (0)', valor: 0 }, { rotulo: 'Aberto (4)', valor: 4 }] },
    { tipo: 'numero', id: 'gcs', rotulo: 'Escala de coma de Glasgow (pontua o próprio valor)', min: 3, max: 15 },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [{ rotulo: '< 60 anos (5)', valor: 5 }, { rotulo: '≥ 60 anos (0 — o livro não pontua)', valor: 0 }] },
    { tipo: 'escolha', id: 'pas', rotulo: 'Pressão arterial sistólica', opcoes: [{ rotulo: '> 120 mmHg (5)', valor: 5 }, { rotulo: '60–120 mmHg (3)', valor: 3 }, { rotulo: '< 60 mmHg (0)', valor: 0 }] },
  ],
  calcular(r) {
    if (!completo(mgap, r)) return null
    const total = somar(mgap, r) + numero(mgap, r, 'gcs')!
    const faixa = total <= 17 ? '3–17' : total <= 22 ? '18–22' : '23–29'
    const rotuloLivro = total <= 17 ? 'leve' : total <= 22 ? 'moderado' : 'grave'
    return {
      rotulo: 'MGAP',
      valor: String(total),
      unidade: 'de 29',
      nota: `faixa ${faixa} — o livro chama de "${rotuloLivro}" (ver errata)`,
      estado: 1,
      derivados: [['Faixa do livro', `${faixa} ("${rotuloLivro}")`]],
      alerta: 'Errata: nesta escala a pontuação sobe com Glasgow maior, idade < 60 e PAS maior, mas o livro chama 3–17 de "leve" e 23–29 de "grave". Um paciente com Glasgow 3 e PAS < 60 somaria 3 a 7 e cairia em "leve". Os rótulos parecem invertidos; a faixa é mostrada e o rótulo do livro não é usado como gravidade.',
      cuidados: [
        'Desenvolvido pelo SAMU da França para sistemas de APH com médico (p. 671).',
        'O livro dá 5 pontos para idade < 60 anos e não escreve a pontuação de ≥ 60 (lida como 0).',
        'Mecanismo "aberto = 4, fechado = 0" está como o livro imprime; não foi conferido contra o artigo original.',
      ],
    }
  },
}

// ── Triage-RTS (Tabela 4, p. 672) ───────────────────────────────────────────

/** Pontos do Glasgow na Tabela 4: 13–15 = 4; 9–12 = 3; 6–8 = 2; 4–5 = 1; 3 = 0. */
export const pontoGcsRts = (g: number) => (g >= 13 ? 4 : g >= 9 ? 3 : g >= 6 ? 2 : g >= 4 ? 1 : 0)
/** PAS: > 89 = 4; 76–89 = 3; 50–75 = 2; 1–49 = 1; 0 = 0 (valores inteiros). */
export const pontoPasRts = (p: number) => (p > 89 ? 4 : p >= 76 ? 3 : p >= 50 ? 2 : p >= 1 ? 1 : 0)
/** FR: 10–29 = 4; > 29 = 3; 6–9 = 2; 1–5 = 1; 0 = 0. */
export const pontoFrRts = (f: number) => (f > 29 ? 3 : f >= 10 ? 4 : f >= 6 ? 2 : f >= 1 ? 1 : 0)

export const triageRts: Escore = {
  ficha: fichaAdulto('adulto-triage-rts', 'Triage-RTS — escore de trauma revisado de triagem (adulto)', 'cap. 48 Atendimento pré-hospitalar, p. 671–672 (Tabela 4)'),
  descricao: 'Glasgow, PAS e frequência ventilatória, de 0 a 4 cada; soma de 0 a 12',
  itens: [
    { tipo: 'numero', id: 'gcs', rotulo: 'Escala de coma de Glasgow', min: 3, max: 15 },
    { tipo: 'numero', id: 'pas', rotulo: 'Pressão arterial sistólica', unidade: 'mmHg', min: 0, max: 300 },
    { tipo: 'numero', id: 'fr', rotulo: 'Frequência ventilatória', unidade: 'mpm', min: 0, max: 80 },
  ],
  calcular(r) {
    if (!completo(triageRts, r)) return null
    const g = pontoGcsRts(numero(triageRts, r, 'gcs')!)
    const p = pontoPasRts(numero(triageRts, r, 'pas')!)
    const f = pontoFrRts(numero(triageRts, r, 'fr')!)
    const total = g + p + f
    return {
      rotulo: 'Triage-RTS',
      valor: String(total),
      unidade: 'de 12',
      nota: total < 11 ? 'abaixo de 11: o livro indica transporte a um centro de trauma' : '11 ou 12: acima do corte do livro',
      estado: total < 11 ? 2 : 0,
      derivados: [['Glasgow', `${g} ponto(s)`], ['PAS', `${p} ponto(s)`], ['Frequência ventilatória', `${f} ponto(s)`]],
      cuidados: [
        'A Tabela 4 usa faixas inteiras (PAS 76–89 e 50–75, por exemplo); valores com decimal caem na faixa de baixo.',
        'É a versão de triagem (soma simples). O livro não traz o RTS com coeficientes.',
      ],
    }
  },
}

// ── Contas do atendimento inicial (cap. 47) ─────────────────────────────────

export const TXA_TRAUMA = { bolusG: 1, bolusMin: 10, manutG: 1, manutH: 8, janelaH: 3, pagina: 'p. 649 (CRASH-2)' }

export type TxaTrauma = { dentroDaJanela: boolean; bolusMgMin: number; manutMgH: number; totalG: number; minutosRestantes: number }

/** Ácido tranexâmico (p. 649): 1 g IV em 10 min + 1 g IV em 8 h, desde que com menos de 3 h do trauma. */
export function txaTrauma(minutosDesdeTrauma: number): TxaTrauma | null {
  if (!Number.isFinite(minutosDesdeTrauma) || minutosDesdeTrauma < 0) return null
  const janelaMin = TXA_TRAUMA.janelaH * 60
  return {
    dentroDaJanela: minutosDesdeTrauma < janelaMin,
    bolusMgMin: (TXA_TRAUMA.bolusG * 1000) / TXA_TRAUMA.bolusMin,
    manutMgH: (TXA_TRAUMA.manutG * 1000) / TXA_TRAUMA.manutH,
    totalG: TXA_TRAUMA.bolusG + TXA_TRAUMA.manutG,
    minutosRestantes: Math.max(0, janelaMin - minutosDesdeTrauma),
  }
}

export type Hemotorax = { inicialAtinge: boolean; debitoMlH: number | null; debitoAtinge: boolean | null; horasNaJanela: boolean | null }

/**
 * Hemotórax (p. 644–645): drenagem inicial ≥ 1.500 mL, ou drenagem
 * subsequente > 200 mL/h nas próximas 2 a 4 horas → o livro fala em alta
 * probabilidade / possibilidade de toracotomia de urgência.
 */
export function hemotorax(inicialMl: number, subsequenteMl?: number, horas?: number): Hemotorax | null {
  if (!Number.isFinite(inicialMl) || inicialMl < 0) return null
  const temDebito = subsequenteMl !== undefined && horas !== undefined && Number.isFinite(subsequenteMl) && subsequenteMl >= 0 && valido(horas)
  const debito = temDebito ? subsequenteMl! / horas! : null
  return {
    inicialAtinge: inicialMl >= 1500,
    debitoMlH: debito,
    debitoAtinge: debito === null ? null : debito > 200,
    horasNaJanela: temDebito ? horas! >= 2 && horas! <= 4 : null,
  }
}

export const TORNIQUETE_MAX_MIN = 120 // p. 646

/** Minutos restantes até 2 h de torniquete (p. 646); negativo = passou do limite. */
export const torniqueteRestante = (minutosAplicado: number) => (Number.isFinite(minutosAplicado) && minutosAplicado >= 0 ? TORNIQUETE_MAX_MIN - minutosAplicado : null)

export const ALIQUOTA_TRAUMA_ML: Faixa = [250, 500] // p. 646
export const CRISTALOIDE_ANTES_TRANSFUSAO_L: Faixa = [1, 3] // p. 647

/** Cristaloide acumulado em relação aos 1–3 L após os quais o livro diz que a transfusão está bem indicada se instável (p. 647). */
export function cristaloideAcumulado(ml: number): 'abaixo' | 'dentro' | 'acima' | null {
  if (!Number.isFinite(ml) || ml < 0) return null
  const l = ml / 1000
  return l < CRISTALOIDE_ANTES_TRANSFUSAO_L[0] ? 'abaixo' : l <= CRISTALOIDE_ANTES_TRANSFUSAO_L[1] ? 'dentro' : 'acima'
}

export const TRAUMA_REFERENCIAS = [
  { texto: 'Saturação adequada: igual ou superior a 95%', pagina: 'p. 639' },
  { texto: 'IOT de imediato com Glasgow < 8 (p. 640); via aérea definitiva com Glasgow ≤ 8 (p. 649)', pagina: 'p. 640 e 649' },
  { texto: 'Pneumotórax hipertensivo: punção no 5º espaço intercostal, linha axilar média; dreno n. 24 a 28 entre as linhas axilar média e anterior (4º ou 5º EIC)', pagina: 'p. 644' },
  { texto: 'Hemotórax volumoso: > 1.500 mL de sangue; dreno n. 38; cristaloide aquecido a 38 °C', pagina: 'p. 644' },
  { texto: 'Hipotensão permissiva: PAS 80–90 e PAM 50–60 mmHg; TCE grave: PAM > 80 mmHg; alíquotas de 250–500 mL (ver também a tela de ressuscitação volêmica)', pagina: 'p. 646' },
  { texto: 'Transfusão maciça: 10 unidades de concentrado de hemácias nas primeiras 24 h; proporção 1:1:1 plasma, plaquetas e hemácias', pagina: 'p. 647' },
  { texto: 'Lavado peritoneal diagnóstico: 1.000 mL de solução fisiológica (adulto)', pagina: 'p. 648' },
  { texto: 'Glasgow < 15 com mecanismo compatível: supor lesão craniana significativa até prova em contrário', pagina: 'p. 649' },
]

/** Tabela 3 do cap. 48 (p. 664): restrição de movimento da coluna no trauma contuso do adulto. */
export const RMC_ADULTO = ['Paciente > 65 anos', 'Escala de coma de Glasgow < 15 (aguda)', 'Sinais clínicos de intoxicação', 'Lesões de distração', 'Cinemática perigosa', 'Dor ou sensibilidade ou deformidade na coluna', 'Sinais neurológicos focais', 'Barreira linguística']

/** Coluna toracolombar (p. 653): mecanismo de força importante + algum sinal alterado no exame da coluna. */
export const TORACOLOMBAR = {
  mecanismo: ['Queda de > 3 m', 'Ejeção de veículo', 'Colisão de moto', 'Atropelamento por carro ou veículo maior', 'Outra lesão importante que cause distração', '> 60 anos (queda da própria altura deve ser considerada)', 'Rebaixamento do nível de consciência ou intoxicação'],
  exame: ['Dor à palpação da coluna', 'Sinais de trauma direto (equimose, hematoma, desvio evidente)', 'Déficit neurológico consistente com lesão medular'],
  texto: 'O livro diz que a decisão de TC de coluna "geralmente se dá" pela presença de mecanismo de força importante e de algum sinal alterado no exame da coluna; não há regra validada para a coluna toracolombar.',
  pagina: 'p. 653',
}

export const ERRATA_TRAUMA = [
  'p. 640 x p. 649 — corte de IOT por Glasgow: "< 8" e "≤ 8".',
  'p. 641 — regra canadense chamada de "CCTR (Canadian CT Trauma Rule)" e depois "CCR"; itens impressos sob o título NEXUS na Tabela 1.',
  'p. 642 — Tabela 1 indica radiografia sem fator de baixo risco; a mesma página diz que não há razão para radiografia se houver TC.',
  'p. 647 — "10 UI de concentrado de hemácias": lido como 10 unidades.',
  'p. 663 x p. 664 — o texto diz que a Tabela 3 traz critérios de acionamento de suporte avançado; a Tabela 3 é "Quando utilizar restrição de movimento da coluna".',
  'p. 671 — MGAP com rótulos de gravidade invertidos em relação à direção da escala (ver o escore).',
]

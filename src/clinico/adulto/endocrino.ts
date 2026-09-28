import { completo, escolha, somar, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Crise tireotóxica (cap. 70, p. 947–957), estado mixedematoso (cap. 71,
// p. 958–963) e insuficiência adrenal (cap. 72, p. 964–972) pelo Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022). Os dois escores (Burch-
// Wartofsky e o do estado mixedematoso) somam as linhas como o livro imprime;
// as doses aparecem como estão, com as contas diárias e por peso quando o livro
// dá mg/kg. A decisão é do médico (ADR 0007).

export const fichaCriseTireotoxica = fichaAdulto('adulto-crise-tireotoxica', 'Crise tireotóxica — adulto', 'cap. 70 Crise tireotóxica, p. 947–956')
export const fichaMixedema = fichaAdulto('adulto-estado-mixedematoso', 'Estado mixedematoso — adulto', 'cap. 71 Estado mixedematoso, p. 958–963')
export const fichaInsuficienciaAdrenal = fichaAdulto('adulto-insuficiencia-adrenal', 'Insuficiência adrenal e crise adrenal — adulto', 'cap. 72 Insuficiência adrenal, p. 964–971')
export const fichaBurchWartofsky = fichaAdulto('adulto-burch-wartofsky', 'Burch-Wartofsky — crise tireotóxica (adulto)', 'cap. 70, Tabela 4, p. 951–952')
export const fichaEscoreMixedema = fichaAdulto('adulto-escore-mixedema', 'Escore diagnóstico do estado mixedematoso (adulto)', 'cap. 71, Tabela 3, p. 960–961')

export type Faixa = [number, number]
export type Dose = { droga: string; texto: string; pagina: string; errata?: string }

const valido = (x: number) => Number.isFinite(x) && x > 0
const pts = (rotulo: string, valor: number) => ({ rotulo: `${rotulo} — ${valor}`, valor })

// ── Burch-Wartofsky (Tabela 4, p. 951–952) ──────────────────────────────────

export const ERRATA_BURCH = 'Faixas como impressas: a 1ª temperatura começa em 37,0 °C e a última é "> 39,3" (39,3 exato sem linha); FC "130–139" e depois "> 140" (140 exato sem linha); corte "> 45 = crise" e "25–44 = iminente" (45 exato sem classe). Temperatura < 37,0 e FC < 90 não têm linha: a ferramenta dá 0.'

export const burchWartofsky: Escore = {
  ficha: fichaBurchWartofsky,
  descricao: 'Critérios diagnósticos para crise tireotóxica (Tabela 4 do manual do HC, p. 951–952): soma de temperatura, SNC, trato GI/fígado, FC, IC, fibrilação atrial e fator precipitante.',
  itens: [
    { tipo: 'escolha', id: 'temp', rotulo: 'Temperatura (°C)', ajuda: 'Linhas como impressas; 39,3 exato não tem linha.', opcoes: [
      pts('< 37,0 (sem linha na tabela)', 0), pts('37,0–37,7', 5), pts('37,8–38,1', 10), pts('38,2–38,5', 15), pts('38,6–38,8', 20), pts('38,9–39,2', 25), pts('> 39,3', 30),
    ] },
    { tipo: 'escolha', id: 'snc', rotulo: 'Efeitos no SNC', opcoes: [pts('Ausente', 0), pts('Leve (agitação)', 10), pts('Moderado (delirium, psicose, letargia)', 20), pts('Grave (convulsão, coma)', 30)] },
    { tipo: 'escolha', id: 'gi', rotulo: 'Disfunção gastrointestinal/hepática', opcoes: [pts('Ausente', 0), pts('Moderada (dor abdominal, diarreia, vômitos)', 10), pts('Grave (icterícia)', 20)] },
    { tipo: 'escolha', id: 'fc', rotulo: 'Taquicardia (bpm)', ajuda: '140 exato não tem linha na tabela.', opcoes: [
      pts('< 90 (sem linha na tabela)', 0), pts('90–109', 5), pts('110–119', 10), pts('120–129', 15), pts('130–139', 20), pts('> 140', 25),
    ] },
    { tipo: 'escolha', id: 'ic', rotulo: 'Insuficiência cardíaca', opcoes: [pts('Ausente', 0), pts('Leve (edema MMII)', 5), pts('Moderada (estertores em bases)', 10), pts('Grave (edema agudo de pulmão)', 15)] },
    { tipo: 'escolha', id: 'fa', rotulo: 'Fibrilação atrial', opcoes: [pts('Ausente', 0), pts('Presente', 10)] },
    { tipo: 'escolha', id: 'precipitante', rotulo: 'Fator precipitante', opcoes: [pts('Negativo', 0), pts('Positivo', 10)] },
  ],
  calcular(r) {
    if (!completo(burchWartofsky, r)) return null
    const total = somar(burchWartofsky, r)
    const faixa = total > 45 ? '> 45: crise tireotóxica' : total === 45 ? '45: sem classe na tabela ("> 45" crise; "25–44" iminente)' : total >= 25 ? '25–44: crise iminente' : '< 25: crise improvável'
    return {
      rotulo: 'Burch-Wartofsky',
      valor: String(total),
      unidade: 'de 140',
      nota: `${faixa} (p. 952)`,
      estado: total >= 45 ? 2 : total >= 25 ? 1 : 0,
      derivados: [['Temperatura', escolha(burchWartofsky, r, 'temp')!.rotulo], ['Frequência cardíaca', escolha(burchWartofsky, r, 'fc')!.rotulo]],
      alerta: total === 45 ? ERRATA_BURCH : undefined,
      cuidados: [
        'O diagnóstico é clínico; o escore ajuda nos casos duvidosos (p. 947, 950).',
        ERRATA_BURCH,
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ── Drogas da crise tireotóxica (p. 953–954) ────────────────────────────────

export const DROGAS_CRISE_TIREOTOXICA: Dose[] = [
  { droga: 'Propiltiouracil', texto: 'Ataque de 600 a 1.000 mg, seguido de 200 a 300 mg de 6/6 a 4/4 horas (1.200 a 1.500 mg/dia)', pagina: 'cap. 70, p. 953',
    errata: '200–300 mg de 6/6 a 4/4 h somam 800–1.800 mg/dia, não 1.200–1.500 como escrito entre parênteses. As duas faixas ficam na tela.' },
  { droga: 'Metimazol', texto: '20 mg de 4/4 a 6/6 horas (80 a 120 mg/dia)', pagina: 'cap. 70, p. 953' },
  { droga: 'Ácido iopanoico', texto: 'Agente iodado de escolha: 1 g 8/8 h no 1º dia e, depois, 500 mg 12/12 h', pagina: 'cap. 70, p. 953' },
  { droga: 'Iodeto de potássio', texto: '4–8 gotas 6/6 ou 8/8 h', pagina: 'cap. 70, p. 954' },
  { droga: 'Carbonato de lítio', texto: 'Alternativa na alergia ao iodo: 300 mg a cada 6 horas; ajustar para litemia "em torno de 1 mg/dL"', pagina: 'cap. 70, p. 954',
    errata: 'Unidade da litemia impressa em mg/dL; litemia é medida em mEq/L (mmol/L). O número não é convertido.' },
  { droga: 'Propranolol VO', texto: 'Dose inicial 20–40 mg; habitual 60–120 mg 6/6 horas', pagina: 'cap. 70, p. 954' },
  { droga: 'Propranolol EV', texto: '0,5–1,0 mg a cada 15 minutos até controle da FC', pagina: 'cap. 70, p. 954' },
  { droga: 'Esmolol', texto: 'Bomba de infusão contínua 0,05–1,0 mg/kg/min', pagina: 'cap. 70, p. 954',
    errata: 'O inventário do projeto aponta o teto de 1,0 mg/kg/min como alto; não conferido fora do livro. Transcrito como está, sem preparo (sem mL/h).' },
  { droga: 'Metoprolol', texto: '5 mg a cada 10–15 minutos até controle da FC', pagina: 'cap. 70, p. 954' },
  { droga: 'Hidrocortisona', texto: '100 mg EV a cada 6 horas', pagina: 'cap. 70, p. 954' },
  { droga: 'Dexametasona', texto: '2–4 mg EV 6/6 horas', pagina: 'cap. 70, p. 954' },
]

export const ERRATA_ORDEM_IODO = 'A p. 954 diz que "as tionamidas só devem ser utilizadas 2–3 horas após o início das drogas antitireoidianas" — frase invertida (tionamida já é antitireoidiano). A Figura 1 (p. 956) põe a ordem: "usar solução de iodo 2 h após PTU ou metimazol".'

/** Totais diários das drogas dadas em intervalo fixo (multiplicação simples). */
export function totaisTireotoxica() {
  return {
    ptuManutencaoMgDia: [200 * 4, 300 * 6] as Faixa,
    ptuEscritoMgDia: [1200, 1500] as Faixa,
    metimazolMgDia: [20 * 4, 20 * 6] as Faixa,
    propranololVoMgDia: [60 * 4, 120 * 4] as Faixa,
    hidrocortisonaMgDia: 100 * 4,
    dexametasonaMgDia: [2 * 4, 4 * 4] as Faixa,
    iopanoicoD1G: 3,
  }
}

export function esmololMgMin(pesoKg: number): { mgMin: Faixa; mgH: Faixa } | null {
  if (!valido(pesoKg)) return null
  const mgMin: Faixa = [0.05 * pesoKg, 1.0 * pesoKg]
  return { mgMin, mgH: [mgMin[0] * 60, mgMin[1] * 60] }
}

// ── Escore do estado mixedematoso (Tabela 3, p. 960–961) ────────────────────

export const ERRATA_MIXEDEMA_FC = 'A linha de bradicardia só tem "ausente", 50–59 (10) e 40–49 (20); FC < 40 bpm não tem linha no livro. Marcada, a ferramenta soma o restante e avisa que a bradicardia ficou de fora.'

const NT_BRADI = { rotulo: '< 40 bpm — sem linha na tabela', valor: 0, naoTestavel: true }

export const escoreMixedema: Escore = {
  ficha: fichaEscoreMixedema,
  descricao: 'Critérios diagnósticos para estado mixedematoso (Tabela 3 do manual do HC, p. 960–961): soma de temperatura, SNC, trato GI, precipitante, cardiovascular e metabólico.',
  itens: [
    { tipo: 'escolha', id: 'temp', rotulo: 'Temperatura', opcoes: [pts('> 35 °C', 0), pts('32–35 °C', 10), pts('< 32 °C', 20)] },
    { tipo: 'escolha', id: 'snc', rotulo: 'Alterações de SNC', opcoes: [pts('Ausentes (sem linha na tabela)', 0), pts('Sonolência/letargia', 10), pts('Paciente obnubilado', 15), pts('Estupor', 20), pts('Coma/convulsões', 30)] },
    { tipo: 'escolha', id: 'gi', rotulo: 'Alterações gastrointestinais', opcoes: [pts('Ausentes (sem linha na tabela)', 0), pts('Anorexia/dor abdominal/constipação', 5), pts('Diminuição da motilidade intestinal', 15), pts('Íleo paralítico', 20)] },
    { tipo: 'escolha', id: 'precipitante', rotulo: 'Fator precipitante', opcoes: [pts('Ausente', 0), pts('Presente', 10)] },
    { tipo: 'escolha', id: 'bradi', rotulo: 'Bradicardia (bpm)', opcoes: [pts('Ausente', 0), pts('50–59', 10), pts('40–49', 20), NT_BRADI] },
    { tipo: 'marca', id: 'ecg', rotulo: 'Alterações do ECG (QT longo, baixa voltagem, bloqueios, ST inespecífico)', pontos: 10, grupo: 'Cardiovascular' },
    { tipo: 'marca', id: 'pericardio', rotulo: 'Derrame pericárdico', pontos: 10, grupo: 'Cardiovascular' },
    { tipo: 'marca', id: 'cardiomegalia', rotulo: 'Cardiomegalia', pontos: 15, grupo: 'Cardiovascular' },
    { tipo: 'marca', id: 'pleura', rotulo: 'Derrame pleural', pontos: 10, grupo: 'Outras alterações' },
    { tipo: 'marca', id: 'edemaPulmonar', rotulo: 'Edema pulmonar', pontos: 15, grupo: 'Outras alterações' },
    { tipo: 'marca', id: 'hipotensao', rotulo: 'Hipotensão', pontos: 20, grupo: 'Outras alterações' },
    { tipo: 'marca', id: 'hiponatremia', rotulo: 'Hiponatremia', pontos: 10, grupo: 'Alterações metabólicas' },
    { tipo: 'marca', id: 'hipoglicemia', rotulo: 'Hipoglicemia', pontos: 10, grupo: 'Alterações metabólicas' },
    { tipo: 'marca', id: 'hipoxemia', rotulo: 'Hipoxemia', pontos: 10, grupo: 'Alterações metabólicas' },
    { tipo: 'marca', id: 'hipercapnia', rotulo: 'Hipercapnia', pontos: 10, grupo: 'Alterações metabólicas' },
    { tipo: 'marca', id: 'tfg', rotulo: 'Diminuição da filtração glomerular', pontos: 10, grupo: 'Alterações metabólicas' },
  ],
  calcular(r) {
    if (!completo(escoreMixedema, r)) return null
    const total = somar(escoreMixedema, r)
    const semBradi = escolha(escoreMixedema, r, 'bradi')?.naoTestavel === true
    const faixa = total >= 60 ? '≥ 60: extremamente sugestivo de estado mixedematoso' : total >= 25 ? '25–59: sugestivo de estado mixedematoso' : '< 25: diagnóstico improvável'
    return {
      rotulo: 'Escore do estado mixedematoso',
      valor: String(total),
      nota: `${faixa} (p. 961)${semBradi ? ' — sem a bradicardia' : ''}`,
      estado: total >= 60 ? 2 : total >= 25 ? 1 : 0,
      derivados: [['Temperatura', escolha(escoreMixedema, r, 'temp')!.rotulo]],
      alerta: semBradi ? ERRATA_MIXEDEMA_FC : undefined,
      cuidados: [
        'A tabela não diz se as linhas "cardiovascular", "outras" e "metabólicas" somam entre si; a ferramenta soma cada achado marcado.',
        'Os níveis de hormônio tireoidiano não têm ponto de corte diagnóstico (p. 960).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ── Reposição no estado mixedematoso (p. 961–963) ───────────────────────────

export const REPOSICAO_MIXEDEMA: Dose[] = [
  { droga: 'T4 (levotiroxina) isolada', texto: 'Ataque 200–500 µg EV ou 500 µg VO, seguido de manutenção de 50–150 µg VO ao dia', pagina: 'cap. 71, p. 962' },
  { droga: 'T3 isolada', texto: 'Ataque 10 a 20 µg EV seguido de reposição diária com T4; a maioria dos autores não recomenda (mortalidade maior com doses acima da habitual)', pagina: 'cap. 71, p. 962' },
  { droga: 'T3 + T4 combinadas', texto: '10 µg de T3 e 200–300 µg de T4 EV; manter 50–100 µg de T4 VO ou EV e 10 µg EV de T3 a cada 8 ou 12 horas', pagina: 'cap. 71, p. 962' },
  { droga: 'Tabela 5', texto: 'T4 200–500 µg inicial e 100–150 µg/dia; T3 10 µg 8/8 h até paciente consciente (uso controverso)', pagina: 'cap. 71, Tabela 5, p. 963',
    errata: 'Manutenção de T4: 50–150 µg (texto, p. 962) x 100–150 µg/dia (Tabela 5, p. 963). As duas ficam na tela.' },
  { droga: 'Hidrocortisona', texto: '100 mg EV 8/8 horas até excluir insuficiência adrenal associada', pagina: 'cap. 71, p. 962; Tabela 5, p. 962' },
]

export const SUPORTE_MIXEDEMA: Dose[] = [
  { droga: 'Hiponatremia', texto: 'Salina hipertônica para manter Na > 120 mEq/L', pagina: 'cap. 71, Tabela 5, p. 962' },
  { droga: 'Hipotermia', texto: 'Aquecimento com cobertores; evitar aquecimento periférico (vasodilatação e hipotensão)', pagina: 'cap. 71, Tabela 5, p. 962' },
  { droga: 'Hipotensão', texto: 'Corrigir hipovolemia; considerar vasopressores (Figura 1: preferir dopamina)', pagina: 'cap. 71, Tabela 5, p. 962' },
]

export const NOTA_MIXEDEMA_PESO_IDADE = 'O livro não ajusta a dose de T4 ou T3 por peso, idade ou cardiopatia: as faixas são fixas. Nada é calculado por peso.'

export const ERRATA_INVERNO = 'A p. 958 diz que o estado mixedematoso "só ocorre nos meses do inverno"; o sentido é "mais comum" no inverno. Sem efeito em conta.'

export function totaisMixedema() {
  return { t3CombinadaUgDia: [10 * 2, 10 * 3] as Faixa, hidrocortisonaMgDia: 100 * 3 }
}

// ── Insuficiência adrenal (cap. 72) ─────────────────────────────────────────

export type LeituraCortisol = { texto: string; pagina: string }

/** Cortisol basal das 8 h (p. 969): ≤ 3 confirma; > 19 praticamente exclui; entre 3 e 19, teste com ACTH. */
export function leituraCortisolBasal(cortisol: number): LeituraCortisol | null {
  if (!Number.isFinite(cortisol) || cortisol < 0) return null
  const pagina = 'cap. 72, p. 969'
  if (cortisol <= 3) return { texto: '≤ 3 µg/dL: o texto diz que confirma IA', pagina }
  if (cortisol > 19) return { texto: '> 19 µg/dL: o texto diz que praticamente exclui IA', pagina }
  return { texto: 'Entre 3 e 19 µg/dL: faixa em que o texto indica o teste com ACTH 250 µg EV ou IM', pagina }
}

/** Cortisol 30 min após ACTH (p. 969): > 18 exclui; abaixo disso confirma. 18 exato não tem classe. */
export function leituraCortisolActh(cortisol: number): LeituraCortisol | null {
  if (!Number.isFinite(cortisol) || cortisol < 0) return null
  const pagina = 'cap. 72, p. 969'
  if (cortisol > 18) return { texto: '> 18 µg/dL após ACTH: exclui IA', pagina }
  if (cortisol < 18) return { texto: '< 18 µg/dL após ACTH: confirma IA', pagina }
  return { texto: '18 µg/dL exato: o texto diz "acima de 18 exclui" e "abaixo disso confirma" — sem classe', pagina }
}

export const DIVERGENCIA_FIGURA_IA = 'A Figura 1 (p. 971) usa outros cortes: cortisol < 3 µg/dL confirma, > 5 µg/dL vai para o teste com ACTH, e coleta 30–60 min após o ACTH; o texto (p. 969) usa ≤ 3, 3–19 e 30 min. A Figura também traz volume de 20–30 mL/kg no instável; o texto fala em até 1 L/h.'

export const CRISE_ADRENAL = {
  hidrocortisonaAtaqueMg: 100,
  hidrocortisonaManutencaoMg: [50, 100] as Faixa,
  intervaloH: 6,
  desmameAposH: [48, 72] as Faixa,
  habitual: '5 mg de prednisona ou 20–25 mg de hidrocortisona ou acetato de cortisona',
  fludrocortisona: { ug: 50, intervaloH: 8, texto: 'na manutenção, pode ser necessário mineralocorticoide: flúor-hidrocortisona 50 µg a cada 8 horas' },
  volumeLH: 1,
  volumeFiguraMlKg: [20, 30] as Faixa,
  glicose: 'hipoglicemia: repor glicose a 5 ou 50%',
  pagina: 'cap. 72, p. 969; Figura 1, p. 971',
}

export const CHOQUE_SEPTICO_REFRATARIO = {
  hidrocortisonaMg: 50,
  intervaloH: 6,
  fludrocortisonaImpresso: '50 mg de flúor-hidrocortisona associada',
  pagina: 'cap. 72, p. 970',
  errata: 'A p. 970 imprime "50 mg de flúor-hidrocortisona" (conferido no PDF). Na página anterior (p. 969) a mesma droga aparece em µg (50 µg). 50 mg seria mil vezes a dose da p. 969: a ferramenta mostra a unidade impressa com a errata e não usa esse número em conta. A p. 970 também não diz o intervalo da fludrocortisona.',
  cruzamento: 'No cap. 7 (sepse, p. 125) o livro traz hidrocortisona 200 mg por dia por 7 dias, sem fludrocortisona; 50 mg 6/6 h da p. 970 dá o mesmo total diário.',
}

export function totaisCriseAdrenal() {
  const c = CRISE_ADRENAL
  const dosesDia = 24 / c.intervaloH
  return {
    hidrocortisonaMgDia: [c.hidrocortisonaManutencaoMg[0] * dosesDia, c.hidrocortisonaManutencaoMg[1] * dosesDia] as Faixa,
    fludrocortisonaUgDia: c.fludrocortisona.ug * (24 / c.fludrocortisona.intervaloH),
    hidrocortisonaChoqueMgDia: CHOQUE_SEPTICO_REFRATARIO.hidrocortisonaMg * (24 / CHOQUE_SEPTICO_REFRATARIO.intervaloH),
  }
}

export function volumeCriseAdrenal(pesoKg: number): { figuraMl: Faixa } | null {
  if (!valido(pesoKg)) return null
  return { figuraMl: [CRISE_ADRENAL.volumeFiguraMlKg[0] * pesoKg, CRISE_ADRENAL.volumeFiguraMlKg[1] * pesoKg] }
}

export const FORA_ENDOCRINO = [
  'Ajuste de T4/T3 por peso, idade ou cardiopatia no mixedema: o livro não traz.',
  'Diluição de esmolol e de propranolol EV (mL/h): não informada.',
  'Duração do tratamento com iodo, lítio ou corticoide na crise tireotóxica: não informada.',
  'Colestiramina, plasmaférese, hemodiálise e hemoperfusão na crise refratária (p. 954): sem dose.',
  'Dose de salina hipertônica no mixedema: só a meta de Na > 120 mEq/L (cálculo de sódio já existe na ferramenta de hiponatremia).',
  'Intervalo da fludrocortisona no choque séptico (p. 970): não informado.',
]

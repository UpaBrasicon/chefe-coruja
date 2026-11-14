import type { Ficha, Fonte } from '../ficha.ts'
import { completo, escolha, somar, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Neutropenia febril — cap. 81 do Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022), p. 1062–1072. MASCC (Tabela 2, p. 1068), critérios de alto
// risco (p. 1067) e doses do tratamento empírico (p. 1069–1072). O CISNE é
// citado (p. 1067–1068) sem tabela de pontos e não é implementado.

const CAP = 'cap. 81 Neutropenia febril'

const KLASTERSKY: Ficha['fontes'][number] = {
  citacao: 'Klastersky J, Paesmans M, Rubenstein EB, et al. The Multinational Association for Supportive Care in Cancer risk index: a multinational scoring system for identifying low-risk febrile neutropenic cancer patients. J Clin Oncol. 2000;18(16):3038–3051.',
  url: 'https://doi.org/10.1200/JCO.2000.18.16.3038',
}

const baseMascc = fichaAdulto('adulto-mascc', 'MASCC — risco na neutropenia febril (adulto)', `${CAP}, p. 1067–1068 (Tabela 2)`)

// Revisão PubMed de 09/10/2026, itens médios (decisão do RT em 06/11/2026): o
// consenso MASCC 2026 entra como nota nos cuidados. Corte e pontos não mudam.
export const MASCC_2026: Fonte = {
  citacao: 'Cooksley T, Font C, Thursky K, et al. Febrile neutropenia in patients treated with chemotherapy/immune checkpoint inhibition: a MASCC consensus statement. Support Care Cancer. 2026;34(8) (PMID 42525130).',
  url: 'https://doi.org/10.1007/s00520-026-11045-7',
}

export const NOTA_MASCC_2026 =
  'Consenso MASCC 2026: MASCC ≥ 21 continua indicando candidato a manejo ambulatorial, mas o escore não foi validado em quem usa quimioterapia combinada com inibidor de checkpoint imune; MASCC < 21 é alto risco e segue o manejo padrão.'

export const ERRATA_MASCC =
  'p. 1068 (conferido na imagem da página) — a Tabela 2 junta "sintomas moderados ou graves = 3". No escore original (Klastersky et al., 2000) sintomas moderados valem 3 e sintomas graves valem 0. A ferramenta usa 0 para sintomas graves e mostra também o total pela leitura literal do livro.'

const simNao = (id: string, rotulo: string, pontos: number): Item => ({ tipo: 'escolha', id, rotulo, opcoes: [{ rotulo: 'Não — 0', valor: 0 }, { rotulo: `Sim — ${pontos}`, valor: pontos }] })

export const mascc: Escore = {
  ficha: {
    ...baseMascc,
    versao: '2026-11-06.1',
    fontes: [...baseMascc.fontes, KLASTERSKY, MASCC_2026],
    revisadoEm: '06/11/2026 (nota do consenso MASCC 2026 nos cuidados; revisão PubMed, itens médios)',
  },
  descricao: 'Multinational Association for Supportive Care in Cancer: soma de 0 a 26; abaixo de 21 é critério de alto risco no livro.',
  itens: [
    { tipo: 'escolha', id: 'sintomas', rotulo: 'Intensidade dos sintomas', opcoes: [
      { rotulo: 'Assintomático — 5', valor: 5 },
      { rotulo: 'Sintomas leves — 5', valor: 5 },
      { rotulo: 'Sintomas moderados — 3', valor: 3 },
      { rotulo: 'Sintomas graves — 0 (o livro dá 3; ver errata)', valor: 0 },
    ] },
    simNao('hipotensao', 'Ausência de hipotensão', 5),
    simNao('dpoc', 'Ausência de doença pulmonar obstrutiva crônica', 4),
    simNao('tumor', 'Tumor sólido ou neoplasia hematológica sem infecção fúngica prévia', 4),
    simNao('desidratacao', 'Ausência de desidratação', 3),
    simNao('ambulatorial', 'Não hospitalizado ao aparecimento da febre', 3),
    simNao('idade', 'Idade menor que 60 anos', 2),
  ],
  calcular(r) {
    if (!completo(mascc, r)) return null
    const total = somar(mascc, r)
    const graves = escolha(mascc, r, 'sintomas')?.rotulo.startsWith('Sintomas graves') ?? false
    const literal = graves ? total + 3 : total
    const alto = total < 21
    const derivados: [string, string][] = [['Corte do livro (p. 1067)', 'MASCC < 21 é um dos critérios de alto risco']]
    if (graves) derivados.push(['Total pela leitura literal do livro (graves = 3)', `${literal}${literal < 21 ? ' — alto risco' : ' — ≥ 21'}`])
    return {
      rotulo: 'MASCC',
      valor: String(total),
      unidade: 'de 26',
      nota: alto ? '< 21: critério de alto risco' : '≥ 21: não preenche o critério de alto risco pelo MASCC',
      estado: alto ? 2 : 0,
      derivados,
      alerta: graves ? ERRATA_MASCC : undefined,
      cuidados: [
        'MASCC ≥ 21 não basta para baixo risco: o livro também classifica como alto risco neutropenia < 500 esperada por > 7 dias; comorbidades (instabilidade, mucosite, alteração mental, infecção de cateter, infiltrado novo ou hipóxia, doença pulmonar crônica); transaminases > 5 × LSN ou ClCr < 30 mL/min; neutropenia ≤ 100 por > 7 dias; profilaxia ambulatorial com quinolona; e exige doença oncológica estável (p. 1067).',
        'Baixo risco: nenhum desses critérios e bom performance status (p. 1067).',
        NOTA_MASCC_2026,
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// Definições e doses (p. 1062, 1069–1072)

// Lote 3 da revisão do HCFMUSP, N2 (decisão do RT de 14/11/2026), cap. 81: o
// consenso da ABHH de 2024 (Delphi, sem graduação; pacientes hematológicos) foi
// lido no texto integral no PMC. Os pontos do consenso MASCC 2026 entram pelo
// resumo. As doses e contas do manual não mudam.
export const ABHH_NF_2024: Fonte = {
  citacao: 'Nucci M, Arrais-Rodrigues C, Bergamasco MD, et al. Management of febrile neutropenia: consensus of the Brazilian Association of Hematology, Blood Transfusion and Cell Therapy - ABHH. Hematol Transfus Cell Ther. 2024;46(Suppl 6):S346–S361 (PMID 39694764; PMC11726106). Consenso Delphi em pacientes hematológicos, sem graduação. Texto integral lido.',
  url: 'https://doi.org/10.1016/j.htct.2024.11.119',
}

const SEM_ITEM_NF = 'sem item do manual na ferramenta'

/** ABHH 2024 e MASCC 2026 × manual, na neutropenia febril; um tema por linha. */
export const DIRETRIZ_NF: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Definições', diretriz: 'Neutropenia: neutrófilos < 500/µL. Febre: axilar > 38 °C. Febre persistente: depois de 3 dias de antibiótico. Febre recorrente: novo episódio depois de 48 h afebril', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: 'febre axilar ≥ 37,8 °C sustentada por 1 h; neutropenia < 500 ou 500–1.000 com queda esperada em 48 h (p. 1062)' },
  { tema: 'Exames antes do antibiótico', diretriz: 'Dois pares de hemocultura (veia periférica e cateter), com frascos aeróbio, anaeróbio e para fungos. Radiografia de tórax e urocultura não são de rotina. TC de tórax se houver sintoma respiratório; TC de abdome se houver sintoma abdominal', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: 'dois pares de hemocultura periférica (p. 1064); urina 1 e urocultura (p. 1065); radiografia de tórax com sintoma respiratório e TC se ela for normal (p. 1066)' },
  { tema: 'Antibiótico empírico', diretriz: 'Cefepima ou piperacilina-tazobactam, pela epidemiologia local e pela toxicidade. Carbapenêmico não é de rotina; usar se houver hipotensão ou piora e colonização ou bacteremia prévia por enterobactéria ESBL. Voltar para cefepima ou piperacilina-tazobactam se a hemocultura não crescer Gram-negativo resistente', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: 'monoterapia antipseudomonas: piperacilina-tazobactam 4,5 g 6/6 h, cefepima 2 g 8/8 h ou meropenem 1 g 8/8 h (p. 1069)' },
  { tema: 'Vancomicina', diretriz: 'Não usar de rotina, nem por colonização por MRSA, pneumonia, mucosite ou febre persistente ou recorrente. Quando houver indicação de cobertura para MRSA, a vancomicina é a escolha', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: 'associar com instabilidade, mucosite, infecção de cateter, pele ou partes moles, profilaxia com quinolona, colonização ou cultura com Gram-positivo (p. 1070)' },
  { tema: 'Troca do betalactâmico', diretriz: 'Ampliar para Gram-negativo na piora clínica ou com sinal novo de infecção, mesmo afebril. Voltar ao esquema inicial em 48–72 h se não houver Gram-negativo resistente documentado', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: 'modificar o esquema se o paciente ficar instável (p. 1070)' },
  { tema: 'Anaeróbio', diretriz: 'Cobrir anaeróbio se houver suspeita de tiflite ou dor perianal', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: SEM_ITEM_NF },
  { tema: 'Febre persistente ou recorrente', diretriz: 'Repetir hemoculturas e fazer TC de tórax; PCR sérica seriada durante o episódio', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: SEM_ITEM_NF },
  { tema: 'Antifúngico', diretriz: 'Não iniciar antifúngico empírico só pela febre persistente ou recorrente após 4–7 dias de antibiótico. Usar a estratégia preemptiva, guiada por galactomanana sérica e TC de tórax, com anfotericina B lipossomal, caspofungina ou voriconazol', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: 'antifúngico empírico na febre persistente após 4–7 dias, com neutropenia esperada > 7 dias (p. 1071–1072)' },
  { tema: 'Quando parar o antibiótico', diretriz: 'Parar o empírico quando a neutropenia se resolve sem infecção documentada, mesmo com febre. No neutropênico persistente, sem infecção documentada e com sinais vitais normais, parar depois de 4 dias. Manter se continuar neutropênico e febril', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: 'sem foco e com culturas negativas: afebril por pelo menos 48 h e neutrófilos > 500 em ascensão (p. 1072)' },
  { tema: 'Profilaxia antibacteriana', diretriz: 'Não usar de rotina. Quinolona só onde a resistência a Gram-negativo é baixa e só na indução de LMA ou depois de TCTH autólogo', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: 'profilaxia ambulatorial com quinolona é critério de alto risco (p. 1067)' },
  { tema: 'Swab anal', diretriz: 'Na admissão, swab anal para colonização por Gram-negativo multirresistente; semanal onde essa colonização é frequente', grau: 'consenso Delphi em pacientes hematológicos, sem graduação', fonte: 'ABHH 2024', livro: SEM_ITEM_NF },
  { tema: 'MASCC e imunoterapia', diretriz: 'MASCC ≥ 21 indica candidato a manejo ambulatorial, mas o escore não foi validado em quimioterapia combinada com inibidor de checkpoint imune; MASCC < 21 é alto risco e segue o manejo padrão', grau: 'consenso; lido no resumo', fonte: 'MASCC 2026', livro: 'MASCC < 21 é critério de alto risco (p. 1067)' },
  { tema: 'Quimioterapia com inibidor de checkpoint', diretriz: 'Com diarreia grau ≥ 3 ou transaminite, não usar corticoide em dose alta empírico. Suspeitar de neutropenia pelo inibidor se a apresentação não for a esperada ou se não houver recuperação 10 dias depois; nesse caso, corticoide em dose alta e considerar G-CSF de ação curta', grau: 'consenso; lido no resumo', fonte: 'MASCC 2026', livro: SEM_ITEM_NF },
]

export const DIFERENCAS_NF: string[] = [
  'A ABHH 2024 foi feita para pacientes hematológicos; o manual trata da neutropenia febril em geral, inclusive em tumor sólido.',
  'Febre: a ABHH usa axilar > 38 °C; o manual, ≥ 37,8 °C sustentada por 1 h.',
  'Empírico: a ABHH prefere cefepima ou piperacilina-tazobactam e reserva o carbapenêmico para choque ou piora com ESBL; o manual põe o meropenem entre as opções iniciais.',
  'Vancomicina: a ABHH não a usa por mucosite, pneumonia, colonização por MRSA nem febre persistente; o manual a associa com mucosite e profilaxia com quinolona.',
  'Antifúngico: a ABHH é contra o empírico só por febre persistente após 4–7 dias e prefere a estratégia preemptiva (galactomanana e TC); o manual indica o empírico nessa situação.',
  'Suspensão: a ABHH para o antibiótico com a recuperação dos neutrófilos sem infecção documentada, mesmo com febre, ou após 4 dias com sinais vitais normais; o manual pede 48 h afebril e neutrófilos > 500 em ascensão.',
  'Exames: a ABHH não faz radiografia de tórax nem urocultura de rotina; o manual pede urina 1 e urocultura.',
]

const fichaNfLivro = fichaAdulto('adulto-neutropenia-febril', 'Neutropenia febril — definições e doses empíricas (adulto)', `${CAP}, p. 1062–1072`)
export const fichaNeutropeniaFebrilAdulto: Ficha = {
  ...fichaNfLivro,
  versao: '2026-11-14.1',
  fontes: [...fichaNfLivro.fontes, ABHH_NF_2024, MASCC_2026],
  revisadoEm: '14/11/2026 (consenso da ABHH 2024 lido no texto integral e pontos do MASCC 2026 pelo resumo, ao lado do manual; lote 3 da revisão do HCFMUSP; aguarda aprovação do RT)',
}

export const DEFINICOES_NF = [
  { texto: 'Febre: temperatura axilar ≥ 37,8 °C sustentada por uma hora; não medir temperatura retal', pagina: 'p. 1062' },
  { texto: 'Neutropenia: < 500 células ou entre 500 e 1.000 com perspectiva de queda nas 48 h seguintes', pagina: 'p. 1062' },
  { texto: 'Triagem: considerar até 6 semanas após quimioterapia; maior risco entre o 10º e o 20º dia', pagina: 'p. 1062' },
  { texto: 'Antimicrobiano idealmente nos primeiros 30 min após a triagem, depois das hemoculturas', pagina: 'p. 1068' },
  { texto: 'Plaquetas < 50.000 antes de punção lombar: considerar transfusão (o livro escreve "/L")', pagina: 'p. 1067' },
]

export const ATB_ALTO_RISCO = [
  { nome: 'Piperacilina-tazobactam', dose: '4,5 g IV 6/6 horas' },
  { nome: 'Cefepime', dose: '2 g IV 8/8 horas' },
  { nome: 'Meropenem', dose: '1 g IV 8/8 horas' },
  { nome: 'Imipenem', dose: '500 mg IV 6/6 horas' },
  { nome: 'Ceftazidima', dose: '2 g IV 8/8 horas (ressalva: resistência crescente e espectro limitado contra Gram-positivos)' },
]

export type Faixa = [number, number]

export const ANTIFUNGICOS_NF = {
  caspofungina: { ataqueMg: 70, manutencaoMg: 50, texto: '70 mg IV no 1º dia, depois 50 mg 1 x/d (sem profilaxia antifúngica prévia e sem foco)' },
  anfoLipossomal: { mgKg: [3, 5] as Faixa, texto: '3-5 mg/kg IV 1 x/d (infiltrados/nódulos pulmonares)' },
  voriconazol: { ataqueMgKg: 6, manutencaoMgKg: 4, intervaloH: 12, texto: '6 mg/kg IV 12/12 h no 1º dia, depois 4 mg/kg 12/12 h' },
  pagina: 'p. 1072',
}

export const ERRATA_ANFO_DEOXICOLATO =
  'p. 1072 — o livro traz "deoxicolato 5 mg/kg 1 x/d" para a anfotericina B convencional. A dose usual da formulação deoxicolato é muito menor (fração de mg/kg), e 5 mg/kg é dose da formulação lipídica: provável erro de digitação. A ferramenta não calcula essa linha.'

export type ContaAntifungico = { anfoLipossomalMg: Faixa; voriconazolAtaqueMg: number; voriconazolManutencaoMg: number }

export function antifungicosPorPeso(pesoKg: number): ContaAntifungico | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const a = ANTIFUNGICOS_NF
  return {
    anfoLipossomalMg: [a.anfoLipossomal.mgKg[0] * pesoKg, a.anfoLipossomal.mgKg[1] * pesoKg],
    voriconazolAtaqueMg: a.voriconazol.ataqueMgKg * pesoKg,
    voriconazolManutencaoMg: a.voriconazol.manutencaoMgKg * pesoKg,
  }
}

export const INDICACOES_VANCO_NF = [
  'Instabilidade hemodinâmica',
  'Mucosite',
  'Suspeita de infecção relacionada a cateter, pele ou partes moles',
  'Profilaxia com quinolona',
  'Colonização prévia com germe sensível somente a vancomicina',
  'Cultura preliminarmente positiva para Gram-positivo',
]

export const DURACAO_NF = [
  { texto: 'Foco definido: tempo conforme o sítio + neutrófilos > 500 céls./µL', pagina: 'p. 1072' },
  { texto: 'Sem foco e culturas negativas: afebril por pelo menos 48 h + neutrófilos > 500 céls./µL em ascensão', pagina: 'p. 1072' },
  { texto: 'Antifúngico empírico: febre persistente após 4-7 dias com neutropenia esperada > 7 dias', pagina: 'p. 1071–1072' },
]

import type { Fonte } from '../ficha.ts'

// Diretriz AHA/ACC/ACCP/ACEP/CHEST/SCAI/SHM/SIR/SVM/SVN 2026 de TEP agudo no
// adulto. Lote 2 da revisão do HCFMUSP, M2 (decisão do RT de 13/11/2026),
// cap. 32. O texto integral foi lido em 14/11/2026 no site da Circulation, pelo
// Chrome do RT. As tabelas de recomendação são imagens e foram lidas uma a uma:
// 3.1.1, 3.1.2, 3.2.1, 4.1.1, 4.2.1, 4.2.2, 4.2.3, 4.4 e 4.4.1, com as
// figuras 1 e 2. A diretriz não traz dose de trombolítico; as doses do manual
// não mudam.

export const AHA_TEP_2026: Fonte = {
  citacao: 'Creager MA, Barnes GD, Giri J, et al. 2026 AHA/ACC/ACCP/ACEP/CHEST/SCAI/SHM/SIR/SVM/SVN Guideline for the Evaluation and Management of Acute Pulmonary Embolism in Adults. Circulation. 2026;153(12):e977–e1051 (PMID 41712677), versão corrigida. Texto integral lido; recomendações com classe (COR) e nível (LOE) das seções 3.1.1, 3.1.2, 3.2.1, 4.1.1, 4.2.1, 4.2.2, 4.2.3, 4.4 e 4.4.1 e figuras 1 e 2. Não traz dose de trombolítico.',
  url: 'https://doi.org/10.1161/CIR.0000000000001415',
}

const SEM_ITEM = 'sem item do manual na ferramenta'

/** AHA/ACC 2026 × manual, um tema por linha. Classe e nível como a diretriz escreve (1, 2a, 2b, 3); "figura" quando vem só do fluxograma. */
export const DIRETRIZ_TEP_2026: { tema: string; aha: string; classe: string; onde: string; livro: string }[] = [
  { tema: 'Probabilidade pré-teste', aha: 'História e exame dirigidos, com ferramenta validada (Wells, Genebra revisado ou impressão clínica), para estimar a probabilidade clínica', classe: '1, A', onde: 'seção 3.1.1; Figura 1', livro: 'Wells simplificado e Genebra (Tabela 3, p. 433)' },
  { tema: 'PERC', aha: 'Só na probabilidade clínica baixa (< 15%). PERC todo negativo: probabilidade muito baixa, sem mais exames. Se algum critério for positivo, D-dímero com os critérios do YEARS', classe: 'figura', onde: 'Figura 1', livro: 'PERC quando a probabilidade pré-teste é improvável (p. 433; Tabela 4, p. 434)' },
  { tema: 'D-dímero ajustado pela idade', aha: 'Na probabilidade baixa ou intermediária (< 50%), D-dímero abaixo de idade × 10 µg/L (ensaio em FEU) exclui o TEP e dispensa imagem', classe: '2a, B-R', onde: 'seção 3.1.1', livro: 'D-dímero na probabilidade baixa e moderada; corte de 500 µg/L abaixo de 50 anos e 10 × idade acima de 50 (p. 435)' },
  { tema: 'YEARS', aha: 'Pode identificar quem não precisa de imagem: sem critério do YEARS, corte de 1000 ng/mL; com 1 ou mais (sinais de TVP, hemoptise, TEP como diagnóstico mais provável), corte de 500 ng/mL ou o ajustado pela idade', classe: '2a, B-R', onde: 'seção 3.1.1; Figura 1', livro: SEM_ITEM },
  { tema: 'Gestante', aha: 'Critérios do YEARS adaptados à gestação para decidir quem não precisa de imagem', classe: '2b, B-NR', onde: 'seção 3.1.1', livro: SEM_ITEM },
  { tema: 'Exame de imagem', aha: 'Indicado na probabilidade alta (> 50%) ou com D-dímero elevado (1, A). Angio-TC de tórax preferida à cintilografia V/Q (1, B-R); V/Q se a angio-TC não puder ser feita (2a, B-R)', classe: '1 e 2a', onde: 'seção 3.1.2', livro: 'angio-TC na probabilidade alta ou com D-dímero positivo; cintilografia V/Q se não puder contraste ou radiação (p. 440)' },
  { tema: 'Ecocardiograma e USG das pernas', aha: 'O ecocardiograma não confirma nem afasta o TEP; o Doppler venoso das pernas não acrescenta depois de angio-TC negativa', classe: '3: sem benefício, B-NR', onde: 'seção 3.1.2', livro: 'o eco não exclui o TEP; o USG venoso em geral não é indicado (p. 440–441)' },
  { tema: 'Laudo da angio-TC', aha: 'Relatar a relação VD/VE em número, não por impressão', classe: '1, B-R', onde: 'seção 3.1.2', livro: SEM_ITEM },
  { tema: 'Categorias AHA/ACC (A a E)', aha: 'A: subclínico. B: sintomático com escore baixo (PESI ≤ 85, sPESI 0 ou Bova ≤ 4); B1 subsegmentar, B2 não subsegmentar. C: escore elevado; C1 VD e biomarcadores normais, C2 VD ou 1 biomarcador alterado, C3 os dois. D: falência cardiopulmonar incipiente; D1 hipotensão transitória, D2 choque normotenso. E: falência cardiopulmonar; E1 hipotensão persistente com choque, E2 choque refratário ou PCR. Modificador R para hipoxemia, FR ≥ 30 ou necessidade de O2', classe: 'figura', onde: 'Figura 2', livro: 'baixo, intermediário baixo, intermediário alto e alto risco (Figura 4, p. 447)' },
  { tema: 'Escores de risco', aha: 'Hestia, PESI ou sPESI nas categorias A e B para achar o baixo risco (1, B-R); escore específico de TEP nas categorias C e D estáveis (2a, B-NR); NEWS ou NEWS2 como alternativa (2b, B-NR)', classe: '1, 2a e 2b', onde: 'seção 3.2.1', livro: 'PESI (Tabela 10, p. 445–446) e HESTIA (Tabela 11, p. 447–448)' },
  { tema: 'Tratamento ambulatorial', aha: 'Nas categorias A e B selecionadas, tratar em casa é opção razoável, com anticoagulante na mão e seguimento rápido garantido (2a, B-R); usar Hestia, PESI ou sPESI para decidir (2a, B-R)', classe: '2a, B-R', onde: 'seção 4.1.1', livro: 'PESI I–II com HESTIA negativo: domicílio ou alta precoce (p. 447)' },
  { tema: 'Início da anticoagulação', aha: 'Anticoagular sem contraindicação absoluta (1, B-R). Na suspeita de categoria C2 ou maior, com baixo risco de sangramento, anticoagular se a imagem atrasar (2a, C-EO)', classe: '1 e 2a', onde: 'seção 4.2.1', livro: 'anticoagular antes da confirmação na probabilidade provável (p. 434), intermediária ou alta (p. 443)' },
  { tema: 'HBPM × HNF', aha: 'Nas categorias C1 a E1 que precisam de anticoagulante parenteral, HBPM em vez de HNF, para menos recorrência e menos sangramento maior', classe: '1, B-R', onde: 'seção 4.2.1', livro: 'enoxaparina 1 mg/kg 12/12 h ou 1,5 mg/kg/dia; HNF preferida na instabilidade, disfunção renal, extremos de peso e idade e alto risco de sangramento (p. 441–442)' },
  { tema: 'Anticoagulante oral', aha: 'DOAC em vez de varfarina, salvo contraindicação (1, B-R). Na síndrome antifosfolípide trombótica estabelecida, varfarina (1, A)', classe: '1', onde: 'seção 4.2.1', livro: 'varfarina, rivaroxabana, apixabana e edoxabana, com doses (p. 442–443)' },
  { tema: 'Choque', aha: 'Vasopressor e/ou inotrópico nas categorias D2 a E2 (1, C-LD). Volume em D1–D2 só se houver suspeita de pré-carga baixa (2b, C-LD). Vasodilatador pulmonar inalatório pode ser considerado de C2 a E (2b, B-R)', classe: '1 e 2b', onde: 'seção 4.2.2', livro: 'suporte hemodinâmico e respiratório, sem detalhe (p. 441)' },
  { tema: 'Oxigênio e intubação', aha: 'Na hipoxemia moderada a grave, CNAF em vez de cateter comum (2a, C-LD). Nas categorias C a E, só sedar fundo e intubar se indicado, para não colapsar (3: dano, C-LD); se intubar, ter vasopressor, inotrópico ou ECMO à mão (1, C-LD)', classe: '1, 2a e 3: dano', onde: 'seção 4.2.3', livro: SEM_ITEM },
  { tema: 'Trombólise sistêmica', aha: 'Categorias E1–E2 com risco de sangramento aceitável: razoável trombolisar e anticoagular (2a, C-LD). D1–D2: pode ser considerada (2b, C-LD). C3: benefício incerto (2b, C-LD). A1 a C2: não trombolisar, pelo sangramento maior e AVC hemorrágico (3: dano, B-R). Dose menor pode ser considerada para reduzir sangramento (2b, C-LD)', classe: '2a, 2b e 3: dano', onde: 'seção 4.4.1', livro: 'principal indicação é a instabilidade hemodinâmica (p. 441); no intermediário alto, só se descompensar (p. 447)' },
  { tema: 'Trombo em trânsito', aha: 'Trombo livre no AD ou VD nas categorias C3 a E2: terapia avançada em vez de só anticoagular', classe: '2a, C-LD', onde: 'seção 4.4', livro: SEM_ITEM },
]

export const DIFERENCAS_TEP_2026: string[] = [
  'Gravidade: a AHA/ACC 2026 troca o baixo/intermediário/alto risco pelas categorias A a E, com subcategorias e o modificador respiratório R.',
  'Trombólise: razoável só na categoria E (choque), considerada na D (hipotensão transitória ou choque normotenso), incerta na C3 e contraindicada de A1 a C2. O manual a reserva ao alto risco e ao intermediário alto que descompensa.',
  'PERC: a AHA/ACC 2026 o usa só na probabilidade baixa (< 15%); o manual fala em probabilidade improvável.',
  'D-dímero: o ajuste pela idade já está no manual (p. 435) e vira recomendação 2a; o YEARS (2a) e o YEARS da gestante (2b) são novos.',
  'HBPM preferida à HNF nas categorias C1 a E1 (1, B-R); o manual prefere a HNF na instabilidade. DOAC preferido à varfarina (1, B-R). As doses do manual não mudam.',
  'No TEP grave (C a E), evitar sedação profunda e intubação sem indicação (3: dano); preferir CNAF na hipoxemia.',
]

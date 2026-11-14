import type { Fonte } from '../ficha.ts'
import type { Escore, Item, Respostas } from '../escore.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Endocardite infecciosa — critérios de Duke-ISCVID 2023 (revisão PubMed de
// 09/10/2026, decisão do RT: trocar a fonte). O Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022) traz o Duke modificado de 2000 na
// Tabela 2 do cap. 23 (p. 324–326); ele continua citado como referência, com a
// errata. O Duke-ISCVID 2023 (Fowler et al., Clin Infect Dis 2023) muda:
// - microbiologia: lista de típicos ampliada e outros típicos com prótese;
//   hemoculturas sem exigência de tempo ou de punções separadas;
// - imagem: TC cardíaca e PET-CT com 18F-FDG;
// - novo critério maior cirúrgico;
// - categorias "possível" e "rejeitada".
// Itens conferidos na página da revista (academic.oup.com, CID 77(4):518–526).

export const DUKE_ISCVID_2023: Fonte = {
  citacao: 'Fowler VG Jr, Durack DT, Selton-Suty C, et al. The 2023 Duke-International Society for Cardiovascular Infectious Diseases Criteria for Infective Endocarditis: Updating the Modified Duke Criteria. Clin Infect Dis. 2023;77(4):518–526 (PMID 37138445).',
  url: 'https://doi.org/10.1093/cid/ciad271',
}

// Lote 4 da revisão do HCFMUSP, O2 (decisão do RT de 14/11/2026), cap. 23: a diretriz
// da ESC de 2023 foi lida no site da revista (as tabelas de recomendação são imagens
// e foram lidas uma a uma). Os critérios de Duke-ISCVID 2023 da ferramenta não mudam.
export const ESC_EI_2023: Fonte = {
  citacao: 'Delgado V, Ajmone Marsan N, de Waha S, et al. 2023 ESC Guidelines for the management of endocarditis. Eur Heart J. 2023;44(39):3948–4042 (PMID 37622656). Texto integral lido; classes e níveis de evidência da ESC.',
  url: 'https://doi.org/10.1093/eurheartj/ehad193',
}

const SEM_ITEM_EI = 'sem item do manual na ferramenta'

/** ESC 2023 × manual, na endocardite infecciosa do adulto; um tema por linha. */
export const DIRETRIZ_EI: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Hemoculturas', diretriz: 'Pelo menos 3 sets de hemocultura com 30 min de intervalo, antes do antibiótico, com 10 mL de sangue cada, em aerobiose e anaerobiose, de veia periférica e não de cateter central', grau: 'texto, sem classe', fonte: 'ESC 2023', livro: 'três pares de hemocultura, de preferência com 30 min entre eles, 10 mL cada, em aerobiose e anaerobiose (cap. 23, p. 324)' },
  { tema: 'Eco transtorácico', diretriz: 'Ecocardiograma transtorácico como primeiro exame de imagem na suspeita de endocardite', grau: 'I, B', fonte: 'ESC 2023', livro: SEM_ITEM_EI },
  { tema: 'Eco transesofágico', diretriz: 'Transesofágico em toda suspeita com transtorácico negativo ou não diagnóstico (I, B) e na suspeita com prótese valvar ou dispositivo intracardíaco (I, B). Também com transtorácico positivo, exceto na endocardite direita isolada de valva nativa com transtorácico bom e achados inequívocos (I, C)', grau: 'I, B e C', fonte: 'ESC 2023', livro: 'transesofágico se o transtorácico for negativo com suspeita importante, imagem ruim, prótese ou dispositivo (cap. 23, p. 324)' },
  { tema: 'Repetir o eco', diretriz: 'Repetir transtorácico e/ou transesofágico em 5–7 dias se o primeiro for negativo ou inconclusivo e a suspeita continuar alta (I, C); repetir logo que houver suspeita de complicação nova: sopro novo, embolia, febre e bacteriemia persistentes, insuficiência cardíaca, abscesso, BAV (I, B)', grau: 'I, B e C', fonte: 'ESC 2023', livro: 'repetir na suspeita de complicação (sopro novo, embolia, insuficiência cardíaca, BAV, abscesso) e seriar conforme achados, germe e resposta (cap. 23, p. 326)' },
  { tema: 'Eco na bacteriemia', diretriz: 'Considerar ecocardiograma na bacteriemia por S. aureus, E. faecalis e alguns Streptococcus', grau: 'IIa, B', fonte: 'ESC 2023', livro: SEM_ITEM_EI },
  { tema: 'Antibiótico empírico: comunitária', diretriz: 'Valva nativa comunitária ou prótese tardia (12 meses ou mais após a cirurgia): ampicilina 12 g/dia EV em 4–6 doses com ceftriaxona 4 g/dia EV ou IM em 2 doses, ou com (flu)cloxacilina 12 g/dia EV em 4–6 doses, e gentamicina 3 mg/kg/dia EV ou IM em 1 dose (doses do adulto). Trocar pelo esquema dirigido quando o germe aparecer, em 24–48 h', grau: 'IIa, C', fonte: 'ESC 2023', livro: 'ampicilina 2 g 4/4 h + oxacilina 2 g 4/4 h (6 semanas) + gentamicina 3 mg/kg/dia 1×/dia (4 semanas) EV, pela ESC 2015 (cap. 23, Tabela 3, p. 327)' },
  { tema: 'Antibiótico empírico: prótese precoce ou hospitalar', diretriz: 'Prótese com menos de 12 meses, ou endocardite hospitalar ou associada a serviço de saúde: vancomicina 30 mg/kg/dia EV em 2 doses ou daptomicina 10 mg/kg/dia EV em 1 dose, com gentamicina 3 mg/kg/dia EV ou IM em 1 dose e rifampicina 900–1.200 mg/dia EV ou VO em 2 ou 3 doses (doses do adulto)', grau: 'IIb, C', fonte: 'ESC 2023', livro: 'vancomicina 30–60 mg/kg/dia + gentamicina 3 mg/kg/dia 1×/dia EV, pela ESC 2015 (cap. 23, Tabela 3, p. 327)' },
  { tema: 'Antibiótico empírico: alergia a betalactâmico', diretriz: 'Comunitária ou prótese tardia com alergia à penicilina: cefazolina 6 g/dia EV em 3 doses ou vancomicina 30 mg/kg/dia EV em 2 doses, com gentamicina 3 mg/kg/dia EV ou IM em 1 dose (doses do adulto)', grau: 'IIb, C', fonte: 'ESC 2023', livro: 'o mesmo esquema da hospitalar: vancomicina 30–60 mg/kg/dia + gentamicina 3 mg/kg/dia 1×/dia EV (cap. 23, Tabela 3, p. 327)' },
  { tema: 'Cirurgia por insuficiência cardíaca', diretriz: 'Cirurgia de emergência (em 24 h) na endocardite aórtica ou mitral, nativa ou protética, com regurgitação aguda grave, obstrução ou fístula que causa edema pulmonar refratário ou choque cardiogênico (I, B). Cirurgia urgente (em 3–5 dias) quando a regurgitação grave ou a obstrução causa sintomas de insuficiência cardíaca ou má tolerância hemodinâmica no eco (I, B)', grau: 'I, B', fonte: 'ESC 2023', livro: 'emergência (24 h) com insuficiência grave, obstrução ou fístula e edema pulmonar ou choque; urgente (1–2 dias) com insuficiência cardíaca ou má tolerância hemodinâmica no eco (cap. 23, p. 329–330)' },
  { tema: 'Cirurgia por infecção não controlada', diretriz: 'Cirurgia urgente na infecção local não controlada: abscesso, pseudoaneurisma, fístula, vegetação que cresce, deiscência de prótese ou BAV novo (I, B). Fungo ou germe multirresistente: cirurgia urgente ou na mesma internação, conforme a hemodinâmica (I, C). Considerar cirurgia urgente com hemocultura positiva por mais de 1 semana ou sepse persistente apesar de antibiótico adequado e de foco metastático controlado (IIa, B), e na prótese com S. aureus ou Gram-negativo não HACEK (IIa, C)', grau: 'I, B e C; IIa, B e C', fonte: 'ESC 2023', livro: 'urgente (1–2 dias): abscesso, pseudoaneurisma, fístula, vegetação em aumento ou culturas positivas apesar de antibiótico correto; urgente ou eletiva: fungo, germe multirresistente, prótese por estafilococo ou HACEK (cap. 23, p. 329–330)' },
  { tema: 'Cirurgia para evitar embolia', diretriz: 'Cirurgia urgente na endocardite aórtica ou mitral com vegetação de 10 mm ou mais que persiste após um ou mais episódios embólicos apesar do antibiótico (I, B), ou com vegetação de 10 mm ou mais e outra indicação de cirurgia (I, C). Pode-se considerar com vegetação de 10 mm ou mais, sem disfunção valvar grave nem embolia, e risco cirúrgico baixo (IIb, B)', grau: 'I, B e C; IIb, B', fonte: 'ESC 2023', livro: 'urgente (1–2 dias): vegetação > 1 cm com pelo menos um evento embólico apesar do antibiótico; > 1 cm com estenose ou regurgitação e baixo risco operatório; > 3 cm (cap. 23, p. 329–330)' },
  { tema: 'Antiagregante e anticoagulante', diretriz: 'Suspender antiagregante ou anticoagulante no sangramento maior, inclusive hemorragia intracraniana (I, C). Prótese mecânica com hemorragia intracraniana: considerar reiniciar heparina não fracionada assim que possível, depois de discussão multidisciplinar (IIa, C). Sem AVC e com cirurgia provável (por exemplo, S. aureus): considerar trocar o anticoagulante oral por heparina não fracionada com monitorização (IIa, C)', grau: 'I, C; IIa, C', fonte: 'ESC 2023', livro: SEM_ITEM_EI },
  { tema: 'Trombólise', diretriz: 'Trombolítico não é recomendado na endocardite', grau: 'III, C', fonte: 'ESC 2023', livro: SEM_ITEM_EI },
  { tema: 'Antibiótico oral ou ambulatorial', diretriz: 'Considerar antibiótico parenteral ambulatorial ou oral na endocardite esquerda por Streptococcus, E. faecalis, S. aureus ou estafilococo coagulase-negativo, depois de pelo menos 10 dias de antibiótico EV (ou 7 dias após a cirurgia), com o paciente estável e sem abscesso nem lesão valvar cirúrgica no transesofágico (IIa, A); transesofágico antes de passar para a via oral (I, B). Não fazer ambulatorial com germe de difícil tratamento, cirrose Child B ou C, êmbolos graves no sistema nervoso central, abscesso extracardíaco grande não tratado, complicação valvar ou endocardite em usuário de droga injetável (III, C)', grau: 'IIa, A; I, B; III, C', fonte: 'ESC 2023', livro: SEM_ITEM_EI },
]

export const DIFERENCAS_EI: string[] = [
  'Hemoculturas: a ESC 2023 e o manual pedem 3 sets com 30 min de intervalo; o Duke-ISCVID 2023 da ferramenta exige ao menos 2.',
  'Eco transesofágico: a ESC 2023 o indica em quase toda suspeita, mesmo com transtorácico positivo; o manual, quando o transtorácico é negativo com suspeita importante, imagem ruim, prótese ou dispositivo.',
  'Antibiótico empírico: a ESC 2023 usa ampicilina com ceftriaxona ou (flu)cloxacilina, e gentamicina (IIa, C); o manual, ampicilina com oxacilina e gentamicina, pela ESC 2015. Na prótese precoce ou hospitalar, a ESC 2023 soma rifampicina e aceita daptomicina.',
  'Prazo da cirurgia urgente: 3–5 dias na ESC 2023; 1–2 dias no manual. A tabela de cirurgia da ESC 2023 não tem o corte de 3 cm do manual.',
  'Via oral: a ESC 2023 aceita passar para oral depois de 10 dias de antibiótico EV no paciente estável (IIa, A); a ferramenta do manual não traz.',
]

const maior = (id: string, rotulo: string): Item => ({ tipo: 'marca', id, rotulo, pontos: 1, grupo: 'Critérios maiores' })
const menor = (id: string, rotulo: string): Item => ({ tipo: 'marca', id, rotulo, pontos: 1, grupo: 'Critérios menores' })

const MAIORES = ['microbiologico', 'imagem', 'cirurgico']
const MENORES = ['predisposicao', 'febre', 'vascular', 'imunologico', 'microbiologico_menor', 'imagem_menor', 'exame_fisico']
const conta = (r: Respostas, ids: string[]) => ids.filter((i) => r[i] === true).length

/** Definida pela clínica: 2 maiores, ou 1 maior e 3 menores, ou 5 menores (igual no livro e no Duke-ISCVID 2023). */
export function preencheDuke(maiores: number, menores: number): boolean {
  return maiores >= 2 || (maiores >= 1 && menores >= 3) || menores >= 5
}

/** Duke-ISCVID 2023: possível com 1 maior e 1 menor, ou 3 menores. */
export function possivelDuke(maiores: number, menores: number): boolean {
  return (maiores >= 1 && menores >= 1) || menores >= 3
}

export type ClasseDuke = 'definida' | 'possivel' | 'nao_preenche'

export function classificarDuke(maiores: number, menores: number, patologico: boolean): ClasseDuke {
  if (patologico || preencheDuke(maiores, menores)) return 'definida'
  return possivelDuke(maiores, menores) ? 'possivel' : 'nao_preenche'
}

export const ERRATA_DUKE = [
  'Na p. 326 a continuação da Tabela 2 repete o cabeçalho "Critérios maiores" acima dos itens 3 a 6, que são critérios menores (continuação da numeração da p. 325).',
  '"Proteína C-reativa > 100 mg/dL" (item 6): a unidade provável é mg/L; mostrado como impresso.',
]

export const duke: Escore = {
  ficha: {
    ...fichaAdulto('adulto-duke-modificado', 'Endocardite infecciosa — critérios de Duke-ISCVID 2023 (adulto)', 'cap. 23 Endocardite infecciosa, p. 324–326 (Tabela 2, Duke modificado de 2000, como referência)'),
    versao: '2026-11-14.1',
    fontes: [
      DUKE_ISCVID_2023,
      ESC_EI_2023,
      pagina('cap. 23 Endocardite infecciosa, p. 324–326 (Tabela 2, Duke modificado de 2000, como referência)'),
    ],
    revisadoEm: '14/11/2026 (ESC 2023 de endocardite lida no texto integral, ao lado do manual; lote 4 da revisão do HCFMUSP; aguarda aprovação do RT); 09/10/2026 (Duke-ISCVID 2023 conferido na página da revista; livro mantido como referência)',
  },
  descricao: 'Critérios de Duke-ISCVID 2023: definida com critério patológico, 2 maiores, 1 maior e 3 menores, ou 5 menores; possível com 1 maior e 1 menor, ou 3 menores.',
  itens: [
    { tipo: 'marca', id: 'patologico', rotulo: 'Critério patológico: micro-organismo (cultura, coloração, imunologia, PCR, sequenciamento ou hibridização in situ) ou histologia de endocardite ativa em vegetação, tecido cardíaco, prótese valvar ou anel, enxerto de aorta ascendente com envolvimento valvar, dispositivo endovascular ou êmbolo arterial', pontos: 1, grupo: 'Critério patológico' },
    maior('microbiologico', 'Microbiológico: típico em ≥ 2 sets de hemocultura separados (S. aureus, S. lugdunensis, E. faecalis, estreptococos exceto S. pneumoniae e S. pyogenes, Granulicatella, Abiotrophia, Gemella, HACEK; com prótese intracardíaca também estafilococo coagulase-negativo, C. striatum, C. jeikeium, S. marcescens, P. aeruginosa, C. acnes, micobactéria não tuberculosa e Candida); não típico em ≥ 3 sets; PCR ou sequenciamento no sangue para C. burnetii, Bartonella ou T. whipplei; C. burnetii IgG fase I > 1:800 ou isolado em uma hemocultura; IFA para B. henselae ou B. quintana com IgG ≥ 1:800. Não se exige intervalo nem punção separada'),
    maior('imagem', 'Imagem: eco e/ou TC cardíaca com vegetação, perfuração ou aneurisma de folheto, abscesso, pseudoaneurisma ou fístula; regurgitação valvar significativa nova (piora de prévia não conta); nova deiscência parcial de prótese; PET-CT com 18F-FDG com captação anormal em valva, enxerto, eletrodos ou outra prótese (na prótese valvar, só ≥ 3 meses após a cirurgia)'),
    maior('cirurgico', 'Cirúrgico: endocardite vista na inspeção direta durante cirurgia cardíaca, sem critério maior de imagem nem confirmação histológica ou microbiológica posterior'),
    menor('predisposicao', 'Predisposição: endocardite prévia, prótese valvar, reparo valvar prévio, cardiopatia congênita, regurgitação ou estenose mais que leve, dispositivo cardíaco endovascular, cardiomiopatia hipertrófica obstrutiva ou uso de droga injetável'),
    menor('febre', 'Febre: temperatura > 38,0 °C'),
    menor('vascular', 'Fenômenos vasculares: êmbolo arterial, infarto pulmonar séptico, abscesso cerebral ou esplênico, aneurisma micótico, hemorragia intracraniana ou conjuntival, lesões de Janeway, púrpura purulenta'),
    menor('imunologico', 'Fenômenos imunológicos: fator reumatoide positivo, nódulos de Osler, manchas de Roth ou glomerulonefrite por imunocomplexo'),
    menor('microbiologico_menor', 'Microbiológico sem critério maior: hemocultura com germe compatível; cultura, PCR ou sequenciamento de germe compatível em sítio estéril fora do coração; bactéria de pele isolada por PCR em valva ou eletrodo sem outro dado'),
    menor('imagem_menor', 'Imagem: PET-CT com 18F-FDG anormal até 3 meses depois do implante de prótese valvar, enxerto, eletrodos ou outra prótese'),
    menor('exame_fisico', 'Exame físico: regurgitação valvar nova na ausculta, só quando não há ecocardiograma (piora de sopro não basta)'),
  ],
  calcular(r) {
    const ma = conta(r, MAIORES)
    const me = conta(r, MENORES)
    const classe = classificarDuke(ma, me, r.patologico === true)
    const rotuloClasse = { definida: 'Endocardite definida', possivel: 'Endocardite possível', nao_preenche: 'Não preenche "possível"' }[classe]
    return {
      rotulo: 'Duke-ISCVID 2023',
      valor: `${ma} maior${ma === 1 ? '' : 'es'} · ${me} menor${me === 1 ? '' : 'es'}${r.patologico === true ? ' · critério patológico' : ''}`,
      nota: rotuloClasse,
      estado: classe === 'definida' ? 2 : classe === 'possivel' ? 1 : 0,
      derivados: [
        ['Definida', 'critério patológico, 2 maiores, 1 maior e 3 menores, ou 5 menores'],
        ['Possível', '1 maior e 1 menor, ou 3 menores'],
      ],
      cuidados: [
        'Rejeitada só com diagnóstico alternativo firme, resolução com menos de 4 dias de antibiótico, ausência de endocardite na cirurgia ou necropsia com menos de 4 dias de antibiótico, ou quando não preenche "possível".',
        'Colher ao menos 2 sets de hemocultura no adulto com suspeita (punções separadas continuam recomendadas quando possível).',
        'Livro (Duke modificado de 2000, Tabela 2, p. 324–326): mesma regra de "definida"; não traz "possível" nem "rejeitada", nem TC cardíaca, PET-CT ou critério cirúrgico.',
        'Ecocardiograma transesofágico se o transtorácico for negativo com suspeita importante, imagem ruim, prótese ou dispositivo (livro, p. 324).',
        ...ERRATA_DUKE.map((e) => `Errata do livro: ${e}`),
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

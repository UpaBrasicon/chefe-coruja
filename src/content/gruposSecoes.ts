// Grupos por especialidade dentro das seções grandes da Central. Só organiza a
// página da seção: os endereços (/plantonista/<seção>/<ferramenta>) e os
// favoritos não mudam. Toda ferramenta da seção tem de estar em um grupo — o
// teste src/content/gruposSecoes.test.ts confere contra o registry.

export type Grupo = { rotulo: string; slugs: string[] }

export const GRUPOS_SECAO: Record<string, Grupo[]> = {
  // Escores por especialidade (pedido do RT em 23/10/2026: "cardiologia com
  // HAS-BLED, HEART e outros"). Só agrupa; cada escore segue no mesmo endereço.
  escores: [
    { rotulo: 'Cardiologia', slugs: ['heart', 'timi', 'timi-iamcsst', 'grace', 'killip', 'cha2ds2-va', 'has-bled', 'sincope-san-francisco', 'sincope-canadense', 'duke-endocardite', 'sgarbossa-modificado'] },
    { rotulo: 'Pneumologia e tromboembolismo', slugs: ['curb-65', 'crb-65', 'psi-port', 'wells-tep', 'genebra-revisado', 'years', 'pesi', 'spesi', 'wells-tvp', 'light'] },
    { rotulo: 'Neurologia', slugs: ['glasgow', 'four', 'nih-avc', 'abcd2', 'fast-ed', 'race'] },
    { rotulo: 'Gastroenterologia e hepatologia', slugs: ['glasgow-blatchford', 'aims65', 'rockall', 'child-pugh', 'meld-3', 'bisap', 'ranson', 'alvarado'] },
    { rotulo: 'Terapia intensiva e sepse', slugs: ['sepse-adulto', 'sofa-2', 'news2', 'cam-icu', 'rass'] },
    { rotulo: 'Hematologia', slugs: ['4t-hit', 'civd-isth'] },
    { rotulo: 'Trauma', slugs: ['canadian-ct-head', 'iss', 'ottawa-tornozelo', 'ottawa-joelho'] },
    { rotulo: 'Nefrologia', slugs: ['ckd-epi', 'cockcroft-gault'] },
    // grupos novos por decisão do RT (23/10/2026, lacunas da Central)
    { rotulo: 'Infectologia', slugs: ['mcisaac'] },
    { rotulo: 'Geriatria e fragilidade', slugs: ['4at'] },
    // grupo novo com o TWIST (escores P2/P3, item P9, 11/11/2026)
    { rotulo: 'Urologia', slugs: ['twist'] },
  ],
  // Condutas e cálculos — adulto: as ferramentas de emergências e, desde 23/10/2026, as das
  // Calculadoras (SECOES_JUNTAS no registry; os slugs das duas seções não se repetem).
  emergencias: [
    { rotulo: 'Infusões e via aérea', slugs: ['iot', 'infusoes-adulto'] },
    { rotulo: 'Parada, ritmo e choque', slugs: ['pcr-adulto', 'pos-pcr-adulto', 'bradicardia-adulto', 'taquiarritmias-adulto', 'fibrilacao-atrial-adulto', 'marca-passo-provisorio-adulto', 'anafilaxia-adulto', 'ressuscitacao-volemica-adulto', 'qtc'] },
    { rotulo: 'Cardiovascular', slugs: ['sca-inicial-adulto', 'emergencia-hipertensiva-adulto', 'sindrome-aortica-adulto', 'add-rs-disseccao-aorta', 'insuficiencia-cardiaca-aguda-adulto'] },
    { rotulo: 'Respiratório e ventilação', slugs: ['asma-exacerbacao-adulto', 'dpoc-exacerbacao-adulto', 'oxigenacao-irpa-adulto', 'dispneia-abordagem-adulto', 'vm-ajuste-inicial-adulto', 'vm-obstruido-grave-adulto', 'mecanica-ventilatoria-adulto', 'sdra-ventilacao-adulto', 'desmame-vm-adulto', 'perc', 'hestia', 'smart-cop', 'ats-idsa-pac', 'pac-antibiotico-adulto'] },
    { rotulo: 'Neurológico', slugs: ['cefaleia-adulto', 'meningite-adulto', 'hidantalizacao', 'trombolise-avc-adulto', 'rankin-modificada', 'escore-ich', 'hsa-adulto', 'ottawa-hsa', 'hunt-hess', 'wfns-hsa', 'fisher-hsa', 'hints-plus', 'guillain-barre-adulto', 'criterios-vm-sgb', 'gbs-incapacidade', 'egos', 'agitacao-delirium-adulto', 'bars-agitacao'] },
    { rotulo: 'Anticoagulação e hemoterapia', slugs: ['heparinizacao-venosa', 'profilaxia-tev', 'anticoagulacao-plena-adulto', 'fibrinoliticos-adulto', 'reversao-anticoagulacao-adulto', 'transfusao-hemocomponentes-adulto', 'abc-score-transfusao-macica'] },
    { rotulo: 'Eletrólitos, ácido-base e endócrino', slugs: ['hiponatremia', 'hipernatremia', 'hipocalemia-reposicao-potassio', 'hipomagnesemia-reposicao-magnesio', 'hipocalcemia-reposicao-calcio', 'hipercalcemia', 'hipofosfatemia-reposicao-fosforo', 'gasometria-acidobase', 'bicarbonato-de-sodio', 'cad-ehh-criterios', 'cad-ehh-tratamento', 'hipoglicemia-adulto', 'crise-tireotoxica-adulto', 'burch-wartofsky', 'estado-mixedematoso-adulto', 'escore-mixedema', 'insuficiencia-adrenal-adulto'] },
    // grupo novo por decisão do RT (27/10/2026): a ITU sai de "Digestivo, fígado e rim"
    { rotulo: 'Infecções', slugs: ['itu-adulto'] },
    // a seção Dengue entrou nas condutas (revisão da Central, M2, RT em 24/11/2026)
    { rotulo: 'Dengue', slugs: ['classificacao-conduta-hidratacao'] },
    { rotulo: 'Digestivo, fígado e rim', slugs: ['colica-renal-adulto', 'hemorragia-digestiva-adulto', 'oakland-hdb', 'ascite-pbe-hepatorrenal-adulto', 'encefalopatia-hepatites-graves-adulto', 'maddrey', 'lesao-renal-aguda-adulto', 'rabdomiolise-adulto', 'mcmahon-rabdomiolise'] },
    { rotulo: 'Trauma e ambientais', slugs: ['trauma-inicial-adulto', 'nexus-coluna-cervical', 'regra-canadense-coluna-cervical', 'mgap-trauma', 'triage-rts-trauma', 'szpilman-afogamento', 'hipotermia-adulto', 'intermacao-adulto', 'queimadura-adulto'] },
    { rotulo: 'Toxicologia e profilaxias', slugs: ['intoxicacoes-antidotos-adulto', 'animais-peconhentos-adulto', 'pep-hiv-adulto', 'tetano-profilaxia-adulto', 'raiva-pos-exposicao-adulto', 'hepatite-b-pos-exposicao-adulto'] },
    { rotulo: 'Hemato-oncologia e pele', slugs: ['mascc', 'neutropenia-febril-adulto', 'cairo-bishop', 'lise-tumoral-adulto', 'falciforme-adulto', 'sindrome-toracica-aguda-adulto', 'regiscar', 'scorten-uti', 'dermatoses-graves-adulto'] },
    { rotulo: 'Dor, sedação e procedimentos', slugs: ['sedacao-procedimento-adulto', 'dor-analgesia-adulto', 'escala-numerica-dor', 'painad', 'bps-dor', 'sintomas-paliativos-adulto', 'acesso-venoso', 'acessos-calibres-adulto'] },
  ],
  pediatria: [
    { rotulo: 'Doses e infusões', slugs: ['bolus', 'infusoes', 'sedacao-procedimento-ped'] },
    { rotulo: 'Reanimação, via aérea e choque', slugs: ['rcp-pediatrica', 'via-aerea', 'choque-pediatrico', 'anafilaxia-pediatrica', 'sinais-vitais-pediatricos'] },
    { rotulo: 'Triagem e escores', slugs: ['pops', 'pews', 'glasgow-pediatrico', 'pecarn-menor-2-anos', 'pecarn-2-anos-ou-mais', 'phoenix', 'twist-ped'] },
    { rotulo: 'Respiratório', slugs: ['asma-pediatrica', 'vias-aereas-superiores-ped', 'bronquiolite-ped', 'pneumonia-ped', 'pram'] },
    { rotulo: 'Neurológico', slugs: ['crise-epileptica-pediatrica', 'tce-grave-pediatrico', 'coma-hic-ped', 'meningite-ped'] },
    { rotulo: 'Neonato', slugs: ['reanimacao-neonatal', 'ictericia-neonatal'] },
    { rotulo: 'Hidratação, eletrólitos e metabólico', slugs: ['fluidoterapia-manutencao-ped', 'desidratacao-diarreia-ped', 'sodio-ped', 'eletrolitos-ped', 'acidobase-ped', 'cad-ehh-ped', 'hipoglicemia-ped', 'insuficiencia-adrenal-ped'] },
    { rotulo: 'Cardiovascular e renal', slugs: ['insuficiencia-cardiaca-ped', 'crise-hipertensiva-ped', 'kawasaki-ped', 'injuria-renal-ped', 'tfg-schwartz-ped', 'glomerulopatias-shu-ped', 'infeccao-urinaria-ped'] },
    { rotulo: 'Infecções', slugs: ['dengue-ped', 'tetano-raiva-ped', 'febre-sem-sinais-ped', 'febre-imunodeprimido-ped', 'choque-toxico-partes-moles-ped', 'artrite-osteomielite-ped'] },
    { rotulo: 'Hemato-oncologia e digestivo', slugs: ['hemocomponentes-ped', 'falciforme-ped', 'hemostasia-trombose-ped', 'emergencias-oncologicas-ped', 'hemorragia-digestiva-hepatica-ped'] },
    { rotulo: 'Trauma, toxicologia e acidentes', slugs: ['pecarn-coluna-cervical', 'pecarn-abdome', 'ten-4-facesp', 'queimadura-ped', 'intoxicacoes-ped', 'escorpiao-aranhas-ped'] },
  ],
}

/** id estável para âncora do grupo na página */
export const idGrupo = (rotulo: string) =>
  'grupo-' + rotulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ---------------------------------------------------------------------------
// F2 (RT, 24/11/2026): organização por tema dentro das seções. Só exibição: o
// endereço e a chave de favorito de cada ferramenta (`secao/slug`) não mudam.
//
// Tipo de cada ferramenta, para o rótulo e o filtro da página da seção. Sem
// entrada: escore na seção Escores, conduta nas outras.
// ---------------------------------------------------------------------------

export type TipoFerramenta = 'conduta' | 'escore' | 'calculo'

export const ROTULO_TIPO: Record<TipoFerramenta, string> = { conduta: 'Conduta', escore: 'Escore', calculo: 'Cálculo' }

const ESCORES_FORA_DA_SECAO = [
  // condutas e cálculos — adulto
  'emergencias/escala-numerica-dor', 'emergencias/painad', 'emergencias/bps-dor', 'emergencias/rankin-modificada', 'emergencias/escore-ich',
  'emergencias/abc-score-transfusao-macica', 'emergencias/add-rs-disseccao-aorta', 'emergencias/nexus-coluna-cervical',
  'emergencias/regra-canadense-coluna-cervical', 'emergencias/mgap-trauma', 'emergencias/triage-rts-trauma', 'emergencias/oakland-hdb',
  'emergencias/maddrey', 'emergencias/mcmahon-rabdomiolise', 'emergencias/burch-wartofsky', 'emergencias/escore-mixedema',
  'emergencias/bars-agitacao', 'emergencias/ottawa-hsa', 'emergencias/hunt-hess', 'emergencias/wfns-hsa', 'emergencias/fisher-hsa',
  'emergencias/hints-plus', 'emergencias/criterios-vm-sgb', 'emergencias/gbs-incapacidade', 'emergencias/egos', 'emergencias/perc',
  'emergencias/hestia', 'emergencias/smart-cop', 'emergencias/ats-idsa-pac', 'emergencias/mascc', 'emergencias/cairo-bishop',
  'emergencias/sindrome-toracica-aguda-adulto', 'emergencias/szpilman-afogamento', 'emergencias/regiscar', 'emergencias/scorten-uti',
  // pediatria
  'pediatria/pram', 'pediatria/pecarn-menor-2-anos', 'pediatria/pecarn-2-anos-ou-mais', 'pediatria/pecarn-coluna-cervical',
  'pediatria/pecarn-abdome', 'pediatria/twist-ped', 'pediatria/ten-4-facesp', 'pediatria/glasgow-pediatrico', 'pediatria/pops',
  'pediatria/pews', 'pediatria/phoenix',
]

const CALCULOS = [
  'calculadoras/iot', 'calculadoras/infusoes-adulto', 'calculadoras/heparinizacao-venosa', 'calculadoras/hiponatremia',
  'calculadoras/hipernatremia', 'calculadoras/qtc', 'emergencias/mecanica-ventilatoria-adulto', 'emergencias/gasometria-acidobase',
  'emergencias/bicarbonato-de-sodio', 'emergencias/cad-ehh-criterios', 'escores/ckd-epi', 'escores/cockcroft-gault',
  'pediatria/bolus', 'pediatria/infusoes', 'pediatria/tfg-schwartz-ped',
]

export const TIPO_FERRAMENTA: Record<string, TipoFerramenta> = Object.fromEntries([
  ...ESCORES_FORA_DA_SECAO.map((c) => [c, 'escore'] as const),
  ...CALCULOS.map((c) => [c, 'calculo'] as const),
])

export function tipoDaFerramenta(secao: string, slug: string): TipoFerramenta {
  return TIPO_FERRAMENTA[`${secao}/${slug}`] ?? (secao === 'escores' ? 'escore' : 'conduta')
}

/**
 * Temas: a conduta primeiro e, junto dela, os escores e cálculos do mesmo
 * assunto, mesmo os de outra seção (que aparecem com "em <seção>" e abrem no
 * endereço de sempre). Na página de uma seção, o tema fica no lugar da primeira
 * ferramenta dele que a seção tem; as outras da seção saem do grupo de origem
 * para ficar juntas. Tema sem nenhuma ferramenta da seção não aparece nela.
 */
export type Tema = { rotulo: string; chaves: string[] }

export const TEMAS: Tema[] = [
  // Juntar temas partidos (pedido do RT): potássio, HDA, ventilação mecânica e dengue
  { rotulo: 'Potássio', chaves: ['emergencias/hipocalemia-reposicao-potassio', 'protocolos/hiperpotassemia'] },
  { rotulo: 'Hemorragia digestiva', chaves: ['emergencias/hemorragia-digestiva-adulto', 'protocolos/hda-lamg', 'emergencias/oakland-hdb', 'escores/glasgow-blatchford', 'escores/aims65', 'escores/rockall'] },
  { rotulo: 'Ventilação mecânica', chaves: ['emergencias/vm-ajuste-inicial-adulto', 'ventilacao-mecanica/vm-cinco-passos', 'ventilacao-mecanica/vni-cinco-passos', 'emergencias/vm-obstruido-grave-adulto', 'emergencias/mecanica-ventilatoria-adulto', 'emergencias/sdra-ventilacao-adulto', 'emergencias/desmame-vm-adulto'] },
  { rotulo: 'Dengue', chaves: ['dengue/classificacao-conduta-hidratacao', 'pediatria/dengue-ped'] },
  // Escores junto da conduta do mesmo tema
  { rotulo: 'Hemorragia subaracnóidea', chaves: ['emergencias/hsa-adulto', 'emergencias/ottawa-hsa', 'emergencias/hunt-hess', 'emergencias/wfns-hsa', 'emergencias/fisher-hsa'] },
  { rotulo: 'AVC', chaves: ['emergencias/trombolise-avc-adulto', 'emergencias/rankin-modificada', 'emergencias/escore-ich', 'escores/nih-avc', 'escores/fast-ed', 'escores/race', 'escores/abcd2'] },
  { rotulo: 'Síndrome de Guillain-Barré', chaves: ['emergencias/guillain-barre-adulto', 'emergencias/criterios-vm-sgb', 'emergencias/gbs-incapacidade', 'emergencias/egos'] },
  { rotulo: 'Agitação e delirium', chaves: ['emergencias/agitacao-delirium-adulto', 'emergencias/bars-agitacao', 'escores/cam-icu', 'escores/rass', 'escores/4at'] },
  { rotulo: 'Tromboembolismo pulmonar', chaves: ['emergencias/perc', 'emergencias/hestia', 'escores/wells-tep', 'escores/genebra-revisado', 'escores/years', 'escores/pesi', 'escores/spesi'] },
  { rotulo: 'Pneumonia adquirida na comunidade', chaves: ['emergencias/pac-antibiotico-adulto', 'emergencias/smart-cop', 'emergencias/ats-idsa-pac', 'escores/curb-65', 'escores/crb-65', 'escores/psi-port'] },
  { rotulo: 'Síndrome coronariana aguda', chaves: ['emergencias/sca-inicial-adulto', 'escores/heart', 'escores/timi', 'escores/timi-iamcsst', 'escores/grace', 'escores/killip', 'escores/sgarbossa-modificado'] },
  { rotulo: 'Fibrilação atrial', chaves: ['emergencias/fibrilacao-atrial-adulto', 'escores/cha2ds2-va', 'escores/has-bled'] },
  { rotulo: 'Síndrome aórtica aguda', chaves: ['emergencias/sindrome-aortica-adulto', 'emergencias/add-rs-disseccao-aorta'] },
  { rotulo: 'Choque e sepse', chaves: ['emergencias/ressuscitacao-volemica-adulto', 'escores/sepse-adulto', 'escores/sofa-2'] },
  { rotulo: 'Politraumatizado', chaves: ['emergencias/trauma-inicial-adulto', 'emergencias/abc-score-transfusao-macica', 'emergencias/mgap-trauma', 'emergencias/triage-rts-trauma', 'emergencias/nexus-coluna-cervical', 'emergencias/regra-canadense-coluna-cervical', 'escores/canadian-ct-head', 'escores/iss'] },
  { rotulo: 'Encefalopatia hepática e hepatites graves', chaves: ['emergencias/encefalopatia-hepatites-graves-adulto', 'emergencias/maddrey', 'escores/child-pugh', 'escores/meld-3'] },
  { rotulo: 'Lesão renal aguda', chaves: ['emergencias/lesao-renal-aguda-adulto', 'escores/ckd-epi', 'escores/cockcroft-gault'] },
  { rotulo: 'Rabdomiólise', chaves: ['emergencias/rabdomiolise-adulto', 'emergencias/mcmahon-rabdomiolise'] },
  { rotulo: 'Crise tireotóxica', chaves: ['emergencias/crise-tireotoxica-adulto', 'emergencias/burch-wartofsky'] },
  { rotulo: 'Estado mixedematoso', chaves: ['emergencias/estado-mixedematoso-adulto', 'emergencias/escore-mixedema'] },
  { rotulo: 'Neutropenia febril', chaves: ['emergencias/neutropenia-febril-adulto', 'emergencias/mascc'] },
  { rotulo: 'Síndrome de lise tumoral', chaves: ['emergencias/lise-tumoral-adulto', 'emergencias/cairo-bishop'] },
  { rotulo: 'Anemia falciforme', chaves: ['emergencias/falciforme-adulto', 'emergencias/sindrome-toracica-aguda-adulto'] },
  { rotulo: 'Dermatoses graves', chaves: ['emergencias/dermatoses-graves-adulto', 'emergencias/regiscar', 'emergencias/scorten-uti'] },
  { rotulo: 'Dor', chaves: ['emergencias/dor-analgesia-adulto', 'emergencias/escala-numerica-dor', 'emergencias/painad', 'emergencias/bps-dor'] },
]

/** Linha da página da seção: a ferramenta e, se ela vem de outra seção, de onde. */
export type LinhaTema<T> = { tool: T; externa: boolean }
export type BlocoTema<T> = { tema?: string; linhas: LinhaTema<T>[] }

/**
 * Monta os blocos de cada grupo da seção com os temas. `chave` dá `secao/slug`
 * da ferramenta; `externa` acha a ferramenta de outra seção (ou nada, se ela não
 * está na Central). Tema com menos de duas linhas na seção fica como estava.
 */
export function blocosComTemas<T>(
  grupos: { rotulo: string; tools: T[] }[],
  chave: (t: T) => string,
  externa: (chave: string) => T | undefined,
  temas: Tema[] = TEMAS,
): { rotulo: string; blocos: BlocoTema<T>[] }[] {
  const nativas = new Map<string, T>()
  for (const g of grupos) for (const t of g.tools) nativas.set(chave(t), t)
  const ordem = grupos.flatMap((g) => g.tools.map(chave))
  const ancora = new Map<string, BlocoTema<T>>()
  const consumidas = new Set<string>()
  for (const tema of temas) {
    const daSecao = tema.chaves.filter((c) => nativas.has(c))
    if (daSecao.length === 0) continue
    const linhas = tema.chaves.flatMap((c): LinhaTema<T>[] => {
      if (nativas.has(c)) return consumidas.has(c) ? [] : [{ tool: nativas.get(c)!, externa: false }]
      const t = externa(c)
      return t ? [{ tool: t, externa: true }] : []
    })
    if (linhas.length < 2) continue
    const primeira = ordem.find((c) => daSecao.includes(c) && !consumidas.has(c))
    if (!primeira) continue
    for (const l of linhas) if (!l.externa) consumidas.add(chave(l.tool))
    ancora.set(primeira, { tema: tema.rotulo, linhas })
  }
  return grupos.map((g) => ({
    rotulo: g.rotulo,
    blocos: g.tools.flatMap((t): BlocoTema<T>[] => {
      const c = chave(t)
      const doTema = ancora.get(c)
      if (doTema) return [doTema]
      return consumidas.has(c) ? [] : [{ linhas: [{ tool: t, externa: false }] }]
    }),
  }))
}

// Grupos por especialidade dentro das seções grandes da Central. Só organiza a
// página da seção: os endereços (/plantonista/<seção>/<ferramenta>) e os
// favoritos não mudam. Toda ferramenta da seção tem de estar em um grupo — o
// teste src/content/gruposSecoes.test.ts confere contra o registry.

export type Grupo = { rotulo: string; slugs: string[] }

export const GRUPOS_SECAO: Record<string, Grupo[]> = {
  emergencias: [
    { rotulo: 'Parada, ritmo e choque', slugs: ['pcr-adulto', 'pos-pcr-adulto', 'bradicardia-adulto', 'taquiarritmias-adulto', 'fibrilacao-atrial-adulto', 'marca-passo-provisorio-adulto', 'anafilaxia-adulto', 'ressuscitacao-volemica-adulto'] },
    { rotulo: 'Cardiovascular', slugs: ['emergencia-hipertensiva-adulto', 'sindrome-aortica-adulto', 'add-rs-disseccao-aorta', 'insuficiencia-cardiaca-aguda-adulto'] },
    { rotulo: 'Respiratório e ventilação', slugs: ['asma-exacerbacao-adulto', 'dpoc-exacerbacao-adulto', 'oxigenacao-irpa-adulto', 'dispneia-abordagem-adulto', 'vm-ajuste-inicial-adulto', 'vm-obstruido-grave-adulto', 'mecanica-ventilatoria-adulto', 'sdra-ventilacao-adulto', 'desmame-vm-adulto', 'perc', 'hestia', 'smart-cop', 'ats-idsa-pac', 'pac-antibiotico-adulto'] },
    { rotulo: 'Neurológico', slugs: ['trombolise-avc-adulto', 'rankin-modificada', 'escore-ich', 'hsa-adulto', 'ottawa-hsa', 'hunt-hess', 'wfns-hsa', 'fisher-hsa', 'hints-plus', 'guillain-barre-adulto', 'criterios-vm-sgb', 'gbs-incapacidade', 'egos', 'agitacao-delirium-adulto', 'bars-agitacao'] },
    { rotulo: 'Anticoagulação e hemoterapia', slugs: ['anticoagulacao-plena-adulto', 'fibrinoliticos-adulto', 'reversao-anticoagulacao-adulto', 'transfusao-hemocomponentes-adulto', 'abc-score-transfusao-macica'] },
    { rotulo: 'Eletrólitos, ácido-base e endócrino', slugs: ['hipocalemia-reposicao-potassio', 'hipomagnesemia-reposicao-magnesio', 'hipocalcemia-reposicao-calcio', 'hipercalcemia', 'hipofosfatemia-reposicao-fosforo', 'gasometria-acidobase', 'bicarbonato-de-sodio', 'cad-ehh-criterios', 'cad-ehh-tratamento', 'hipoglicemia-adulto', 'crise-tireotoxica-adulto', 'burch-wartofsky', 'estado-mixedematoso-adulto', 'escore-mixedema', 'insuficiencia-adrenal-adulto'] },
    { rotulo: 'Digestivo, fígado e rim', slugs: ['hemorragia-digestiva-adulto', 'oakland-hdb', 'ascite-pbe-hepatorrenal-adulto', 'encefalopatia-hepatites-graves-adulto', 'maddrey', 'lesao-renal-aguda-adulto', 'rabdomiolise-adulto', 'mcmahon-rabdomiolise'] },
    { rotulo: 'Trauma e ambientais', slugs: ['trauma-inicial-adulto', 'nexus-coluna-cervical', 'regra-canadense-coluna-cervical', 'mgap-trauma', 'triage-rts-trauma', 'szpilman-afogamento', 'hipotermia-adulto'] },
    { rotulo: 'Toxicologia e profilaxias', slugs: ['intoxicacoes-antidotos-adulto', 'animais-peconhentos-adulto', 'tetano-profilaxia-adulto', 'raiva-pos-exposicao-adulto', 'hepatite-b-pos-exposicao-adulto'] },
    { rotulo: 'Hemato-oncologia e pele', slugs: ['mascc', 'neutropenia-febril-adulto', 'cairo-bishop', 'lise-tumoral-adulto', 'falciforme-adulto', 'sindrome-toracica-aguda-adulto', 'regiscar', 'scorten-uti', 'dermatoses-graves-adulto'] },
    { rotulo: 'Dor, sedação e procedimentos', slugs: ['sedacao-procedimento-adulto', 'dor-analgesia-adulto', 'escala-numerica-dor', 'painad', 'bps-dor', 'sintomas-paliativos-adulto', 'acessos-calibres-adulto'] },
  ],
  pediatria: [
    { rotulo: 'Doses e infusões', slugs: ['bolus', 'infusoes', 'sedacao-procedimento-ped'] },
    { rotulo: 'Reanimação, via aérea e choque', slugs: ['rcp-pediatrica', 'via-aerea', 'choque-pediatrico', 'anafilaxia-pediatrica', 'sinais-vitais-pediatricos'] },
    { rotulo: 'Triagem e escores', slugs: ['pops', 'pews', 'glasgow-pediatrico', 'pecarn-menor-2-anos', 'pecarn-2-anos-ou-mais', 'phoenix'] },
    { rotulo: 'Respiratório', slugs: ['asma-pediatrica', 'vias-aereas-superiores-ped', 'bronquiolite-ped', 'pneumonia-ped', 'pram'] },
    { rotulo: 'Neurológico', slugs: ['crise-epileptica-pediatrica', 'tce-grave-pediatrico', 'coma-hic-ped', 'meningite-ped'] },
    { rotulo: 'Hidratação, eletrólitos e metabólico', slugs: ['fluidoterapia-manutencao-ped', 'desidratacao-diarreia-ped', 'sodio-ped', 'eletrolitos-ped', 'acidobase-ped', 'cad-ehh-ped', 'hipoglicemia-ped', 'insuficiencia-adrenal-ped'] },
    { rotulo: 'Cardiovascular e renal', slugs: ['insuficiencia-cardiaca-ped', 'crise-hipertensiva-ped', 'kawasaki-ped', 'injuria-renal-ped', 'tfg-schwartz-ped', 'glomerulopatias-shu-ped', 'infeccao-urinaria-ped'] },
    { rotulo: 'Infecções', slugs: ['dengue-ped', 'febre-sem-sinais-ped', 'febre-imunodeprimido-ped', 'choque-toxico-partes-moles-ped', 'artrite-osteomielite-ped'] },
    { rotulo: 'Hemato-oncologia e digestivo', slugs: ['hemocomponentes-ped', 'falciforme-ped', 'hemostasia-trombose-ped', 'emergencias-oncologicas-ped', 'hemorragia-digestiva-hepatica-ped'] },
    { rotulo: 'Trauma, toxicologia e acidentes', slugs: ['queimadura-ped', 'intoxicacoes-ped', 'escorpiao-aranhas-ped'] },
  ],
}

/** id estável para âncora do grupo na página */
export const idGrupo = (rotulo: string) =>
  'grupo-' + rotulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

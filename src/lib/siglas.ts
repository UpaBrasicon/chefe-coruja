// Siglas comuns do plantão → expansão. A busca local (Fuse) e a busca da
// biblioteca (API, cópia em biblioteca/app/siglas.py) usam a mesma lista:
// "o que é icc" precisa achar "insuficiência cardíaca". Manter as duas listas
// iguais. Siglas ambíguas trazem as duas leituras.

export const SIGLAS: Record<string, string> = {
  icc: 'insuficiência cardíaca congestiva',
  ic: 'insuficiência cardíaca',
  icfer: 'insuficiência cardíaca com fração de ejeção reduzida',
  iam: 'infarto agudo do miocárdio',
  sca: 'síndrome coronariana aguda',
  avc: 'acidente vascular cerebral',
  ave: 'acidente vascular encefálico',
  ait: 'ataque isquêmico transitório',
  tep: 'tromboembolismo pulmonar',
  tvp: 'trombose venosa profunda',
  tev: 'tromboembolismo venoso',
  dpoc: 'doença pulmonar obstrutiva crônica',
  cad: 'cetoacidose diabética',
  ehh: 'estado hiperglicêmico hiperosmolar',
  pcr: 'parada cardiorrespiratória (ou proteína C reativa)',
  rcp: 'reanimação cardiopulmonar',
  ira: 'insuficiência renal aguda',
  lra: 'lesão renal aguda',
  irc: 'insuficiência renal crônica',
  drc: 'doença renal crônica',
  itu: 'infecção do trato urinário',
  pac: 'pneumonia adquirida na comunidade',
  hda: 'hemorragia digestiva alta',
  hdb: 'hemorragia digestiva baixa',
  has: 'hipertensão arterial sistêmica',
  dm: 'diabetes mellitus',
  fa: 'fibrilação atrial',
  tce: 'traumatismo cranioencefálico',
  sdra: 'síndrome do desconforto respiratório agudo',
  vm: 'ventilação mecânica',
  vni: 'ventilação não invasiva',
  iot: 'intubação orotraqueal',
  isr: 'intubação em sequência rápida',
  eap: 'edema agudo de pulmão',
  hsa: 'hemorragia subaracnóidea',
  eme: 'estado de mal epiléptico',
  pam: 'pressão arterial média',
  bav: 'bloqueio atrioventricular',
  tsv: 'taquicardia supraventricular',
  tv: 'taquicardia ventricular',
  fv: 'fibrilação ventricular',
  aesp: 'atividade elétrica sem pulso',
  dva: 'droga vasoativa',
  atb: 'antibiótico',
  ivas: 'infecção de vias aéreas superiores',
  geca: 'gastroenterite aguda',
  tro: 'terapia de reidratação oral',
  sro: 'sais de reidratação oral',
  sf: 'soro fisiológico',
  sg: 'soro glicosado',
  kcl: 'cloreto de potássio',
  rn: 'recém-nascido',
  pic: 'pressão intracraniana',
  hic: 'hipertensão intracraniana',
  hnf: 'heparina não fracionada',
  hbpm: 'heparina de baixo peso molecular',
  aas: 'ácido acetilsalicílico',
  pep: 'profilaxia pós-exposição',
  tb: 'tuberculose',
  sbv: 'suporte básico de vida',
  sav: 'suporte avançado de vida',
  ecg: 'eletrocardiograma',
  tc: 'tomografia computadorizada',
  usg: 'ultrassonografia',
  gsa: 'gasometria arterial',
  civd: 'coagulação intravascular disseminada',
  shu: 'síndrome hemolítico-urêmica',
  irpa: 'insuficiência respiratória aguda',
  sirs: 'síndrome da resposta inflamatória sistêmica',
  qsofa: 'quick SOFA sepse',
  dhe: 'distúrbio hidroeletrolítico',
  ptt: 'púrpura trombocitopênica trombótica',
  pti: 'púrpura trombocitopênica imune',
  lmc: 'leucemia mieloide crônica',
  sta: 'síndrome torácica aguda',
  af: 'anemia falciforme',
  ttpa: 'tempo de tromboplastina parcial ativada',
  inr: 'razão normalizada internacional',
  rni: 'razão normalizada internacional',
}

const RE_TOKEN = /[a-z0-9]+/g

/** Expansões das siglas presentes na consulta (sem repetir). */
export function expandirSiglas(consulta: string): string[] {
  const vistas = new Set<string>()
  const saida: string[] = []
  for (const t of consulta.toLowerCase().match(RE_TOKEN) ?? []) {
    const exp = SIGLAS[t]
    if (exp && !vistas.has(exp)) {
      vistas.add(exp)
      saida.push(exp)
    }
  }
  return saida
}

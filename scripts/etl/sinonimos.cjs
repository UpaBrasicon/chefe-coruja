// Sinonímia BR -> nome internacional (RxNorm/openFDA). Compartilhado entre
// os scripts de ETL. Não é conteúdo clínico estruturado — só tradução de nome.
const SINONIMIA = {
  adrenalina: 'epinephrine',
  noradrenalina: 'norepinephrine',
  dipirona: 'metamizole',
  'dipirona (gotas)': 'metamizole',
  'dipirona (ampola)': 'metamizole',
  acetilcisteina: 'acetylcysteine',
  'acido folico': 'folic acid',
  'acido aminocaproico': 'aminocaproic acid',
  amicacina: 'amikacin',
  amiodarona: 'amiodarone',
  anlodipino: 'amlodipine',
  atracurio: 'atracurium',
  bicarbonato: 'sodium bicarbonate',
  carbamazepina: 'carbamazepine',
  ceftazidima: 'ceftazidime',
  cefuroxima: 'cefuroxime',
  cetamina: 'ketamine',
  cetorolaco: 'ketorolac',
  cetoprofeno: 'ketoprofen',
  cianocobalamina: 'cyanocobalamin',
  ciprofloxacino: 'ciprofloxacin',
  cisatracurio: 'cisatracurium',
  clopidogrel: 'clopidogrel',
  codeina: 'codeine',
  desmopressina: 'desmopressin',
  dexametasona: 'dexamethasone',
  digoxina: 'digoxin',
  diltiazem: 'diltiazem',
  dobutamina: 'dobutamine',
  doxorrubicina: 'doxorubicin',
  enalapril: 'enalapril',
  enoxaparina: 'enoxaparin',
  ertapenem: 'ertapenem',
  escopolamina: 'scopolamine',
  esmolol: 'esmolol',
  esomeprazol: 'esomeprazole',
  espironolactona: 'spironolactone',
  fentanila: 'fentanyl',
  fenitoina: 'phenytoin',
  fenobarbital: 'phenobarbital',
  fenoterol: 'fenoterol',
  fitomenadiona: 'phytonadione',
  fluconazol: 'fluconazole',
  furosemida: 'furosemide',
  ganciclovir: 'ganciclovir',
  gentamicina: 'gentamicin',
  glicose: 'glucose',
  glucagon: 'glucagon',
  haloperidol: 'haloperidol',
  hidralazina: 'hydralazine',
  hidroclorotiazida: 'hydrochlorothiazide',
  hidrocortisona: 'hydrocortisone',
  ipratropio: 'ipratropium',
  levetiracetam: 'levetiracetam',
  levofloxacino: 'levofloxacin',
  linezolida: 'linezolid',
  lorazepam: 'lorazepam',
  losartana: 'losartan',
  meropenem: 'meropenem',
  metformina: 'metformin',
  metilprednisolona: 'methylprednisolone',
  metoclopramida: 'metoclopramide',
  metoprolol: 'metoprolol',
  metronidazol: 'metronidazole',
  midazolam: 'midazolam',
  milrinona: 'milrinone',
  misoprostol: 'misoprostol',
  morfina: 'morphine',
  naloxona: 'naloxone',
  nitrofurantoina: 'nitrofurantoin',
  nitroglicerina: 'nitroglycerin',
  nifedipino: 'nifedipine',
  octreotida: 'octreotide',
  ocitocina: 'oxytocin',
  omeprazol: 'omeprazole',
  ondansetrona: 'ondansetron',
  oseltamivir: 'oseltamivir',
  oxacilina: 'oxacillin',
  pantoprazol: 'pantoprazole',
  paracetamol: 'acetaminophen',
  piperacilina: 'piperacillin',
  prometazina: 'promethazine',
  propofol: 'propofol',
  protamina: 'protamine',
  ranitidina: 'ranitidine',
  rocuronio: 'rocuronium',
  salbutamol: 'albuterol',
  sulfametoxazol: 'sulfamethoxazole',
  teofilina: 'theophylline',
  tramadol: 'tramadol',
  tranexamico: 'tranexamic acid',
  valproato: 'valproic acid',
  vancomicina: 'vancomycin',
  vasopressina: 'vasopressin',
  verapamil: 'verapamil',
  nitroprussiato: 'nitroprusside',
  'soro fisiologico': 'sodium chloride',
  'soro glicofisiologico': 'sodium chloride / dextrose',
  'ringer lactato': 'lactated ringer',
  'albumina humana': 'albumin human',
  'heparina nao fracionada': 'heparin',
  'cloreto de potassio': 'potassium chloride',
  'fosfato de potassio': 'potassium phosphate',
  'sulfato de magnesio': 'magnesium sulfate',
  'gluconato de calcio': 'calcium gluconate',
  'cloreto de calcio': 'calcium chloride',
  'bicarbonato de sodio': 'sodium bicarbonate',
  'cloreto de sodio': 'sodium chloride',
  'carvao ativado': 'charcoal activated',
  dimenidrinato: 'dimenhydrinate',
  'amoxicilina clavulanato': 'amoxicillin / clavulanate',
  'amoxicilina sulbactam': 'amoxicillin / clavulanate',
  'ampicilina sulbactam': 'ampicillin / sulbactam',
  'piperacilina tazobactam': 'piperacillin / tazobactam',
  'imipenem cilastatina': 'imipenem / cilastatin',
  'sulfametoxazol trimetoprima': 'sulfamethoxazole / trimethoprim',
  'anfotericina b desoxicolato': 'amphotericin b',
  'anfotericina b lipossomal': 'amphotericin b',
  'insulina nph': 'insulin isophane',
  'acido acetilsalicilico': 'aspirin',
  aas: 'aspirin',
  'sulfato ferroso': 'ferrous sulfate',
  hidroxiureia: 'hydroxyurea',
  colistina: 'colistin',
  'acido aminocaproico': 'aminocaproic acid',
  rimantadina: 'rimantadine',
  warfarina: 'warfarin',
  levotiroxina: 'levothyroxine',
  oseltamivir: 'oseltamivir',
}

// rxcui canônicos verificados via RxNorm (nome -> rxcui), para casos onde o
// princípio não é um fármaco (soros/soluções) e o RxNav não resolve por nome.
const RXCUI_MANUAL = {
  'soro fisiologico': '9863', // sodium chloride
  'soro glicofisiologico': '20623', // sodium chloride 0.9% / dextrose 5%
  'ringer lactato': '2877', // lactated ringers
  'nitroprussiato de sodio': '7476', // nitroprusside
}

function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nomeBase(s) {
  const semParenteses = (s || '').replace(/[\(\[].*?[\)\]]/g, '').replace(/\s+/g, ' ').trim()
  const semNumeros = semParenteses
    .split(' ')
    .filter((tok) => !/^[0-9.,/%]+$/.test(tok))
    .join(' ')
  return normalizar(semNumeros)
}

function nomeInternacional(nomeBR) {
  const base = nomeBase(nomeBR)
  return SINONIMIA[base] ?? base
}

module.exports = { SINONIMIA, RXCUI_MANUAL, normalizar, nomeBase, nomeInternacional }

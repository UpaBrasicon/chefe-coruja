import { fichaPediatrica } from './fonte.ts'

// Doses pediátricas em bolus, por peso (transcritas do PedGuide — ver fonte.ts).
// Cada item guarda a faixa por kg, o valor por kg usado no cálculo, o máximo
// absoluto e a concentração da apresentação. O cálculo é puro: dose =
// min(porKg × peso, máximo); volume = dose ÷ concentração.

export const fichaBolusPediatrico = fichaPediatrica('ped-bolus', 'Doses pediátricas em bolus por peso')

export type Grupo =
  | 'pcr' | 'isr' | 'emergencia' | 'anticonvulsivante' | 'hic' | 'procedimento' | 'asma' | 'antidoto'

export const GRUPOS: Record<Grupo, string> = {
  pcr: 'Parada cardiorrespiratória',
  isr: 'Intubação — sequência rápida',
  emergencia: 'Outras drogas de emergência',
  anticonvulsivante: 'Anticonvulsivantes',
  hic: 'Hipertensão intracraniana',
  procedimento: 'Dor e sedação para procedimento',
  asma: 'Crise asmática',
  antidoto: 'Toxicologia e antídotos',
}

export type Bolus = {
  id: string
  nome: string
  grupo: Grupo
  /** o que se mede: mg, mcg, g, UI, mEq ou mL */
  unidade: 'mg' | 'mcg' | 'g' | 'UI' | 'mEq' | 'mL'
  /** faixa por kg, na unidade acima */
  faixa: [number, number]
  /** valor por kg usado no cálculo (quando a faixa é larga, o PedGuide calcula num ponto dela) */
  calcularEm: number
  /** máximo absoluto por dose, na mesma unidade */
  maximo?: number
  /** mínimo absoluto por dose */
  minimo?: number
  /** unidade por mL da apresentação (mesma unidade da dose); ausente quando não se aspira volume */
  porMl?: number
  apresentacao: string
  via: string
  nota: string
  /** "não rotineiro" no PedGuide */
  naoRotineiro?: boolean
}

const B = (b: Bolus) => b

export const BOLUS: Bolus[] = [
  // ── PCR ──
  B({ id: 'epinefrina-pcr', nome: 'Epinefrina (PCR)', grupo: 'pcr', unidade: 'mg', faixa: [0.01, 0.01], calcularEm: 0.01, maximo: 1, porMl: 0.1, apresentacao: 'solução final 0,1 mg/mL (1 mg em 10 mL)', via: 'EV/IO', nota: 'Volume de 0,1 mL/kg da solução 0,1 mg/mL; repetir a cada 3–5 min. A ampola de 1 mg/mL não vai pura por via EV/IO.' }),
  B({ id: 'amiodarona-pcr', nome: 'Amiodarona', grupo: 'pcr', unidade: 'mg', faixa: [5, 5], calcularEm: 5, maximo: 300, porMl: 50, apresentacao: '50 mg/mL', via: 'EV/IO', nota: 'FV/TV sem pulso refratária; pode repetir até 15 mg/kg no total.' }),
  B({ id: 'lidocaina-pcr', nome: 'Lidocaína 1%', grupo: 'pcr', unidade: 'mg', faixa: [1, 1], calcularEm: 1, maximo: 100, porMl: 10, apresentacao: '10 mg/mL', via: 'EV/IO', nota: 'FV/TV sem pulso, alternativa à amiodarona.' }),
  B({ id: 'atropina-bradi', nome: 'Atropina (bradicardia)', grupo: 'pcr', unidade: 'mg', faixa: [0.02, 0.02], calcularEm: 0.02, maximo: 1, porMl: 0.5, apresentacao: '0,5 mg/mL', via: 'EV/IO', nota: 'Bradicardia com pulso.' }),
  B({ id: 'bicarbonato-pcr', nome: 'Bicarbonato de sódio 8,4%', grupo: 'pcr', unidade: 'mEq', faixa: [1, 1], calcularEm: 1, porMl: 1, apresentacao: '1 mEq/mL (diluir com igual volume de AD)', via: 'EV/IO', nota: 'Não rotineiro na PCR: hipercalemia, intoxicação por bloqueador de canal de sódio ou indicação específica. Não misturar com cálcio.', naoRotineiro: true }),
  B({ id: 'gluconato-calcio-pcr', nome: 'Gluconato de cálcio 10%', grupo: 'pcr', unidade: 'mg', faixa: [60, 100], calcularEm: 60, maximo: 2000, porMl: 100, apresentacao: '100 mg/mL', via: 'EV/IO lento, com ECG', nota: 'Não rotineiro na PCR: hipocalcemia, hipercalemia ou intoxicação por bloqueador de canal de cálcio. Calculado no piso da faixa.', naoRotineiro: true }),
  B({ id: 'cloreto-calcio-pcr', nome: 'Cloreto de cálcio 10%', grupo: 'pcr', unidade: 'mg', faixa: [20, 20], calcularEm: 20, maximo: 1000, porMl: 100, apresentacao: '100 mg/mL', via: 'central ou IO de preferência', nota: 'Mesmas indicações específicas do cálcio; necrose por extravasamento. Não misturar com bicarbonato.', naoRotineiro: true }),
  B({ id: 'insulina-hiperk', nome: 'Insulina regular (hipercalemia)', grupo: 'pcr', unidade: 'UI', faixa: [0.1, 0.1], calcularEm: 0.1, maximo: 10, apresentacao: '100 UI/mL — seringa de insulina', via: 'EV', nota: 'Sempre com glicose associada.' }),
  B({ id: 'magnesio-pcr', nome: 'Sulfato de magnésio 10%', grupo: 'pcr', unidade: 'mg', faixa: [50, 50], calcularEm: 50, maximo: 2000, porMl: 100, apresentacao: '100 mg/mL', via: 'EV/IO', nota: 'Torsades de pointes ou hipomagnesemia.' }),
  B({ id: 'glicose-10', nome: 'Glicose 10%', grupo: 'pcr', unidade: 'g', faixa: [0.5, 0.5], calcularEm: 0.5, porMl: 0.1, apresentacao: '100 mg/mL (5 mL/kg)', via: 'EV/IO', nota: 'Hipoglicemia; reavaliar a glicemia. G50% sem diluição não se usa na criança.' }),
  B({ id: 'glicose-25', nome: 'Glicose 25%', grupo: 'pcr', unidade: 'g', faixa: [0.5, 0.5], calcularEm: 0.5, porMl: 0.25, apresentacao: '250 mg/mL (2 mL/kg)', via: 'EV/IO', nota: 'Alternativa na criança maior com acesso adequado; no lactente e em acesso periférico pequeno, G10%.' }),

  // ── ISR ──
  B({ id: 'cetamina-isr', nome: 'Cetamina', grupo: 'isr', unidade: 'mg', faixa: [1, 2], calcularEm: 2, porMl: 50, apresentacao: '50 mg/mL', via: 'EV', nota: 'Indução dissociativa, broncodilatação.' }),
  B({ id: 'midazolam-isr', nome: 'Midazolam', grupo: 'isr', unidade: 'mg', faixa: [0.1, 0.3], calcularEm: 0.3, maximo: 10, porMl: 5, apresentacao: '5 mg/mL', via: 'EV', nota: 'Início menos previsível no choque; pode causar hipotensão.' }),
  B({ id: 'fentanil-isr', nome: 'Fentanil', grupo: 'isr', unidade: 'mcg', faixa: [1, 2], calcularEm: 2, maximo: 100, porMl: 50, apresentacao: '50 mcg/mL', via: 'EV lento', nota: 'Analgesia.' }),
  B({ id: 'propofol-isr', nome: 'Propofol', grupo: 'isr', unidade: 'mg', faixa: [1, 2.5], calcularEm: 2.5, porMl: 10, apresentacao: '10 mg/mL', via: 'EV', nota: 'Hipotensão dose-dependente; o PedGuide recomenda evitar no choque.' }),
  B({ id: 'etomidato-isr', nome: 'Etomidato', grupo: 'isr', unidade: 'mg', faixa: [0.2, 0.4], calcularEm: 0.3, maximo: 20, porMl: 2, apresentacao: '2 mg/mL', via: 'EV', nota: 'Estabilidade hemodinâmica; o PedGuide recomenda evitar na sepse.' }),
  B({ id: 'rocuronio-isr', nome: 'Rocurônio', grupo: 'isr', unidade: 'mg', faixa: [1.2, 1.2], calcularEm: 1.2, maximo: 100, porMl: 10, apresentacao: '10 mg/mL', via: 'EV', nota: 'Início rápido; paralisia prolongada exige sedação pós-intubação.' }),
  B({ id: 'succinilcolina-isr', nome: 'Succinilcolina', grupo: 'isr', unidade: 'mg', faixa: [1, 2], calcularEm: 1.5, maximo: 100, porMl: 10, apresentacao: '100 mg reconstituída em 10 mL (10 mg/mL)', via: 'EV', nota: 'Contraindicada em hipercalemia, queimadura após 24 h, denervação ou doença neuromuscular, rabdomiólise e risco de hipertermia maligna.' }),
  B({ id: 'cisatracurio-isr', nome: 'Cisatracúrio', grupo: 'isr', unidade: 'mg', faixa: [0.1, 0.15], calcularEm: 0.15, porMl: 2, apresentacao: '2 mg/mL', via: 'EV', nota: 'Início mais lento; não é primeira escolha para sequência rápida.' }),

  // ── emergência ──
  B({ id: 'epinefrina-im', nome: 'Epinefrina IM (anafilaxia)', grupo: 'emergencia', unidade: 'mg', faixa: [0.01, 0.01], calcularEm: 0.01, maximo: 0.5, porMl: 1, apresentacao: '1 mg/mL, sem diluir', via: 'IM, vasto lateral da coxa', nota: 'Repetir a cada 5–15 min conforme resposta.' }),
  B({ id: 'adenosina-1', nome: 'Adenosina — 1ª dose', grupo: 'emergencia', unidade: 'mg', faixa: [0.1, 0.1], calcularEm: 0.1, maximo: 6, porMl: 3, apresentacao: '3 mg/mL', via: 'EV em bolus rápido + flush de 5–10 mL de SF', nota: 'TSV com pulso.' }),
  B({ id: 'adenosina-2', nome: 'Adenosina — 2ª dose', grupo: 'emergencia', unidade: 'mg', faixa: [0.2, 0.2], calcularEm: 0.2, maximo: 12, porMl: 3, apresentacao: '3 mg/mL', via: 'EV em bolus rápido + flush de 5–10 mL de SF', nota: 'TSV com pulso.' }),
  B({ id: 'naloxona', nome: 'Naloxona', grupo: 'emergencia', unidade: 'mg', faixa: [0.1, 0.1], calcularEm: 0.1, maximo: 2, porMl: 0.4, apresentacao: '0,4 mg/mL', via: 'EV, IO, IM ou IN', nota: 'Reversão de opioide. Com possibilidade de dependência e ventilação presente, doses menores (0,01 mg/kg) tituladas.' }),
  B({ id: 'tranexamico', nome: 'Ácido tranexâmico', grupo: 'emergencia', unidade: 'mg', faixa: [15, 15], calcularEm: 15, maximo: 1000, porMl: 50, apresentacao: '50 mg/mL', via: 'EV em 10 min', nota: 'Trauma com hemorragia.' }),
  B({ id: 'hidrocortisona', nome: 'Hidrocortisona', grupo: 'emergencia', unidade: 'mg', faixa: [2, 4], calcularEm: 4, maximo: 200, porMl: 50, apresentacao: '100 mg/2 mL', via: 'EV', nota: 'Não rotineira na anafilaxia; asma associada ou reação refratária, depois da epinefrina.', naoRotineiro: true }),
  B({ id: 'difenidramina', nome: 'Difenidramina', grupo: 'emergencia', unidade: 'mg', faixa: [1, 1.25], calcularEm: 1.25, maximo: 50, porMl: 50, apresentacao: '50 mg/mL', via: 'EV lento ou IM', nota: 'Não rotineira; sintomas cutâneos após estabilização. Sedação e hipotensão.', naoRotineiro: true }),
  B({ id: 'octreotide-hda', nome: 'Octreotide (HDA) — bolus', grupo: 'emergencia', unidade: 'mcg', faixa: [1, 2], calcularEm: 2, maximo: 50, porMl: 100, apresentacao: '0,1 mg/mL (100 mcg/mL)', via: 'EV em bolus', nota: 'Hemorragia digestiva alta. Infusão de 1–2 mcg/kg/h, máximo 25–50 mcg/h.' }),
  B({ id: 'omeprazol-hda', nome: 'Omeprazol (HDA)', grupo: 'emergencia', unidade: 'mg', faixa: [1, 1], calcularEm: 1, maximo: 40, porMl: 4, apresentacao: '40 mg + 10 mL de diluente (4 mg/mL)', via: 'EV em bolus', nota: 'Hemorragia digestiva alta.' }),

  // ── anticonvulsivantes ──
  B({ id: 'diazepam-se', nome: 'Diazepam', grupo: 'anticonvulsivante', unidade: 'mg', faixa: [0.3, 0.3], calcularEm: 0.3, maximo: 5, porMl: 5, apresentacao: '5 mg/mL, sem diluir', via: 'EV em bolus', nota: 'Estado de mal epiléptico, 1ª linha. Máximo de 5 mg como está no PedGuide — conferir na fonte primária.' }),
  B({ id: 'midazolam-se-im', nome: 'Midazolam (estado de mal) — IM', grupo: 'anticonvulsivante', unidade: 'mg', faixa: [0.3, 0.3], calcularEm: 0.3, maximo: 10, porMl: 5, apresentacao: '5 mg/mL', via: 'IM', nota: 'Alternativa de 1ª linha.' }),
  B({ id: 'midazolam-se-ev', nome: 'Midazolam (estado de mal) — EV', grupo: 'anticonvulsivante', unidade: 'mg', faixa: [0.1, 0.1], calcularEm: 0.1, maximo: 5, porMl: 5, apresentacao: '5 mg/mL', via: 'EV', nota: 'Alternativa de 1ª linha.' }),
  B({ id: 'fenitoina', nome: 'Fenitoína', grupo: 'anticonvulsivante', unidade: 'mg', faixa: [20, 20], calcularEm: 20, maximo: 1500, porMl: 50, apresentacao: '50 mg/mL', via: 'EV em 20 min, diluída em SF, com ECG', nota: '2ª linha.' }),
  B({ id: 'fenobarbital', nome: 'Fenobarbital', grupo: 'anticonvulsivante', unidade: 'mg', faixa: [20, 20], calcularEm: 20, maximo: 1000, porMl: 100, apresentacao: '100 mg/mL', via: 'EV em 15–20 min, diluído em SF', nota: 'Refratário ou neonatal; depressão respiratória.' }),
  B({ id: 'levetiracetam', nome: 'Levetiracetam', grupo: 'anticonvulsivante', unidade: 'mg', faixa: [40, 60], calcularEm: 60, maximo: 3000, porMl: 100, apresentacao: '100 mg/mL', via: 'EV em 15 min', nota: 'Alternativa de 2ª linha.' }),

  // ── HIC ──
  B({ id: 'manitol', nome: 'Manitol 20%', grupo: 'hic', unidade: 'g', faixa: [0.25, 1], calcularEm: 0.5, porMl: 0.2, apresentacao: '200 mg/mL', via: 'EV em 15–30 min', nota: 'Hipertensão intracraniana.' }),
  B({ id: 'salina-3', nome: 'NaCl 3%', grupo: 'hic', unidade: 'mL', faixa: [2, 5], calcularEm: 3, porMl: 1, apresentacao: '0,513 mEq de Na por mL', via: 'EV em 10–20 min', nota: 'Hipertensão intracraniana ou hiponatremia grave.' }),

  // ── procedimento ──
  B({ id: 'cetamina-proc-ev', nome: 'Cetamina — EV', grupo: 'procedimento', unidade: 'mg', faixa: [1, 1], calcularEm: 1, maximo: 100, porMl: 50, apresentacao: '50 mg/mL', via: 'EV lento', nota: 'Sedação dissociativa; o PedGuide evita abaixo de 3 meses.' }),
  B({ id: 'cetamina-proc-im', nome: 'Cetamina — IM', grupo: 'procedimento', unidade: 'mg', faixa: [4, 4], calcularEm: 4, maximo: 200, porMl: 50, apresentacao: '50 mg/mL', via: 'IM', nota: 'Sedação dissociativa; o PedGuide evita abaixo de 3 meses.' }),
  B({ id: 'fentanil-proc-ev', nome: 'Fentanil — EV', grupo: 'procedimento', unidade: 'mcg', faixa: [1, 1], calcularEm: 1, maximo: 100, porMl: 50, apresentacao: '50 mcg/mL', via: 'EV lento', nota: 'Analgesia.' }),
  B({ id: 'fentanil-proc-in', nome: 'Fentanil — intranasal', grupo: 'procedimento', unidade: 'mcg', faixa: [1.5, 1.5], calcularEm: 1.5, maximo: 100, porMl: 50, apresentacao: '50 mcg/mL', via: 'IN', nota: 'Analgesia.' }),
  B({ id: 'midazolam-proc-ev', nome: 'Midazolam — EV', grupo: 'procedimento', unidade: 'mg', faixa: [0.1, 0.1], calcularEm: 0.1, maximo: 5, porMl: 5, apresentacao: '5 mg/mL', via: 'EV', nota: 'Ansiólise ou sedação leve.' }),
  B({ id: 'midazolam-proc-in', nome: 'Midazolam — intranasal', grupo: 'procedimento', unidade: 'mg', faixa: [0.4, 0.4], calcularEm: 0.4, maximo: 10, porMl: 5, apresentacao: '5 mg/mL', via: 'IN (acima de 1 mL, dividir entre as narinas)', nota: 'Ansiólise ou sedação leve.' }),
  B({ id: 'morfina-proc', nome: 'Morfina', grupo: 'procedimento', unidade: 'mg', faixa: [0.1, 0.1], calcularEm: 0.1, maximo: 5, porMl: 10, apresentacao: '10 mg/mL', via: 'EV lento', nota: 'Dor intensa.' }),
  B({ id: 'propofol-proc', nome: 'Propofol', grupo: 'procedimento', unidade: 'mg', faixa: [1, 1], calcularEm: 1, maximo: 100, porMl: 10, apresentacao: '10 mg/mL', via: 'EV lento, em doses fracionadas', nota: 'Procedimentos curtos.' }),

  // ── asma ──
  B({ id: 'prednisolona', nome: 'Prednisolona', grupo: 'asma', unidade: 'mg', faixa: [1, 2], calcularEm: 2, maximo: 40, porMl: 3, apresentacao: '3 mg/mL', via: 'VO, 1 vez ao dia, 3–5 dias', nota: 'Crise moderada ou grave. Máximo de 40 mg/dia.' }),
  B({ id: 'metilprednisolona', nome: 'Metilprednisolona (succinato)', grupo: 'asma', unidade: 'mg', faixa: [1, 1], calcularEm: 1, maximo: 80, apresentacao: 'diluir em 20–50 mL de SF', via: 'EV em 20 min', nota: 'Crise grave.' }),
  B({ id: 'magnesio-asma-10', nome: 'Sulfato de magnésio 10%', grupo: 'asma', unidade: 'mg', faixa: [50, 50], calcularEm: 50, maximo: 2000, porMl: 100, apresentacao: '100 mg/mL (diluir em 100 mL de SF)', via: 'EV em 20 min', nota: 'Crise grave refratária.' }),
  B({ id: 'magnesio-asma-50', nome: 'Sulfato de magnésio 50%', grupo: 'asma', unidade: 'mg', faixa: [50, 50], calcularEm: 50, maximo: 2000, porMl: 500, apresentacao: '500 mg/mL (completar até 100 mL de SF)', via: 'EV em 20 min', nota: 'Crise grave refratária.' }),

  // ── antídotos ──
  B({ id: 'atropina-organofosforado', nome: 'Atropina (organofosforado)', grupo: 'antidoto', unidade: 'mg', faixa: [0.02, 0.05], calcularEm: 0.05, minimo: 0.1, porMl: 0.5, apresentacao: '0,5 mg/mL', via: 'EV em bolus', nota: 'Repetir a cada 3–5 min dobrando a dose até controle de secreção e ventilação; sem teto cumulativo na síndrome colinérgica grave. Contato com o CIATox.' }),
  B({ id: 'bicarbonato-tox', nome: 'Bicarbonato de sódio 8,4% (bloqueador de canal de sódio)', grupo: 'antidoto', unidade: 'mEq', faixa: [1, 2], calcularEm: 2, maximo: 250, porMl: 1, apresentacao: '1 mEq/mL', via: 'EV em bolus', nota: 'Repetir guiado por QRS e pH. Contato com o CIATox.' }),
  B({ id: 'emulsao-lipidica', nome: 'Emulsão lipídica 20% — bolus', grupo: 'antidoto', unidade: 'mL', faixa: [1.5, 1.5], calcularEm: 1.5, porMl: 1, apresentacao: 'pronta para uso', via: 'EV em 2–3 min', nota: 'Toxicidade por anestésico local; depois, infusão de 0,25 mL/kg/min por 30–60 min, total até 12 mL/kg. Contato com o CIATox.' }),
  B({ id: 'glucagon', nome: 'Glucagon (betabloqueador/BCC) — ataque', grupo: 'antidoto', unidade: 'mg', faixa: [0.05, 0.05], calcularEm: 0.05, maximo: 10, porMl: 0.08, apresentacao: '4 mg + SG 5% 46 mL = 0,08 mg/mL', via: 'EV', nota: 'Manutenção de 0,05–0,1 mg/kg/h na mesma diluição; benefício incerto. Contato com o CIATox.' }),
  B({ id: 'gluconato-calcio-tox', nome: 'Gluconato de cálcio 10% (BCC)', grupo: 'antidoto', unidade: 'mg', faixa: [60, 60], calcularEm: 60, maximo: 2000, porMl: 100, apresentacao: '100 mg/mL', via: 'EV lento, diluído', nota: 'Intoxicação por bloqueador de canal de cálcio ou hipocalcemia.' }),
  B({ id: 'hidroxicobalamina', nome: 'Hidroxicobalamina', grupo: 'antidoto', unidade: 'mg', faixa: [70, 70], calcularEm: 70, maximo: 5000, porMl: 25, apresentacao: '5 g/200 mL (25 mg/mL)', via: 'EV', nota: 'Cianeto (inalação de fumaça).' }),
  B({ id: 'insulina-alta-dose', nome: 'Insulina em alta dose (BB/BCC) — bolus', grupo: 'antidoto', unidade: 'UI', faixa: [1, 1], calcularEm: 1, porMl: 1, apresentacao: '100 UI em 100 mL de SF (1 UI/mL)', via: 'EV', nota: 'Infusão de 0,5–1 UI/kg/h; glicose associada; glicemia a cada 15–30 min, potássio, magnésio e fósforo. Contato com o CIATox.' }),
  B({ id: 'naloxona-tox', nome: 'Naloxona (intoxicação grave)', grupo: 'antidoto', unidade: 'mg', faixa: [0.1, 0.1], calcularEm: 0.1, maximo: 2, porMl: 0.4, apresentacao: '0,4 mg/mL', via: 'EV, IO, IM ou IN', nota: 'Máximo de 2 mg por dose, repetir conforme resposta.' }),
  B({ id: 'octreotide-sulfonilureia', nome: 'Octreotide (sulfonilureia)', grupo: 'antidoto', unidade: 'mcg', faixa: [1, 2], calcularEm: 2, maximo: 50, porMl: 100, apresentacao: '0,1 mg/mL (100 mcg/mL)', via: 'EV em bolus', nota: 'Hipoglicemia refratária por sulfonilureia.' }),
  B({ id: 'vitamina-k', nome: 'Vitamina K', grupo: 'antidoto', unidade: 'mg', faixa: [0.03, 0.03], calcularEm: 0.03, maximo: 5, porMl: 10, apresentacao: '10 mg/mL', via: 'EV lento', nota: 'Cumarínico. Esquema de dose fixa possível: 0,5–2–5 mg conforme gravidade.' }),
  B({ id: 'nac-1', nome: 'N-acetilcisteína — fase 1 (1 h)', grupo: 'antidoto', unidade: 'mg', faixa: [150, 150], calcularEm: 150, maximo: 15000, porMl: 100, apresentacao: '100 mg/mL (diluir em 100 mL de SF)', via: 'EV em 1 h', nota: 'Paracetamol.' }),
  B({ id: 'nac-2', nome: 'N-acetilcisteína — fase 2 (4 h)', grupo: 'antidoto', unidade: 'mg', faixa: [50, 50], calcularEm: 50, maximo: 5000, porMl: 100, apresentacao: '100 mg/mL (diluir em 100 mL de SF)', via: 'EV em 4 h', nota: 'Paracetamol.' }),
  B({ id: 'nac-3', nome: 'N-acetilcisteína — fase 3 (16 h)', grupo: 'antidoto', unidade: 'mg', faixa: [100, 100], calcularEm: 100, maximo: 10000, porMl: 100, apresentacao: '100 mg/mL (diluir em 200 mL de SF)', via: 'EV em 16 h', nota: 'Paracetamol.' }),
]

export type DoseCalculada = {
  dose: number
  volumeMl: number | null
  /** a dose bateu no máximo absoluto */
  noMaximo: boolean
  noMinimo: boolean
  faixaTotal: [number, number]
}

/** Dose de um bolus para o peso. Peso inválido não calcula. */
export function calcularBolus(b: Bolus, pesoKg: number): DoseCalculada | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  let dose = b.calcularEm * pesoKg
  const noMaximo = b.maximo !== undefined && dose > b.maximo
  if (noMaximo) dose = b.maximo!
  const noMinimo = b.minimo !== undefined && dose < b.minimo
  if (noMinimo) dose = b.minimo!
  const lim = (x: number) => Math.max(b.minimo ?? 0, b.maximo !== undefined ? Math.min(x, b.maximo) : x)
  return {
    dose,
    volumeMl: b.porMl ? dose / b.porMl : null,
    noMaximo,
    noMinimo,
    faixaTotal: [lim(b.faixa[0] * pesoKg), lim(b.faixa[1] * pesoKg)],
  }
}

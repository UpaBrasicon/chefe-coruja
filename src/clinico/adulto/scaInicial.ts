import type { Ficha } from '../ficha.ts'
import { AHA_SCA_2025, ESC_SCA_2023, enoxaparina, type Enoxaparina } from './anticoagulacao.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// SCA — conduta inicial na UPA (lacunas da Central, lote 2, 23/10/2026).
// Fonte das doses: Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022),
// cap. 13 IAM sem supra (p. 199–210) e cap. 14 IAM com supra (p. 211–221),
// lidos no PDF (página do livro = página do PDF + 1). O que o capítulo traz como
// conduta aparece como "o manual traz"; a decisão é do médico (ADR 0007).
// Fibrinolítico e enoxaparina têm tela própria (anticoagulacao.ts): aqui a
// enoxaparina reaproveita a mesma função, sem segunda regra.

const PAG_SCA = 'cap. 13 IAM sem supra, p. 199–210; cap. 14 IAM com supra, p. 211–221'

export const fichaScaInicialAdulto: Ficha = {
  ...fichaAdulto('adulto-sca-inicial', 'SCA — conduta inicial (adulto)', PAG_SCA),
  versao: '2026-10-23.1',
  fontes: [pagina(PAG_SCA), AHA_SCA_2025, ESC_SCA_2023],
  revisadoEm: '23/10/2026 (lacunas da Central, lote 2; doses conferidas no texto do manual, com página)',
}

export type TipoSca = 'supra' | 'equivalente' | 'sem_supra'

export type EntradaSca = {
  tipo: TipoSca
  idadeAnos?: number
  pesoKg?: number
  clcr?: number
  /** IAM com supra: horas desde o início dos sintomas */
  horasSintomas?: number
  /** IAM com supra há mais de 12 h: ainda há evidência de isquemia? */
  isquemiaPersistente?: boolean
  /** tempo previsto da entrada até a reperfusão percutânea, em minutos */
  atrasoIcpMin?: number
  contraindicacaoLitico?: boolean
  /** IAM sem supra: estratificação invasiva disponível em menos de 6–24 h */
  invasivaPrecoce?: boolean
  /** IAM sem supra: candidato a intervenção coronária em até 6 h */
  icpEm6h?: boolean
  avcAitPrevio?: boolean
}

export type Via = 'angioplastia' | 'fibrinolitico' | 'sem_definicao'

export type Reperfusao = { via: Via; motivo: string; pagina: string }

export type Dose = { droga: string; ataque: string; manutencao?: string; pagina: string; nota?: string }

export type CondutaSca = {
  reperfusao: Reperfusao | null
  antiagregantes: Dose[]
  /** null quando o manual deixa o anticoagulante para a sala de cateterismo */
  enoxaparina: { contexto: string; dose: Enoxaparina | null; pagina: string } | null
  anticoagulacaoTexto: string
  avisos: string[]
}

const ok = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x > 0

export const AAS: Dose = {
  droga: 'Ácido acetilsalicílico (AAS)',
  ataque: '300 mg, mastigado',
  pagina: 'p. 199, 203 e 216',
  nota: 'Não usar a forma tamponada. Fora se a dissecção de aorta for a principal suspeita; na alergia verdadeira, o manual dá ticagrelor ou prasugrel como alternativa (p. 200).',
}

/** Supra de ST pela idade e sexo nas derivações V2–V3 (cap. 14, p. 212). */
export function limiarSupraV2V3(mulher: boolean, idadeAnos: number): number {
  if (mulher) return 1.5
  return idadeAnos < 40 ? 2.5 : 2
}

/** Prasugrel no IAM sem supra (p. 207): menos de 75 anos, mais de 60 kg, sem AVC ou AIT prévio. null se faltar dado. */
export function prasugrelElegivel(e: EntradaSca): boolean | null {
  if (e.avcAitPrevio === true) return false
  if (ok(e.idadeAnos) && e.idadeAnos >= 75) return false
  if (ok(e.pesoKg) && e.pesoKg <= 60) return false
  if (!ok(e.idadeAnos) || !ok(e.pesoKg) || e.avcAitPrevio === undefined) return null
  return true
}

/** Reperfusão no IAM com supra ou equivalente (cap. 14, p. 213 e 218). */
export function reperfusao(e: EntradaSca): Reperfusao | null {
  if (e.tipo === 'sem_supra') return null
  if (e.tipo === 'equivalente') {
    return { via: 'angioplastia', motivo: 'Equivalente de supra: o consenso europeu citado no manual indica a angioplastia primária, mas não a trombólise.', pagina: 'p. 213' }
  }
  if (e.contraindicacaoLitico) {
    return { via: 'angioplastia', motivo: 'Contraindicação ao fibrinolítico (Tabela 1): angioplastia primária, não importa o tempo.', pagina: 'p. 218' }
  }
  if (!ok(e.horasSintomas)) return null
  if (e.horasSintomas > 12) {
    return e.isquemiaPersistente
      ? { via: 'angioplastia', motivo: 'Mais de 12 horas com evidência de isquemia: angioplastia primária.', pagina: 'p. 218' }
      : { via: 'sem_definicao', motivo: 'Mais de 12 horas sem evidência de isquemia: o manual diz que não há evidência clara; um estudo pequeno sugere conduta intervencionista precoce (< 24 h).', pagina: 'p. 218' }
  }
  if (e.atrasoIcpMin === undefined || !Number.isFinite(e.atrasoIcpMin) || e.atrasoIcpMin < 0) return null
  // o lítico só aparece depois de respondida a contraindicação (Tabela 1)
  if (e.atrasoIcpMin > 120 && e.contraindicacaoLitico === undefined) return null
  return e.atrasoIcpMin > 120
    ? { via: 'fibrinolitico', motivo: 'Tempo previsto até a reperfusão percutânea acima de 120 minutos: fibrinolítico, com porta-agulha menor que 10 minutos.', pagina: 'p. 218' }
    : { via: 'angioplastia', motivo: 'Menos de 12 horas e reperfusão percutânea em até 120 minutos: angioplastia primária.', pagina: 'p. 218' }
}

/** Clopidogrel com trombólise (p. 219): 300 mg até 75 anos; 75 mg acima. */
export function clopidogrelLitico(idadeAnos: number | undefined): Dose | null {
  if (!ok(idadeAnos)) return null
  return { droga: 'Clopidogrel', ataque: idadeAnos > 75 ? '75 mg (acima de 75 anos)' : '300 mg (75 anos ou menos)', pagina: 'p. 219' }
}

/** Conduta inicial pelo manual: antiagregantes, anticoagulante e reperfusão. */
export function condutaSca(e: EntradaSca): CondutaSca {
  const avisos: string[] = []
  const rep = reperfusao(e)
  const antiagregantes: Dose[] = [AAS]
  let enoxa: CondutaSca['enoxaparina'] = null
  let anticoagulacaoTexto: string

  if (e.tipo !== 'sem_supra') {
    if (rep?.via === 'fibrinolitico') {
      const c = clopidogrelLitico(e.idadeAnos)
      if (c) antiagregantes.push(c)
      else avisos.push('Informe a idade para a dose do clopidogrel com trombólise (300 mg até 75 anos; 75 mg acima).')
      enoxa = { contexto: 'Após trombólise, por 7 dias', dose: ok(e.pesoKg) ? enoxaparina('iamcsst-trombolise', { pesoKg: e.pesoKg, idadeAnos: e.idadeAnos, clcr: e.clcr }) : null, pagina: 'p. 219' }
      anticoagulacaoTexto = 'Enoxaparina plena após a trombólise (com estreptoquinase, sem ataque e primeira dose após 24 horas).'
    } else if (rep?.via === 'angioplastia') {
      antiagregantes.push(
        { droga: 'Ticagrelor', ataque: '180 mg', manutencao: '90 mg 12/12 h', pagina: 'p. 219' },
        { droga: 'Prasugrel', ataque: '60 mg', manutencao: '10 mg 1 vez ao dia', pagina: 'p. 219' },
        { droga: 'Clopidogrel', ataque: '600 mg', pagina: 'p. 219', nota: 'Ticagrelor e prasugrel têm maior benefício nessa situação.' },
      )
      anticoagulacaoTexto = 'Na angioplastia primária, o manual não faz anticoagulante antes: ele é feito na sala de cateterismo, após a punção arterial (p. 219).'
    } else {
      anticoagulacaoTexto = 'Defina a reperfusão para ver o segundo antiagregante e o anticoagulante.'
    }
    return { reperfusao: rep, antiagregantes, enoxaparina: enoxa, anticoagulacaoTexto, avisos }
  }

  // IAM sem supra (p. 207)
  if (e.invasivaPrecoce === undefined) {
    avisos.push('Informe se a estratificação invasiva está disponível em menos de 6–24 horas.')
  } else if (e.invasivaPrecoce) {
    avisos.push('Estratificação invasiva precoce (< 6–24 h): o segundo antiagregante NÃO é feito agora; fica para depois da anatomia, se houver tratamento percutâneo (p. 207).')
  } else {
    const p = prasugrelElegivel(e)
    antiagregantes.push(
      { droga: 'Prasugrel', ataque: '60 mg', manutencao: '10 mg/dia VO', pagina: 'p. 207', nota: p === false ? 'Fora da indicação do manual: só para menores de 75 anos, com mais de 60 kg e sem AVC ou AIT prévio.' : p === null ? 'Indicado para menores de 75 anos, com mais de 60 kg e sem AVC ou AIT prévio: confira os três.' : 'Dentro da indicação do manual (idade, peso, sem AVC/AIT).' },
      { droga: 'Ticagrelor', ataque: '180 mg', manutencao: '90 mg 12/12 h VO', pagina: 'p. 207', nota: 'Efeitos adversos: dispneia (sem broncoespasmo) e aumento do ácido úrico.' },
    )
    const idoso = ok(e.idadeAnos) && e.idadeAnos > 75
    antiagregantes.push(e.icpEm6h
      ? { droga: 'Clopidogrel (sem prasugrel nem ticagrelor)', ataque: '600 mg', manutencao: '75 mg/dia', pagina: 'p. 207', nota: 'Candidato a intervenção coronária em até 6 h.' }
      : { droga: 'Clopidogrel (sem prasugrel nem ticagrelor)', ataque: idoso ? '75 mg (acima de 75 anos)' : '300 mg', manutencao: '75 mg/dia', pagina: 'p. 207' })
  }
  enoxa = e.invasivaPrecoce
    ? null
    : { contexto: 'Manejo conservador', dose: ok(e.pesoKg) ? enoxaparina('iamsst', { pesoKg: e.pesoKg }) : null, pagina: 'p. 207' }
  anticoagulacaoTexto = e.invasivaPrecoce
    ? 'Manejo intervencionista: o anticoagulante é feito na sala de cateterismo (p. 207). Com o cateterismo nas primeiras 12–24 horas, o manual não inicia anticoagulante (p. 203).'
    : 'Anticoagulante quando a probabilidade de isquemia é pelo menos moderada; no manejo conservador, enoxaparina plena. Evitar trocas entre enoxaparina e heparina não fracionada (p. 207).'
  return { reperfusao: null, antiagregantes, enoxaparina: enoxa, anticoagulacaoTexto, avisos }
}

/** Equivalentes de IAM com supra que o manual lista (cap. 14, p. 212–214). */
export const EQUIVALENTES_SUPRA: { nome: string; texto: string; pagina: string }[] = [
  { nome: 'Parede posterior', texto: 'Infra de ST de V1 a V3 ou V4, com onda T positiva, com ou sem R altas: fazer V7, V8 e V9 (basta 0,5 mm de supra).', pagina: 'p. 212–213' },
  { nome: 'BRE ou marca-passo com Sgarbossa positivo', texto: 'Ver a ferramenta do Sgarbossa modificado nos escores.', pagina: 'p. 213' },
  { nome: 'Tronco ou triarterial', texto: 'Infra de ST em seis derivações com supra em aVR e/ou V1: cateterismo em 2 horas no consenso europeu do IAM sem supra.', pagina: 'p. 213' },
  { nome: 'De Winter', texto: 'Depressão do ponto J maior que 1 mm de V1 a V6, ST ascendente e T positivas, altas e simétricas: lesão crítica da descendente anterior.', pagina: 'p. 213–214' },
  { nome: 'Wellens (no contexto de isquemia)', texto: 'Tipo A: T bifásica (positiva/negativa); tipo B: T negativa, profunda e simétrica em derivações anteriores, sem dor. Lesão grave da descendente anterior, não necessariamente aguda.', pagina: 'p. 214' },
]

/** Demais medidas que o manual traz (p. 208, 216 e 219). */
export const OUTRAS_MEDIDAS: Dose[] = [
  { droga: 'Oxigênio', ataque: 'só com saturação abaixo de 90%', pagina: 'p. 207 e 219' },
  { droga: 'Dinitrato de isossorbida', ataque: '5 mg SL, pode repetir a cada 5 min por 3 vezes', pagina: 'p. 219', nota: 'Não fazer no infarto de VD nem com inibidor de fosfodiesterase-5 (sildenafil nas últimas 24 h, p. 208).' },
  { droga: 'Metoprolol', ataque: '25–50 mg VO nas primeiras 24 h', pagina: 'p. 208', nota: 'Contraindicações: sinais de insuficiência cardíaca, risco de choque (idade > 70 anos, PAS < 120, FC > 110 ou < 60), PR > 0,24, bloqueio cardíaco complexo e asma descompensada.' },
  { droga: 'Atorvastatina', ataque: '40 mg VO 1 vez ao dia, o mais cedo possível', pagina: 'p. 208' },
  { droga: 'Pantoprazol', ataque: '20 mg VO (IAM com supra, p. 219); 40 mg VO 1 vez ao dia com dupla antiagregação e risco de sangramento digestivo (p. 208)', pagina: 'p. 208 e 219' },
]

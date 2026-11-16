// Peso plausível do adulto nas ferramentas da Central — regra da unidade.
//
// Decisão do RT em 16/11/2026 (diagnóstico das calculadoras, H5): fora de
// 30 a 250 kg a ferramenta de adulto NÃO calcula dose e pede para conferir o
// peso. Não é faixa clínica com fonte: é trava contra erro de digitação
// (75 → 750 kg dava 1.125 mg de indução na intubação, sem aviso).
// O campo de peso da própria Central continua sem julgar o peso
// (./pacienteCentral.ts); a trava fica na ferramenta que calcula.

export const PESO_ADULTO_MIN_KG = 30
export const PESO_ADULTO_MAX_KG = 250

export type LeituraPesoAdulto = 'vazio' | 'ok' | 'fora'

/** 0, vazio ou inválido → 'vazio'; de 30 a 250 kg (inclusive) → 'ok'; resto → 'fora'. */
export function lerPesoAdulto(kg: number): LeituraPesoAdulto {
  if (!Number.isFinite(kg) || kg <= 0) return 'vazio'
  return kg >= PESO_ADULTO_MIN_KG && kg <= PESO_ADULTO_MAX_KG ? 'ok' : 'fora'
}

export const AVISO_PESO_ADULTO_FORA =
  `Peso fora de ${PESO_ADULTO_MIN_KG} a ${PESO_ADULTO_MAX_KG} kg: confira o peso. A ferramenta não calcula dose fora dessa faixa (regra da unidade).`

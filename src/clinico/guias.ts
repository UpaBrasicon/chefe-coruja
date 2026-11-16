import { DIRETRIZ_DOR_TORACICA_2025 } from './escores/heart.ts'
import type { Guia, PassoGuia } from './guia.ts'

// Guias das ferramentas do piloto, pelo id da ficha. Nesta primeira leva só
// entra texto que JÁ está na ficha com fonte (nada escrito de novo): no HEART,
// as linhas da diretriz brasileira de dor torácica de 2025, lida no texto
// integral (heart.ts). Os textos novos das outras ferramentas vêm em lote de
// fichas, com fonte e página, para a aprovação do RT.

const SBC = 'SBC 2025 — Diretriz Brasileira de Dor Torácica na Unidade de Emergência'

function linhaSbc(tema: string, faixas?: (0 | 1 | 2)[]): PassoGuia {
  const l = DIRETRIZ_DOR_TORACICA_2025.find((d) => d.tema === tema)
  if (!l) throw new Error(`linha da SBC 2025 sem tema "${tema}"`)
  return { tema, texto: l.diretriz, ref: { fonte: SBC, grau: l.grau }, faixas }
}

export const GUIAS: Record<string, Guia> = {
  heart: {
    proximosPassos: [
      linhaSbc('Alta do baixo risco', [0, 1]),
      linhaSbc('Dosagem única de troponina', [0]),
      linhaSbc('Troponina de alta sensibilidade'),
      linhaSbc('Angiotomografia de coronárias'),
      linhaSbc('Antiagregação antes do diagnóstico'),
    ],
  },
}

export function guiaDa(fichaId: string): Guia | undefined {
  return GUIAS[fichaId]
}

import type { Ficha } from './ficha.ts'

// Escolha do acesso venoso no ADULTO. O ramo neonatal/pediátrico que existia
// não tinha fonte e saiu (casco): para criança a tela diz que não tem referência.

export const fichaAcessoVenoso: Ficha = {
  id: 'acesso-venoso',
  titulo: 'Escolha do acesso venoso',
  versao: '2026-09-27.1',
  publico: 'adulto',
  fontes: [
    { citacao: 'Gorski LA, et al. Infusion Therapy Standards of Practice, 8th ed. J Infus Nurs. 2021;44(1S).' },
  ],
  revisadoEm: '27/09/2026',
}

export type EntradaAcesso = {
  terapia: 'curta' | 'longa'
  infusao: 'periferica' | 'irritante' | 'osmolaridade'
  rede: 'boa' | 'ruim'
  urgencia: 'urgente' | 'programada'
}

export type Recomendacao = { dispositivo: string; motivo: string }

export function recomendarAcesso(e: EntradaAcesso): Recomendacao {
  if (e.urgencia === 'urgente') {
    return { dispositivo: 'Acesso periférico rápido (2 cateteres) / intraósseo se choque', motivo: 'Situação emergencial — acesso imediato.' }
  }
  if (e.infusao !== 'periferica') {
    return { dispositivo: 'Cateter central (CVC ou PICC)', motivo: 'Infusão vesicante/irritante, osmolaridade alta ou pH extremo.' }
  }
  if (e.terapia === 'longa' || e.rede === 'ruim') {
    return { dispositivo: 'PICC (ou CVC se alta osmolaridade)', motivo: 'Terapia prolongada (> 6 dias) ou rede venosa ruim.' }
  }
  return { dispositivo: 'Cateter periférico curto (acesso único)', motivo: 'Terapia curta, infusão compatível e rede venosa adequada.' }
}

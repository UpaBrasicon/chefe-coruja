import type { Ficha, Fonte } from './ficha.ts'

// Escolha do acesso venoso no ADULTO. O ramo neonatal/pediátrico que existia
// não tinha fonte e saiu (casco): para criança a tela diz que não tem referência.
// Versão de 06/11/2026 (revisão PubMed, itens médios; RT, H12 = A): a citação
// da 8ª edição foi completada e entra a nota da 9ª edição (2024). A regra de
// recomendarAcesso não muda: segue a 8ª até o RT ler a 9ª.

export const INS_8A_EDICAO_2021: Fonte = {
  citacao: 'Gorski LA, Hadaway L, Hagle ME, et al. Infusion Therapy Standards of Practice, 8th Edition. J Infus Nurs. 2021;44(1S Suppl 1):S1–S224 (PMID 33394637).',
  url: 'https://doi.org/10.1097/NAN.0000000000000396',
}

export const INS_9A_EDICAO_2024: Fonte = {
  citacao: 'Nickel B, Gorski L, Kleidon T, et al. Infusion Therapy Standards of Practice, 9th Edition. J Infus Nurs. 2024;47(1S Suppl 1):S1–S285 (PMID 38211609). Citada para registrar a edição nova; a regra desta tela não foi conferida com ela.',
  url: 'https://doi.org/10.1097/NAN.0000000000000532',
}

export const NOTA_ACESSO_9A_EDICAO =
  'Existe a 9ª edição dos Infusion Therapy Standards of Practice (2024), que substitui a 8ª citada aqui. O PubMed não traz resumo de nenhuma das duas, e o que mudou entre as edições não foi conferido: a regra desta tela segue a 8ª edição até o RT ler o texto.'

export const fichaAcessoVenoso: Ficha = {
  id: 'acesso-venoso',
  titulo: 'Escolha do acesso venoso',
  versao: '2026-11-06.1',
  publico: 'adulto',
  fontes: [INS_8A_EDICAO_2021, INS_9A_EDICAO_2024],
  revisadoEm: '06/11/2026 (nota da 9ª edição e citação completa da 8ª; revisão PubMed, itens médios)',
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

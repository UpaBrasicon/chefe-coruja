// Exame feito fora da UBS, trazido em papel (percurso da UBS, U12 = A). Cópia da
// lista do banco (private.ubs_exames_externos, migration
// 20270415000017_ubs_u12_exame_externo.sql). O banco confere o valor de novo.

export type TipoValorExterno = 'percentual' | 'vdrl' | 'reagente'
export type ExameExterno = { codigo: string; nome: string; tipo: TipoValorExterno }

export const EXAMES_EXTERNOS: ExameExterno[] = [
  { codigo: '0202010503', nome: 'Hemoglobina glicada (HbA1c)', tipo: 'percentual' },
  { codigo: '0202031110', nome: 'Sífilis (VDRL)', tipo: 'vdrl' },
  { codigo: '0202031179', nome: 'Sífilis (VDRL) em gestante', tipo: 'vdrl' },
  { codigo: '0202031500', nome: 'HIV', tipo: 'reagente' },
  { codigo: '0202031519', nome: 'HIV em gestante', tipo: 'reagente' },
  { codigo: '0202031446', nome: 'Hepatite B (HBsAg)', tipo: 'reagente' },
  { codigo: '0202031454', nome: 'Hepatite B (HBsAg) em gestante', tipo: 'reagente' },
  { codigo: '0202031470', nome: 'Hepatite C (anti-HCV)', tipo: 'reagente' },
  { codigo: '0202031489', nome: 'Hepatite C (anti-HCV) em gestante', tipo: 'reagente' },
]

/** Títulos do VDRL aceitos (diluições dobradas). */
export const TITULOS_VDRL = ['1:1', '1:2', '1:4', '1:8', '1:16', '1:32', '1:64', '1:128', '1:256', '1:512', '1:1024']

/** O valor na forma que o banco aceita, ou a mensagem do que falta. */
export function valorExterno(tipo: TipoValorExterno, valor: string): { ok: true; valor: string } | { ok: false; erro: string } {
  const v = valor.trim().toLowerCase()
  if (tipo === 'percentual') {
    const n = Number(v.replace(',', '.'))
    return v && Number.isFinite(n) && n >= 3 && n <= 20 ? { ok: true, valor: v } : { ok: false, erro: 'HbA1c: informe o valor em % (de 3 a 20).' }
  }
  if (tipo === 'vdrl') {
    return v === 'nao_reagente' || TITULOS_VDRL.includes(v) ? { ok: true, valor: v } : { ok: false, erro: 'VDRL: escolha "não reagente" ou o título.' }
  }
  return v === 'reagente' || v === 'nao_reagente' ? { ok: true, valor: v } : { ok: false, erro: 'Escolha reagente ou não reagente.' }
}

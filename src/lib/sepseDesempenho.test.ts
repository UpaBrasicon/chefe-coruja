import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { fracao, rotuloMes, textoPublicavel, type Agregado } from './sepseDesempenho.ts'

const migration = readFileSync(new URL('../../supabase/migrations/20270418000095_sp1_desempenho_alerta_sepse.sql', import.meta.url), 'utf8')

const base: Agregado = {
  atendimentos: 400, suspeitas: 60, sepses: 40, alertas: 50, alertas_com_sepse: 30, detectadas: 32, dispensados: 10,
  alertas_parciais: 20, parciais_com_sepse: 8, alertas_completos: 30, completos_com_sepse: 22, suspeitas_com_laboratorio: 45,
  antimicrobiano_sem_cultura: 12, antecedencia_mediana_h: 1.5, sensibilidade: 0.8, valor_preditivo: 0.6, alertas_por_100: 12.5,
  cobertura_laboratorio: 0.75, publicavel: true, motivo_nao_publicavel: null,
}

test('SP1: percentual sempre com o número de casos', () => {
  assert.equal(fracao(1, 2), '50% (1 de 2)')
  assert.equal(fracao(0, 0), 'sem casos')
})

test('SP1: texto pronto só quando publicável (S5)', () => {
  const t = textoPublicavel(base, 'UPA Teste', 'jun a nov de 2026')
  assert.ok(t?.includes('80% (32 de 40)'))
  assert.ok(t?.includes('12,5 alertas por 100'))
  assert.equal(textoPublicavel({ ...base, publicavel: false, motivo_nao_publicavel: 'amostra pequena' }, 'UPA', 'nov'), null)
})

test('SP1: a trava do banco é a do S5 (30 sepses e 50% com laboratório)', () => {
  assert.ok(migration.includes("'publicavel', sepses >= 30 AND suspeitas > 0 AND suspeitas_com_laboratorio::numeric / suspeitas >= 0.5"))
  assert.ok(migration.includes("al.em <= i.em + interval '6 hours'"), 'sensibilidade: alerta até 6 h depois do início')
  assert.ok(migration.includes("a.em <= c.em AND c.em <= a.em + interval '24 hours'") && migration.includes("a.em <= c.em + interval '72 hours'"),
    'janela de Seymour 2016: 24 h e 72 h')
})

test('SP1: rótulo do mês', () => {
  assert.equal(rotuloMes('2026-11'), 'nov/2026')
})

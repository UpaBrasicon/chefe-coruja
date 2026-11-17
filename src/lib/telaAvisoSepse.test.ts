import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  AVISO_SEPSE_ATENDIMENTO, CORTE_NEWS2_SEPSE, CORTE_NEWS2_SEPSE_ALTO, HORAS_VITAIS_AVISO_ATENDIMENTO, sepseAdulto,
} from '../clinico/escores/sepseAdulto.ts'

// F7 das ferramentas pelo CID (pedido do RT de 17/11/2026; AV1–AV8 = A e as
// condições da sessão de obrigatórios legais): aviso "pensar em sepse" no
// atendimento pela mesma regra e pela mesma ficha do alerta da internação.
const sql = readFileSync('supabase/migrations/20270416000001_f7_aviso_sepse_atendimento.sql', 'utf8')
const aviso = readFileSync('src/components/clinico/AvisoSepseAtendimento.tsx', 'utf8')
const atend = readFileSync('src/pages/plantao/porta/AbaAtendimento.tsx', 'utf8')
const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')

test('os limites do SQL seguem a ficha sepse-adulto (NEWS2 5 e 7, 6 h, 14 anos)', () => {
  assert.equal(CORTE_NEWS2_SEPSE, 5)
  assert.equal(CORTE_NEWS2_SEPSE_ALTO, 7)
  assert.equal(HORAS_VITAIS_AVISO_ATENDIMENTO, 6)
  assert.ok(sql.includes(`IF v_total < ${CORTE_NEWS2_SEPSE} THEN RETURN NULL`))
  assert.ok(sql.includes(`WHEN v_total >= ${CORTE_NEWS2_SEPSE_ALTO} THEN 'news2_alto'`))
  assert.ok(sql.includes(`now() - interval '${HORAS_VITAIS_AVISO_ATENDIMENTO} hours', e.id, p_cids`))
  assert.ok(sql.includes(`v_nasc > private.data_atual() - interval '14 years' THEN RETURN NULL`))
})

test('mesma regra: o alerta da internação chama a mesma função, com as 24 h de antes', () => {
  assert.ok(sql.includes(`a := private.sepse_adulto_regra(r.id, now() - interval '24 hours', NULL, NULL);`))
  assert.ok(sql.includes(`SELECT private.calcular_acuidade_janela(p_paciente, now() - interval '24 hours', NULL)`))
  // a versão nova da ficha é registrada e fica aguardando o RT
  const registro = sql.split('\n').find((l) => l.includes(`registrar_versao_ferramenta('sepse-adulto'`)) ?? ''
  assert.ok(registro.includes(`'${sepseAdulto.ficha.versao}'`))
})

test('texto do aviso: exames com fonte e página, decisão do médico, sem a palavra "diagnóstico"', () => {
  assert.ok(AVISO_SEPSE_ATENDIMENTO.startsWith('Pode ser sepse. Considere: '))
  assert.ok(AVISO_SEPSE_ATENDIMENTO.includes('lactato (SSC 2026, rec. 51 e 52, p. 39–40; ILAS jul/2026, p. 8 e 14)'))
  assert.ok(AVISO_SEPSE_ATENDIMENTO.includes('(ILAS jul/2026, p. 3)'))
  assert.ok(AVISO_SEPSE_ATENDIMENTO.endsWith('A decisão é do médico.'))
  assert.ok(!/diagn[oó]stico/.test(AVISO_SEPSE_ATENDIMENTO.toLowerCase()))
})

test('a tela: só adulto, sem cor de risco, sem exame marcado nem pedido, registro pelo servidor', () => {
  assert.ok(aviso.includes(`const adulto = faixa === 'adulto'`))
  assert.ok(aviso.includes('enabled: adulto'))
  assert.ok(aviso.includes('{AVISO_SEPSE_ATENDIMENTO}'))
  for (const proibido of ['CORES_RISCO', 'bg-critico', 'bg-atencao', 'border-critico', 'border-atencao', 'CaixaMarcar', 'checkbox', 'pedir_exame']) {
    assert.ok(!aviso.includes(proibido), proibido)
  }
  assert.ok(aviso.includes(`rpc('aviso_sepse_atendimento'`))
  assert.ok(aviso.includes(`rpc('registrar_aviso_sepse'`))
  assert.ok(aviso.includes('Abrir sepse (adulto)'))
  assert.ok(aviso.includes('Dispensar'))
  assert.ok(atend.includes('<AvisoSepseAtendimento episodioId={episodioId}'))
  assert.ok(conduta.includes('<AvisoSepseAtendimento episodioId={episodioId}'))
})

// Percurso da UBS, U15 (PR 1): o RAC da UBS na RNDS (V4 e V5 = A, RT em 18/11/2026).
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('U15, PR 1: na UBS, o RAC sai como Atenção Básica e a consulta programada ou agendada é eletiva', () => {
  const mig = readFileSync('supabase/migrations/20270415000021_ubs_u15_rac_aps.sql', 'utf8')
  assert.match(mig, /'modalidade', CASE WHEN EXISTS \(SELECT 1 FROM public\.unidades u WHERE u\.id = e\.unidade_id AND u\.tipo::text = 'ubs'\) THEN '01' ELSE '06' END/)
  assert.match(mig, /e\.tipo_atendimento_aps IN \('consulta_programada', 'consulta_agendada'\) THEN '01' ELSE '02' END/)
})

test('U15, PR 1: a escolha "RNDS da APS pelo app ou pelo PEC" aparece só na UBS', () => {
  const aba = readFileSync('src/pages/admin/RndsAba.tsx', 'utf8')
  assert.match(aba, /\{unidadeAtiva\?\.unidade\.tipo === 'ubs' && <SecaoRacAps p=\{p\} unidade=\{unidade\} \/>\}/)
  assert.match(aba, /supabase\.rpc\('rnds_rac_aps_pelo', \{ p_unidade: unidade, p_pelo: pelo \}\)/)
})

test('U15, PR 2: a fila do LEDI é própria (o serviço da RNDS não a pega) e só o gestor a lê', () => {
  const mig = readFileSync('supabase/migrations/20270415000022_ubs_u15_fila_ledi.sql', 'utf8')
  assert.match(mig, /CREATE TABLE IF NOT EXISTS public\.ledi_fila/)
  assert.doesNotMatch(mig, /INSERT INTO public\.interop_outbox/)
  for (const tabela of ['ledi_fila', 'ledi_config_unidade']) {
    assert.ok(mig.includes(`ALTER TABLE public.${tabela} ENABLE ROW LEVEL SECURITY`), `${tabela} sem RLS`)
    assert.ok(mig.includes(`REVOKE INSERT, UPDATE, DELETE ON public.${tabela} FROM anon, authenticated`), `${tabela} gravável pela API`)
  }
  // o envio nasce desligado
  assert.match(mig, /envio_ligado\s+boolean NOT NULL DEFAULT false/)
})

// node --test scripts/ambiente/migrations-destrutivas.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analisar, CORTE } from './migrations-destrutivas.mjs'

const nova = `${String(BigInt(CORTE) + 1n)}_teste.sql`

test('expand/contract: aditivo passa; destrutivo sem contrato reprova', () => {
  assert.deepEqual(analisar(nova, 'ALTER TABLE public.leitos ADD COLUMN x text; CREATE INDEX i ON t (x);'), [])
  assert.deepEqual(analisar(nova, 'DROP POLICY IF EXISTS p ON t; CREATE POLICY p ON t USING (true);'), [])
  assert.deepEqual(analisar(nova, 'DROP TRIGGER IF EXISTS g ON t; ALTER TABLE t DROP CONSTRAINT c;'), [])
  assert.deepEqual(analisar(nova, 'DROP FUNCTION IF EXISTS public.f(int); CREATE OR REPLACE FUNCTION public.f(int, text) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;'), [])
  // corpo de função com DELETE/DROP não é DDL da migration
  assert.deepEqual(analisar(nova, 'CREATE FUNCTION g() RETURNS void LANGUAGE plpgsql AS $$ BEGIN DELETE FROM t; DROP TABLE tmp; END $$;'), [])
  assert.match(analisar(nova, 'DROP TABLE public.antiga;')[0], /DROP de objeto/)
  assert.match(analisar(nova, 'ALTER TABLE public.leitos DROP COLUMN status;')[0], /DROP COLUMN/)
  assert.match(analisar(nova, 'ALTER TABLE public.leitos RENAME COLUMN a TO b;')[0], /RENAME/)
  assert.match(analisar(nova, 'ALTER TABLE t ALTER COLUMN c TYPE bigint;')[0], /troca de tipo/)
  assert.match(analisar(nova, 'TRUNCATE public.log;')[0], /TRUNCATE/)
  assert.match(analisar(nova, 'DELETE FROM public.pacientes;')[0], /DELETE sem WHERE/)
  assert.deepEqual(analisar(nova, "DELETE FROM public.x WHERE id = '1';"), [])
  assert.match(analisar(nova, 'DROP FUNCTION public.rpc_velha(uuid);')[0], /sem recriar/)
  // comentário não conta
  assert.deepEqual(analisar(nova, '-- DROP TABLE x;\nSELECT 1;'), [])
})

test('expand/contract: contrato assumido com a migration expand anterior passa', () => {
  const expand = '20261025000001'
  const sql = '-- contract: tira a coluna velha, sem uso desde a release anterior (expand em 20261025000001)\nALTER TABLE t DROP COLUMN velha;'
  assert.deepEqual(analisar(nova, sql, [expand]), [])
  assert.match(analisar(nova, sql, [])[0], /precisa citar/)  // expand inexistente
  assert.match(analisar(nova, '-- contract: sem referência\nDROP TABLE t;', [expand])[0], /precisa citar/)
})

test('migrations anteriores à adoção não são verificadas', () => {
  assert.deepEqual(analisar('20260101000000_antiga.sql', 'DROP TABLE t;'), [])
})

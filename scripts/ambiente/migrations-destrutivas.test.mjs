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

test('bloco DO: o corpo é analisado (S10, H5)', () => {
  // o que é proibido fora do DO também é dentro dele
  assert.match(analisar(nova, 'DO $$ BEGIN DROP TABLE public.antiga; END $$;')[0], /DROP de objeto/)
  assert.match(analisar(nova, 'DO $d$ BEGIN DELETE FROM public.pacientes; END $d$;')[0], /DELETE sem WHERE/)
  assert.match(analisar(nova, "DO $$ BEGIN EXECUTE 'DELETE FROM public.pacientes'; END $$;")[0], /DELETE sem WHERE/)
  assert.match(analisar(nova, 'DO LANGUAGE plpgsql $$ BEGIN ALTER TABLE t DROP COLUMN c; END $$;')[0], /DROP COLUMN/)
  // SQL dinâmico entre $q$ dentro do DO também
  assert.match(analisar(nova, 'DO $$ BEGIN EXECUTE $q$TRUNCATE public.log$q$; END $$;')[0], /TRUNCATE/)
  // e o que é permitido fora continua permitido dentro
  assert.deepEqual(analisar(nova, "DO $$ BEGIN DROP POLICY IF EXISTS p ON t; DROP TRIGGER IF EXISTS g ON t; DELETE FROM t WHERE id = '1'; END $$;"), [])
  // função criada dentro do DO por EXECUTE: o corpo dela continua fora da análise
  assert.deepEqual(analisar(nova, 'DO $$ BEGIN EXECUTE $q$CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $b$ BEGIN DELETE FROM t; END $b$$q$; END $$;'), [])
  // COMMENT com $$ fora de DO não é código
  assert.deepEqual(analisar(nova, 'COMMENT ON TABLE t IS $$ sai o DROP TABLE antigo $$;'), [])
})

test('DROP FUNCTION recriada por EXECUTE num DO passa quando há GRANT nela depois', () => {
  const sql = "DO $$ BEGIN EXECUTE def; DROP FUNCTION public.rpc(uuid); END $$;\nGRANT EXECUTE ON FUNCTION public.rpc(uuid, text) TO authenticated;"
  assert.deepEqual(analisar(nova, sql), [])
  assert.match(analisar(nova, 'DO $$ BEGIN DROP FUNCTION public.rpc(uuid); END $$;')[0], /sem recriar/)
  // GRANT antes do DROP não conta
  assert.match(analisar(nova, 'GRANT EXECUTE ON FUNCTION public.rpc(uuid) TO authenticated;\nDROP FUNCTION public.rpc(uuid);')[0], /sem recriar/)
})

test('DELETE com WHERE sempre verdadeiro reprova (S10, H5)', () => {
  assert.match(analisar(nova, 'DELETE FROM public.pacientes WHERE true;')[0], /sempre verdadeiro/)
  assert.match(analisar(nova, 'DELETE FROM public.pacientes WHERE 1=1;')[0], /sempre verdadeiro/)
  assert.match(analisar(nova, 'DELETE FROM public.pacientes p WHERE 1 = 1 RETURNING id;')[0], /sempre verdadeiro/)
  assert.match(analisar(nova, 'DO $$ BEGIN DELETE FROM t WHERE TRUE; END $$;')[0], /sempre verdadeiro/)
  assert.deepEqual(analisar(nova, 'DELETE FROM t WHERE true_flag = false;'), [])
  assert.deepEqual(analisar(nova, 'DELETE FROM t WHERE ativo = true;'), [])
})

test('limparSql: literal com -- e $$ não confunde a limpeza', () => {
  assert.deepEqual(analisar(nova, "SELECT '-- não é comentário $$'; DROP TABLE t;").length, 1)
  assert.deepEqual(analisar(nova, "SELECT E'a\' -- x'; SELECT 1;"), [])
})

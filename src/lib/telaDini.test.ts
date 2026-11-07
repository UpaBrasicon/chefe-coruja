import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Dini (classificação de pacientes pediátricos; A em D1 a D7, RT em
// 06/11/2026): a tela usa as RPCs da migration, a criança ganha o cartão no
// lugar da nota "ainda não está no produto" e o selo na lista de leitos.
const ler = (c: string) => readFileSync(c, 'utf8').replace(/\r/g, '')
const migration = ler('supabase/migrations/20270303000001_dini_pediatrico.sql')
const fichas = ler('supabase/migrations/20270303000002_dini_pediatrico_fichas.sql')
const cartao = ler('src/components/enfermagem/CartaoDini.tsx')
const abas = ler('src/components/enfermagem/AbasRegistro.tsx')
const lista = ler('src/pages/enfermagem/InternacaoEnfermagem.tsx')
const guardadas = ler('src/lib/offline/consultasGuardadas.ts')
const tipos = ler('src/types/database.ts')

test('aba de escalas: criança com internação ganha o CartaoDini; a nota antiga sai', () => {
  assert.doesNotMatch(abas, /ainda não está no produto/)
  assert.match(abas, /publico === 'pediatrico' && <CartaoDini internacaoId=\{dados\.internacao_id\} pacienteId=\{ctx\.pacienteId\} \/>/)
  assert.match(abas, /publico !== 'pediatrico' && <CartaoFugulin /)
})

test('cartão: RPCs do Dini, por domínio, com a nota D6 e a citação', () => {
  assert.match(cartao, /supabase\.rpc\('registrar_dini'/)
  assert.match(cartao, /supabase\.rpc\('dini_da_internacao'/)
  assert.match(cartao, /DOMINIOS_DINI\.map/)
  assert.match(cartao, /notaDiniMenorDe6\(/)
  assert.match(cartao, /textoFontes\(fichaDini\)/)
  assert.match(cartao, /papelAtivo === 'enfermeiro'/)
})

test('lista de leitos: selo do Dini só na criança; consultas guardadas sem rede', () => {
  assert.match(lista, /supabase\.rpc\('dini_de_hoje'/)
  assert.match(lista, /dini\.data && ehAdulto\(l\.data_nascimento\) === false/)
  assert.match(lista, /Dini de hoje pendente/)
  assert.match(lista, /fugulin\.data && ehAdulto\(l\.data_nascimento\) !== false/)
  assert.match(guardadas, /'dini', 'dini-hoje'/)
})

test('migration: travas do Fugulin, corte de 14 anos, só inserção e auditoria', () => {
  assert.doesNotMatch(migration, /papel_na_unidade\([^)]*\)\s+IS NOT NULL/i)
  assert.match(migration, /PERFORM private\.exigir_segundo_fator\(\);/)
  assert.match(migration, /private\.segundo_fator_ok\(\)/)
  assert.match(migration, /private\.tenho_papel\(i\.unidade_id, 'enfermeiro'\) IS NOT TRUE OR NOT private\.paciente_em_cuidado_no_plantao/)
  assert.match(migration, /IF NOT private\.pediatrico_em\(pa\.data_nascimento, v_dia\) THEN/)
  assert.match(migration, /CHECK \(total BETWEEN 11 AND 44\)/)
  assert.match(migration, /REVOKE INSERT, UPDATE, DELETE ON public\.classificacoes_dini FROM authenticated, anon;/)
  assert.match(migration, /BEFORE UPDATE OR DELETE ON public\.classificacoes_dini/)
  assert.match(migration, /WHEN 'classificacoes_dini' THEN\s+PERFORM private\.registrar_auditoria\('dini_registrado'/)
  assert.match(migration, /AFTER INSERT ON public\.classificacoes_dini\s+FOR EACH ROW EXECUTE FUNCTION private\.auditar_clinico\(\)/)
  assert.match(migration, /ROLLBACK/)
  for (const f of ['registrar_dini(uuid, jsonb, text)', 'dini_da_internacao(uuid)', 'dini_de_hoje(uuid[])']) {
    assert.ok(migration.includes(`REVOKE ALL ON FUNCTION public.${f} FROM PUBLIC, anon;`), f)
  }
})

test('ficha na fila de aprovação e tipos do banco', () => {
  assert.match(fichas, /registrar_versao_ferramenta\('dini-pediatrico', '[^']+', '2026-11-06\.1', 'pediatrico'/)
  for (const n of ['classificacoes_dini: {', 'registrar_dini: {', 'dini_da_internacao: {', 'dini_de_hoje: {']) assert.ok(tipos.includes(n), n)
})

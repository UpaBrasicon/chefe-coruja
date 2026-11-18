// Percurso da UBS, U6, PR 3b (R1–R5 = A): receita do enfermeiro pelo protocolo
// de enfermagem do município.
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('U6, 3b: a receita do enfermeiro leva o protocolo usado e o ano (Cofen 801/2026)', async () => {
  const { textoProtocoloEnfermagem } = await import('../domain/receitaEnfermagem.ts')
  assert.equal(textoProtocoloEnfermagem({ id: 'x', nome: 'Saúde da mulher', ativo: true, enfermagem: true, itens: [],
    origem_numero: 'Portaria SMS 12/2026', origem_orgao: 'Secretaria Municipal de Saúde', origem_data: '2026-01-10' }),
  'Saúde da mulher (Portaria SMS 12/2026, Secretaria Municipal de Saúde, 2026)')
})

test('U6, 3b: a consulta de enfermagem tem a aba Receita, só com o protocolo de enfermagem', () => {
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /rotulo: consultaEnfermagem \? 'Receita' : 'Atestado e receita'/)
  assert.match(janela, /\{consultaEnfermagem \? \(\s*<ReceitaEnfermagem/)
  const rx = readFileSync('src/components/documentos/ReceitaEnfermagem.tsx', 'utf8')
  assert.match(rx, /filter\(\(p\) => p\.ativo && p\.enfermagem\)/)
  assert.match(rx, /if \(faixa !== 'adulto'\)/, 'criança e sem nascimento ficam com o médico')
  assert.doesNotMatch(rx, /<Input/, 'sem texto livre (R2 e R4)')
  const gestor = readFileSync('src/pages/gestor/Protocolos.tsx', 'utf8')
  assert.match(gestor, /supabase\.rpc\('definir_protocolo_enfermagem'/)
  const sql = readFileSync('supabase/migrations/20270415000013_ubs_prescricao_enfermeiro.sql', 'utf8')
  assert.match(sql, /controle especial é só do médico \(Portaria 344\/1998\)/)
})

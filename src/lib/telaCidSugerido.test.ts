import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// CID de referência a partir da Avaliação (decisão do RT: A em C1 a C7,
// docs/porta/CID-SUGERIDO-AVALIACAO-DIAGNOSTICO.md). Os chips aparecem ao
// lado do campo CID na porta/UBS e no Diagnóstico da internação; o clique só
// preenche o campo, nunca registra.
const chips = readFileSync('src/components/clinico/CidsDeReferencia.tsx', 'utf8')
const hook = readFileSync('src/hooks/useCidSugerido.ts', 'utf8')
const atend = readFileSync('src/pages/plantao/porta/AbaAtendimento.tsx', 'utf8')
const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
const diag = readFileSync('src/components/internacao/caderno/Diagnostico.tsx', 'utf8')

test('C2: o aviso diz que é só referência e que a escolha é do médico', () => {
  assert.match(chips, /CIDs de referência \(só referência; a escolha é sua\)/)
  // o princípio antigo foi reescrito, sem perder "não sugere cor, dose ou conduta"
  assert.match(atend, /Nada aqui sugere cor, dose ou conduta\. CID: o sistema mostra/)
  assert.doesNotMatch(conduta, /Nada aqui sugere problema, CID ou conduta/)
  assert.match(conduta, /Nada aqui sugere problema ou conduta\. CID: só referência/)
})

test('C1: o servidor sugere (só leitura); nem o hook nem os chips registram nada', () => {
  assert.match(hook, /supabase\.rpc\('cid_sugerir_do_texto', \{ p_texto: pronto \}\)/)
  assert.match(hook, /DEBOUNCE_MS = 500/)
  for (const src of [hook, chips]) {
    assert.doesNotMatch(src, /registrar_/)
    assert.doesNotMatch(src, /useMutation/)
  }
  assert.doesNotMatch(chips, /supabase/)
})

test('C3: porta e UBS: chips da Avaliação ao lado do CID-10; o clique só preenche o rascunho', () => {
  assert.match(atend, /<CidsDeReferencia [^>]*texto=\{soap\.a\} valorDoCampo=\{soap\.cid\}/)
  assert.match(atend, /onEscolher=\{\(c\) => setSoap\(\{ \.\.\.soap, cid: c\.codigo \}\)\} \/>/)
  // os chips vêm logo depois do campo CID-10, antes do Plano e do Registrar
  const campo = atend.indexOf('<CampoCid id="soap-cid"')
  const ref = atend.indexOf('<CidsDeReferencia ')
  assert.ok(campo > 0 && ref > campo && ref < atend.indexOf('htmlFor="soap-p"'))
  // um só registro do SOAP, pelo botão Registrar
  assert.equal(atend.match(/rpc\('registrar_soap'/g)?.length, 1)
})

test('C3: internação: a hipótese em texto só alimenta os chips e não é gravada', () => {
  assert.match(diag, /<CidsDeReferencia texto=\{hipotese\} valorDoCampo=\{texto\} onEscolher=\{\(c\) => setTexto\(`\$\{c\.codigo\} — \$\{c\.descricao\}`\)\} \/>/)
  assert.match(diag, /não é gravada/)
  // registrar_diagnostico não recebe a hipótese
  const chamadas = diag.match(/rpc\('registrar_diagnostico', \{[^}]*\}/g) ?? []
  assert.equal(chamadas.length, 2)
  for (const c of chamadas) assert.doesNotMatch(c, /hipotese/)
})

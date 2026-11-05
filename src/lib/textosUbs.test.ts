import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Achado F5-T1 do portão da Fase 5: a consulta da UBS mostrava textos da UPA.
test('na UBS a prescrição não fala em pronto-socorro', () => {
  const presc = readFileSync('src/pages/plantao/porta/AbaPrescricao.tsx', 'utf8')
  assert.match(presc, /\{ubs \? 'Prescrição para fazer aqui' : 'Prescrição do Pronto-Socorro'\}/)
  assert.match(presc, /\{ubs \? 'Nada prescrito nesta consulta\.' : 'Nada prescrito no PS\.'\}/)
  const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')
  assert.match(janela, /<AbaPrescricao [^>]*ubs=\{ubs\} \/>/)
})

test('na UBS o encaminhamento interno só oferece consultório e sala de procedimentos', () => {
  // o hook usa o cliente do Supabase: lê o texto em vez de importar
  const hook = readFileSync('src/components/encaminhamento/useEncaminhamentos.ts', 'utf8')
  assert.match(hook, /export const SERVICOS_UBS: [^=]+= \['Consultório', 'Sala de procedimentos'\]/)
  // os dois estão na lista do banco (CHECK), que é a SERVICOS
  assert.match(hook, /export const SERVICOS = \['Consultório', 'Sala de emergência', 'Observação', 'Sala de procedimentos', 'Pediatria'\]/)
  const aba = readFileSync('src/components/encaminhamento/AbaEncaminhamentoInterno.tsx', 'utf8')
  assert.match(aba, /unidadeAtiva\?\.unidade\.tipo === 'ubs' \? SERVICOS_UBS : SERVICOS/)
})

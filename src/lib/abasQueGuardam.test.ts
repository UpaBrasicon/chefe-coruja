import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Achado F5-T3 do portão da Fase 5: a aba Conduta da UBS perdia o problema
// avaliado e as condutas quando o médico ia a outra aba e voltava. Conduta e
// Desfecho guardam as escolhas só na memória até confirmar, então ficam montadas.
const janela = readFileSync('src/pages/plantao/porta/JanelaAtendimento.tsx', 'utf8')

test('Conduta e Desfecho ficam montadas ao trocar de aba', () => {
  assert.match(janela, /<TabsContent value="conduta" keepMounted>/)
  assert.match(janela, /<TabsContent value="fim" keepMounted>/)
})

test('a Conduta guarda o estado em memória (por isso precisa ficar montada)', () => {
  const conduta = readFileSync('src/pages/plantao/porta/AbaConduta.tsx', 'utf8')
  assert.match(conduta, /const \[problemas, setProblemas\] = React\.useState/)
  assert.match(conduta, /const \[condutas, setCondutas\] = React\.useState/)
})

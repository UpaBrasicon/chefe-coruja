// node --experimental-strip-types --test src/lib/respostaIa.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { citacoes, fontesCitadas, NAO_ENCONTREI, SEM_PEDIATRIA, semResposta, textoConfianca, confiancaDasCitadas, mostrarPubmed, numeracaoNaTela, fontesNaTela, textoParaCopiar } from './respostaIa.ts'

test('IA3: numeração na ordem em que o texto cita', () => {
  const t = 'Amiodarona [3]. Cardioversão [5, 3]. Anticoagular [4].'
  assert.deepEqual([...numeracaoNaTela(t)], [[3, 1], [5, 2], [4, 3]])
  const fontes = [1, 2, 3, 4, 5].map((n) => ({ n }))
  assert.deepEqual(fontesNaTela(t, fontes).map((f) => [f.n, f.na]), [[3, 1], [5, 2], [4, 3]])
  assert.deepEqual(fontesNaTela('Sem citação.', fontes.slice(0, 2)).map((f) => f.na), [1, 2])
})

test('IA6: texto para colar com as fontes numeradas como na tela e sem caminho cru', () => {
  const t = '**Dose** de ataque [3] (/plantonista/emergencias/fibrilacao-atrial-adulto).\nVer [5].'
  const fontes = [
    { n: 3, titulo: 'Manual HC', editor: 'HCFMUSP', ano: 2024, secao: 'FA', pagina: 210 },
    { n: 5, titulo: 'Ficha', editor: 'Central', ano: 2026, secao: '', pagina: null },
  ]
  assert.equal(textoParaCopiar('dose de amiodarona', t, fontes),
    'Pergunta: dose de amiodarona\n\nDose de ataque [1].\nVer [2].\n\nFontes:\n1. Manual HC — HCFMUSP, 2024, FA, p. 210\n2. Ficha — Central, 2026')
})

test('sem resposta: fica só a frase, sem a lista de assuntos que o modelo acrescenta', () => {
  const t = 'Não encontrei isso no material de referência.\n\nOs trechos disponíveis tratam de Maddrey [1]; Child-Pugh [2].'
  assert.equal(semResposta(t), NAO_ENCONTREI)
  assert.equal(semResposta(`${SEM_PEDIATRIA} Os trechos são de adulto.`), SEM_PEDIATRIA)
  assert.equal(semResposta('Não encontrei isso no material de referência'), 'Não encontrei isso no material de referência')
})

test('resposta com conteúdo não é cortada', () => {
  assert.equal(semResposta('Insulina 0,05 a 0,1 U/kg/h [1].'), null)
  assert.equal(semResposta('Dose de referência: não encontrei a apresentação, mas...'), null)
})

test('resposta pronta lista só as fontes citadas no texto', () => {
  const fontes = [1, 2, 3, 4, 5, 6].map((n) => ({ n }))
  const t = 'Critérios [2]. Gravidade [2, 1]. Cetonúria [1].'
  assert.deepEqual(fontesCitadas(t, fontes).map((f) => f.n), [1, 2])
  assert.deepEqual([...citacoes('sem citação')], [])
  assert.equal(fontesCitadas('sem citação', fontes).length, 6)
})

test('confiança (E4): alta e moderada têm texto; baixa e ausente não aparecem', () => {
  assert.match(textoConfianca('alta') ?? '', /^Confiança alta/)
  assert.match(textoConfianca('moderada') ?? '', /Confira na fonte/)
  assert.equal(textoConfianca('baixa'), null)
  assert.equal(textoConfianca(null), null)
  assert.equal(textoConfianca(undefined), null)
})

test('confiança pelas fontes citadas (E4)', () => {
  const a = { fonte_id: 'a', acima_do_corte: true }
  const b = { fonte_id: 'b', acima_do_corte: true }
  const bBaixo = { fonte_id: 'b', acima_do_corte: false }
  assert.equal(confiancaDasCitadas([a, b], 'moderada'), 'alta')
  assert.equal(confiancaDasCitadas([a, { ...a }], 'alta'), 'moderada')
  assert.equal(confiancaDasCitadas([a, bBaixo], 'alta'), 'moderada')
  assert.equal(confiancaDasCitadas([bBaixo], 'alta'), null)
  // resposta antiga, sem os campos: fica o nível da biblioteca
  assert.equal(confiancaDasCitadas([{}], 'alta'), 'alta')
  assert.equal(confiancaDasCitadas([], 'moderada'), 'moderada')
})

test('PubMed ao vivo (E5) só quando o material não respondeu', () => {
  const a = [{ pmid: '1' }]
  assert.equal(mostrarPubmed('blocked', null, a), true)
  assert.equal(mostrarPubmed('done', NAO_ENCONTREI, a), true)
  assert.equal(mostrarPubmed('done', null, a), false)
  assert.equal(mostrarPubmed('streaming', NAO_ENCONTREI, a), false)
  assert.equal(mostrarPubmed('blocked', null, []), false)
})

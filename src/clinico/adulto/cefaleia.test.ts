// node --experimental-strip-types --test src/clinico/adulto/cefaleia.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  AHS_2025_NIVEIS, ESQUEMA_REFRATARIA, SBCE_TABELAS, SINAIS, TRATAMENTO, avaliarSinais, clorpromazinaMg, fichaCefaleiaAdulto,
} from './cefaleia.ts'

test('cefaleia: SNNOOP10 tem os 15 sinais do resumo', () => {
  assert.equal(SINAIS.length, 15)
  assert.equal(new Set(SINAIS.map((s) => s.id)).size, 15)
})
test('cefaleia: nenhum sinal = nenhuma linha de investigação', () => {
  assert.deepEqual(avaliarSinais([]), { alarmes: 0, linhas: [], semLinha: [] })
})
test('cefaleia: início súbito traz a linha da Tabela 2 com punção após a neuroimagem', () => {
  const a = avaliarSinais(['subita'])
  assert.equal(a.alarmes, 1)
  assert.match(a.linhas[0].investigacao, /punção lombar após a neuroimagem/)
})
test('cefaleia: neoplasia e HIV caem na mesma linha, sem repetir', () => {
  const a = avaliarSinais(['neoplasia', 'imunidade'])
  assert.equal(a.alarmes, 2)
  assert.equal(a.linhas.length, 1)
})
test('cefaleia: sinal sem linha no manual aparece à parte', () => {
  assert.deepEqual(avaliarSinais(['posicional']).semLinha, ['Cefaleia posicional'])
})
test('cefaleia: só as doses que o capítulo traz (dexametasona 10 mg, difenidramina 12,5 mg, sumatriptano 6 mg SC)', () => {
  const textos = Object.values(TRATAMENTO).flatMap((t) => t.itens.map((i) => i.texto)).join(' ')
  assert.match(textos, /10 mg EV/)
  assert.match(textos, /12,5 mg EV/)
  assert.match(textos, /6 mg SC/)
  assert.doesNotMatch(textos, /dipirona \d|metoclopramida \d/)
})

// ---- doses do consenso da SBCe 2000 e níveis da AHS 2025 (decisão do RT, 27/10/2026) ----
test('SBCe 2000: Tabela 3 (crise forte, p. 378) como o consenso traz', () => {
  const t3 = SBCE_TABELAS.find((t) => t.id === 'forte')!
  assert.equal(t3.pagina, 'Tabela 3, p. 378')
  const linha = (d: string) => t3.linhas.find((l) => l.droga === d)!
  assert.equal(linha('Dipirona').dose, '1000 mg IV diluída em SF 0,9%; máximo/dia 2 g')
  assert.equal(linha('Clorpromazina').dose, '0,1–0,7 mg/kg IM ou IV diluído em SF 0,9%; repetir até 3 vezes nas 24 h')
  assert.equal(linha('Sumatriptano').dose, '6 mg SC ou 20 mg IN, ou 50–100 mg VO')
  assert.equal(linha('Dexametasona').dose, '4 mg IV, repetir em 12–24 h s/n')
  assert.equal(t3.linhas.length, 10)
})
test('SBCe 2000: Tabelas 1 e 2 (crise fraca e moderada, p. 377) com AINE, dipirona VO, metoclopramida VO e triptanos', () => {
  const t1 = SBCE_TABELAS.find((t) => t.id === 'fraca')!
  assert.equal(t1.linhas.find((l) => l.droga === 'Ibuprofeno')!.dose, '800–1200 mg VO, repetir 2–4 h após s/n; máximo/dia 1600 mg')
  assert.equal(t1.linhas.find((l) => l.droga === 'Metoclopramida')!.dose, '20 mg VO, associada ou antes do analgésico')
  const t2 = SBCE_TABELAS.find((t) => t.id === 'moderada')!
  assert.equal(t2.linhas.find((l) => l.droga === 'Rizatriptano')!.dose, '5–10 mg VO, 10 mg disco dispersível sobre a língua, s/n; máximo/dia 20 mg')
})
test('SBCe 2000: clorpromazina 0,1–0,7 mg/kg (Tabela 3) pelo peso', () => {
  assert.deepEqual(clorpromazinaMg(70), [7, 49])
  assert.equal(clorpromazinaMg(0), null)
})
test('SBCe 2000: esquema da migrânea refratária na emergência (p. 376)', () => {
  assert.ok(ESQUEMA_REFRATARIA.some((p) => /clorpromazina, 0,1 mg\/kg IV, em 3 minutos/.test(p)))
  assert.ok(ESQUEMA_REFRATARIA.some((p) => /Dexametasona, 10 mg IV/.test(p)))
})
test('AHS 2025 (resumo): metoclopramida IV nível B, clorpromazina IV nível C, paracetamol IV não oferecer', () => {
  const nivel = (d: string) => AHS_2025_NIVEIS.find((n) => n.drogas.includes(d))!.nivel
  assert.match(nivel('metoclopramida IV'), /^B/)
  assert.match(nivel('clorpromazina IV'), /^C/)
  assert.equal(nivel('paracetamol IV'), 'C — não deveria oferecer')
  assert.equal(fichaCefaleiaAdulto.versao, '2026-10-27.1')
  assert.equal(fichaCefaleiaAdulto.fontes.length, 4)
})

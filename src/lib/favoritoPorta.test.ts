import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { deFavoritoParaPorta, quandoDoFavorito, viaDoFavorito } from './favoritoPorta.ts'

// Favoritos de prescrição na porta (decisão do RT: A em G1 a G5,
// docs/porta/FAVORITOS-PRESCRICAO-PORTA-DIAGNOSTICO.md).

const VIAS = ['EV', 'IM', 'VO', 'SC', 'INAL', 'SL']
const fav = (posologia: string | null, via: string | null = 'VO', dose: string | null = '500 mg') =>
  ({ medicamento_id: 'm1', dose, via, posologia })

test('G2: o favorito vira o "Novo item" preenchido (medicamento, dose, via e quando)', () => {
  assert.deepEqual(deFavoritoParaPorta(fav('8/8h'), VIAS), {
    medicamentoId: 'm1', dose: '500 mg', via: 'VO', viaLembrete: null, quando: '8/8h', outraTexto: '',
  })
  assert.equal(deFavoritoParaPorta(fav('8/8h', 'VO', null), VIAS).dose, '')
  assert.equal(deFavoritoParaPorta(fav('8/8h', 'VO', '  1 g  '), VIAS).dose, '1 g')
})

test('G3: intervalo puro marca o chip correspondente', () => {
  assert.deepEqual(quandoDoFavorito('8/8h'), { quando: '8/8h', outraTexto: '' })
  assert.deepEqual(quandoDoFavorito('8/8 H'), { quando: '8/8h', outraTexto: '' })
  assert.deepEqual(quandoDoFavorito('12 / 12 horas'), { quando: '12/12h', outraTexto: '' })
  assert.deepEqual(quandoDoFavorito('a cada 6 horas'), { quando: '6/6h', outraTexto: '' })
  assert.deepEqual(quandoDoFavorito('de 4 em 4 h'), { quando: '4/4h', outraTexto: '' })
  assert.deepEqual(quandoDoFavorito('24/24h.'), { quando: '24/24h', outraTexto: '' })
})

test('G3: Agora e Se necessário marcam os chips', () => {
  assert.deepEqual(quandoDoFavorito('Agora'), { quando: 'Agora', outraTexto: '' })
  assert.deepEqual(quandoDoFavorito('se necessário'), { quando: 'Se necessário', outraTexto: '' })
  assert.deepEqual(quandoDoFavorito('Se necessario'), { quando: 'Se necessário', outraTexto: '' })
})

test('G3: frequência que o servidor entende, sem chip, vai em "Outra" com o texto', () => {
  assert.deepEqual(quandoDoFavorito('3x ao dia'), { quando: 'Outra', outraTexto: '3x ao dia' })
  assert.deepEqual(quandoDoFavorito('duas vezes ao dia'), { quando: 'Outra', outraTexto: 'duas vezes ao dia' })
  assert.deepEqual(quandoDoFavorito('a cada 2 horas'), { quando: 'Outra', outraTexto: 'a cada 2 horas' })
  assert.deepEqual(quandoDoFavorito('Contínuo'), { quando: 'Outra', outraTexto: 'Contínuo' })
})

test('G3: texto de receita, ou frequência que o sistema não entende, deixa o "Quando" em branco', () => {
  const branco = { quando: null, outraTexto: '' }
  assert.deepEqual(quandoDoFavorito('1 cp de 8/8h por 5 dias, se dor'), branco)
  assert.deepEqual(quandoDoFavorito('8/8h por 5 dias'), branco)
  assert.deepEqual(quandoDoFavorito('8/8h se dor'), branco)
  assert.deepEqual(quandoDoFavorito('tomar 1 comprimido a cada 6 horas'), branco)
  assert.deepEqual(quandoDoFavorito('se dor'), branco)
  assert.deepEqual(quandoDoFavorito('8/12h'), branco)
  assert.deepEqual(quandoDoFavorito('a cada 5 horas'), branco)
  assert.deepEqual(quandoDoFavorito('de manhã'), branco)
  assert.deepEqual(quandoDoFavorito(''), branco)
  assert.deepEqual(quandoDoFavorito(null), branco)
  assert.equal(deFavoritoParaPorta(fav('1 cp de 8/8h por 5 dias, se dor'), VIAS).quando, null)
})

test('G4: via igual a uma da porta (sem caixa nem acento) é marcada', () => {
  assert.deepEqual(viaDoFavorito('EV', VIAS), { via: 'EV', viaLembrete: null })
  assert.deepEqual(viaDoFavorito(' ev ', VIAS), { via: 'EV', viaLembrete: null })
  assert.deepEqual(viaDoFavorito('vo', VIAS), { via: 'VO', viaLembrete: null })
  assert.deepEqual(viaDoFavorito('Inal', VIAS), { via: 'INAL', viaLembrete: null })
  assert.deepEqual(viaDoFavorito('ÍM', VIAS), { via: 'IM', viaLembrete: null })
  // com o rótulo do chip: "Sublingual" é o chip SL, "inalatoria" o INAL
  const chips = [{ v: 'SL', rotulo: 'Sublingual' }, { v: 'INAL', rotulo: 'Inalatória' }]
  assert.deepEqual(viaDoFavorito('sublingual', chips), { via: 'SL', viaLembrete: null })
  assert.deepEqual(viaDoFavorito('inalatoria', chips), { via: 'INAL', viaLembrete: null })
  assert.deepEqual(viaDoFavorito('sl', chips), { via: 'SL', viaLembrete: null })
})

test('G4: via fora das da porta vira lembrete, sem tradução (IV não vira EV)', () => {
  assert.deepEqual(viaDoFavorito('IV', VIAS), { via: null, viaLembrete: 'IV' })
  assert.deepEqual(viaDoFavorito('Tópica', VIAS), { via: null, viaLembrete: 'Tópica' })
  assert.deepEqual(viaDoFavorito('oral', VIAS), { via: null, viaLembrete: 'oral' })
  assert.deepEqual(viaDoFavorito(null, VIAS), { via: null, viaLembrete: null })
  assert.deepEqual(viaDoFavorito('  ', VIAS), { via: null, viaLembrete: null })
  const r = deFavoritoParaPorta(fav('8/8h', 'IV'), VIAS)
  assert.equal(r.via, null)
  assert.equal(r.viaLembrete, 'IV')
})

// ── a tela ──────────────────────────────────────────────────────────────────
const estruturada = readFileSync('src/components/prescricao/PrescricaoEstruturada.tsx', 'utf8')
const receituario = readFileSync('src/pages/plantao/atendimento/ReceituarioMedico.tsx', 'utf8')

test('G1/G5: "Meus favoritos" só na porta e nunca para o paciente pediátrico', () => {
  assert.match(estruturada, /\{porta && !pediatrico && \([\s\S]{0,200}<FavoritosPorta/)
  assert.match(estruturada, /Meus favoritos/)
  assert.match(estruturada, /enabled: porta && !pediatrico/)
  assert.match(estruturada, /const favs = pediatrico \? \[\] :/)
  assert.match(estruturada, /to="\/preferencias-prescricao"[^>]*>Editar</)
  assert.match(estruturada, /Nenhum favorito ainda\./)
})

test('G1: a leitura é a do Receituário, com a via', () => {
  assert.match(estruturada, /from\('preferencias_prescricao'\)\s*\.select\('id, receita_padrao, dose, via, posologia, quantidade, medicamento_id, medicamento:medicamento\(/)
})

test('G2: o clique no chip só preenche o formulário, não prescreve', () => {
  const chip = estruturada.match(/function FavoritosPorta[\s\S]*?\r?\n}\r?\n/)?.[0] ?? ''
  assert.ok(chip, 'FavoritosPorta existe')
  assert.doesNotMatch(chip, /prescrever\(|supabase\.rpc|\.from\(/)
  assert.match(estruturada, /<FavoritosPorta[^>]*aoEscolher=\{usarFavorito\}/)
  const usar = estruturada.match(/function usarFavorito[\s\S]*?\r?\n {2}}\r?\n/)?.[0] ?? ''
  assert.ok(usar, 'usarFavorito existe')
  assert.doesNotMatch(usar, /prescrever\(|supabase\.rpc/)
  assert.match(usar, /deFavoritoParaPorta\(/)
})

test('alergia trava o chip, como no Receituário (mesmo hook)', () => {
  for (const f of [estruturada, receituario]) assert.match(f, /import \{ useTravas \} from '@\/components\/paciente\/useTravas'/)
  assert.match(estruturada, /disabled=\{!!trava/)
  assert.match(estruturada, /Bloqueado pela alergia a \$\{trava\}/)
})

test('G3: "Quando" em branco não vale "Agora"', () => {
  assert.match(estruturada, /semQuando \? '' :/)
})

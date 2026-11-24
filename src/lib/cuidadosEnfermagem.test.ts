// CU1–CU3, CK0–CK3 (revisão do perfil Enfermeiro) e TE2–TE4 (perfil Técnico), RT 24/11/2026
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const ler = (f: string) => readFileSync(f, 'utf8')

test('CK0: a gaveta e a tela Checagem usam a mesma leitura e o mesmo item, com as mesmas chamadas', () => {
  const dados = ler('src/components/enfermagem/checagem/dados.ts')
  assert.match(dados, /queryKey: \['fila-checagem'\]/)
  assert.match(dados, /supabase\.rpc\('fila_checagem'\)/)
  assert.match(dados, /l\.paciente_id === pacienteId/)
  const item = ler('src/components/enfermagem/checagem/ItemChecagem.tsx')
  for (const rpc of ['checar', 'aprazar', 'pedir_renovacao', 'dar_ciencia_atraso']) assert.match(item, new RegExp(`supabase\\.rpc\\('${rpc}'`))
  assert.match(ler('src/components/enfermagem/AbaAgora.tsx'), /useChecagem\(ctx\.pacienteId\)/)
  assert.match(ler('src/pages/enfermagem/Checagem.tsx'), /useChecagem\(\)/)
})

test('CK2: o item vencido não oferece Feito, Recusado nem Aprazar', () => {
  const item = ler('src/components/enfermagem/checagem/ItemChecagem.tsx')
  const i = item.indexOf('{vencido ? (')
  const j = item.indexOf(') : (', i)
  const ramoVencido = item.slice(i, j)
  assert.ok(i > 0 && j > i)
  assert.doesNotMatch(ramoVencido, /checar\('feito'|Recusado|aprazar\(/)
})

test('CU1/CU2: a gaveta abre em Agora, com contenção e intercorrência no menu de ações', () => {
  const painel = ler('src/components/enfermagem/PainelCuidados.tsx')
  assert.match(painel, /React\.useState<Aba>\('agora'\)/)
  assert.match(painel, /\['mais', 'Mais'\]/)
  const gaveta = ler('src/pages/enfermagem/GavetaCuidados.tsx')
  assert.match(gaveta, /<BotaoIniciarContencao /)
  assert.match(gaveta, /Registrar intercorrência/)
  assert.doesNotMatch(gaveta, /<CabecalhoPaciente /)
})

test('TE2 (COFEN 736/2024): no perfil Técnico a SAE e as escalas ficam só para leitura e não há aprazar', () => {
  const painel = ler('src/components/enfermagem/PainelCuidados.tsx')
  assert.match(painel, /tecnico \? \{ \.\.\.q\.data, pode_sae: false \} : q\.data/)
  assert.match(painel, /somenteLeitura=\{tecnico\}/)
  assert.match(ler('src/components/enfermagem/AbaAgora.tsx'), /souEnfermeiro = papelAtivo === 'enfermeiro'/)
  assert.match(ler('src/components/enfermagem/AbaSae.tsx'), /A SAE é do enfermeiro/)
})

test('TE3/TE4: PS com porta e observação; no Técnico o leito livre só mostra o estado', () => {
  const ps = ler('src/pages/enfermagem/ProntoSocorroEnfermagem.tsx')
  assert.match(ps, /<LeitosParaLiberar unidadeId=\{unidadeId\} setores=\{daPorta\} \/>/)
  assert.match(ps, /meusSetores\.includes\(o\.setor_id\)/)
  const leito = ler('src/pages/enfermagem/LeitosParaLiberar.tsx')
  assert.match(leito, /podeBloquear=\{l\.pode_bloquear && !tecnico\}/)
  assert.match(leito, /podeReservar=\{l\.pode_reservar && !tecnico\}/)
})

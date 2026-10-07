// Copia para a área de transferência, em ordem, os SQLs que montam a
// homologação pelo SQL Editor do Supabase (Fase 0, tarefa 2).
//
// Uso: npm run homolog:copiar -- 1   (depois 2, 3, 4, 5, 6)
//      npm run homolog:copiar -- 7 seu@email   (super admin de um usuário que já existe)
//      npm run homolog:copiar -- 8 seu@email   (todos os papéis na UPA Homologação + escala no PS)
//      npm run homolog:copiar -- 9             (demo: catálogo mínimo de medicamentos)
//      npm run homolog:copiar -- 10 seu@email  (demo: escala hoje e amanhã no PS, na Observação e na Clínica Médica)
//      npm run homolog:copiar -- 11            (CID-10, depois 12, 13, 14, 15 — gerado por gerar-cid10-sql.ts)
// No painel de homologação: SQL Editor → New query → Ctrl+V → Run.
//
// Vai para o clip.exe em UTF-16LE SEM BOM: os acentos chegam intactos e o
// SQL Editor não recebe um U+FEFF invisível na 1ª linha (com BOM, o clip.exe
// o copiava junto e o Postgres acusava erro de sintaxe). Ler pelo PowerShell
// corromperia o texto — ver AGENTS.md.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const ORDEM = [
  ['supabase/dados/protocolo_aparecida_2025.sql', 'protocolo de classificação de risco'],
  ['supabase/homolog/partes/sigtap_cid_parte1.sql', 'SIGTAP × CID, parte 1 de 4'],
  ['supabase/homolog/partes/sigtap_cid_parte2.sql', 'SIGTAP × CID, parte 2 de 4'],
  ['supabase/homolog/partes/sigtap_cid_parte3.sql', 'SIGTAP × CID, parte 3 de 4'],
  ['supabase/homolog/partes/sigtap_cid_parte4.sql', 'SIGTAP × CID, parte 4 de 4'],
  ['supabase/homolog/seed-homolog.sql', 'UPA de homologação (setores, leitos, pacientes fictícios)'],
  ['supabase/homolog/promover-super-admin.sql', 'seu usuário vira super admin da homologação'],
  ['supabase/homolog/vincular-usuario-teste.sql', 'todos os papéis na UPA Homologação + escala no Pronto Socorro'],
  ['supabase/homolog/demo-medicamentos.sql', 'demo: catálogo mínimo de medicamentos de PS (sem dose)'],
  ['supabase/homolog/demo-preparar.sql', 'demo: escala hoje e amanhã no PS, na Observação e na Clínica Médica'],
  ['supabase/homolog/partes/cid10_parte1.sql', 'CID-10, parte 1 de 5'],
  ['supabase/homolog/partes/cid10_parte2.sql', 'CID-10, parte 2 de 5'],
  ['supabase/homolog/partes/cid10_parte3.sql', 'CID-10, parte 3 de 5'],
  ['supabase/homolog/partes/cid10_parte4.sql', 'CID-10, parte 4 de 5'],
  ['supabase/homolog/partes/cid10_parte5.sql', 'CID-10, parte 5 de 5'],
]

const n = Number(process.argv[2])
if (!Number.isInteger(n) || n < 1 || n > ORDEM.length) {
  console.log(`Diga qual arquivo copiar: npm run homolog:copiar -- 1   (de 1 a ${ORDEM.length})`)
  ORDEM.forEach(([, d], i) => console.log(`  ${i + 1}. ${d}`))
  process.exit(1)
}
const [arquivo, descricao] = ORDEM[n - 1]
if (!existsSync(arquivo)) {
  console.error(`Arquivo não encontrado: ${arquivo}`)
  process.exit(1)
}
let texto = readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '')
if (arquivo.endsWith('promover-super-admin.sql') || arquivo.endsWith('vincular-usuario-teste.sql') || arquivo.endsWith('demo-preparar.sql')) {
  const email = (process.argv[3] ?? '').trim()
  if (!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email)) {
    console.error('Informe o e-mail do usuário criado no painel: npm run homolog:copiar -- 7 seu@email')
    process.exit(1)
  }
  texto = texto.replace('TROQUE-PELO-SEU-EMAIL@exemplo.com', email)
}
const dados = Buffer.from(texto, 'utf16le')
const r = spawnSync('clip', { input: dados })
if (r.status !== 0) {
  console.error('Não consegui copiar para a área de transferência (clip.exe).')
  process.exit(1)
}
console.log(`Copiado ${n} de ${ORDEM.length}: ${descricao} (${Math.round(texto.length / 1024)} KB).`)
console.log('Agora, no painel de homologação: SQL Editor → New query → Ctrl+V → Run.')
if (n === 6) console.log('Próximo: crie o usuário de teste com npm run homolog:usuario -- seu@email (o Add user do painel é barrado pela regra de convite).')
else if (n === 7) console.log('Próximo: npm run homolog:copiar -- 8 seu@email (papéis e escala na UPA Homologação).')
else if (n < 6) console.log(`Quando terminar sem erro: npm run homolog:copiar -- ${n + 1}`)
else console.log('Pronto. Entre em https://homolog.chefecoruja.com.br e use Trocar perfil para cada papel.')

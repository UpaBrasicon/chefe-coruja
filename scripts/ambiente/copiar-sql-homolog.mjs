// Copia para a área de transferência, em ordem, os SQLs que montam a
// homologação pelo SQL Editor do Supabase (Fase 0, tarefa 2).
//
// Uso: npm run homolog:copiar -- 1   (depois 2, 3, 4, 5, 6)
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
const texto = readFileSync(arquivo, 'utf8').replace(/^﻿/, '')
const dados = Buffer.from(texto, 'utf16le')
const r = spawnSync('clip', { input: dados })
if (r.status !== 0) {
  console.error('Não consegui copiar para a área de transferência (clip.exe).')
  process.exit(1)
}
console.log(`Copiado ${n} de ${ORDEM.length}: ${descricao} (${Math.round(texto.length / 1024)} KB).`)
console.log('Agora, no painel de homologação: SQL Editor → New query → Ctrl+V → Run.')
if (n < ORDEM.length) console.log(`Quando terminar sem erro: npm run homolog:copiar -- ${n + 1}`)
else console.log('Esse era o último. Próximo passo: URL do Auth e seu usuário.')

// Prepara um script de scripts/e2e/ para rodar na HOMOLOGAÇÃO pelo SQL Editor
// ou pelo plugin do Supabase (que não entendem meta-comandos do psql):
//   • tira as linhas `\set ...`;
//   • troca `crypt(:'senha', gen_salt('bf'))` pelo HASH bcrypt pronto, lido da
//     variável de ambiente HASH_E2E (a senha em texto nunca entra no SQL: o hash
//     é calculado fora, como em scripts/ambiente/usuario-homolog.mjs).
// A saída vai para o arquivo indicado (ou para a pasta de rascunho da sessão).
//
// Uso: HASH_E2E='$2b$10$...' node scripts/e2e/homolog/preparar.mjs scripts/e2e/01_rede_e2e.sql saida.sql
import { readFileSync, writeFileSync } from 'node:fs'

const [entrada, saida] = process.argv.slice(2)
if (!entrada || !saida) {
  console.log('Uso: HASH_E2E=<hash bcrypt> node scripts/e2e/homolog/preparar.mjs <entrada.sql> <saida.sql>')
  process.exit(1)
}
let sql = readFileSync(entrada, 'utf8').replace(/\r\n/g, '\n')
sql = sql.split('\n').filter((l) => !/^\\set\b/.test(l)).join('\n')
if (sql.includes(":'senha'")) {
  const hash = process.env.HASH_E2E
  if (!hash || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
    console.error('O script usa a senha de teste: passe HASH_E2E com o hash bcrypt (ver cabeçalho deste arquivo).')
    process.exit(1)
  }
  sql = sql.replace(/crypt\(:'senha', gen_salt\('bf'\)\)/g, `'${hash}'`)
}
if (/:'[a-z_]+'/.test(sql)) {
  console.error('Sobrou variável do psql no script: ' + sql.match(/:'[a-z_]+'/)[0])
  process.exit(1)
}
writeFileSync(saida, sql, 'utf8')
console.log(`ok: ${saida} (${sql.split('\n').length} linhas)`)

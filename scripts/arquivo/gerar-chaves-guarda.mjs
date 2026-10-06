// Gera o par de chaves da guarda automática (Fase 0, tarefa 8).
//
//   guarda-publica.pem   vai para o servidor (VPS). Só cifra: quem a tiver
//                        NÃO consegue abrir nenhuma guarda.
//   guarda-privada.pem   fica com o responsável, FORA do servidor (nota segura
//                        no Bitwarden + uma cópia offline). Protegida por uma
//                        frase digitada aqui (não aparece na tela nem é gravada),
//                        guardada em outro lugar que não o da chave.
//
// Sem a chave privada E a frase, nenhuma guarda abre — nem pelo responsável.
//
// Uso: node scripts/arquivo/gerar-chaves-guarda.mjs --saida <pasta>
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { digitalDaChave, perguntarSenha } from './cofre.mjs'

const args = process.argv.slice(2)
const i = args.indexOf('--saida')
const saida = i >= 0 ? resolve(args[i + 1]) : null
if (!saida) {
  console.error('uso: node scripts/arquivo/gerar-chaves-guarda.mjs --saida <pasta>')
  process.exit(1)
}
const publica = join(saida, 'guarda-publica.pem')
const privada = join(saida, 'guarda-privada.pem')
if (existsSync(publica) || existsSync(privada)) {
  console.error(`já existem chaves em ${saida}: não sobrescrevo (perderia o acesso às guardas antigas)`)
  process.exit(1)
}

const frase = await perguntarSenha('Frase da chave privada (mínimo 16 caracteres): ')
if (frase.length < 16) { console.error('frase curta: use 16 caracteres ou mais'); process.exit(1) }
if ((await perguntarSenha('Repita a frase: ')) !== frase) { console.error('as frases não conferem'); process.exit(1) }

console.log('gerando o par de chaves (RSA 4096, alguns segundos)…')
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: frase },
})
mkdirSync(saida, { recursive: true })
writeFileSync(publica, publicKey)
writeFileSync(privada, privateKey, { mode: 0o600 })

console.log(`✔ ${publica}  → copie para o servidor`)
console.log(`✔ ${privada}  → Bitwarden (item separado da frase) + uma cópia offline; depois apague deste computador`)
console.log(`  impressão digital da pública: ${digitalDaChave(publicKey)}`)
console.log('  Anote a impressão digital nos itens do Bitwarden (chave e frase).')
console.log('  Perder a chave privada ou a frase = nenhuma guarda abre mais.')

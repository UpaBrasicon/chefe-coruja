// Envia uma guarda gerada por exportar-guarda.mjs para o cofre na nuvem
// (AWS S3 em São Paulo, Object Lock em conformidade por 20 anos e Glacier
// Deep Archive depois de 30 dias). Decisão do RT em 02/10/2026.
//
//   1. confere o MANIFESTO (sha256 de cada arquivo);
//   2. pede a senha da guarda (duas vezes; não aparece na tela nem é gravada);
//   3. cifra cada arquivo no computador (AES-256-GCM, chave por scrypt) e
//      confere que decifra de volta antes de enviar;
//   4. envia com o nome trocado por um número (o nome real só existe dentro
//      do índice cifrado) e confere no S3 o checksum e a trava de 20 anos.
//
// Uso:
//   node scripts/arquivo/enviar-guarda.mjs <pasta-da-guarda> --credenciais <chave.csv>
// A chave .csv é a do usuário IAM guarda-envio (só grava e lê neste bucket).
// Também aceita AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY e GUARDA_SENHA no ambiente.
// Para abrir uma guarda baixada: node scripts/arquivo/abrir-guarda.mjs
//
// SEM A SENHA A GUARDA NÃO ABRE. Guarde a senha fora do computador (cofre de
// senhas e uma cópia em papel lacrada com o RT).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { cifrar, consultar, credenciais, decifrar, derivarChave, enviar, novoSal, perguntarSenha, sha256 } from './cofre.mjs'

const args = process.argv.slice(2)
const opt = (n, padrao) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : padrao }
const pasta = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null
const bucket = opt('--bucket', 'chefe-coruja-guarda-saqjrjt')
const regiao = opt('--regiao', 'sa-east-1')
if (!pasta || !existsSync(join(pasta, 'MANIFESTO.json'))) {
  console.error('uso: node scripts/arquivo/enviar-guarda.mjs <pasta-da-guarda> --credenciais <chave.csv>')
  process.exit(1)
}
const cred = credenciais(opt('--credenciais'))
const prefixo = basename(pasta)

// 1. a guarda local está íntegra?
const manifesto = JSON.parse(readFileSync(join(pasta, 'MANIFESTO.json'), 'utf8'))
for (const a of manifesto.arquivos) {
  const c = join(pasta, ...a.arquivo.split('/'))
  if (!existsSync(c) || sha256(readFileSync(c)).toString('hex') !== a.sha256) {
    console.error(`✖ ${a.arquivo} falta ou foi alterado: rode guarda:conferir e gere a guarda de novo`)
    process.exit(1)
  }
}
console.log(`✔ ${manifesto.arquivos.length} arquivo(s) conferidos`)

// 2. senha
const senha = await perguntarSenha('Senha da guarda (mínimo 12 caracteres): ')
if (senha.length < 12) { console.error('senha curta: use 12 caracteres ou mais'); process.exit(1) }
if (!process.env.GUARDA_SENHA && (await perguntarSenha('Repita a senha: ')) !== senha) {
  console.error('as senhas não conferem'); process.exit(1)
}
const sal = novoSal()
console.log('derivando a chave (alguns segundos)…')
const chave = derivarChave(senha, sal)

// 3 e 4. cifra, confere, envia, consulta
const limite = new Date(Date.now() + (20 * 365 - 2) * 864e5)  // ~20 anos, folga de bissextos
const objetos = []
const itens = [...manifesto.arquivos.map((a) => a.arquivo), 'MANIFESTO.json']
async function subir(chaveObjeto, claro) {
  const cifrado = cifrar(chave, sal, claro)
  if (!decifrar(chave, cifrado).equals(claro)) throw new Error(`a cifra de ${chaveObjeto} não confere`)
  const enviado = await enviar({ bucket, regiao, chaveObjeto, corpo: cifrado, cred })
  const s3 = await consultar({ bucket, regiao, chaveObjeto, cred })
  if (s3.checksum !== enviado) throw new Error(`${chaveObjeto}: checksum no S3 diferente do enviado`)
  if (s3.modo !== 'COMPLIANCE') throw new Error(`${chaveObjeto}: sem trava em conformidade (modo ${s3.modo ?? 'nenhum'}). Confira o bloqueio de objetos do bucket.`)
  if (!s3.ate || new Date(s3.ate) < limite) throw new Error(`${chaveObjeto}: trava até ${s3.ate}, menos de 20 anos`)
  return { checksum: enviado, ate: s3.ate, bytes: cifrado.length }
}

for (const [i, arquivo] of itens.entries()) {
  const chaveObjeto = `${prefixo}/${String(i + 1).padStart(5, '0')}.ccg`
  const claro = readFileSync(join(pasta, ...arquivo.split('/')))
  const r = await subir(chaveObjeto, claro)
  objetos.push({ objeto: chaveObjeto, arquivo, sha256_claro: sha256(claro).toString('hex'), ...r })
  console.log(`  ${i + 1}/${itens.length} enviado e travado até ${r.ate.slice(0, 10)}`)
}

// índice cifrado por último: sem ele a guarda está incompleta
const indice = { versao: 1, enviado_em: new Date().toISOString(), bucket, regiao, prefixo, manifesto, objetos }
const ri = await subir(`${prefixo}/indice.ccg`, Buffer.from(JSON.stringify(indice, null, 2)))

// recibo local, sem segredo nem dado de paciente
const recibo = {
  enviado_em: indice.enviado_em, bucket, regiao, prefixo,
  objetos: objetos.length + 1, bytes: objetos.reduce((s, o) => s + o.bytes, 0) + ri.bytes,
  travado_ate: ri.ate, gerada_em: manifesto.gerado_em,
}
writeFileSync(`${pasta}.envio.json`, JSON.stringify(recibo, null, 2))
console.log(`✔ guarda ${prefixo} no cofre: ${recibo.objetos} objeto(s), travados até ${ri.ate.slice(0, 10)}`)
console.log(`  recibo: ${pasta}.envio.json`)
console.log('  A pasta local tem dados de saúde sem cifra: apague-a depois de conferir o recibo.')

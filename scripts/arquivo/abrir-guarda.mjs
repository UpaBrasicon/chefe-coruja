// Abre uma guarda baixada do cofre (os .ccg de uma pasta guarda-AAAA-MM-DD-HHMM
// mais o indice.ccg) e reconstrói os arquivos originais, conferindo o sha256.
//
// No Deep Archive, antes de baixar é preciso pedir a restauração no console do
// S3 (Ações → Iniciar restauração; leva de 12 a 48 horas).
//
// Uso: node scripts/arquivo/abrir-guarda.mjs <pasta-com-os-ccg> --destino <pasta>
//   guarda automática (CCG2): acrescente --chave-privada <guarda-privada.pem>;
//   a frase da chave é pedida sem aparecer na tela.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { caminhoConfinado, caminhoValido } from './caminho.mjs'
import { abrirEnvelope, decifrar, decifrar2, derivarChave, envelopeDe, formatoDe, perguntarSenha, salDe, sha256 } from './cofre.mjs'

const args = process.argv.slice(2)
const origem = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null
const i = args.indexOf('--destino')
const destino = i >= 0 ? resolve(args[i + 1]) : null
const j = args.indexOf('--chave-privada')
const chavePrivada = j >= 0 ? resolve(args[j + 1]) : null
if (!origem || !destino || !existsSync(join(origem, 'indice.ccg'))) {
  console.error('uso: node scripts/arquivo/abrir-guarda.mjs <pasta-com-os-ccg> --destino <pasta>')
  process.exit(1)
}

const ccgIndice = readFileSync(join(origem, 'indice.ccg'))
let abrir
if (formatoDe(ccgIndice) === 'CCG2') {
  if (!chavePrivada || !existsSync(chavePrivada)) {
    console.error('guarda automática: informe --chave-privada <guarda-privada.pem>')
    process.exit(1)
  }
  const frase = await perguntarSenha('Frase da chave privada: ')
  const chave = abrirEnvelope(readFileSync(chavePrivada, 'utf8'), frase, envelopeDe(ccgIndice))
  abrir = (c) => decifrar2(chave, c)
} else {
  const senha = await perguntarSenha('Senha da guarda: ')
  const chave = derivarChave(senha, salDe(ccgIndice))
  abrir = (c) => decifrar(chave, c)
}
const indice = JSON.parse(abrir(ccgIndice).toString('utf8'))

// Guarda automática nova (S10, H1): cada anexo foi guardado com nome seguro
// (storage/anexo-00001) e o nome real está no manifesto. Volta ao nome real se
// ele passar na checagem; senão fica o nome seguro. Guardas antigas não têm a
// lista e restauram como sempre, pelo `arquivo` do índice.
const anexos = new Map((Array.isArray(indice.manifesto?.anexos) ? indice.manifesto.anexos : [])
  .map((a) => [a.arquivo, `storage/${a.bucket}/${a.nome}`]))

// Todo caminho vem do índice (que pode ter sido forjado): confinado em
// --destino e na pasta de origem; o que for recusado é pulado e conta como falha.
let falhas = 0
const gravados = new Set()
for (const o of indice.objetos) {
  const nome = String(o.objeto ?? '').split('/').pop()
  let c, alvo
  try {
    c = caminhoConfinado(origem, nome)
    let rel = o.arquivo
    if (anexos.has(o.arquivo)) {
      if (caminhoValido(anexos.get(o.arquivo)) && anexos.get(o.arquivo).split('/').length >= 3) rel = anexos.get(o.arquivo)
      else console.log(`! anexo ${o.arquivo}: nome real recusado, fica com o nome seguro`)
    }
    alvo = caminhoConfinado(destino, rel)
  } catch (e) {
    falhas++; console.log(`✖ recusado (objeto ${nome || '?'}): ${e.message}; índice possivelmente adulterado`); continue
  }
  if (gravados.has(alvo)) { falhas++; console.log(`✖ repetido no índice: ${o.arquivo}`); continue }
  if (!existsSync(c)) { falhas++; console.log(`✖ falta ${nome} (${o.arquivo})`); continue }
  const claro = abrir(readFileSync(c))
  if (sha256(claro).toString('hex') !== o.sha256_claro) { falhas++; console.log(`✖ alterado ${o.arquivo}`); continue }
  try {
    mkdirSync(dirname(alvo), { recursive: true })
    writeFileSync(alvo, claro)
    gravados.add(alvo)
  } catch (e) {
    falhas++; console.log(`✖ não gravou ${o.arquivo}: ${e.code ?? e.message}`)
  }
}
console.log(falhas
  ? `${falhas} problema(s) em ${indice.objetos.length} arquivo(s)`
  : `✔ ${indice.objetos.length} arquivo(s) abertos em ${destino} · guarda gerada em ${indice.manifesto.gerado_em}`)
process.exit(falhas ? 1 : 0)

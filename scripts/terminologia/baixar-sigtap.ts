// ─────────────────────────────────────────────────────────────────────────────
// Baixa a Tabela Unificada SIGTAP mais recente a partir do mirror automático
// https://github.com/RenatoKR/SIGTAP (sincronizado diariamente às 5h BRT do
// FTP oficial do DATASUS; mantém os últimos 6 meses).
//
// Extrai apenas os arquivos necessários para `importar-sigtap.ts`:
//   tb_procedimento.txt  (+ tb_procedimento_layout.txt)
// em data/terminologia/sigtap/ — pronto para importação.
//
// Uso: node scripts/terminologia/baixar-sigtap.ts
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const API_TABELAS = 'https://api.github.com/repos/RenatoKR/SIGTAP/contents/tabelas'
const DIR_DESTINO = resolve('data/terminologia/sigtap')
// arquivos necessários para a importação (nome no zip → nome local)
const ARQUIVOS = new Map([
  ['tb_procedimento.txt', 'tb_procedimento.txt'],
  ['tb_procedimento_layout.txt', 'tb_procedimento_layout.txt'],
])

async function obterZipMaisRecente(): Promise<{ nome: string; url: string }> {
  const res = await fetch(API_TABELAS, { headers: { 'User-Agent': 'chefe-coruja-terminologia' } })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)
  const itens = (await res.json()) as { name: string; download_url: string | null }[]
  const zips = itens
    .filter((i) => i.name.startsWith('TabelaUnificada_') && i.name.endsWith('.zip') && i.download_url)
    .sort((a, b) => b.name.localeCompare(a.name))
  if (zips.length === 0) throw new Error('Nenhum zip de TabelaUnificada encontrado no repositório')
  return { nome: zips[0].name, url: zips[0].download_url! }
}

async function baixarZip(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { 'User-Agent': 'chefe-coruja-terminologia' } })
  if (!res.ok) throw new Error(`Download ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/** Extrai do zip apenas os arquivos do Map (sem dependência de lib). */
async function extrairDoZip(zipBytes: Uint8Array, desejados: Map<string, string>): Promise<void> {
  // Localiza o EOCD (End of Central Directory)
  const fim = zipBytes.length
  let eocd = -1
  for (let i = fim - 22; i >= 0; i--) {
    if (zipBytes[i] === 0x50 && zipBytes[i + 1] === 0x4b && zipBytes[i + 2] === 0x05 && zipBytes[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error('EOCD não encontrado (zip inválido)')

  const lerU16 = (o: number) => zipBytes[o] | (zipBytes[o + 1] << 8)
  const lerU32 = (o: number) => zipBytes[o] | (zipBytes[o + 1] << 8) | (zipBytes[o + 2] << 16) | (zipBytes[o + 3] << 24)

  const totalEntradas = lerU16(eocd + 10)
  const cdOffset = lerU32(eocd + 16)
  const cdSize = lerU32(eocd + 12)

  let extraidos = 0
  let off = cdOffset
  const fimCd = cdOffset + cdSize
  while (off < fimCd && extraidos < totalEntradas) {
    if (lerU32(off) !== 0x02014b50) break // assinatura central directory
    const metodo = lerU16(off + 10)
    const tamanhoComp = lerU32(off + 20)
    const tamanhoRaw = lerU32(off + 24)
    const nomeLen = lerU16(off + 28)
    const extraLen = lerU16(off + 30)
    const comentLen = lerU16(off + 32)
    const localOffset = lerU32(off + 42)
    const nome = new TextDecoder('utf8').decode(zipBytes.slice(off + 46, off + 46 + nomeLen))

    const alvo = desejados.get(nome)
    if (alvo !== undefined) {
      // local file header
      if (lerU32(localOffset) !== 0x04034b50) throw new Error(`Header local inválido para ${nome}`)
      const nomeLocalLen = lerU16(localOffset + 26)
      const extraLocalLen = lerU16(localOffset + 28)
      const dadosInicio = localOffset + 30 + nomeLocalLen + extraLocalLen

      let conteudo: Uint8Array
      if (metodo === 0) {
        conteudo = zipBytes.slice(dadosInicio, dadosInicio + tamanhoRaw)
      } else if (metodo === 8) {
        // DEFLATE — usa DecompressionStream (Node 18+)
        const stream = new Blob([zipBytes.slice(dadosInicio, dadosInicio + tamanhoComp)]).stream()
          .pipeThrough(new DecompressionStream('deflate-raw'))
        conteudo = new Uint8Array(await new Response(stream).arrayBuffer())
      } else {
        throw new Error(`Método de compressão ${metodo} não suportado p/ ${nome}`)
      }
      writeFileSync(resolve(DIR_DESTINO, alvo), conteudo)
      console.log(`  ✓ ${nome} → ${alvo} (${conteudo.length} bytes)`)
      extraidos++
    }
    off += 46 + nomeLen + extraLen + comentLen
  }
  if (extraidos === 0) throw new Error('Nenhum arquivo desejado encontrado no zip')
}

async function main() {
  const maisRecente = await obterZipMaisRecente()
  console.log(`SIGTAP: baixando ${maisRecente.nome} (${maisRecente.url})`)
  const zipBytes = await baixarZip(maisRecente.url)
  console.log(`SIGTAP: zip baixado (${zipBytes.length} bytes)`)

  mkdirSync(DIR_DESTINO, { recursive: true })
  await extrairDoZip(zipBytes, ARQUIVOS)
  console.log(`SIGTAP: pronto em ${DIR_DESTINO}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

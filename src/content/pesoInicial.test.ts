// node --experimental-strip-types --test src/content/pesoInicial.test.ts
// Nenhuma ferramenta clínica abre com um peso suposto (revisão das ferramentas,
// 24/11/2026): a Dengue abria com 70 kg e calculava hidratação, hemocomponentes
// e eletrólitos sem o médico digitar o peso. O peso começa vazio (0) ou vem do
// paciente informado na Central; nunca de um número fixo no código.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : []
  })
}

// [peso, setPeso] = useState(70) / useState<number>(3.5) / useState(() => 70)
const PESO_FIXO = /\[\s*(peso\w*)\s*,\s*set\w*\s*\]\s*=\s*useState(?:<[^>]*>)?\(\s*(?:\(\)\s*=>\s*)?(\d+(?:\.\d+)?)\s*\)/g

test('nenhuma ferramenta abre com peso fixo diferente de zero', () => {
  const achados: string[] = []
  for (const dir of ['src/pages/plantonista', 'src/components/plantonista']) {
    for (const arquivo of arquivos(dir)) {
      for (const m of readFileSync(arquivo, 'utf8').matchAll(PESO_FIXO)) {
        if (Number(m[2]) !== 0) achados.push(`${arquivo}: ${m[0]}`)
      }
    }
  }
  assert.deepEqual(achados, [])
})

test('Dengue: o peso abre com o da Central ou vazio', () => {
  const dengue = readFileSync('src/pages/plantonista/dengue/ClassificacaoDengue.tsx', 'utf8')
  assert.ok(dengue.includes("useState(() => pacienteDaCentral('adulto').pesoKg ?? 0)"))
  assert.ok(!/useState\(70\)/.test(dengue))
})

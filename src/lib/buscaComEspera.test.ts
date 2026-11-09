import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Item 04 do kit de desempenho (docs/desempenho/AUDITORIA.md): estas buscas
// consultavam o banco a cada tecla. Agora esperam a pessoa parar de digitar
// (useValorAdiado, 300 ms). A chave da consulta usa o valor adiado.
const BUSCAS: [arquivo: string, chave: string][] = [
  ['src/components/apac/SolicitarApac.tsx', 'buscar-sigtap-apac'],
  ['src/components/hiperdia/IncluirNoHiperdia.tsx', 'hiperdia-busca-paciente'],
  ['src/components/internacao/documentos/PedidoExamesLeito.tsx', 'buscar-exames'],
  ['src/components/leito/ReservarLeito.tsx', 'reserva-busca-paciente'],
  ['src/components/paciente/CadastroRn.tsx', 'rn-busca-mae'],
  ['src/components/perfil/CampoCbo.tsx', 'buscar-cbo'],
  ['src/components/preNatal/Dialogos.tsx', 'pre-natal-busca-paciente'],
  ['src/pages/agenda/AgendaConsultas.tsx', 'agenda-busca-paciente'],
  ['src/pages/farmacia/Diluicoes.tsx', 'med-farmacia'],
  ['src/pages/faturamento/Bpa.tsx', 'atendimentos-para-faturar'],
  ['src/pages/faturamento/Bpa.tsx', 'buscar-sigtap'],
  ['src/pages/faturamento/Contas.tsx', 'buscar-sigtap'],
  ['src/pages/faturamento/Materiais.tsx', 'buscar-sigtap-material'],
  ['src/pages/gestor/ExamesUnidade.tsx', 'buscar-exames-todos'],
  ['src/components/paciente/AlergiasEventos.tsx', 'alergia-busca-medicamento'],
  ['src/components/prescricao/PrescricaoEstruturada.tsx', 'busca-medicamento'],
  ['src/components/documentos/AtestadoReceita.tsx', 'busca-medicamento-receita'],
  ['src/pages/farmacia/Dispensacao.tsx', 'busca-medicamento-avulsa'],
]

test('cada busca usa um valor adiado na chave da consulta', () => {
  const faltam: string[] = []
  for (const [arquivo, chave] of BUSCAS) {
    const fonte = readFileSync(arquivo, 'utf8')
    if (!fonte.includes('useValorAdiado(')) { faltam.push(`${arquivo} (sem useValorAdiado)`); continue }
    const linha = fonte.split('\n').find((l) => l.includes(`queryKey: ['${chave}'`))
    if (!linha) { faltam.push(`${arquivo} (sem a chave ${chave})`); continue }
    const nomesAdiados = [...fonte.matchAll(/const (\w+) = useValorAdiado\(/g)].map((m) => m[1])
    if (!nomesAdiados.some((n) => new RegExp(`\\b${n}\\b`).test(linha))) faltam.push(`${arquivo} (${chave} sem valor adiado)`)
  }
  assert.deepEqual(faltam, [])
})

test('o gancho espera 300 ms por padrão e limpa o temporizador', () => {
  const fonte = readFileSync('src/hooks/useValorAdiado.ts', 'utf8')
  assert.match(fonte, /ms = 300/)
  assert.match(fonte, /clearTimeout/)
})

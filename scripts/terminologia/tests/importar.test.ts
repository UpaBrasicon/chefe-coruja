// ─────────────────────────────────────────────────────────────────────────────
// Testes de importação — idempotência e relatório
// Usa um cliente fake em memória (sem banco), validando a lógica de
// inseridos/atualizados/ignorados e a idempotência (2ª execução = 0 inseridos).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { importarTabela, type Relatorio } from '../lib/importar.ts'
import type { LinhaCsv } from '../lib/csv.ts'

type Linha = Record<string, unknown>

/** Cliente Supabase fake em memória (schema terminologia). */
function criarFake(chave: string, estadoInicial: Linha[] = []) {
  const banco: Linha[] = structuredClone(estadoInicial)
  const chamadas: { tipo: string; payload: Linha[] }[] = []
  return {
    banco,
    chamadas,
    from() {
      return {
        select: () => ({
          in: async (chaveSel: string, valores: string[]) => {
            void chaveSel
            const set = new Set(valores)
            const achadas = banco.filter((r) => set.has(String(r[chave])))
            return { data: achadas, error: null }
          },
        }),
        upsert: async (linhas: Linha[], opts?: { onConflict?: string }) => {
          void opts
          chamadas.push({ tipo: 'upsert', payload: structuredClone(linhas) })
          for (const l of linhas) {
            const idx = banco.findIndex((r) => String(r[chave]) === String(l[chave]))
            if (idx === -1) banco.push(structuredClone(l))
            else banco[idx] = structuredClone(l)
          }
          return { data: linhas, error: null }
        },
      }
    },
  }
}

const MAPEAR_CID = (l: LinhaCsv) => ({
  codigo: l.codigo,
  descricao: l.descricao,
  capitulo: l.capitulo || null,
  grupo: l.grupo || null,
})

function linhasCid(extra: LinhaCsv[] = []): LinhaCsv[] {
  const base: LinhaCsv[] = [
    { codigo: 'A00', descricao: 'Cólera', capitulo: 'I', grupo: 'A00-A09' },
    { codigo: 'A01', descricao: 'Febre tifoide', capitulo: 'I', grupo: 'A00-A09' },
    { codigo: 'A02', descricao: 'Outras salmoneloses', capitulo: 'I', grupo: 'A00-A09' },
  ]
  return [...base, ...extra]
}

describe('importarTabela', () => {
  it('primeira execução insere tudo', async () => {
    const fake = criarFake('codigo')
    const r = await importarTabela(
      fake as never,
      { tabela: 'cid10', chave: 'codigo', colunas: ['descricao', 'capitulo', 'grupo'], mapear: MAPEAR_CID },
      linhasCid()
    )
    assert.equal(r.inseridos, 3)
    assert.equal(r.atualizados, 0)
    assert.equal(r.ignorados, 0)
    assert.equal(fake.banco.length, 3)
  })

  it('segunda execução é idempotente (0 inseridos, tudo ignorado)', async () => {
    const fake = criarFake('codigo')
    const opcoes = { tabela: 'cid10', chave: 'codigo', colunas: ['descricao', 'capitulo', 'grupo'], mapear: MAPEAR_CID }
    await importarTabela(fake as never, opcoes, linhasCid())
    const r2: Relatorio = await importarTabela(fake as never, opcoes, linhasCid())
    assert.equal(r2.inseridos, 0)
    assert.equal(r2.atualizados, 0)
    assert.equal(r2.ignorados, 3)
    assert.equal(fake.banco.length, 3)
  })

  it('mudança de payload conta como atualizado', async () => {
    const fake = criarFake('codigo')
    const opcoes = { tabela: 'cid10', chave: 'codigo', colunas: ['descricao', 'capitulo', 'grupo'], mapear: MAPEAR_CID }
    await importarTabela(fake as never, opcoes, linhasCid())
    // altera a descrição do A00 (substituindo a linha original)
    const alteradas: LinhaCsv[] = [
      { codigo: 'A00', descricao: 'Cólera (nova descrição)', capitulo: 'I', grupo: 'A00-A09' },
      { codigo: 'A01', descricao: 'Febre tifoide', capitulo: 'I', grupo: 'A00-A09' },
      { codigo: 'A02', descricao: 'Outras salmoneloses', capitulo: 'I', grupo: 'A00-A09' },
    ]
    const r = await importarTabela(fake as never, opcoes, alteradas)
    assert.equal(r.inseridos, 0)
    assert.equal(r.atualizados, 1)
    assert.equal(r.ignorados, 2) // A01, A02 idênticos
  })

  it('linhas inválidas (sem chave) são ignoradas', async () => {
    const fake = criarFake('codigo')
    const linhas = [...linhasCid(), { codigo: '', descricao: 'Sem código' }, { descricao: 'Sem código também' }]
    const r = await importarTabela(
      fake as never,
      { tabela: 'cid10', chave: 'codigo', colunas: ['descricao', 'capitulo', 'grupo'], mapear: MAPEAR_CID },
      linhas
    )
    assert.equal(r.inseridos, 3)
    assert.equal(r.ignorados, 2)
  })

  it('duplicadas no arquivo contam como ignoradas (1ª vence)', async () => {
    const fake = criarFake('codigo')
    const linhas = [...linhasCid(), { codigo: 'A00', descricao: 'Cólera duplicada', capitulo: 'I', grupo: 'A00-A09' }]
    const r = await importarTabela(
      fake as never,
      { tabela: 'cid10', chave: 'codigo', colunas: ['descricao', 'capitulo', 'grupo'], mapear: MAPEAR_CID },
      linhas
    )
    assert.equal(r.inseridos, 3)
    assert.equal(r.ignorados, 1)
    // a primeira vence: descricao continua 'Cólera'
    assert.equal(fake.banco.find((b) => b.codigo === 'A00')?.descricao, 'Cólera')
  })

  it('mapear retornando null ignora a linha', async () => {
    const fake = criarFake('codigo')
    const r = await importarTabela(
      fake as never,
      { tabela: 'cbo', chave: 'codigo', colunas: ['titulo'], mapear: () => null },
      [{ codigo: '1', titulo: 'X' }]
    )
    assert.equal(r.ignorados, 1)
    assert.equal(fake.banco.length, 0)
  })
})

// LG11, decisão C3: regras do mapa do módulo clínico (o que é SaMD provável,
// zona cinzenta ou fora). Funções puras: o script e o teste usam as mesmas.

export const CLASSES = ['dentro', 'zona-cinzenta', 'fora']

// LG13 (K2): que profissões revisam cada grupo. O médico revisa tudo.
export const REVISORES = ['medico', 'farmaceutico', 'enfermeiro']

/** Ficha → revisões exigidas, pelo grupo do mapa. */
export function revisoesPorFicha(mapa) {
  const m = new Map()
  for (const g of mapa.grupos ?? []) for (const f of g.fichas ?? []) m.set(f, g.revisoes)
  return m
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
const arr = (xs) => `ARRAY[${xs.map(q).join(', ')}]::text[]`

/**
 * SQL que grava em public.ferramentas_clinicas.revisoes_exigidas o que o mapa
 * pede (LG13). Idempotente: só muda o que está diferente. Com `ids`, só essas fichas.
 */
export function sqlRevisoes(mapa, ids) {
  const porConjunto = new Map()
  for (const [f, rev] of revisoesPorFicha(mapa)) {
    if (ids && !ids.has(f)) continue
    const k = rev.join(',')
    if (!porConjunto.has(k)) porConjunto.set(k, [])
    porConjunto.get(k).push(f)
  }
  return [...porConjunto.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, fs]) => {
      const rev = k.split(',')
      return `UPDATE public.ferramentas_clinicas SET revisoes_exigidas = ${arr(rev)}\n WHERE id = ANY (${arr(fs.sort())})\n   AND revisoes_exigidas IS DISTINCT FROM ${arr(rev)};`
    })
    .join('\n')
}

/**
 * Confere o mapa contra as fichas do código.
 * @param {object} mapa           docs/regulatorio/modulo-clinico/mapa.json
 * @param {Set<string>} fichas    ids das fichas de src/clinico
 * @param {(caminho: string) => boolean} existe  confere se o arquivo citado em "onde" existe
 * @returns {string[]} problemas (vazio = ok)
 */
export function conferirMapa(mapa, fichas, existe) {
  const problemas = []
  const vistas = new Map()
  const ids = new Set()
  const item = (tipo, x) => {
    for (const campo of ['id', 'nome', 'classe', 'motivo']) if (!x[campo]) problemas.push(`${tipo} ${x.id ?? '?'}: falta o campo "${campo}"`)
    if (x.classe && !CLASSES.includes(x.classe)) problemas.push(`${tipo} ${x.id}: classe "${x.classe}" deve ser ${CLASSES.join(', ')}`)
    if (ids.has(x.id)) problemas.push(`${tipo} ${x.id}: id repetido`)
    ids.add(x.id)
  }
  for (const g of mapa.grupos ?? []) {
    item('grupo', g)
    if (!g.fichas?.length) problemas.push(`grupo ${g.id}: sem fichas`)
    if (!Array.isArray(g.revisoes) || !g.revisoes.includes('medico') || g.revisoes.some((r) => !REVISORES.includes(r)))
      problemas.push(`grupo ${g.id}: "revisoes" precisa incluir "medico" e só usar ${REVISORES.join(', ')}`)
    for (const f of g.fichas ?? []) {
      if (vistas.has(f)) problemas.push(`ficha ${f} está em dois grupos: ${vistas.get(f)} e ${g.id}`)
      vistas.set(f, g.id)
    }
  }
  for (const fn of mapa.funcoes ?? []) {
    item('função', fn)
    if (!fn.onde?.length) problemas.push(`função ${fn.id}: falta "onde"`)
    for (const c of fn.onde ?? []) if (!existe(c)) problemas.push(`função ${fn.id}: arquivo ${c} não existe`)
  }
  for (const f of fichas) if (!vistas.has(f)) problemas.push(`ficha ${f} não está em nenhum grupo do mapa do módulo clínico (docs/regulatorio/modulo-clinico/mapa.json)`)
  for (const f of vistas.keys()) if (!fichas.has(f)) problemas.push(`ficha ${f} está no mapa, mas não existe em src/clinico`)
  return problemas
}

const ROTULO = { dentro: 'dentro (SaMD provável)', 'zona-cinzenta': 'zona cinzenta', fora: 'fora' }

/** Documento legível para o consultor. Determinístico. */
export function gerarDocumentoMapa(mapa) {
  const conta = (c) => mapa.grupos.filter((g) => g.classe === c).reduce((n, g) => n + g.fichas.length, 0)
  const total = mapa.grupos.reduce((n, g) => n + g.fichas.length, 0)
  const p = [
    '# LG11: mapa do módulo clínico',
    '',
    '<!-- Gerado por scripts/modulo-clinico.mjs a partir de docs/regulatorio/modulo-clinico/mapa.json. Não edite à mão: edite o JSON e rode `node --experimental-strip-types scripts/modulo-clinico.mjs`. -->',
    '',
    `Versão ${mapa.versao}. ${mapa.aviso}`,
    '',
    '## Classes',
    '',
    ...CLASSES.map((c) => `- **${ROTULO[c]}:** ${mapa.classes[c]}`),
    '',
    '## Resumo',
    '',
    `${total} fichas: ${conta('dentro')} dentro, ${conta('zona-cinzenta')} na zona cinzenta e ${conta('fora')} fora. Mais ${mapa.funcoes.length} funções do sistema que não são fichas.`,
    '',
    '| Grupo | Classe | Revisam (LG13) | Fichas |',
    '|---|---|---|---|',
    ...mapa.grupos.map((g) => `| ${g.nome} | ${ROTULO[g.classe]} | ${g.revisoes.join(' + ')} | ${g.fichas.length} |`),
    '',
    '## Funções do sistema',
    '',
    '| Função | Classe | Motivo | Onde |',
    '|---|---|---|---|',
    ...mapa.funcoes.map((f) => `| ${f.nome} | ${ROTULO[f.classe]} | ${f.motivo} | ${f.onde.map((o) => `\`${o}\``).join(', ')} |`),
    '',
    '## Grupos de fichas',
  ]
  for (const g of mapa.grupos) {
    p.push('', `### ${g.nome}`, '', `\`${g.id}\` · ${ROTULO[g.classe]} · revisam: ${g.revisoes.join(' + ')} · ${g.fichas.length} fichas`, '', g.motivo, '', g.fichas.map((f) => `\`${f}\``).join(', '))
  }
  return p.join('\n') + '\n'
}

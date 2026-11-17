// LG11, decisão C3: regras do mapa do módulo clínico (o que é SaMD provável,
// zona cinzenta ou fora). Funções puras: o script e o teste usam as mesmas.

export const CLASSES = ['dentro', 'zona-cinzenta', 'fora']

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
    '| Grupo | Classe | Fichas |',
    '|---|---|---|',
    ...mapa.grupos.map((g) => `| ${g.nome} | ${ROTULO[g.classe]} | ${g.fichas.length} |`),
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
    p.push('', `### ${g.nome}`, '', `\`${g.id}\` · ${ROTULO[g.classe]} · ${g.fichas.length} fichas`, '', g.motivo, '', g.fichas.map((f) => `\`${f}\``).join(', '))
  }
  return p.join('\n') + '\n'
}

// LG4: regras do inventário das operações de tratamento (LGPD, art. 37).
// Funções puras: o script (inventario-lgpd.mjs) e o teste usam as mesmas.

const CAMPOS = ['id', 'nome', 'papel', 'finalidade', 'base_legal', 'titulares', 'dados', 'sensivel', 'acesso', 'local', 'prazo', 'tabelas']

/** Tabelas que as migrations deixam no banco: CREATE TABLE menos DROP TABLE, na ordem dos arquivos. */
export function tabelasDasMigrations(arquivos) {
  const tabelas = new Set()
  const re = /\b(create|drop)\s+table\s+(?:if\s+(?:not\s+)?exists\s+)?(?:"?([a-z_0-9]+)"?\.)?"?([a-z_0-9]+)"?/gi
  const renomeia = /\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:"?([a-z_0-9]+)"?\.)?"?([a-z_0-9]+)"?\s+rename\s+to\s+"?([a-z_0-9]+)"?/gi
  for (const { conteudo } of [...arquivos].sort((a, b) => a.nome.localeCompare(b.nome))) {
    const sql = conteudo.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    const eventos = []
    let m
    while ((m = re.exec(sql))) eventos.push({ pos: m.index, tipo: m[1].toLowerCase(), nome: `${(m[2] ?? 'public').toLowerCase()}.${m[3].toLowerCase()}` })
    while ((m = renomeia.exec(sql))) {
      const esquema = (m[1] ?? 'public').toLowerCase()
      eventos.push({ pos: m.index, tipo: 'rename', nome: `${esquema}.${m[2].toLowerCase()}`, novo: `${esquema}.${m[3].toLowerCase()}` })
    }
    for (const e of eventos.sort((a, b) => a.pos - b.pos)) {
      if (e.tipo === 'create') tabelas.add(e.nome)
      else if (e.tipo === 'drop') tabelas.delete(e.nome)
      else if (tabelas.delete(e.nome)) tabelas.add(e.novo)
    }
  }
  return tabelas
}

/** Confere o inventário contra as tabelas do banco. Devolve a lista de problemas (vazia = ok). */
export function conferir(inventario, tabelasBanco) {
  const problemas = []
  const vistas = new Map()
  const ids = new Set()
  const fora = new Set(inventario.fora_das_migrations?.tabelas ?? [])
  for (const op of inventario.operacoes ?? []) {
    for (const campo of CAMPOS) {
      const v = op[campo]
      if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) problemas.push(`operação ${op.id ?? '?'}: falta o campo "${campo}"`)
    }
    if (ids.has(op.id)) problemas.push(`operação ${op.id}: id repetido`)
    ids.add(op.id)
    if (op.papel && !['operador', 'controlador'].includes(op.papel)) problemas.push(`operação ${op.id}: papel "${op.papel}" deve ser operador ou controlador`)
    if (op.prazo && !(op.prazo.guarda && op.prazo.base && op.prazo.descarte)) problemas.push(`operação ${op.id}: prazo precisa de guarda, base e descarte`)
    for (const t of op.tabelas ?? []) {
      if (vistas.has(t)) problemas.push(`tabela ${t} está em duas operações: ${vistas.get(t)} e ${op.id}`)
      vistas.set(t, op.id)
    }
  }
  for (const t of tabelasBanco) {
    if (!vistas.has(t)) problemas.push(`tabela ${t} não está em nenhuma operação do inventário (docs/regulatorio/inventario/operacoes.json)`)
  }
  for (const t of vistas.keys()) {
    if (!tabelasBanco.has(t) && !fora.has(t)) problemas.push(`tabela ${t} está no inventário, mas não existe nas migrations`)
  }
  return problemas
}

const lista = (itens) => itens.map((i) => `- ${i}`).join('\n')

/** Documento legível para o advogado e o cliente. Determinístico: mesma entrada, mesmo texto. */
export function gerarDocumento(inventario) {
  const ops = inventario.operacoes
  const total = ops.reduce((n, op) => n + op.tabelas.length, 0)
  const partes = [
    '# LG4: inventário das operações de tratamento',
    '',
    `<!-- Gerado por scripts/inventario-lgpd.mjs a partir de docs/regulatorio/inventario/operacoes.json. Não edite à mão: edite o JSON e rode \`node scripts/inventario-lgpd.mjs\`. -->`,
    '',
    `Versão ${inventario.versao}. ${inventario.aviso}`,
    '',
    `${ops.length} operações cobrem ${total} tabelas.`,
    '',
    '## Papéis',
    '',
    `- **Operador:** ${inventario.papeis.operador}`,
    `- **Controlador:** ${inventario.papeis.controlador}`,
    '',
    '## Medidas de segurança comuns a todas as operações',
    '',
    lista(inventario.seguranca_comum),
    '',
    '## Resumo',
    '',
    '| Operação | Papel | Dado sensível | Prazo de guarda | Tabelas |',
    '|---|---|---|---|---|',
    ...ops.map((op) => `| ${op.nome} | ${op.papel} | ${op.sensivel ? 'sim' : 'não'} | ${op.prazo.guarda} | ${op.tabelas.length} |`),
    '',
    '## Operações',
  ]
  for (const op of ops) {
    partes.push(
      '',
      `### ${op.nome}`,
      '',
      `\`${op.id}\` · papel da Chefe Coruja: **${op.papel}** · dado sensível: **${op.sensivel ? 'sim' : 'não'}**`,
      '',
      `**Finalidade.** ${op.finalidade}`,
      '',
      '**Base legal (LGPD)**',
      lista(op.base_legal),
      '',
      '**Titulares**',
      lista(op.titulares),
      '',
      '**Dados**',
      lista(op.dados),
      '',
      '**Quem acessa**',
      lista(op.acesso),
      '',
      '**Onde fica**',
      lista(op.local),
      '',
      `**Prazo.** ${op.prazo.guarda} (${op.prazo.base}). Descarte: ${op.prazo.descarte}.`,
    )
    if (op.seguranca?.length) partes.push('', '**Medidas próprias**', lista(op.seguranca))
    partes.push('', `**Tabelas (${op.tabelas.length})**`, '', op.tabelas.map((t) => `\`${t}\``).join(', '))
  }
  if (inventario.fora_das_migrations?.tabelas?.length) {
    partes.push('', '## Fora das migrations', '', `${inventario.fora_das_migrations.motivo} Tabelas: ${inventario.fora_das_migrations.tabelas.map((t) => `\`${t}\``).join(', ')}.`)
  }
  return partes.join('\n') + '\n'
}

// Guarda automática de 20 anos (Fase 0, tarefa 8 do BACKLOG.md; Lei
// 13.787/2018, art. 6º; ADR 0004). Roda sozinha no servidor (container agendado
// pelo systemd; ver infra/guarda/) — o mesmo que guarda:exportar + guarda:enviar,
// sem ninguém digitar senha:
//
//   1. exporta o banco (pg_dump, conta guarda_leitura: só lê) e os anexos do
//      Storage (protocolo S3 da Supabase, chave só de Storage);
//   2. monta o MANIFESTO (sha256 de cada arquivo);
//   3. cifra cada arquivo no servidor (AES-256-GCM; a chave da guarda vai
//      envelopada com a chave PÚBLICA do responsável — o servidor não abre o que
//      cifrou) e confere a cifra antes de enviar;
//   4. envia ao cofre (S3 sa-east-1, Object Lock em conformidade por 20 anos) e
//      confere checksum e trava de cada objeto; o índice cifrado vai por último;
//   5. apaga a cópia sem cifra (sempre, mesmo com erro) e registra o resultado
//      em <estado>/historico.jsonl e <estado>/ultima.json (sem dado de paciente);
//   6. falhou? manda e-mail ao responsável.
//
//   --vigiar         só confere se a última guarda com sucesso tem menos de
//                    GUARDA_VIGIA_HORAS (36 h); senão, manda e-mail
//   --testar-alerta  manda um e-mail de teste
//
// Configuração só pelo ambiente (infra/guarda/guarda.env.example). O script
// não imprime credencial nem dado de paciente.
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { assinar, baixar, cifrar2, consultar, decifrar2, digitalDaChave, enviar, novaChaveEnvelopada, sha256 } from './cofre.mjs'

const env = process.env
const modo = process.argv.includes('--vigiar') ? 'vigiar' : process.argv.includes('--testar-alerta') ? 'testar-alerta' : 'guarda'
const ESTADO = env.GUARDA_ESTADO ?? '/estado'
const exigir = (n) => { if (!env[n]) throw new Error(`falta a variável ${n}`); return env[n] }
const local = (host) => /^(127\.0\.0\.1|localhost|host\.docker\.internal)(:\d+)?$/.test(host ?? '')

// ── alerta por e-mail (Resend) ──────────────────────────────────────────────
async function alertar(assunto, texto) {
  if (!env.RESEND_API_KEY || !env.GUARDA_ALERTA_PARA || !env.GUARDA_ALERTA_DE) {
    console.error('[guarda] alerta NÃO enviado: faltam RESEND_API_KEY, GUARDA_ALERTA_PARA ou GUARDA_ALERTA_DE')
    return false
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.GUARDA_ALERTA_DE, to: env.GUARDA_ALERTA_PARA.split(',').map((x) => x.trim()), subject: assunto, text: texto }),
  })
  if (!r.ok) console.error(`[guarda] alerta falhou: HTTP ${r.status}`)
  return r.ok
}

function lerUltima() {
  try { return JSON.parse(readFileSync(join(ESTADO, 'ultima.json'), 'utf8')) } catch { return null }
}

if (modo === 'testar-alerta') {
  const ok = await alertar('[Chefe Coruja] Guarda: teste de alerta', 'Teste do alerta da guarda automática. Nada a fazer.')
  console.log(ok ? '✔ e-mail de teste enviado' : '✖ e-mail de teste não saiu')
  process.exit(ok ? 0 : 1)
}

if (modo === 'vigiar') {
  const horas = Number(env.GUARDA_VIGIA_HORAS ?? 36)
  const u = lerUltima()
  const idadeH = u?.sucesso_em ? (Date.now() - Date.parse(u.sucesso_em)) / 36e5 : Infinity
  if (idadeH > horas) {
    const quando = u?.sucesso_em ? `a última com sucesso foi em ${u.sucesso_em}` : 'nenhuma guarda com sucesso registrada'
    await alertar('[Chefe Coruja] Guarda ATRASADA', `A guarda automática está há mais de ${horas} h sem rodar com sucesso (${quando}).\nÚltimo erro: ${u?.ultimo_erro ?? '—'}\nConfira o servidor: systemctl status chefe-coruja-guarda.service`)
    console.error(`✖ guarda atrasada: ${quando}`)
    process.exit(1)
  }
  console.log(`✔ guarda em dia: última com sucesso há ${idadeH.toFixed(1)} h`)
  process.exit(0)
}

// ── guarda ──────────────────────────────────────────────────────────────────
const inicio = new Date()
const prefixo = 'auto-' + inicio.toISOString().slice(0, 16).replace(/-/g, '').replace('T', '-').replace(':', '')   // auto-20261006-0330 (UTC)
const tmp = mkdtempSync(join(env.GUARDA_TMP ?? '/tmp', 'guarda-'))
mkdirSync(ESTADO, { recursive: true })

function registrar(resultado) {
  const anterior = lerUltima() ?? {}
  const ultima = resultado.ok
    ? { ...anterior, sucesso_em: resultado.fim, prefixo: resultado.prefixo, objetos: resultado.objetos, bytes: resultado.bytes, ultimo_erro: null }
    : { ...anterior, falha_em: resultado.fim, ultimo_erro: resultado.erro }
  writeFileSync(join(ESTADO, 'ultima.json'), JSON.stringify(ultima, null, 2))
  appendFileSync(join(ESTADO, 'historico.jsonl'), JSON.stringify(resultado) + '\n')
}

try {
  const chavePublica = readFileSync(exigir('GUARDA_CHAVE_PUBLICA'), 'utf8')
  const cofre = {
    bucket: exigir('GUARDA_BUCKET'),
    regiao: env.GUARDA_REGIAO ?? 'sa-east-1',
    host: env.GUARDA_S3_HOST,
    protocolo: env.GUARDA_S3_PROTOCOLO,
    caminhoBase: env.GUARDA_S3_CAMINHO,
    cred: { id: exigir('AWS_ACCESS_KEY_ID'), segredo: exigir('AWS_SECRET_ACCESS_KEY') },
  }
  // sem trava só num cofre local de teste — nunca na nuvem
  const semTrava = env.GUARDA_SEM_TRAVA === '1'
  if (semTrava && !local(cofre.host)) throw new Error('GUARDA_SEM_TRAVA só vale para cofre local de teste')

  // 1a. banco
  const pgDump = env.GUARDA_PG_DUMP ?? 'pg_dump'
  const schemas = (env.GUARDA_SCHEMAS ?? 'public,private,terminologia,auth,storage,supabase_migrations').split(',')
  execFileSync(pgDump, ['--format=custom', '--no-owner', '--no-privileges', ...schemas.flatMap((s) => ['-n', s.trim()]),
    '-f', join(tmp, 'banco.dump'), '--dbname', exigir('GUARDA_DB_URL')], { stdio: ['ignore', 'ignore', 'pipe'] })

  // 1b. anexos (lista pelo banco; arquivos pelo protocolo S3 do Storage)
  let storage = 'não exportado: defina GUARDA_STORAGE_S3_HOST e a chave S3 do Storage'
  if (env.GUARDA_STORAGE_S3_HOST) {
    const psql = env.GUARDA_PSQL ?? 'psql'
    const lista = execFileSync(psql, ['--dbname', exigir('GUARDA_DB_URL'), '-At', '-F', '\t', '-c',
      'SELECT bucket_id, name FROM storage.objects ORDER BY bucket_id, name'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\n').filter(Boolean).map((l) => l.split('\t'))
    const credStorage = { id: exigir('GUARDA_STORAGE_S3_ID'), segredo: exigir('GUARDA_STORAGE_S3_SEGREDO') }
    const base = (env.GUARDA_STORAGE_S3_CAMINHO ?? 'storage/v1/s3').replace(/^\/|\/$/g, '')
    for (const [bucket, nome] of lista) {
      const { url, cabecalhos } = assinar({
        metodo: 'GET', bucket, regiao: env.GUARDA_STORAGE_S3_REGIAO ?? 'sa-east-1', chaveObjeto: `${base}/${bucket}/${nome}`,
        host: env.GUARDA_STORAGE_S3_HOST, protocolo: env.GUARDA_STORAGE_S3_PROTOCOLO ?? 'https',
        corpoHash: 'UNSIGNED-PAYLOAD', cred: credStorage,
      })
      const r = await fetch(url, { headers: cabecalhos })
      if (!r.ok) throw new Error(`anexo ${bucket}/… não baixou: HTTP ${r.status}`)
      const alvo = join(tmp, 'storage', bucket, ...nome.split('/'))
      mkdirSync(dirname(alvo), { recursive: true })
      writeFileSync(alvo, Buffer.from(await r.arrayBuffer()))
    }
    storage = `${lista.length} arquivo(s)`
  }

  // 2. manifesto
  const todos = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? todos(join(d, n)) : [join(d, n)]))
  const arquivos = todos(tmp).map((c) => {
    const b = readFileSync(c)
    return { arquivo: relative(tmp, c).split(/[\\/]/).join('/'), bytes: b.length, sha256: sha256(b).toString('hex') }
  })
  const manifesto = { versao: 2, gerado_em: inicio.toISOString(), origem: 'guarda automática (produção)', storage, arquivos }
  writeFileSync(join(tmp, 'MANIFESTO.json'), JSON.stringify(manifesto, null, 2))

  // 3 e 4. cifra, confere, envia, consulta
  const { chave, envelope } = novaChaveEnvelopada(chavePublica)
  const limite = new Date(Date.now() + (20 * 365 - 2) * 864e5)
  async function subir(chaveObjeto, claro) {
    const cifrado = cifrar2(chave, envelope, claro)
    if (!decifrar2(chave, cifrado).equals(claro)) throw new Error(`a cifra de ${chaveObjeto} não confere`)
    const enviado = await enviar({ ...cofre, chaveObjeto, corpo: cifrado })
    const s3 = await consultar({ ...cofre, chaveObjeto })
    if (semTrava && !s3.checksum) {
      // cofre local de teste não devolve checksum: confere baixando
      if (!sha256(await baixar({ ...cofre, chaveObjeto })).equals(sha256(cifrado))) throw new Error(`${chaveObjeto}: conteúdo no cofre diferente do enviado`)
    } else if (s3.checksum !== enviado) {
      throw new Error(`${chaveObjeto}: checksum no cofre diferente do enviado`)
    }
    if (!semTrava) {
      if (s3.modo !== 'COMPLIANCE') throw new Error(`${chaveObjeto}: sem trava em conformidade (modo ${s3.modo ?? 'nenhum'})`)
      if (!s3.ate || new Date(s3.ate) < limite) throw new Error(`${chaveObjeto}: trava até ${s3.ate}, menos de 20 anos`)
    }
    return { checksum: enviado, ate: s3.ate, bytes: cifrado.length }
  }
  const objetos = []
  const itens = [...arquivos.map((a) => a.arquivo), 'MANIFESTO.json']
  for (const [i, arquivo] of itens.entries()) {
    const chaveObjeto = `${prefixo}/${String(i + 1).padStart(5, '0')}.ccg`
    const claro = readFileSync(join(tmp, ...arquivo.split('/')))
    objetos.push({ objeto: chaveObjeto, arquivo, sha256_claro: sha256(claro).toString('hex'), ...(await subir(chaveObjeto, claro)) })
  }
  const indice = {
    versao: 2, enviado_em: new Date().toISOString(), bucket: cofre.bucket, regiao: cofre.regiao, prefixo,
    chave_publica: digitalDaChave(chavePublica), manifesto, objetos,
  }
  const ri = await subir(`${prefixo}/indice.ccg`, Buffer.from(JSON.stringify(indice, null, 2)))

  const resultado = {
    ok: true, inicio: inicio.toISOString(), fim: new Date().toISOString(), prefixo,
    objetos: objetos.length + 1, bytes: objetos.reduce((s, o) => s + o.bytes, 0) + ri.bytes,
    travado_ate: ri.ate, storage, chave_publica: indice.chave_publica,
  }
  registrar(resultado)
  console.log(`✔ guarda ${prefixo}: ${resultado.objetos} objeto(s), ${resultado.bytes} bytes cifrados, travados até ${ri.ate?.slice(0, 10) ?? '— (cofre local de teste)'}`)
} catch (e) {
  const erro = String(e?.message ?? e).replace(/postgres(ql)?:\/\/[^\s]+/g, 'postgres://***')   // nunca vaza a URL com senha
  registrar({ ok: false, inicio: inicio.toISOString(), fim: new Date().toISOString(), prefixo, erro })
  console.error(`✖ guarda falhou: ${erro}`)
  await alertar('[Chefe Coruja] Guarda FALHOU', `A guarda automática ${prefixo} falhou.\n\nErro: ${erro}\n\nNada foi apagado do cofre. A próxima tentativa roda no horário agendado; confira o servidor (journalctl -u chefe-coruja-guarda.service).`)
  process.exitCode = 1
} finally {
  if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true })   // cópia sem cifra não fica no disco
}

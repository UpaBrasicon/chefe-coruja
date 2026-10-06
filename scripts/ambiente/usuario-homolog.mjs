// Usuário de teste da HOMOLOGAÇÃO (Fase 0, tarefa 2).
//
// O "Add user" do painel é barrado pela regra de cadastro só por convite
// (20261003000009) — correto, é a mesma proteção da produção. Para o operador
// ter conta de teste, este comando monta um SQL que cria o usuário como
// administrador do banco (app_metadata.origem = 'admin') e o promove a super
// admin. Ele pede a senha sem mostrar na tela, calcula o hash bcrypt no
// Postgres local (Docker, mesma função crypt do Supabase) e copia o SQL para a
// área de transferência: a senha em texto não vai para o painel nem para o
// histórico do SQL Editor, só o hash.
//
// Uso: npm run homolog:usuario -- teste.homolog@chefecoruja.com.br
// Depois: SQL Editor da homologação → New query → Ctrl+V → Run.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import readline from 'node:readline'

const CONTAINER = 'supabase_db_chefe-coruja'
const EMAIL_OK = /^[^\s@']+@[^\s@']+\.[^\s@']+$/

/** Hash bcrypt pelo Postgres local; a senha vai pelo stdin, nunca por argumento. */
export function hashBcrypt(senha) {
  const tag = `s${randomBytes(6).toString('hex')}`
  if (senha.includes(`$${tag}$`)) throw new Error('senha incompatível com o delimitador; tente de novo')
  const sql = `SELECT extensions.crypt($${tag}$${senha}$${tag}$, extensions.gen_salt('bf'));\n`
  const r = spawnSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1'], { input: sql })
  const hash = (r.stdout?.toString() ?? '').trim()
  if (r.status !== 0 || !/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(hash)) {
    throw new Error('não consegui calcular o hash no Postgres local (o Docker Desktop está aberto e o Supabase local de pé?)')
  }
  return hash
}

/** SQL de criação; recusa banco que não seja a homologação. */
export function sqlUsuario(email, hash, nome = 'Teste Homologação') {
  if (!EMAIL_OK.test(email)) throw new Error('e-mail inválido')
  const lit = (s) => `'${String(s).replace(/'/g, "''")}'`
  return `-- Usuário de teste da homologação (gerado por scripts/ambiente/usuario-homolog.mjs).
-- Só o hash bcrypt da senha está aqui. Rodar no SQL Editor do projeto kswurfyxxvfydpjfrivy.
DO $$
DECLARE
  v_email text := ${lit(email)};
  v_hash  text := ${lit(hash)};
  v_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizacoes WHERE id = '30000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco não é a homologação. Confira a URL do painel.';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(v_email)) THEN
    RAISE EXCEPTION 'Já existe usuário com o e-mail %', v_email;
  END IF;
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, v_hash, now(),
    '{"provider":"email","providers":["email"],"origem":"admin"}', jsonb_build_object('nome_completo', ${lit(nome)}),
    now(), now(), '', '', '', '');
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  INSERT INTO public.super_admins (perfil_id) VALUES (v_id) ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Usuário de homologação criado: %', v_email;
END $$;
`
}

function perguntarOculto(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let mudo = false
    rl._writeToOutput = (s) => { if (!mudo) rl.output.write(s) }
    rl.question(pergunta, (resp) => { rl.output.write('\n'); rl.close(); resolve(resp) })
    mudo = true
  })
}

async function principal() {
  const email = (process.argv[2] ?? '').trim()
  if (!EMAIL_OK.test(email)) {
    console.error('Uso: npm run homolog:usuario -- seu.email@exemplo.com')
    return 1
  }
  const s1 = await perguntarOculto('Senha (não aparece na tela): ')
  const s2 = await perguntarOculto('Repita a senha: ')
  if (s1 !== s2) { console.error('As senhas não conferem.'); return 1 }
  if (s1.length < 8) { console.error('Use ao menos 8 caracteres.'); return 1 }
  const sql = sqlUsuario(email, hashBcrypt(s1))
  const r = spawnSync('clip', { input: Buffer.from(sql, 'utf16le') })
  if (r.status !== 0) { console.error('Não consegui copiar para a área de transferência.'); return 1 }
  console.log(`SQL copiado (só o hash da senha). Agora: SQL Editor da homologação → New query → Ctrl+V → Run.`)
  console.log(`Depois entre em https://homolog.chefecoruja.com.br com ${email}.`)
  return 0
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/usuario-homolog.mjs')) {
  principal().then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1) })
}

"""SQL que cria os usuários carga-* na HOMOLOGAÇÃO pelo banco.

A API de admin do Auth não cria conta: a regra de cadastro só por convite
(private.primeiro_acesso_estacionar) recusa a conta que o supabase_auth_admin
insere sem convite, porque o app_metadata.origem = 'admin' só chega depois do
INSERT. É a mesma proteção da produção. Como em scripts/ambiente/usuario-homolog.mjs,
a conta nasce como administrador do banco, com origem = 'admin'.

A senha (LOADTEST_SENHA) entra pelo stdin e sai só como hash bcrypt no SQL.
Rodar o SQL na homologação (npx supabase db query --linked -f arquivo.sql) e
depois o setup/criar_massa.mjs, que acha as contas prontas e segue.

Uso: python setup/usuarios_sql.py < senha > usuarios.sql   (pede: pip install bcrypt)
"""
import sys

import bcrypt

# Mesmo plano do criar_massa.mjs.
PLANO = {'plantonista': 40, 'enfermeiro': 15, 'gestor': 3, 'recepcao': 6}


def principal() -> int:
    senha = sys.stdin.readline().rstrip('\r\n')
    if len(senha) < 12:
        print('Senha curta ou vazia no stdin.', file=sys.stderr)
        return 1
    hash_ = bcrypt.hashpw(senha.encode(), bcrypt.gensalt(prefix=b'2a')).decode()
    linhas = []
    for papel, n in PLANO.items():
        for i in range(1, n + 1):
            num = f'{i:02d}'
            linhas.append(f"('carga-{papel}-{num}@loadtest.invalid', '{papel}', 'CARGA {papel} {num}')")
    valores = ',\n    '.join(linhas)
    sys.stdout.write(f"""-- Usuários carga-* do teste de carga (gerado por loadtest/setup/usuarios_sql.py).
-- Só o hash bcrypt da senha está aqui. Idempotente: quem já existe fica como está.
DO $$
DECLARE
  v_hash text := '{hash_}';
  r record;
  v_id uuid;
BEGIN
  IF (SELECT valor FROM public.configuracao_plataforma WHERE chave = 'ambiente_teste') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'A marca ambiente_teste não está ligada: este banco não é a homologação.';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    {valores}
  ) AS u(email, papel, nome) LOOP
    IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(r.email)) THEN
      CONTINUE;
    END IF;
    v_id := gen_random_uuid();
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', r.email, v_hash, now(),
      '{{"provider":"email","providers":["email"],"origem":"admin"}}',
      jsonb_build_object('loadtest', true, 'papel', r.papel, 'nome_completo', r.nome),
      now(), now(), '', '', '', '');
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', r.email, 'email_verified', true), 'email', now(), now(), now());
  END LOOP;
END $$;
SELECT count(*) AS usuarios_carga FROM auth.users WHERE email LIKE 'carga-%@loadtest.invalid';
""")
    return 0


if __name__ == '__main__':
    sys.exit(principal())

-- ════════════════════════════════════════════════════════════════════════════
-- Fase 0, tarefa 1 do BACKLOG.md — 2FA obrigatório de verdade no servidor.
--
-- Diagnóstico (05/10/2026): o portão do 2FA segurava a TELA, as policies
-- restritivas das 39 tabelas de paciente e ~200 RPCs que chamam
-- private.exigir_segundo_fator(). Mas ~150 RPCs SECURITY DEFINER (passam por
-- cima da RLS) não chamavam — abrir_prontuario, admissao_ficha,
-- painel_atendimento_ps, mapa_leitos_gestor, gerar_convite... Com a senha e
-- sem o segundo fator, a API entregava prontuário. O Storage (anexos do
-- prontuário) também não exigia.
--
-- Decisões do responsável (05/10/2026):
--   1. 2FA para todo papel com acesso a dado de paciente e para administração
--      — na prática, todo usuário logado.
--   2. 10 códigos de recuperação, cada um de uso único.
--   3. Zerar o 2FA de alguém: só o gestor da unidade da pessoa ou o super
--      admin, com registro de quem fez.
--
-- O que muda:
--   a) public.portao_requisicao(): roda antes de TODA requisição à API
--      (pgrst.db_pre_request). Usuário logado sem 2FA válido não chama RPC
--      nenhuma (fora a lista curta do próprio fluxo) e não grava em tabela.
--      Leitura de tabela continua com a RLS (as de paciente já têm a policy
--      restritiva); a casca precisa ler perfil/vínculos para chegar ao portão.
--      Vale também para RPC nova: a regra não depende de cada função lembrar.
--   b) Storage: policy restritiva — sem 2FA válido, nenhum arquivo.
--   c) Códigos de recuperação (hash; mostrados uma vez; uso único; bloqueio
--      depois de 5 erros em 15 min).
--   d) private.zerar_segundo_fator via public.zerar_segundo_fator (gestor da
--      unidade da pessoa ou super admin; motivo obrigatório; nunca o próprio).
--   e) Registro de eventos do 2FA (private.segundo_fator_eventos) e, no reset,
--      também na trilha encadeada (log_auditoria).
--
-- Chave mestra continua `exigir_segundo_fator` (configuracao_plataforma):
-- desligada, private.segundo_fator_ok() é verdadeiro e nada disso barra.
--
-- ROLLBACK (manual, nesta ordem):
--   ALTER ROLE authenticator RESET pgrst.db_pre_request; NOTIFY pgrst, 'reload config';
--   DROP POLICY IF EXISTS storage_segundo_fator ON storage.objects;
--   DROP TRIGGER IF EXISTS segundo_fator_evento_totp ON auth.mfa_factors;
--   DROP TRIGGER IF EXISTS segundo_fator_evento_dispositivo ON public.dispositivos_confiaveis;
--   DROP FUNCTION IF EXISTS public.portao_requisicao(), public.gerar_codigos_recuperacao(),
--     public.usar_codigo_recuperacao(text), public.codigos_recuperacao_status(),
--     public.zerar_segundo_fator(uuid, text), private.registrar_evento_segundo_fator(uuid, text, uuid, text),
--     private.evento_totp(), private.evento_dispositivo();
--   (as tabelas private.segundo_fator_* novas podem ficar: não são lidas por mais nada)
-- ════════════════════════════════════════════════════════════════════════════

-- ── e) Registro de eventos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.segundo_fator_eventos (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL,
  evento     text NOT NULL CHECK (evento IN (
               'totp_ativado', 'totp_removido', 'dispositivo_confiado', 'dispositivo_removido',
               'codigos_gerados', 'codigo_recuperacao_usado', 'codigo_recuperacao_errado',
               'codigo_recuperacao_bloqueado', 'zerado')),
  autor_id   uuid,            -- quem fez (no reset, o gestor/super admin)
  motivo     text,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS segundo_fator_eventos_user ON private.segundo_fator_eventos (user_id, criado_em DESC);
REVOKE ALL ON private.segundo_fator_eventos FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.registrar_evento_segundo_fator(p_user uuid, p_evento text, p_autor uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO private.segundo_fator_eventos (user_id, evento, autor_id, motivo)
  VALUES (p_user, p_evento, p_autor, p_motivo);
$$;
REVOKE ALL ON FUNCTION private.registrar_evento_segundo_fator(uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- Autenticador ativado/removido. O Auth grava sem JWT de usuário: o autor é o
-- próprio dono do fator. Nunca registra a linha inteira (ela tem o segredo TOTP).
CREATE OR REPLACE FUNCTION private.evento_totp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'verified' THEN
      PERFORM private.registrar_evento_segundo_fator(OLD.user_id, 'totp_removido', coalesce(auth.uid(), OLD.user_id));
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.status = 'verified' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'verified') THEN
    PERFORM private.registrar_evento_segundo_fator(NEW.user_id, 'totp_ativado', NEW.user_id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS segundo_fator_evento_totp ON auth.mfa_factors;
CREATE TRIGGER segundo_fator_evento_totp
  AFTER INSERT OR UPDATE OF status OR DELETE ON auth.mfa_factors
  FOR EACH ROW EXECUTE FUNCTION private.evento_totp();

CREATE OR REPLACE FUNCTION private.evento_dispositivo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.registrar_evento_segundo_fator(OLD.user_id, 'dispositivo_removido', coalesce(auth.uid(), OLD.user_id));
    RETURN OLD;
  END IF;
  PERFORM private.registrar_evento_segundo_fator(NEW.user_id, 'dispositivo_confiado', NEW.user_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS segundo_fator_evento_dispositivo ON public.dispositivos_confiaveis;
CREATE TRIGGER segundo_fator_evento_dispositivo
  AFTER INSERT OR DELETE ON public.dispositivos_confiaveis
  FOR EACH ROW EXECUTE FUNCTION private.evento_dispositivo();

-- ── a) Portão antes de toda requisição à API ────────────────────────────────
-- RPCs que precisam funcionar ANTES do segundo fator: o próprio fluxo de
-- confirmação, convite (conta nova ainda sem 2FA), relógio e registro de erro
-- da tela. Nada aqui devolve dado de paciente.
CREATE OR REPLACE FUNCTION public.portao_requisicao()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caminho text;
  v_metodo  text;
BEGIN
  IF coalesce(auth.jwt()->>'role', '') <> 'authenticated' THEN
    RETURN;                                   -- anon (painel da TV) e service_role: fora
  END IF;
  IF private.segundo_fator_ok() THEN
    RETURN;                                   -- chave desligada ou 2FA válido
  END IF;
  v_caminho := coalesce(current_setting('request.path', true), '');
  v_metodo  := upper(coalesce(current_setting('request.method', true), ''));
  IF v_caminho LIKE '/rpc/%' THEN
    IF split_part(substr(v_caminho, 6), '?', 1) IN (
         'segundo_fator_status', 'segundo_fator_tentativas',
         'verificar_codigo_2fa', 'verificar_dispositivo_2fa', 'herdar_segundo_fator',
         'usar_codigo_recuperacao',
         'conferir_convite', 'aceitar_convite',
         'horario_servidor', 'data_atual', 'registrar_erro_cliente') THEN
      RETURN;
    END IF;
  ELSIF v_metodo IN ('GET', 'HEAD', 'OPTIONS') THEN
    RETURN;                                   -- leitura de tabela: decide a RLS
  END IF;
  RAISE EXCEPTION 'SEGUNDO_FATOR: confirme o código do segundo fator para continuar.'
    USING ERRCODE = 'insufficient_privilege';
END; $$;
REVOKE ALL ON FUNCTION public.portao_requisicao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portao_requisicao() TO anon, authenticated, service_role;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.portao_requisicao';
NOTIFY pgrst, 'reload config';

-- ── b) Storage: sem 2FA válido, nenhum arquivo ──────────────────────────────
-- Restritiva: soma-se (AND) às policies de cada bucket; só aperta. O painel
-- da TV lê buckets públicos pela URL pública, que não passa por aqui.
DROP POLICY IF EXISTS storage_segundo_fator ON storage.objects;
CREATE POLICY storage_segundo_fator ON storage.objects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok())
  WITH CHECK (private.segundo_fator_ok());

-- ── c) Códigos de recuperação ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.segundo_fator_recuperacao (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL,
  codigo_hash text NOT NULL,          -- sha256 do código normalizado; nunca o código
  gerado_em   timestamptz NOT NULL DEFAULT now(),
  usado_em    timestamptz
);
CREATE INDEX IF NOT EXISTS segundo_fator_recuperacao_user ON private.segundo_fator_recuperacao (user_id);
REVOKE ALL ON private.segundo_fator_recuperacao FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.segundo_fator_recuperacao_falhas (
  user_id        uuid PRIMARY KEY,
  falhas         int NOT NULL DEFAULT 0,
  primeira_falha timestamptz NOT NULL DEFAULT now(),
  bloqueado_ate  timestamptz
);
REVOKE ALL ON private.segundo_fator_recuperacao_falhas FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.hash_codigo_recuperacao(p_codigo text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(extensions.digest(upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
$$;
REVOKE ALL ON FUNCTION private.hash_codigo_recuperacao(text) FROM PUBLIC, anon, authenticated;

-- Gera 10 códigos novos (anula os anteriores) e devolve em claro UMA vez.
-- Exige 2FA válido: quem só tem a senha não fabrica códigos.
CREATE OR REPLACE FUNCTION public.gerar_codigos_recuperacao()
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- sem 0/O, 1/I/L
  v_codigos text[] := '{}';
  v_bytes bytea;
  v_codigo text;
  i int; j int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NOT private.segundo_fator_valido() THEN
    RAISE EXCEPTION 'SEGUNDO_FATOR: confirme o código do segundo fator para gerar os códigos de recuperação.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM private.segundo_fator_recuperacao WHERE user_id = v_uid;
  FOR i IN 1..10 LOOP
    v_bytes := extensions.gen_random_bytes(8);
    v_codigo := '';
    FOR j IN 0..7 LOOP
      v_codigo := v_codigo || substr(v_alfabeto, 1 + (get_byte(v_bytes, j) % length(v_alfabeto)), 1);
    END LOOP;
    v_codigo := substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4);
    INSERT INTO private.segundo_fator_recuperacao (user_id, codigo_hash)
    VALUES (v_uid, private.hash_codigo_recuperacao(v_codigo));
    v_codigos := v_codigos || v_codigo;
  END LOOP;
  DELETE FROM private.segundo_fator_recuperacao_falhas WHERE user_id = v_uid;
  PERFORM private.registrar_evento_segundo_fator(v_uid, 'codigos_gerados', v_uid);
  RETURN v_codigos;
END; $$;

CREATE OR REPLACE FUNCTION public.codigos_recuperacao_status()
RETURNS TABLE (restantes int, gerados_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT count(*) FILTER (WHERE r.usado_em IS NULL)::int, max(r.gerado_em)
    FROM private.segundo_fator_recuperacao r
   WHERE r.user_id = auth.uid();
$$;

-- Usa um código: marca ESTA sessão como confirmada (como o código por email).
-- Não levanta erro em código errado — o erro desfaria a contagem de falhas.
CREATE OR REPLACE FUNCTION public.usar_codigo_recuperacao(p_codigo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sessao uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  v_max constant int := 5;
  v_janela constant interval := interval '15 minutes';
  f private.segundo_fator_recuperacao_falhas%ROWTYPE;
  v_id bigint;
BEGIN
  IF v_uid IS NULL OR v_sessao IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'sessao');
  END IF;

  SELECT * INTO f FROM private.segundo_fator_recuperacao_falhas WHERE user_id = v_uid FOR UPDATE;
  IF f.bloqueado_ate > now() THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'bloqueado_ate', f.bloqueado_ate);
  END IF;

  UPDATE private.segundo_fator_recuperacao r
     SET usado_em = now()
   WHERE r.id = (SELECT r2.id FROM private.segundo_fator_recuperacao r2
                  WHERE r2.user_id = v_uid AND r2.usado_em IS NULL
                    AND r2.codigo_hash = private.hash_codigo_recuperacao(p_codigo)
                  LIMIT 1 FOR UPDATE)
  RETURNING r.id INTO v_id;

  IF v_id IS NULL THEN
    INSERT INTO private.segundo_fator_recuperacao_falhas AS x (user_id, falhas, primeira_falha)
    VALUES (v_uid, 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET falhas = CASE WHEN x.primeira_falha < now() - v_janela OR x.bloqueado_ate IS NOT NULL THEN 1 ELSE x.falhas + 1 END,
          primeira_falha = CASE WHEN x.primeira_falha < now() - v_janela OR x.bloqueado_ate IS NOT NULL THEN now() ELSE x.primeira_falha END,
          bloqueado_ate = NULL
    RETURNING * INTO f;
    IF f.falhas >= v_max THEN
      UPDATE private.segundo_fator_recuperacao_falhas SET bloqueado_ate = now() + v_janela WHERE user_id = v_uid
      RETURNING * INTO f;
      PERFORM private.registrar_evento_segundo_fator(v_uid, 'codigo_recuperacao_bloqueado', v_uid);
      RETURN jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'bloqueado_ate', f.bloqueado_ate);
    END IF;
    PERFORM private.registrar_evento_segundo_fator(v_uid, 'codigo_recuperacao_errado', v_uid);
    RETURN jsonb_build_object('ok', false, 'motivo', 'invalido', 'restantes', v_max - f.falhas);
  END IF;

  DELETE FROM private.segundo_fator_recuperacao_falhas WHERE user_id = v_uid;
  INSERT INTO private.segundo_fator_sessao_ok (session_id, user_id, verificado_em)
  VALUES (v_sessao, v_uid, now())
  ON CONFLICT (session_id) DO UPDATE SET verificado_em = excluded.verificado_em, user_id = excluded.user_id;
  PERFORM private.registrar_evento_segundo_fator(v_uid, 'codigo_recuperacao_usado', v_uid);
  RETURN jsonb_build_object('ok', true,
    'codigos_restantes', (SELECT count(*) FROM private.segundo_fator_recuperacao
                           WHERE user_id = v_uid AND usado_em IS NULL));
END; $$;

-- ── d) Zerar o 2FA de alguém (perdeu o celular / o email) ───────────────────
-- Só o gestor (ou admin) de uma unidade onde a pessoa tem vínculo ativo, ou o
-- super admin. Super admin só é zerado por outro super admin. Nunca o próprio.
-- Apaga autenticador, aparelhos confiáveis, códigos e confirmações, e derruba
-- as sessões: a pessoa entra de novo e confirma pelo email.
CREATE OR REPLACE FUNCTION public.zerar_segundo_fator(p_usuario uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_autor uuid := auth.uid();
  v_unidade uuid;
BEGIN
  IF v_autor IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = 'insufficient_privilege'; END IF;
  PERFORM private.exigir_segundo_fator();
  IF p_usuario IS NULL OR p_usuario = v_autor THEN
    RAISE EXCEPTION 'Não é possível zerar o próprio segundo fator.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(trim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Escreva o motivo (mínimo 10 caracteres).' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (SELECT 1 FROM public.super_admins s WHERE s.perfil_id = p_usuario) THEN
    IF NOT private.eh_super_admin() THEN
      RAISE EXCEPTION 'Só um super admin zera o segundo fator de outro super admin.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NOT private.eh_super_admin() THEN
    SELECT v.unidade_id INTO v_unidade
      FROM public.vinculos v
     WHERE v.perfil_id = p_usuario AND v.ativo
       AND private.papel_na_unidade(v.unidade_id) IN ('gestor', 'admin')
     LIMIT 1;
    IF v_unidade IS NULL THEN
      RAISE EXCEPTION 'Só o gestor da unidade da pessoa ou o super admin pode zerar o segundo fator.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  DELETE FROM auth.mfa_factors WHERE user_id = p_usuario;
  DELETE FROM public.dispositivos_confiaveis WHERE user_id = p_usuario;
  DELETE FROM private.segundo_fator_recuperacao WHERE user_id = p_usuario;
  DELETE FROM private.segundo_fator_recuperacao_falhas WHERE user_id = p_usuario;
  DELETE FROM private.segundo_fator_sessao_ok WHERE user_id = p_usuario;
  DELETE FROM private.segundo_fator_email_codigo WHERE user_id = p_usuario;
  DELETE FROM private.segundo_fator_tentativas WHERE user_id = p_usuario;
  DELETE FROM auth.sessions WHERE user_id = p_usuario;          -- refresh tokens caem em cascata

  PERFORM private.registrar_evento_segundo_fator(p_usuario, 'zerado', v_autor, trim(p_motivo));
  PERFORM private.registrar_auditoria('segundo_fator_zerado', 'segundo_fator', p_usuario, v_unidade,
                                      jsonb_build_object('perfil_id', p_usuario));
END; $$;

REVOKE ALL ON FUNCTION public.gerar_codigos_recuperacao(), public.codigos_recuperacao_status(),
  public.usar_codigo_recuperacao(text), public.zerar_segundo_fator(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_codigos_recuperacao(), public.codigos_recuperacao_status(),
  public.usar_codigo_recuperacao(text), public.zerar_segundo_fator(uuid, text) TO authenticated;

-- ── Tela do gestor: equipe da unidade e o estado do 2FA de cada um ──────────
-- Só o que o gestor precisa para decidir um reset: tem autenticador? quantos
-- códigos restam? quando foi o último reset? Nada de segredo.
CREATE OR REPLACE FUNCTION public.equipe_segundo_fator(p_unidade uuid)
RETURNS TABLE (perfil_id uuid, nome text, email text, papeis text[], tem_autenticador boolean,
               codigos_restantes int, zerado_em timestamptz, super_admin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT coalesce(private.sou_gestor_da_unidade(p_unidade), false) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT p.id, p.nome_completo, p.email,
         array_agg(DISTINCT v.papel::text ORDER BY v.papel::text),
         EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = p.id AND f.status = 'verified'),
         (SELECT count(*)::int FROM private.segundo_fator_recuperacao r WHERE r.user_id = p.id AND r.usado_em IS NULL),
         (SELECT max(e.criado_em) FROM private.segundo_fator_eventos e WHERE e.user_id = p.id AND e.evento = 'zerado'),
         EXISTS (SELECT 1 FROM public.super_admins s WHERE s.perfil_id = p.id)
    FROM public.vinculos v
    JOIN public.perfis p ON p.id = v.perfil_id
   WHERE v.unidade_id = p_unidade AND v.ativo
   GROUP BY p.id, p.nome_completo, p.email
   ORDER BY p.nome_completo;
END; $$;
REVOKE ALL ON FUNCTION public.equipe_segundo_fator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equipe_segundo_fator(uuid) TO authenticated;

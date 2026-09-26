-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — auditoria que não se altera (ADR 0004; SBIS NGS1.07 e NGS1.09).
--
-- Antes: log_auditoria era tabela comum; a RLS protegia a LEITURA, não a
-- adulteração, e o payload aceitava qualquer JSON escolhido pelo chamador.
--
-- Agora:
--   · só inserção — UPDATE, DELETE e TRUNCATE são recusados por gatilho
--     (também em log_acesso_prontuario);
--   · cada linha guarda o hash da anterior (cadeia); verificar_cadeia_auditoria
--     aponta a primeira linha adulterada;
--   · created_at é sempre now() do servidor (UTC no banco), nunca do cliente;
--   · payload com lista fechada de chaves e só valores escalares — objeto
--     aninhado vira a lista dos NOMES dos campos, sem os valores.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Colunas da cadeia ────────────────────────────────────────────────────
ALTER TABLE public.log_auditoria
  ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY,
  ADD COLUMN IF NOT EXISTS hash_anterior text,
  ADD COLUMN IF NOT EXISTS hash text;

CREATE UNIQUE INDEX IF NOT EXISTS log_auditoria_seq ON public.log_auditoria (seq);

CREATE OR REPLACE FUNCTION private.hash_auditoria(
  p_anterior text, p_ator uuid, p_acao text, p_entidade text, p_entidade_id uuid,
  p_unidade uuid, p_payload jsonb, p_quando timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT encode(extensions.digest(
    concat_ws('|', coalesce(p_anterior, 'genesis'), p_ator, p_acao, p_entidade, p_entidade_id,
              p_unidade, coalesce(p_payload, '{}'::jsonb)::text,
              to_char(p_quando AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
    'sha256'), 'hex');
$$;

-- ── 2. Cadeia para as linhas que já existem (antes de travar o UPDATE) ─────
DO $$
DECLARE r record; v_ant text := NULL;
BEGIN
  FOR r IN SELECT * FROM public.log_auditoria ORDER BY created_at, id LOOP
    UPDATE public.log_auditoria
    SET hash_anterior = v_ant,
        hash = private.hash_auditoria(v_ant, r.ator_id, r.acao, r.entidade, r.entidade_id, r.unidade_id, r.payload, r.created_at)
    WHERE id = r.id
    RETURNING hash INTO v_ant;
  END LOOP;
END $$;

-- ── 3. Inserção: hora do servidor e elo da cadeia ──────────────────────────
CREATE OR REPLACE FUNCTION private.auditoria_encadear()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ant text;
BEGIN
  -- Serializa as inserções: sem isso, duas gravações simultâneas leriam o
  -- mesmo "último hash" e a cadeia bifurcaria.
  PERFORM pg_advisory_xact_lock(hashtext('public.log_auditoria'));
  NEW.created_at := now();
  SELECT l.hash INTO v_ant FROM public.log_auditoria l ORDER BY l.seq DESC LIMIT 1;
  NEW.hash_anterior := v_ant;
  NEW.hash := private.hash_auditoria(v_ant, NEW.ator_id, NEW.acao, NEW.entidade, NEW.entidade_id,
                                     NEW.unidade_id, NEW.payload, NEW.created_at);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auditoria_encadear ON public.log_auditoria;
CREATE TRIGGER trg_auditoria_encadear
  BEFORE INSERT ON public.log_auditoria
  FOR EACH ROW EXECUTE FUNCTION private.auditoria_encadear();

-- ── 4. Só inserção ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.recusar_alteracao_de_registro()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION '% é só-inserção: registro de auditoria não se altera nem se apaga.', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END; $$;

DROP TRIGGER IF EXISTS trg_auditoria_so_insercao ON public.log_auditoria;
CREATE TRIGGER trg_auditoria_so_insercao
  BEFORE UPDATE OR DELETE ON public.log_auditoria
  FOR EACH ROW EXECUTE FUNCTION private.recusar_alteracao_de_registro();
DROP TRIGGER IF EXISTS trg_auditoria_sem_truncate ON public.log_auditoria;
CREATE TRIGGER trg_auditoria_sem_truncate
  BEFORE TRUNCATE ON public.log_auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION private.recusar_alteracao_de_registro();

DROP TRIGGER IF EXISTS trg_acesso_so_insercao ON public.log_acesso_prontuario;
CREATE TRIGGER trg_acesso_so_insercao
  BEFORE UPDATE OR DELETE ON public.log_acesso_prontuario
  FOR EACH ROW EXECUTE FUNCTION private.recusar_alteracao_de_registro();
DROP TRIGGER IF EXISTS trg_acesso_sem_truncate ON public.log_acesso_prontuario;
CREATE TRIGGER trg_acesso_sem_truncate
  BEFORE TRUNCATE ON public.log_acesso_prontuario
  FOR EACH STATEMENT EXECUTE FUNCTION private.recusar_alteracao_de_registro();

-- ── 5. Verificação da cadeia ────────────────────────────────────────────────
-- Devolve a primeira linha cujo hash não confere (NULL = cadeia íntegra).
CREATE OR REPLACE FUNCTION private.verificar_cadeia_auditoria()
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; v_ant text := NULL;
BEGIN
  FOR r IN SELECT * FROM public.log_auditoria ORDER BY seq LOOP
    IF r.hash_anterior IS DISTINCT FROM v_ant
       OR r.hash IS DISTINCT FROM private.hash_auditoria(v_ant, r.ator_id, r.acao, r.entidade, r.entidade_id,
                                                         r.unidade_id, r.payload, r.created_at) THEN
      RETURN r.seq;
    END IF;
    v_ant := r.hash;
  END LOOP;
  RETURN NULL;
END; $$;

-- ── 6. Payload com lista fechada ────────────────────────────────────────────
-- Escalares das chaves permitidas passam; objeto/array aninhado vira a lista
-- dos nomes de campo ("campos_alterados"); o resto sai. `nome` só para
-- entidades de estrutura (setor, leito, banner, unidade) — nunca de pessoa.
CREATE OR REPLACE FUNCTION private.payload_auditoria(p_entidade text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_saida jsonb := '{}'::jsonb;
  k text; v jsonb;
  permitidas text[] := ARRAY['perfil_id','papel','setor_id','leito_id','unidade_id','quantidade','prefixo',
                             'tipo','status','destinatario','conversa','ordem','ativo','limite','motivo_codigo'];
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RETURN NULL; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(p_payload) LOOP
    IF jsonb_typeof(v) IN ('object', 'array') THEN
      IF jsonb_typeof(v) = 'object' THEN
        v_saida := v_saida || jsonb_build_object('campos_alterados', (SELECT jsonb_agg(x ORDER BY x) FROM jsonb_object_keys(v) x));
      END IF;
    ELSIF k = ANY (permitidas)
       OR (k = 'nome' AND p_entidade IN ('setores', 'leitos', 'banners', 'unidades')) THEN
      v_saida := v_saida || jsonb_build_object(k, v);
    END IF;
  END LOOP;
  RETURN v_saida;
END; $$;

CREATE OR REPLACE FUNCTION private.registrar_auditoria(p_acao text, p_entidade text, p_entidade_id uuid DEFAULT NULL,
  p_unidade_id uuid DEFAULT NULL, p_payload jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.log_auditoria (ator_id, acao, entidade, entidade_id, unidade_id, payload)
  VALUES (private.meu_perfil_id(), p_acao, p_entidade, p_entidade_id, p_unidade_id,
          private.payload_auditoria(p_entidade, p_payload))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

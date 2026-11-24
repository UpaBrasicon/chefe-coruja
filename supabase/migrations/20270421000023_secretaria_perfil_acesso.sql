-- ════════════════════════════════════════════════════════════════════════════
-- Perfil Secretaria (pedido do RT, 24/11/2026). Parte 2 de 2: quem é da
-- secretaria e o que pode nas unidades dela.
--
-- "A secretaria é designada pelo administrador e ele escolhe as unidades que
-- a compreendem." "Quem tem login como perfil de secretaria consegue editar
-- tudo, desde quantidade de médicos a leitos em cada unidade." "As pessoas:
-- quem atualiza é o gestor de cada unidade ou o gestor geral da secretaria."
--
-- Expand (só adiciona ou estende, idempotente):
-- 1. public.secretaria_pessoas: a pessoa ligada à secretaria (não a uma
--    unidade). O administrador designa pelo e-mail: com conta e e-mail
--    confirmado, vale na hora; sem conta, fica pendente até a pessoa entrar
--    com aquele e-mail confirmado (minhas_secretarias). RLS: lê o super admin,
--    o administrador da organização e a própria pessoa; ninguém grava direto.
-- 2. 'gestor_secretaria' (parte 1) nunca entra em vínculo nem em convite.
-- 3. private.secretaria_gere_unidade(u): a pessoa é da secretaria ativa a que
--    a unidade está ligada. Entra nas checagens abaixo, sempre somada (OR) à
--    regra que já existia; quem já podia continua podendo.
-- 4. Leitura e escrita da configuração, sem paciente:
--    • membro_da_unidade passa a valer para a secretaria da unidade. É o
--      mesmo alcance que o administrador da organização já tem nela (leitura
--      de setores, leitos, limites, grade, críticas da AIH; auditoria);
--    • pode_gerir_convites também: a secretaria convida pessoas para as
--      unidades dela, como o gestor (gestor e administrador seguem fora do
--      convite);
--    • políticas novas (permissivas, somadas às do gestor): unidades
--      (ler e as colunas que a Configuração já grava), setores e leitos
--      (criar, mudar, excluir), valores de plantão;
--    • RPCs estendidas (corpo anterior tirado da homologação com
--      pg_get_functiondef, no rollback): CNES, endereço, pulseira, limites e
--      alvos da unidade, bloquear e desbloquear leito, escala do mês, lista
--      de profissionais, marcar e retirar vaga, publicar a escala.
--    Não entra: telas e funções com paciente (gestor_da_unidade e
--    sou_gestor_da_unidade seguem iguais), montar plantão com nome
--    (adicionar_plantao_escala), grade de aprazamento e críticas da AIH
--    (seguem do gestor).
-- 5. Árvore da rede: private.rede_arvore_json monta a mesma árvore para o
--    administrador (admin_rede_arvore, agora com quem é da secretaria) e para
--    a secretaria (rede_arvore_da_secretaria, só as secretarias dela).
-- 6. RPCs do administrador para as pessoas da secretaria:
--    admin_secretaria_pessoas, admin_designar_secretaria e
--    admin_retirar_secretaria (segundo fator e auditoria).
--
-- Teste: supabase/tests/secretaria_perfil.sql
-- Rollback: docs/rede/ROLLBACK-20270421000022.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. pessoas da secretaria ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.secretaria_pessoas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id  uuid NOT NULL REFERENCES public.secretarias(id),
  -- e-mail da designação, sempre em minúsculas
  email          text NOT NULL CHECK (email = lower(btrim(email)) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- nulo = designação pendente (a pessoa ainda não entrou com esse e-mail)
  perfil_id      uuid REFERENCES public.perfis(id),
  ativo          boolean NOT NULL DEFAULT true,
  designado_por  uuid NOT NULL REFERENCES public.perfis(id),
  designado_em   timestamptz NOT NULL DEFAULT now(),
  aceito_em      timestamptz,
  retirado_por   uuid REFERENCES public.perfis(id),
  retirado_em    timestamptz,
  CONSTRAINT secretaria_pessoas_email_key UNIQUE (secretaria_id, email)
);
CREATE INDEX IF NOT EXISTS secretaria_pessoas_perfil_idx ON public.secretaria_pessoas (perfil_id) WHERE perfil_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS secretaria_pessoas_pendente_idx ON public.secretaria_pessoas (email) WHERE perfil_id IS NULL;

ALTER TABLE public.secretaria_pessoas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.secretaria_pessoas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.secretaria_pessoas TO authenticated;

-- apoio das políticas (SECURITY DEFINER: uma política não consulta a tabela
-- da outra, senão secretarias e secretaria_pessoas entram em laço)
CREATE OR REPLACE FUNCTION private.minhas_secretarias_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT sp.secretaria_id FROM public.secretaria_pessoas sp
   WHERE sp.perfil_id = private.meu_perfil_id() AND sp.ativo
$$;
REVOKE ALL ON FUNCTION private.minhas_secretarias_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.minhas_secretarias_ids() TO authenticated;

CREATE OR REPLACE FUNCTION private.admin_da_secretaria(p_secretaria uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.eh_super_admin() OR EXISTS (
    SELECT 1 FROM public.secretarias s WHERE s.id = p_secretaria AND private.eh_admin_da_organizacao(s.organizacao_id)), false)
$$;
REVOKE ALL ON FUNCTION private.admin_da_secretaria(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_da_secretaria(uuid) TO authenticated;

DROP POLICY IF EXISTS secretaria_pessoas_select ON public.secretaria_pessoas;
CREATE POLICY secretaria_pessoas_select ON public.secretaria_pessoas FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id() OR private.admin_da_secretaria(secretaria_id));

-- ── 2. o perfil novo não vira vínculo nem convite ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vinculos_sem_perfil_secretaria') THEN
    ALTER TABLE public.vinculos ADD CONSTRAINT vinculos_sem_perfil_secretaria CHECK (papel::text <> 'gestor_secretaria');
  END IF;
  IF to_regclass('public.convites') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'convites' AND column_name = 'papel')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'convites_sem_perfil_secretaria') THEN
    ALTER TABLE public.convites ADD CONSTRAINT convites_sem_perfil_secretaria CHECK (papel::text <> 'gestor_secretaria');
  END IF;
END $$;

-- ── 3. a secretaria da unidade ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.unidades_da_minha_secretaria()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.id
    FROM public.secretaria_pessoas sp
    JOIN public.secretarias s ON s.id = sp.secretaria_id AND s.ativo
    JOIN public.unidades u ON u.secretaria_id = s.id AND u.organizacao_id = s.organizacao_id
   WHERE sp.perfil_id = private.meu_perfil_id() AND sp.ativo
$$;
REVOKE ALL ON FUNCTION private.unidades_da_minha_secretaria() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.unidades_da_minha_secretaria() TO authenticated;

CREATE OR REPLACE FUNCTION private.secretaria_gere_unidade(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_unidade IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.secretaria_pessoas sp
      JOIN public.secretarias s ON s.id = sp.secretaria_id AND s.ativo
      JOIN public.unidades u ON u.secretaria_id = s.id AND u.organizacao_id = s.organizacao_id
     WHERE u.id = p_unidade AND sp.perfil_id = private.meu_perfil_id() AND sp.ativo)
$$;
REVOKE ALL ON FUNCTION private.secretaria_gere_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.secretaria_gere_unidade(uuid) TO authenticated;

-- ── 4a. políticas novas (somadas às que já existem) ───────────────────────
-- a pessoa da secretaria lê a própria secretaria
DROP POLICY IF EXISTS secretarias_pessoa_select ON public.secretarias;
CREATE POLICY secretarias_pessoa_select ON public.secretarias FOR SELECT TO authenticated
  USING (id IN (SELECT private.minhas_secretarias_ids()));

-- unidades: ler e gravar as colunas que a Configuração já grava (a coluna
-- secretaria_id e as demais seguem sem UPDATE para authenticated)
DROP POLICY IF EXISTS unidades_secretaria_select ON public.unidades;
CREATE POLICY unidades_secretaria_select ON public.unidades FOR SELECT TO authenticated
  USING (private.secretaria_gere_unidade(id));
DROP POLICY IF EXISTS unidades_secretaria_update ON public.unidades;
CREATE POLICY unidades_secretaria_update ON public.unidades FOR UPDATE TO authenticated
  USING (private.secretaria_gere_unidade(id)) WITH CHECK (private.secretaria_gere_unidade(id));

-- setores (a leitura vem de setores_membro_select)
DROP POLICY IF EXISTS setores_secretaria_insert ON public.setores;
CREATE POLICY setores_secretaria_insert ON public.setores FOR INSERT TO authenticated
  WITH CHECK (private.secretaria_gere_unidade(unidade_id));
DROP POLICY IF EXISTS setores_secretaria_update ON public.setores;
CREATE POLICY setores_secretaria_update ON public.setores FOR UPDATE TO authenticated
  USING (private.secretaria_gere_unidade(unidade_id)) WITH CHECK (private.secretaria_gere_unidade(unidade_id));
DROP POLICY IF EXISTS setores_secretaria_delete ON public.setores;
CREATE POLICY setores_secretaria_delete ON public.setores FOR DELETE TO authenticated
  USING (private.secretaria_gere_unidade(unidade_id));

-- leitos (a leitura vem de leitos_membro_select)
DROP POLICY IF EXISTS leitos_secretaria_insert ON public.leitos;
CREATE POLICY leitos_secretaria_insert ON public.leitos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.setores s WHERE s.id = leitos.setor_id AND private.secretaria_gere_unidade(s.unidade_id)));
DROP POLICY IF EXISTS leitos_secretaria_update ON public.leitos;
CREATE POLICY leitos_secretaria_update ON public.leitos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.setores s WHERE s.id = leitos.setor_id AND private.secretaria_gere_unidade(s.unidade_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.setores s WHERE s.id = leitos.setor_id AND private.secretaria_gere_unidade(s.unidade_id)));
DROP POLICY IF EXISTS leitos_secretaria_delete ON public.leitos;
CREATE POLICY leitos_secretaria_delete ON public.leitos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.setores s WHERE s.id = leitos.setor_id AND private.secretaria_gere_unidade(s.unidade_id)));

-- valores de plantão (Configuração da unidade)
DROP POLICY IF EXISTS remuneracoes_secretaria_select ON public.remuneracoes_plantao;
CREATE POLICY remuneracoes_secretaria_select ON public.remuneracoes_plantao FOR SELECT TO authenticated
  USING (private.secretaria_gere_unidade(unidade_id));
DROP POLICY IF EXISTS remuneracoes_secretaria_insert ON public.remuneracoes_plantao;
CREATE POLICY remuneracoes_secretaria_insert ON public.remuneracoes_plantao FOR INSERT TO authenticated
  WITH CHECK (private.secretaria_gere_unidade(unidade_id));
DROP POLICY IF EXISTS remuneracoes_secretaria_update ON public.remuneracoes_plantao;
CREATE POLICY remuneracoes_secretaria_update ON public.remuneracoes_plantao FOR UPDATE TO authenticated
  USING (private.secretaria_gere_unidade(unidade_id)) WITH CHECK (private.secretaria_gere_unidade(unidade_id));

-- ── 5. árvore da rede ─────────────────────────────────────────────────────
-- p_secretarias nulo = a árvore inteira das organizações (administrador);
-- preenchido = só essas secretarias e as unidades ligadas a elas.
CREATE OR REPLACE FUNCTION private.rede_arvore_json(p_orgs uuid[], p_secretarias uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id,
    'nome', o.nome,
    'secretarias', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'nome', s.nome, 'esfera', s.esfera, 'municipio', s.municipio, 'uf', s.uf,
        'cnpj', s.cnpj, 'responsavel', s.responsavel, 'telefone', s.telefone, 'email', s.email,
        'endereco', s.endereco, 'ativo', s.ativo, 'atualizado_em', s.atualizado_em,
        -- quem é da secretaria (perfil Secretaria); pendente = ainda não entrou
        'gestao', coalesce((
          SELECT jsonb_agg(jsonb_build_object('nome', coalesce(p.nome_completo, sp.email), 'pendente', sp.perfil_id IS NULL)
                           ORDER BY coalesce(p.nome_completo, sp.email))
            FROM public.secretaria_pessoas sp LEFT JOIN public.perfis p ON p.id = sp.perfil_id
           WHERE sp.secretaria_id = s.id AND sp.ativo), '[]'::jsonb)
      ) ORDER BY s.ativo DESC, s.nome)
      FROM public.secretarias s
     WHERE s.organizacao_id = o.id AND (p_secretarias IS NULL OR s.id = ANY (p_secretarias))), '[]'::jsonb),
    'unidades', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id, 'nome', u.nome, 'tipo', u.tipo, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf,
        'endereco', u.endereco, 'whatsapp', u.whatsapp_numero, 'ativo', u.ativo,
        'secretaria_id', u.secretaria_id,
        'ramo_rede', u.ramo_rede,
        'ramo', coalesce(u.ramo_rede, CASE WHEN cr.unidade_id IS NOT NULL THEN 'central_regulacao' ELSE u.tipo::text END),
        'eh_central', cr.unidade_id IS NOT NULL,
        'eh_sede_rede', rm.secretaria_unidade_id IS NOT NULL,
        -- pessoas: vínculos ativos por papel e o nome de quem gere a unidade
        'pessoas', coalesce((
          SELECT jsonb_object_agg(x.papel, x.n) FROM (
            SELECT v.papel::text AS papel, count(*) AS n FROM public.vinculos v
             WHERE v.unidade_id = u.id AND v.ativo GROUP BY v.papel) x), '{}'::jsonb),
        'gestores', coalesce((
          SELECT jsonb_agg(p.nome_completo ORDER BY p.nome_completo)
            FROM public.vinculos v JOIN public.perfis p ON p.id = v.perfil_id
           WHERE v.unidade_id = u.id AND v.ativo AND v.papel = 'gestor'), '[]'::jsonb)
      ) ORDER BY u.nome)
      FROM public.unidades u
      LEFT JOIN public.centrais_regulacao cr ON cr.unidade_id = u.id AND cr.organizacao_id = u.organizacao_id
      LEFT JOIN public.rede_modulo rm ON rm.secretaria_unidade_id = u.id
     WHERE u.organizacao_id = o.id AND (p_secretarias IS NULL OR u.secretaria_id = ANY (p_secretarias))), '[]'::jsonb)
  ) ORDER BY o.nome), '[]'::jsonb)
  FROM public.organizacoes o
 WHERE o.ativo AND o.id = ANY (p_orgs)
$$;
REVOKE ALL ON FUNCTION private.rede_arvore_json(uuid[], uuid[]) FROM PUBLIC, anon, authenticated;

-- administrador: a mesma resposta de antes, agora com "gestao" em cada secretaria
CREATE OR REPLACE FUNCTION public.admin_rede_arvore()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_super boolean := private.eh_super_admin();
BEGIN
  IF private.meu_perfil_id() IS NULL
     OR NOT (v_super OR EXISTS (SELECT 1 FROM private.orgs_admin())) THEN
    RAISE EXCEPTION 'A rede é do administrador.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN private.rede_arvore_json(
    ARRAY(SELECT o.id FROM public.organizacoes o WHERE v_super OR o.id IN (SELECT private.orgs_admin())), NULL);
END $$;
REVOKE ALL ON FUNCTION public.admin_rede_arvore() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rede_arvore() TO authenticated;

-- perfil Secretaria: só as secretarias da pessoa e as unidades delas
CREATE OR REPLACE FUNCTION public.rede_arvore_da_secretaria()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_sec uuid[];
BEGIN
  SELECT array_agg(DISTINCT sp.secretaria_id) INTO v_sec
    FROM public.secretaria_pessoas sp
    JOIN public.secretarias s ON s.id = sp.secretaria_id AND s.ativo
   WHERE sp.perfil_id = private.meu_perfil_id() AND sp.ativo;
  IF private.meu_perfil_id() IS NULL OR v_sec IS NULL THEN
    RAISE EXCEPTION 'A rede da secretaria é de quem o administrador designou para ela.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN private.rede_arvore_json(
    ARRAY(SELECT DISTINCT s.organizacao_id FROM public.secretarias s WHERE s.id = ANY (v_sec)), v_sec);
END $$;
REVOKE ALL ON FUNCTION public.rede_arvore_da_secretaria() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rede_arvore_da_secretaria() TO authenticated;

-- ── 6. pessoas da secretaria (administrador) ──────────────────────────────
CREATE OR REPLACE FUNCTION private.exigir_admin_da_secretaria(p_secretaria uuid)
RETURNS public.secretarias LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.secretarias;
BEGIN
  SELECT * INTO s FROM public.secretarias WHERE id = p_secretaria;
  IF NOT FOUND OR NOT (private.eh_super_admin() OR private.eh_admin_da_organizacao(s.organizacao_id)) THEN
    RAISE EXCEPTION 'Quem designa as pessoas da secretaria é o administrador da rede.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN s;
END $$;
REVOKE ALL ON FUNCTION private.exigir_admin_da_secretaria(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_secretaria_pessoas(p_secretaria uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_admin_da_secretaria(p_secretaria);
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', sp.id, 'email', sp.email, 'nome', p.nome_completo, 'ativo', sp.ativo,
      'pendente', sp.perfil_id IS NULL, 'designado_em', sp.designado_em, 'aceito_em', sp.aceito_em
    ) ORDER BY sp.ativo DESC, coalesce(p.nome_completo, sp.email))
    FROM public.secretaria_pessoas sp LEFT JOIN public.perfis p ON p.id = sp.perfil_id
   WHERE sp.secretaria_id = p_secretaria), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.admin_secretaria_pessoas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_secretaria_pessoas(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_designar_secretaria(p_secretaria uuid, p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.secretarias;
  v_email text := lower(nullif(btrim(p_email), ''));
  v_perfil uuid;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  s := private.exigir_admin_da_secretaria(p_secretaria);
  IF NOT s.ativo THEN RAISE EXCEPTION 'A secretaria está inativa.'; END IF;
  IF v_email IS NULL OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'E-mail inválido.';
  END IF;
  -- conta com esse e-mail já confirmado vale na hora; sem conta, fica pendente
  SELECT u.id INTO v_perfil
    FROM auth.users u JOIN public.perfis p ON p.id = u.id
   WHERE lower(u.email) = v_email AND u.email_confirmed_at IS NOT NULL
   LIMIT 1;

  INSERT INTO public.secretaria_pessoas AS sp (secretaria_id, email, perfil_id, ativo, designado_por, aceito_em)
  VALUES (s.id, v_email, v_perfil, true, private.meu_perfil_id(), CASE WHEN v_perfil IS NOT NULL THEN now() END)
  ON CONFLICT (secretaria_id, email) DO UPDATE
     SET ativo = true,
         perfil_id = coalesce(sp.perfil_id, EXCLUDED.perfil_id),
         aceito_em = coalesce(sp.aceito_em, EXCLUDED.aceito_em),
         designado_por = EXCLUDED.designado_por, designado_em = now(),
         retirado_por = NULL, retirado_em = NULL
  RETURNING sp.id, sp.perfil_id INTO v_id, v_perfil;

  PERFORM private.registrar_auditoria('secretaria_pessoa_designada', 'secretaria_pessoas', v_id, NULL,
    jsonb_build_object('status', CASE WHEN v_perfil IS NULL THEN 'pendente' ELSE 'ativa' END));
  RETURN jsonb_build_object('id', v_id, 'pendente', v_perfil IS NULL);
END $$;
REVOKE ALL ON FUNCTION public.admin_designar_secretaria(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_designar_secretaria(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_retirar_secretaria(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.secretaria_pessoas;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.secretaria_pessoas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Designação não encontrada.'; END IF;
  PERFORM private.exigir_admin_da_secretaria(r.secretaria_id);
  IF NOT r.ativo THEN RETURN; END IF;
  UPDATE public.secretaria_pessoas
     SET ativo = false, retirado_por = private.meu_perfil_id(), retirado_em = now()
   WHERE id = r.id;
  PERFORM private.registrar_auditoria('secretaria_pessoa_retirada', 'secretaria_pessoas', r.id, NULL,
    jsonb_build_object('status', 'retirada'));
END $$;
REVOKE ALL ON FUNCTION public.admin_retirar_secretaria(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retirar_secretaria(uuid) TO authenticated;

-- ── 7. as secretarias da pessoa (casca do app) ─────────────────────────────
-- Conclui a designação pendente quando a pessoa entra com o e-mail confirmado
-- e devolve as secretarias dela com as unidades ativas de cada uma.
CREATE OR REPLACE FUNCTION public.minhas_secretarias()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_email text;
  v_ids uuid[];
  v_id uuid;
BEGIN
  IF v_eu IS NULL OR NOT EXISTS (SELECT 1 FROM public.perfis WHERE id = v_eu) THEN RETURN '[]'::jsonb; END IF;
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_eu AND u.email_confirmed_at IS NOT NULL;
  IF v_email IS NOT NULL THEN
    WITH a AS (
      UPDATE public.secretaria_pessoas SET perfil_id = v_eu, aceito_em = now()
       WHERE perfil_id IS NULL AND ativo AND email = v_email
      RETURNING id)
    SELECT array_agg(id) INTO v_ids FROM a;
    IF v_ids IS NOT NULL THEN
      FOREACH v_id IN ARRAY v_ids LOOP
        PERFORM private.registrar_auditoria('secretaria_pessoa_aceita', 'secretaria_pessoas', v_id, NULL,
          jsonb_build_object('status', 'ativa'));
      END LOOP;
    END IF;
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'nome', s.nome, 'organizacao_id', s.organizacao_id,
      'unidades', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'tipo', u.tipo,
                                            'organizacao_id', u.organizacao_id, 'usa_pulseira', u.usa_pulseira)
                         ORDER BY u.nome)
          FROM public.unidades u
         WHERE u.secretaria_id = s.id AND u.organizacao_id = s.organizacao_id AND u.ativo), '[]'::jsonb)
    ) ORDER BY s.nome)
    FROM public.secretarias s
   WHERE s.ativo AND EXISTS (SELECT 1 FROM public.secretaria_pessoas sp
                              WHERE sp.secretaria_id = s.id AND sp.perfil_id = v_eu AND sp.ativo)), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.minhas_secretarias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_secretarias() TO authenticated;

-- ── 8. funções que passam a aceitar a secretaria da unidade ───────────────
-- Corpo igual ao da homologação em 24/11/2026; só a checagem ganha
-- "OR private.secretaria_gere_unidade(...)". Os GRANTs ficam (CREATE OR
-- REPLACE não mexe neles).

-- bloquear_leito(uuid,text,text)
CREATE OR REPLACE FUNCTION public.bloquear_leito(p_leito uuid, p_motivo text, p_observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false) OR private.tenho_papel(r.unidade_id, 'enfermeiro') OR private.secretaria_gere_unidade(r.unidade_id)) THEN
    RAISE EXCEPTION 'Só o gestor, o enfermeiro ou a secretaria da unidade bloqueiam leito.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_motivo IS NULL OR p_motivo NOT IN ('manutencao', 'isolamento', 'falta_equipe', 'outro') THEN
    RAISE EXCEPTION 'Escolha o motivo do bloqueio.' USING ERRCODE = 'check_violation';
  END IF;
  IF p_motivo = 'outro' AND length(coalesce(v_obs, '')) < 5 THEN
    RAISE EXCEPTION 'Descreva o motivo do bloqueio.' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'bloqueado' WHERE id = p_leito;   -- a trava recusa ocupado
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'bloqueio', (r.leito).status, 'bloqueado', v_perfil,
          p_motivo || coalesce(': ' || v_obs, ''));
END; $function$;

-- definir_cnes_unidade(uuid,text)
CREATE OR REPLACE FUNCTION public.definir_cnes_unidade(p_unidade uuid, p_cnes text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v text := private.so_digitos(p_cnes); v_antes text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin() OR private.secretaria_gere_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'O CNES da unidade é preenchido pelo gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v IS NULL OR length(v) <> 7 THEN RAISE EXCEPTION 'CNES com 7 dígitos.'; END IF;
  IF EXISTS (SELECT 1 FROM public.unidades WHERE cnes = v AND id <> p_unidade) THEN
    RAISE EXCEPTION 'Este CNES já está em outra unidade.';
  END IF;
  SELECT cnes INTO v_antes FROM public.unidades WHERE id = p_unidade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  UPDATE public.unidades SET cnes = v, updated_at = now() WHERE id = p_unidade;
  PERFORM private.registrar_auditoria('cnes_unidade_definido', 'unidades', p_unidade, p_unidade,
    jsonb_build_object('antes', v_antes, 'depois', v));
  RETURN v;
END $function$;

-- definir_endereco_unidade(uuid,text)
CREATE OR REPLACE FUNCTION public.definir_endereco_unidade(p_unidade uuid, p_endereco text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin() OR private.secretaria_gere_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Só o gestor da unidade define o endereço' USING ERRCODE = '42501';
  END IF;
  IF p_endereco IS NOT NULL AND length(btrim(p_endereco)) NOT BETWEEN 5 AND 300 THEN
    RAISE EXCEPTION 'Endereço da unidade: de 5 a 300 caracteres';
  END IF;
  UPDATE public.unidades SET endereco = nullif(btrim(p_endereco), '') WHERE id = p_unidade;
  PERFORM private.registrar_auditoria('definir_endereco_unidade', 'unidades', p_unidade, p_unidade, NULL);
END $function$;

-- definir_pulseira_unidade(uuid,boolean)
CREATE OR REPLACE FUNCTION public.definir_pulseira_unidade(p_unidade uuid, p_usa boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_antes boolean; v_tipo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin() OR private.secretaria_gere_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Quem liga a pulseira da unidade é o gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_usa IS NULL THEN RAISE EXCEPTION 'Diga se a unidade usa pulseira.'; END IF;
  SELECT usa_pulseira, tipo INTO v_antes, v_tipo FROM public.unidades WHERE id = p_unidade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  IF p_usa AND v_tipo = 'ubs' THEN RAISE EXCEPTION 'A UBS não usa pulseira de identificação.'; END IF;
  UPDATE public.unidades SET usa_pulseira = p_usa, updated_at = now() WHERE id = p_unidade;
  PERFORM private.registrar_auditoria('pulseira_unidade_definida', 'unidades', p_unidade, p_unidade,
    jsonb_build_object('antes', v_antes, 'depois', p_usa));
  RETURN p_usa;
END $function$;

-- desbloquear_leito(uuid,text)
CREATE OR REPLACE FUNCTION public.desbloquear_leito(p_leito uuid, p_observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  r record;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM private.leito_da_unidade(p_leito);
  IF NOT (coalesce(private.sou_gestor_da_unidade(r.unidade_id), false) OR private.tenho_papel(r.unidade_id, 'enfermeiro') OR private.secretaria_gere_unidade(r.unidade_id)) THEN
    RAISE EXCEPTION 'Só o gestor, o enfermeiro ou a secretaria da unidade desbloqueiam leito.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (r.leito).status <> 'bloqueado' THEN
    RAISE EXCEPTION 'Leito % não está bloqueado.', (r.leito).identificador USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.leitos SET status = 'livre' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, autor_id, motivo)
  VALUES (p_leito, r.unidade_id, 'desbloqueio', 'bloqueado', 'livre', v_perfil,
          coalesce(nullif(btrim(coalesce(p_observacao, '')), ''), 'Desbloqueio'));
END; $function$;

-- escala_mes_gestor(uuid,integer,integer)
CREATE OR REPLACE FUNCTION public.escala_mes_gestor(p_unidade uuid, p_ano integer, p_mes integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ini date;
  v_fim date;
  v_pub public.escala_publicacoes;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT (private.gestor_da_unidade(p_unidade) OR private.secretaria_gere_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: escala do gestor da unidade.';
  END IF;
  IF p_mes NOT BETWEEN 1 AND 12 OR p_ano NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Mês inválido.'; END IF;
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  SELECT * INTO v_pub FROM public.escala_publicacoes
   WHERE unidade_id = p_unidade AND competencia = v_ini ORDER BY versao DESC LIMIT 1;
  RETURN jsonb_build_object(
    'setores', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'tipo', s.tipo) ORDER BY s.ordem, s.nome)
                           FROM public.setores s WHERE s.unidade_id = p_unidade AND s.ativo), '[]'::jsonb),
    -- categorias que a unidade escala (filtro da tela)
    'categorias', coalesce((SELECT jsonb_agg(c.papel ORDER BY c.papel)
                              FROM (SELECT DISTINCT v.papel FROM public.vinculos v
                                     WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel NOT IN ('admin', 'gestor')) c), '[]'::jsonb),
    'faixas', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                 'data', f.data, 'setor_id', f.setor_id, 'turno', f.turno, 'escalados', f.escalados,
                                 'previsto', f.previsto, 'vaga_id', f.vaga_id, 'vaga_obs', f.vaga_obs,
                                 'vagas', f.vagas, 'abertas', f.abertas,
                                 'situacao', CASE WHEN jsonb_array_length(f.abertas) > 0 THEN 'vaga'
                                                  WHEN jsonb_array_length(f.escalados) > 0 THEN 'coberto'
                                                  ELSE 'sem_plantao' END)
                               ORDER BY f.data, f.setor_id, f.turno)
                          FROM private.escala_faixas(p_unidade, v_ini, v_fim) f), '[]'::jsonb),
    'publicacao', CASE WHEN v_pub.id IS NULL THEN NULL ELSE jsonb_build_object(
       'versao', v_pub.versao, 'publicada_em', v_pub.publicada_em, 'plantoes', v_pub.plantoes, 'vagas', v_pub.vagas,
       'publicada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = v_pub.publicada_por),
       'alteracoes_depois', (SELECT count(*) FROM public.historico_escala h
                              WHERE h.unidade_id = p_unidade AND h.created_at > v_pub.publicada_em
                                AND h.acao IN ('criar', 'alterar', 'remover')
                                AND coalesce(h.dados -> 'depois' ->> 'data', h.dados -> 'antes' ->> 'data')::date BETWEEN v_ini AND v_fim)) END);
END
$function$;

-- marcar_vaga_escala(uuid,date,text,text,papel)
CREATE OR REPLACE FUNCTION public.marcar_vaga_escala(p_setor uuid, p_data date, p_turno text, p_observacao text DEFAULT NULL::text, p_papel papel DEFAULT NULL::papel)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_unidade uuid;
  v_setor_nome text;
  v_id uuid;
  v_perfil uuid;
  v_cat text := replace(coalesce(p_papel::text, 'plantonista'), '_', ' ');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, nome INTO v_unidade, v_setor_nome FROM public.setores WHERE id = p_setor AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  IF NOT (private.sou_gestor_da_unidade(v_unidade) OR private.secretaria_gere_unidade(v_unidade)) THEN RAISE EXCEPTION 'Só o gestor da unidade marca vaga na escala.'; END IF;
  IF private.turno_valido(v_unidade, p_turno) IS NOT TRUE THEN RAISE EXCEPTION 'Faixa inválida: escolha um turno ativo da unidade.'; END IF;
  IF p_data < private.data_atual() THEN RAISE EXCEPTION 'Não se marca vaga em dia que já passou.'; END IF;
  IF p_papel IN ('admin', 'gestor') THEN RAISE EXCEPTION 'Gestor e administrador não são categoria de plantão.'; END IF;
  -- já tem alguém da categoria na faixa (sem categoria: alguém de qualquer uma)
  IF EXISTS (SELECT 1 FROM private.escala_faixas(v_unidade, p_data, p_data) f, jsonb_array_elements(f.escalados) es
              WHERE f.setor_id = p_setor AND f.turno = p_turno
                AND (p_papel IS NULL OR es ->> 'papel' = p_papel::text)) THEN
    RAISE EXCEPTION 'Esta faixa já tem % escalado.', CASE WHEN p_papel IS NULL THEN 'alguém' ELSE v_cat END;
  END IF;
  SELECT id INTO v_id FROM public.escala_vagas
   WHERE setor_id = p_setor AND data = p_data AND turno = p_turno AND fechada_em IS NULL
     AND plantao_origem_id IS NULL AND papel IS NOT DISTINCT FROM p_papel;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;   -- já marcada: não duplica
  INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, observacao, aberta_por, papel)
  VALUES (v_unidade, p_setor, p_data, p_turno, nullif(btrim(p_observacao), ''), private.meu_perfil_id(), p_papel)
  RETURNING id INTO v_id;
  -- avisa quem tem o papel da vaga (a candidatura continua pela escala)
  FOR v_perfil IN SELECT DISTINCT v.perfil_id FROM public.vinculos v
                   WHERE v.unidade_id = v_unidade AND v.papel = coalesce(p_papel, 'plantonista') AND v.ativo LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (v_perfil, v_unidade, p_data, 'vaga_' || v_id,
            'Vaga aberta em ' || v_setor_nome || ' em ' || to_char(p_data, 'DD/MM') || ' ('
              || private.nome_do_turno(p_turno) || '). Candidate-se pela escala.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (v_unidade, private.meu_perfil_id(), 'marcar_vaga',
          v_setor_nome || ' · ' || to_char(p_data, 'DD/MM') || ' · ' || private.turno_no_texto(p_turno) || CASE WHEN p_papel IS NULL THEN '' ELSE ' · ' || v_cat END,
          jsonb_build_object('vaga_id', v_id, 'setor_id', p_setor, 'data', p_data, 'turno', p_turno, 'papel', p_papel));
  RETURN v_id;
END
$function$;

-- private.membro_da_unidade(uuid)
CREATE OR REPLACE FUNCTION private.membro_da_unidade(p_unidade uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(
       private.eh_super_admin()
    OR p_unidade IN (SELECT private.unidades_do_usuario())
    OR private.secretaria_gere_unidade(p_unidade)
    OR EXISTS (SELECT 1 FROM public.unidades u
               WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id)),
    false);
$function$;

-- private.pode_gerir_convites(uuid)
CREATE OR REPLACE FUNCTION private.pode_gerir_convites(p_unidade uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT private.eh_super_admin()
      OR EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = auth.uid() AND v.unidade_id = p_unidade
                    AND v.ativo AND v.papel = 'gestor')
      OR EXISTS (SELECT 1 FROM public.unidades u
                  WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id))
      OR private.secretaria_gere_unidade(p_unidade);
$function$;

-- profissionais_da_unidade(uuid)
CREATE OR REPLACE FUNCTION public.profissionais_da_unidade(p_unidade uuid)
 RETURNS TABLE(perfil_id uuid, nome_completo text, crm text, papel papel)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT (private.gestor_da_unidade(p_unidade) OR private.secretaria_gere_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade monta a escala.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT DISTINCT p.id, p.nome_completo, p.crm, v.papel
    FROM public.vinculos v
    JOIN public.perfis p ON p.id = v.perfil_id AND p.ativo
   WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel NOT IN ('admin', 'gestor')
   ORDER BY v.papel, p.nome_completo;
END;
$function$;

-- publicar_escala(uuid,integer,integer,text)
CREATE OR REPLACE FUNCTION public.publicar_escala(p_unidade uuid, p_ano integer, p_mes integer, p_observacao text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ini date;
  v_fim date;
  v_versao int;
  v_plantoes int;
  v_vagas int;
  v_perfil uuid;
  v_rotulo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.sou_gestor_da_unidade(p_unidade) OR private.secretaria_gere_unidade(p_unidade)) THEN RAISE EXCEPTION 'Só o gestor da unidade publica a escala.'; END IF;
  IF p_mes NOT BETWEEN 1 AND 12 OR p_ano NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Mês inválido.'; END IF;
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  IF v_fim < private.data_atual() THEN RAISE EXCEPTION 'Este mês já terminou: a escala dele não se publica mais.'; END IF;
  SELECT count(*) INTO v_plantoes FROM public.escala_plantao
   WHERE unidade_id = p_unidade AND ativo AND data BETWEEN v_ini AND v_fim;
  IF v_plantoes = 0 THEN RAISE EXCEPTION 'Não há plantão neste mês para publicar.'; END IF;
  SELECT coalesce(sum(jsonb_array_length(f.abertas)), 0) INTO v_vagas FROM private.escala_faixas(p_unidade, v_ini, v_fim) f;
  SELECT coalesce(max(versao), 0) + 1 INTO v_versao FROM public.escala_publicacoes
   WHERE unidade_id = p_unidade AND competencia = v_ini;
  INSERT INTO public.escala_publicacoes (unidade_id, competencia, versao, plantoes, vagas, observacao, publicada_por)
  VALUES (p_unidade, v_ini, v_versao, v_plantoes, v_vagas, nullif(btrim(p_observacao), ''), private.meu_perfil_id());
  v_rotulo := to_char(v_ini, 'MM/YYYY');
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (p_unidade, private.meu_perfil_id(), 'publicar',
          'Escala de ' || v_rotulo || ' publicada (versão ' || v_versao || ', ' || v_plantoes || ' plantões, ' || v_vagas || ' vagas abertas)',
          jsonb_build_object('competencia', v_ini, 'versao', v_versao, 'plantoes', v_plantoes, 'vagas', v_vagas));
  FOR v_perfil IN SELECT DISTINCT e.perfil_id FROM public.escala_plantao e
                   WHERE e.unidade_id = p_unidade AND e.ativo AND e.data BETWEEN v_ini AND v_fim LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (v_perfil, p_unidade, v_ini, 'escala_publicada_' || to_char(v_ini, 'YYYY_MM') || '_v' || v_versao,
            'A escala de ' || v_rotulo || ' foi publicada' || CASE WHEN v_versao > 1 THEN ' (versão ' || v_versao || ')' ELSE '' END
              || '. Confira seus plantões na agenda.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;
  PERFORM private.registrar_auditoria('publicar_escala', 'escala_publicacoes', NULL, p_unidade,
    jsonb_build_object('quantidade', v_plantoes, 'status', 'versao ' || v_versao));
  RETURN v_versao;
END
$function$;

-- retirar_vaga_escala(uuid)
CREATE OR REPLACE FUNCTION public.retirar_vaga_escala(p_vaga uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v public.escala_vagas;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO v FROM public.escala_vagas WHERE id = p_vaga FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Vaga não encontrada.'; END IF;
  IF NOT (private.sou_gestor_da_unidade(v.unidade_id) OR private.secretaria_gere_unidade(v.unidade_id)) THEN RAISE EXCEPTION 'Só o gestor da unidade retira vaga da escala.'; END IF;
  IF v.fechada_em IS NOT NULL THEN RETURN; END IF;
  UPDATE public.escala_vagas SET fechada_em = clock_timestamp(), fechada_por = private.meu_perfil_id() WHERE id = v.id;
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (v.unidade_id, private.meu_perfil_id(), 'retirar_vaga',
          (SELECT nome FROM public.setores WHERE id = v.setor_id) || ' · ' || to_char(v.data, 'DD/MM') || ' · ' || v.turno,
          jsonb_build_object('vaga_id', v.id, 'setor_id', v.setor_id, 'data', v.data, 'turno', v.turno));
END $function$;

-- salvar_alvo_triagem(uuid,integer)
CREATE OR REPLACE FUNCTION public.salvar_alvo_triagem(p_unidade uuid, p_minutos integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.gestor_da_unidade(p_unidade) OR private.secretaria_gere_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: o alvo da triagem é do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_minutos IS NULL OR p_minutos NOT BETWEEN 1 AND 240 THEN
    RAISE EXCEPTION 'Alvo da chegada à triagem entre 1 e 240 minutos.';
  END IF;
  INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
  VALUES (p_unidade, 'alvo_triagem_min', p_minutos::text, 'Tempo-alvo da chegada à triagem (classificação), em minutos')
  ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
  WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
  PERFORM private.registrar_auditoria('salvar_alvo_triagem', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('alvo_triagem_min', p_minutos));
  RETURN private.limites_unidade(p_unidade);
END $function$;

-- salvar_alvos_grade(uuid,jsonb)
CREATE OR REPLACE FUNCTION public.salvar_alvos_grade(p_unidade uuid, p_alvos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  k text;
  v int;
  v_desc jsonb := '{"exame": "Alvo da grade de ações: do pedido de exame ao resultado, em minutos",
                    "medicacao": "Alvo da grade de ações: da prescrição à checagem da medicação, em minutos",
                    "permanencia": "Alvo da grade de ações: tempo total no PS depois do médico, em minutos"}';
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.gestor_da_unidade(p_unidade) OR private.secretaria_gere_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: os alvos são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_alvos IS NULL OR jsonb_typeof(p_alvos) <> 'object' THEN
    RAISE EXCEPTION 'Informe os alvos da grade.';
  END IF;
  FOREACH k IN ARRAY ARRAY['exame', 'medicacao', 'permanencia'] LOOP
    IF NOT (p_alvos ? k) OR jsonb_typeof(p_alvos -> k) = 'null' THEN
      DELETE FROM public.configuracoes_unidade WHERE unidade_id = p_unidade AND chave = 'alvo_' || k || '_min';
      CONTINUE;
    END IF;
    IF jsonb_typeof(p_alvos -> k) <> 'number' THEN RAISE EXCEPTION 'Alvo de % deve ser um número de minutos.', k; END IF;
    v := (p_alvos ->> k)::numeric::int;
    IF v NOT BETWEEN 1 AND 1440 THEN RAISE EXCEPTION 'Alvo de % entre 1 e 1440 minutos.', k; END IF;
    INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
    VALUES (p_unidade, 'alvo_' || k || '_min', v::text, v_desc ->> k)
    ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
    WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
  END LOOP;
  PERFORM private.registrar_auditoria('salvar_alvos_grade', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('alvos', private.limites_unidade(p_unidade) -> 'alvos_grade'));
  RETURN private.limites_unidade(p_unidade);
END $function$;

-- salvar_alvos_medico(uuid,jsonb)
CREATE OR REPLACE FUNCTION public.salvar_alvos_medico(p_unidade uuid, p_alvos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_proto jsonb;
  c text;
  v int;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.gestor_da_unidade(p_unidade) OR private.secretaria_gere_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: os alvos são do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT coalesce((SELECT p.tempos FROM public.unidades u JOIN public.protocolos_classificacao p ON p.id = u.protocolo_classificacao_id
                    WHERE u.id = p_unidade), '{"vermelho": 0, "laranja": 10, "amarelo": 60, "verde": 120, "azul": 240}'::jsonb)
    INTO v_proto;
  FOREACH c IN ARRAY ARRAY['vermelho', 'laranja', 'amarelo', 'verde', 'azul'] LOOP
    IF p_alvos IS NULL OR NOT (p_alvos ? c) OR jsonb_typeof(p_alvos -> c) <> 'number' THEN
      RAISE EXCEPTION 'Informe o alvo da cor %.', c;
    END IF;
    v := (p_alvos ->> c)::numeric::int;
    IF v NOT BETWEEN 0 AND 1440 THEN RAISE EXCEPTION 'Alvo da cor % entre 0 e 1440 minutos.', c; END IF;
    IF v = coalesce((v_proto ->> c)::int, -1) THEN
      DELETE FROM public.configuracoes_unidade WHERE unidade_id = p_unidade AND chave = 'alvo_medico_' || c;
    ELSE
      INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
      VALUES (p_unidade, 'alvo_medico_' || c, v::text, 'Tempo-alvo da classificação ao médico, cor ' || c || ', em minutos')
      ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
      WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
    END IF;
  END LOOP;
  PERFORM private.registrar_auditoria('salvar_alvos_medico', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('alvos', private.tempos_alvo_unidade(p_unidade)));
  RETURN private.limites_unidade(p_unidade);
END $function$;

-- salvar_limites_unidade(uuid,boolean,integer,integer,integer,integer)
CREATE OR REPLACE FUNCTION public.salvar_limites_unidade(p_unidade uuid, p_descanso_ativo boolean, p_descanso_horas integer, p_sobrecarga_horas integer, p_ocupacao_pct integer, p_checkin_tolerancia_min integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  k text;
  v text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.gestor_da_unidade(p_unidade) OR private.secretaria_gere_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: os limites são do gestor da unidade.';
  END IF;
  IF p_descanso_ativo IS NULL THEN RAISE EXCEPTION 'Diga se a unidade exige descanso mínimo.'; END IF;
  IF p_descanso_horas IS NULL OR p_descanso_horas NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'Descanso mínimo entre 1 e 24 horas.';
  END IF;
  IF p_sobrecarga_horas IS NULL OR p_sobrecarga_horas NOT BETWEEN 12 AND 168 THEN
    RAISE EXCEPTION 'Limite de sobrecarga entre 12 e 168 horas em 7 dias.';
  END IF;
  IF p_ocupacao_pct IS NULL OR p_ocupacao_pct NOT BETWEEN 50 AND 100 THEN
    RAISE EXCEPTION 'Limite de ocupação entre 50%% e 100%%.';
  END IF;
  IF p_checkin_tolerancia_min IS NULL OR p_checkin_tolerancia_min NOT BETWEEN 0 AND 120 THEN
    RAISE EXCEPTION 'Tolerância do check-in entre 0 e 120 minutos.';
  END IF;

  FOR k, v IN SELECT * FROM (VALUES
      ('descanso_minimo_ativo', p_descanso_ativo::text),
      ('descanso_minimo_horas', p_descanso_horas::text),
      ('sobrecarga_horas_7d', p_sobrecarga_horas::text),
      ('ocupacao_limite_pct', p_ocupacao_pct::text),
      ('checkin_tolerancia_min', p_checkin_tolerancia_min::text)) x(chave, valor) LOOP
    INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
    VALUES (p_unidade, k, v, CASE k
      WHEN 'descanso_minimo_ativo' THEN 'A unidade exige descanso mínimo entre jornadas (true/false)'
      WHEN 'descanso_minimo_horas' THEN 'Descanso mínimo entre jornadas, em horas'
      WHEN 'sobrecarga_horas_7d' THEN 'Limite de horas escaladas em 7 dias (sobrecarga)'
      WHEN 'ocupacao_limite_pct' THEN 'Limite de atenção da ocupação de leitos, em %'
      ELSE 'Tolerância do check-in depois do início do plantão, em minutos' END)
    ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao, updated_at = now()
    WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
  END LOOP;

  PERFORM private.registrar_auditoria('salvar_limites_unidade', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('valores', private.limites_unidade(p_unidade)));
  RETURN private.limites_unidade(p_unidade);
END $function$;

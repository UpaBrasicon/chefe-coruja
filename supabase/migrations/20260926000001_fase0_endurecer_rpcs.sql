-- ════════════════════════════════════════════════════════════════════════════
-- Fase 0 — endurecer as RPCs SECURITY DEFINER (26/09/2026)
--
-- Achado: as 55 funções SECURITY DEFINER de `public` eram executáveis por
-- `anon` (o EXECUTE padrão de PUBLIC nunca foi revogado) e 21 delas não
-- conferiam papel nem unidade. As mais graves: qualquer usuário dava alta ou
-- óbito a paciente de qualquer unidade (dar_alta_internado) e o plantonista
-- aprovava a própria candidatura à escala (aprovar_candidatura).
--
-- Regra desta migration: a RPC não pode fazer mais do que as policies da
-- tabela já permitem ao mesmo usuário. Nenhum comportamento novo; só guardas.
-- Relatório completo: produto/docs/esquema-atual.md, seção 6.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Ninguém sem login executa função de `public` ─────────────────────────
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;


-- ── 2. Helpers de autorização ───────────────────────────────────────────────

-- Guarda furada por NULL: sem vínculo na unidade, papel_na_unidade devolvia
-- NULL, e `IF NOT (eh_super_admin() OR papel_na_unidade(u) = 'gestor')` virava
-- `IF NULL`, que não dispara — quem era de FORA da unidade passava. Afetava
-- adicionar_plantao_escala, passar_plantao, transferir_internado,
-- registrar_prescricao_itens e outras. Devolver '' fecha todas de uma vez; nas
-- policies, `'' = 'gestor'` e `'' IN (...)` dão false, como o NULL já dava.
CREATE OR REPLACE FUNCTION private.papel_na_unidade(unidade uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((
    SELECT v.papel::text
    FROM public.vinculos v
    WHERE v.perfil_id = private.meu_perfil_id()
      AND v.unidade_id = unidade
      AND v.ativo
    ORDER BY CASE v.papel
      WHEN 'admin'       THEN 0
      WHEN 'gestor'      THEN 1
      WHEN 'plantonista' THEN 2
    END
    LIMIT 1), '');
$$;

-- Tem qualquer vínculo ativo na unidade, é admin da organização dela, ou super.
CREATE OR REPLACE FUNCTION private.membro_da_unidade(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
       private.eh_super_admin()
    OR p_unidade IN (SELECT private.unidades_do_usuario())
    OR EXISTS (SELECT 1 FROM public.unidades u
               WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id)),
    false);
$$;

-- Gestor ou admin da unidade, admin da organização dela, ou super.
CREATE OR REPLACE FUNCTION private.gestao_da_unidade(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
       private.eh_super_admin()
    OR private.papel_na_unidade(p_unidade) IN ('gestor', 'admin')
    OR EXISTS (SELECT 1 FROM public.unidades u
               WHERE u.id = p_unidade AND private.eh_admin_da_organizacao(u.organizacao_id)),
    false);
$$;

-- Pode alterar o paciente: o mesmo predicado de `pacientes_update` (USING).
CREATE OR REPLACE FUNCTION private.pode_atuar_no_paciente(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
    WHERE pa.id = p_paciente
      AND (   private.eh_super_admin()
           OR private.papel_na_unidade(pa.unidade_id) = 'gestor'
           OR private.tem_acesso_atendimento(pa.unidade_id)
           OR (pa.setor_id IS NOT NULL
               AND pa.setor_id IN (SELECT private.setores_na_escala_agora())))
  );
$$;

REVOKE EXECUTE ON FUNCTION private.membro_da_unidade(uuid), private.gestao_da_unidade(uuid),
  private.pode_atuar_no_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.membro_da_unidade(uuid), private.gestao_da_unidade(uuid),
  private.pode_atuar_no_paciente(uuid) TO authenticated;


-- ── 3. Escala: setor de outra unidade não abre acesso (risco R3) ────────────
-- Um gestor da unidade A inseria plantão com unidade_id = A e setor_id de B e
-- passava a ler os pacientes de B. Duas travas: o helper ignora linhas
-- incoerentes que já existam, e o gatilho impede novas.

CREATE OR REPLACE FUNCTION private.setores_na_escala_agora()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT e.setor_id
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id AND s.unidade_id = e.unidade_id
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND e.data = private.data_atual()
    AND e.turno = private.turno_atual();
$$;

CREATE OR REPLACE FUNCTION private.escala_setor_da_unidade()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.setores s
                 WHERE s.id = NEW.setor_id AND s.unidade_id = NEW.unidade_id) THEN
    RAISE EXCEPTION 'O setor não pertence à unidade do plantão.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_escala_setor_da_unidade ON public.escala_plantao;
CREATE TRIGGER trg_escala_setor_da_unidade
  BEFORE INSERT OR UPDATE OF setor_id, unidade_id ON public.escala_plantao
  FOR EACH ROW EXECUTE FUNCTION private.escala_setor_da_unidade();


-- ── 4. Escala: aprovação, geração, passagem e montagem ──────────────────────

-- Só o gestor da unidade aprova, e nunca a própria candidatura.
CREATE OR REPLACE FUNCTION public.aprovar_candidatura(p_candidatura uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_candidatura public.candidaturas_escala%ROWTYPE;
  v_plantao uuid;
BEGIN
  SELECT * INTO v_candidatura
  FROM public.candidaturas_escala
  WHERE id = p_candidatura
  FOR UPDATE;

  IF v_candidatura.id IS NULL THEN
    RAISE EXCEPTION 'Candidatura não encontrada.';
  END IF;

  IF (private.eh_super_admin() OR private.papel_na_unidade(v_candidatura.unidade_id) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor da unidade aprova candidaturas.';
  END IF;
  IF v_candidatura.perfil_id = private.meu_perfil_id() AND NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Ninguém aprova a própria candidatura.';
  END IF;
  IF v_candidatura.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta candidatura já foi decidida.';
  END IF;

  SELECT e.id INTO v_plantao
  FROM public.escala_plantao e
  WHERE e.setor_id = v_candidatura.setor_id
    AND e.data = v_candidatura.data
    AND e.turno = v_candidatura.turno
    AND e.ativo
  LIMIT 1;

  IF v_plantao IS NOT NULL THEN
    RAISE EXCEPTION 'Este plantão já foi preenchido por outro plantonista.';
  END IF;

  INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, ativo, criado_por)
  VALUES (v_candidatura.unidade_id, v_candidatura.setor_id, v_candidatura.perfil_id,
          v_candidatura.data, v_candidatura.turno, true, auth.uid())
  RETURNING id INTO v_plantao;

  UPDATE public.candidaturas_escala
  SET status = 'aprovado', decidido_por = auth.uid()
  WHERE id = p_candidatura;

  RETURN v_plantao;
END;
$$;

-- Só o gestor da unidade gera a escala do mês.
CREATE OR REPLACE FUNCTION public.gerar_escala_mensal(p_unidade uuid, p_ano integer, p_mes integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_ini date := make_date(p_ano, p_mes, 1);
  v_fim date := (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date;
  v_dia date;
  v_dow int;
  v_semana_do_mes int;
  v_count int := 0;
BEGIN
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor gera a escala da unidade.';
  END IF;

  FOR v_dia IN SELECT generate_series(v_ini, v_fim, interval '1 day')::date LOOP
    v_dow := EXTRACT(ISODOW FROM v_dia)::int % 7;
    v_semana_do_mes := (EXTRACT(day FROM v_dia)::int - 1) / 7;

    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, quinzenal, ativo)
    SELECT f.unidade_id, f.setor_id, f.perfil_id, v_dia, f.turno, f.quinzenal, true
    FROM public.escala_fixa f
    WHERE f.unidade_id = p_unidade
      AND f.ativo
      AND f.dia_semana = v_dow
      AND (f.quinzenal = false OR v_semana_do_mes % 2 = 0)
    ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- O destino precisa ter vínculo ativo na unidade do plantão.
CREATE OR REPLACE FUNCTION public.passar_plantao(p_escala uuid, p_destino uuid, p_justificativa text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_escala public.escala_plantao%ROWTYPE;
  v_unidade uuid;
  v_aprovacao boolean;
  v_solic uuid;
BEGIN
  SELECT * INTO v_escala FROM public.escala_plantao WHERE id = p_escala AND ativo;
  IF v_escala.id IS NULL THEN
    RAISE EXCEPTION 'Plantão não encontrado';
  END IF;
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF v_escala.perfil_id IS DISTINCT FROM v_perfil
     AND (private.papel_na_unidade(v_escala.unidade_id) = 'gestor' OR private.eh_super_admin()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_escala.perfil_id = p_destino THEN
    RAISE EXCEPTION 'O destino não pode ser o próprio plantonista';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_destino AND v.unidade_id = v_escala.unidade_id AND v.ativo) THEN
    RAISE EXCEPTION 'O destino não tem vínculo ativo nesta unidade.';
  END IF;
  IF private.tem_conflito_plantao(p_destino, v_escala.unidade_id, v_escala.setor_id, v_escala.data, v_escala.turno, NULL) THEN
    PERFORM private.registrar_historico(v_escala.unidade_id, p_escala, 'erro_passagem',
      'Conflito de horário: o plantonista de destino já tem plantão no mesmo horário',
      jsonb_build_object('destino', p_destino, 'tipo', 'passagem'));
    RAISE EXCEPTION 'Conflito de horário: o plantonista de destino já tem plantão no mesmo horário';
  END IF;

  v_unidade := v_escala.unidade_id;

  SELECT (valor = 'true') INTO v_aprovacao
    FROM public.configuracoes_unidade
    WHERE unidade_id = v_unidade AND chave = 'escala_passagem_exige_aprovacao';

  IF coalesce(v_aprovacao, false) IS FALSE THEN
    UPDATE public.escala_plantao SET perfil_id = p_destino, observacao = p_justificativa, updated_at = now() WHERE id = p_escala;
    PERFORM private.registrar_historico(v_unidade, p_escala, 'passagem_aplicada',
      'Plantão passado automaticamente', jsonb_build_object('destino', p_destino, 'justificativa', p_justificativa));
    RETURN p_escala;
  END IF;

  INSERT INTO public.solicitacoes_escala
    (unidade_id, escala_plantao_id, perfil_id, tipo, status, destino_perfil_id, justificativa, criado_por)
  VALUES
    (v_unidade, p_escala, v_perfil, 'passar_plantao', 'pendente', p_destino, p_justificativa, v_perfil)
  RETURNING id INTO v_solic;

  PERFORM private.registrar_historico(v_unidade, p_escala, 'passagem_solicitada',
    'Passagem de plantão solicitada', jsonb_build_object('destino', p_destino, 'solicitacao', v_solic));

  RETURN v_solic;
END; $$;

-- O perfil escalado precisa ter vínculo ativo na unidade (o setor já é
-- conferido pelo gatilho da seção 3).
CREATE OR REPLACE FUNCTION public.adicionar_plantao_escala(p_unidade uuid, p_setor uuid, p_perfil uuid, p_data date,
  p_turno text, p_rotulo text DEFAULT NULL, p_quinzenal boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_existente uuid;
  v_id uuid;
BEGIN
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor pode montar a escala.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo) THEN
    RAISE EXCEPTION 'Este profissional não tem vínculo ativo nesta unidade.';
  END IF;

  SELECT e.id INTO v_existente
  FROM public.escala_plantao e
  WHERE e.perfil_id = p_perfil
    AND e.data = p_data
    AND e.turno = p_turno
    AND e.setor_id <> p_setor
    AND e.ativo
  LIMIT 1;

  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito: este plantonista já está escalado em outro setor nesta data/turno.';
  END IF;

  INSERT INTO public.escala_plantao
    (unidade_id, setor_id, perfil_id, data, turno, rotulo, quinzenal, ativo, criado_por)
  VALUES (p_unidade, p_setor, p_perfil, p_data, p_turno, p_rotulo, p_quinzenal, true, auth.uid())
  ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este plantão já está preenchido por este plantonista.';
  END IF;

  RETURN v_id;
END;
$$;


-- ── 5. Leituras de gestão: só quem gere ou pertence à unidade ───────────────

CREATE OR REPLACE FUNCTION public.plantonistas_da_unidade(p_unidade uuid)
RETURNS TABLE(perfil_id uuid, nome_completo text, crm text, uf_crm text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.membro_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT DISTINCT p.id, p.nome_completo, p.crm, p.uf_crm, p.email
  FROM public.vinculos v
  JOIN public.perfis p ON p.id = v.perfil_id
  WHERE v.unidade_id = p_unidade
    AND v.ativo
    AND v.papel = 'plantonista'
    AND p.ativo
  ORDER BY p.nome_completo;
END; $$;

CREATE OR REPLACE FUNCTION public.presencas_do_dia_gestor(p_unidade uuid)
RETURNS TABLE(perfil_id uuid, nome text, papel text, em_escala boolean, checkin_em timestamptz,
  checkout_em timestamptz, checkin_dentro boolean, checkout_dentro boolean, observacao text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.gestao_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: presenças são do gestor da unidade.';
  END IF;
  RETURN QUERY
  SELECT
    p.id, p.nome_completo, v.papel::text,
    EXISTS (SELECT 1 FROM public.escala_plantao e
            WHERE e.perfil_id = p.id AND e.unidade_id = p_unidade
              AND e.data = public.data_atual() AND e.ativo),
    pr.checkin_em, pr.checkout_em, pr.checkin_dentro, pr.checkout_dentro, pr.observacao
  FROM public.vinculos v
  JOIN public.perfis p ON p.id = v.perfil_id
  LEFT JOIN public.presenca_plantonista pr
    ON pr.perfil_id = p.id AND pr.unidade_id = p_unidade AND pr.data = public.data_atual()
  WHERE v.unidade_id = p_unidade
    AND v.ativo
    AND v.papel = 'plantonista'
    AND p.ativo
  ORDER BY pr.checkin_em NULLS LAST, p.nome_completo;
END; $$;

CREATE OR REPLACE FUNCTION public.resumo_carga_plantonistas(p_unidade uuid, p_inicio date, p_fim date)
RETURNS TABLE(perfil_id uuid, nome text, diurnos bigint, noturnos bigint, horas numeric, dias bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.gestao_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  WITH por_dia AS (
    SELECT e.perfil_id, e.data,
           bool_or(e.turno IN ('manha','tarde')) AS tem_diurno,
           bool_or(e.turno = 'noite') AS tem_noturno
    FROM public.escala_plantao e
    WHERE e.unidade_id = p_unidade AND e.ativo
      AND e.data BETWEEN p_inicio AND p_fim
    GROUP BY e.perfil_id, e.data
  )
  SELECT d.perfil_id,
         p.nome_completo,
         COUNT(*) FILTER (WHERE d.tem_diurno),
         COUNT(*) FILTER (WHERE d.tem_noturno),
         (COUNT(*) FILTER (WHERE d.tem_diurno) * 12
          + COUNT(*) FILTER (WHERE d.tem_noturno) * 12)::numeric,
         COUNT(*)
  FROM por_dia d
  JOIN public.perfis p ON p.id = d.perfil_id
  GROUP BY d.perfil_id, p.nome_completo
  ORDER BY p.nome_completo;
END; $$;

CREATE OR REPLACE FUNCTION public.ocupacao_setores(p_unidade uuid)
RETURNS TABLE(setor_id uuid, setor_nome text, internados bigint, limite integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.membro_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT s.id, s.nome,
         (SELECT COUNT(*) FROM public.pacientes p WHERE p.setor_id = s.id AND p.ativo)::bigint,
         (SELECT COUNT(*) FROM public.leitos l WHERE l.setor_id = s.id AND l.ativo)::int
  FROM public.setores s
  WHERE s.unidade_id = p_unidade
    AND s.ativo
    AND s.tipo IN ('internacao', 'observacao')
  ORDER BY s.ordem, s.nome;
END; $$;

CREATE OR REPLACE FUNCTION public.setores_internacao(p_unidade uuid)
RETURNS TABLE(id uuid, nome text, tipo text, ordem integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.membro_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT s.id, s.nome, s.tipo, s.ordem
  FROM public.setores s
  WHERE s.unidade_id = p_unidade
    AND s.ativo
    AND (s.tipo = 'internacao'
         OR (s.tipo = 'observacao' AND position('verm' in lower(s.nome)) > 0))
  ORDER BY s.ordem, s.nome;
END; $$;

CREATE OR REPLACE FUNCTION public.setores_observacao(p_unidade uuid)
RETURNS TABLE(id uuid, nome text, tipo text, ordem integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.membro_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT s.id, s.nome, s.tipo, s.ordem
  FROM public.setores s
  WHERE s.unidade_id = p_unidade
    AND s.ativo
    AND s.tipo = 'observacao'
    AND NOT (position('verm' in lower(s.nome)) > 0)
  ORDER BY s.ordem, s.nome;
END; $$;

CREATE OR REPLACE FUNCTION public.censo_recente(p_unidade uuid, p_dias integer DEFAULT 7)
RETURNS TABLE(data date, setor_id uuid, setor_nome text, internados integer, leitos_total integer,
  taxa_ocupacao numeric, permanencia_media_h numeric, giro_leito numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.gestao_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
    SELECT c.data, c.setor_id, s.nome,
           c.internados, c.leitos_total, c.taxa_ocupacao,
           c.permanencia_media_h, c.giro_leito
    FROM public.censo_ocupacao c
    JOIN public.setores s ON s.id = c.setor_id
    WHERE c.unidade_id = p_unidade
      AND c.data >= current_date - p_dias
    ORDER BY c.data DESC, s.ordem, s.nome;
END; $$;


-- ── 6. Censo: o gestor gera o da sua unidade; o job gera o de todas ─────────
-- O corpo vai para `private` sem guarda (só o job e a RPC guardada o chamam).

ALTER FUNCTION public.gerar_censo_diario(uuid, date) SET SCHEMA private;
ALTER FUNCTION private.gerar_censo_diario(uuid, date) SET search_path = public;
REVOKE EXECUTE ON FUNCTION private.gerar_censo_diario(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gerar_censo_diario(p_unidade uuid, p_data date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (private.gestao_da_unidade(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: o censo é gerado pelo gestor da unidade.';
  END IF;
  RETURN private.gerar_censo_diario(p_unidade, p_data);
END; $$;

CREATE OR REPLACE FUNCTION public.gerar_censo_todas_unidades(p_data date DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade record;
  v_total integer := 0;
  v_data date := coalesce(p_data, current_date - 1);
BEGIN
  FOR v_unidade IN SELECT id FROM public.unidades WHERE ativo LOOP
    PERFORM private.gerar_censo_diario(v_unidade.id, v_data);
    v_total := v_total + 1;
  END LOOP;
  RETURN v_total;
END; $$;

-- Só o job agendado (postgres) e o service_role.
REVOKE EXECUTE ON FUNCTION public.gerar_censo_todas_unidades(date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.gerar_censo_diario(uuid, date) TO authenticated;


-- ── 7. Internação, alta e eventos ADT ───────────────────────────────────────

-- Abrir internação: o mesmo predicado de `pacientes_insert`, e o paciente,
-- o setor e o leito precisam ser da unidade informada.
CREATE OR REPLACE FUNCTION public.abrir_internacao(p_paciente uuid, p_unidade uuid,
  p_tipo_internacao text DEFAULT 'urgencia', p_origem_admissao text DEFAULT 'emergencia',
  p_setor uuid DEFAULT NULL, p_leito uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_org uuid;
  v_ep uuid;
  v_seq integer := 1;
  v_hash text;
  v_estado jsonb;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = p_unidade;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada'; END IF;

  IF (   private.eh_super_admin()
          OR private.papel_na_unidade(p_unidade) = 'gestor'
          OR (private.papel_na_unidade(p_unidade) = 'plantonista'
              AND (private.na_escala_agora(p_unidade) OR private.tem_acesso_atendimento(p_unidade)))) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está em plantão nesta unidade.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente AND unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Paciente não pertence a esta unidade.';
  END IF;
  IF p_setor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.setores WHERE id = p_setor AND unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Setor não pertence a esta unidade.';
  END IF;
  IF p_leito IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
       WHERE l.id = p_leito AND s.unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Leito não pertence a esta unidade.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.internacoes
             WHERE paciente_id = p_paciente AND status IN ('admitido','em_observacao','internado')) THEN
    RAISE EXCEPTION 'Paciente já possui internação ativa.';
  END IF;

  v_estado := jsonb_build_object(
    'status','admitido','setor',p_setor,'leito',p_leito,
    'tipo_internacao',p_tipo_internacao,'origem',p_origem_admissao
  );
  v_hash := private.hash_evento(1, 'admissao', v_estado, v_perfil, 'Admissão', NULL);

  INSERT INTO public.internacoes
    (organizacao_id, unidade_id, paciente_id, tipo_internacao, origem_admissao,
     status, leito_atual_id, setor_atual_id, data_entrada_setor)
  VALUES
    (v_org, p_unidade, p_paciente, p_tipo_internacao, p_origem_admissao,
     'admitido', p_leito, p_setor, CASE WHEN p_setor IS NOT NULL THEN now() END)
  RETURNING id INTO v_ep;

  INSERT INTO public.eventos_adt
    (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento,
     estado_antes, estado_depois, setor_destino_id, leito_destino_id, autor_id,
     motivo, hash_previo, hash_conteudo)
  VALUES
    (v_seq, v_org, p_unidade, v_ep, p_paciente, 'admissao',
     NULL, v_estado, p_setor, p_leito, v_perfil,
     'Admissão', NULL, v_hash);

  IF p_leito IS NOT NULL THEN
    UPDATE public.leitos SET status = 'ocupado' WHERE id = p_leito;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (p_leito, p_unidade, 'ocupacao', 'livre', 'ocupado', v_ep, v_perfil, 'Admissão');
  END IF;

  RETURN v_ep;
END; $$;

-- Dar alta: o mesmo predicado de `pacientes_update`.
CREATE OR REPLACE FUNCTION public.dar_alta_internado(p_paciente uuid, p_tipo_alta text, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  v_ep uuid;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF p_tipo_alta NOT IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN
    RAISE EXCEPTION 'Tipo de alta inválido.';
  END IF;

  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;

  IF (private.pode_atuar_no_paciente(p_paciente)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está na escala do setor deste paciente.';
  END IF;

  v_ep := private.internacao_ativa(p_paciente);
  IF v_ep IS NULL THEN
    RAISE EXCEPTION 'Paciente não possui internação ativa para dar alta.';
  END IF;

  PERFORM public.registrar_evento_adt(v_ep, p_tipo_alta, NULL, NULL, p_motivo);

  UPDATE public.pacientes SET setor_id = NULL, updated_at = now() WHERE id = p_paciente;

  INSERT INTO public.alta_paciente
    (paciente_id, unidade_id, status, criterios, justificativa, liberou_leito, criado_por)
  VALUES
    (p_paciente, v_unidade, 'concluida', jsonb_build_object('tipo', p_tipo_alta), p_motivo, true, v_perfil);
END; $$;

-- Evento ADT: gestor, acesso de atendimento, escala no setor do episódio ou do
-- paciente, ou — episódio recém-aberto na porta, ainda sem setor — plantonista
-- em escala na unidade (o mesmo direito que abriu o episódio).
CREATE OR REPLACE FUNCTION public.registrar_evento_adt(p_internacao uuid, p_tipo_evento text,
  p_setor_destino uuid DEFAULT NULL, p_leito_destino uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL, p_payload jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_ep public.internacoes%ROWTYPE;
  v_seq integer;
  v_hash_previo text;
  v_hash text;
  v_estado_antes jsonb;
  v_estado_depois jsonb;
  v_status_novo text;
  v_leito_origem uuid;
  v_setor_origem uuid;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT * INTO v_ep FROM public.internacoes WHERE id = p_internacao;
  IF v_ep.id IS NULL THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;

  IF (   private.eh_super_admin()
          OR private.papel_na_unidade(v_ep.unidade_id) = 'gestor'
          OR private.tem_acesso_atendimento(v_ep.unidade_id)
          OR v_ep.setor_atual_id IN (SELECT private.setores_na_escala_agora())
          OR EXISTS (SELECT 1 FROM public.pacientes pa
                     WHERE pa.id = v_ep.paciente_id
                       AND pa.setor_id IN (SELECT private.setores_na_escala_agora()))
          OR (v_ep.setor_atual_id IS NULL
              AND private.papel_na_unidade(v_ep.unidade_id) = 'plantonista'
              AND private.na_escala_agora(v_ep.unidade_id))) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está na escala deste paciente.';
  END IF;
  IF p_setor_destino IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.setores WHERE id = p_setor_destino AND unidade_id = v_ep.unidade_id) THEN
    RAISE EXCEPTION 'Setor de destino não pertence à unidade do episódio.';
  END IF;
  IF p_leito_destino IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
       WHERE l.id = p_leito_destino AND s.unidade_id = v_ep.unidade_id) THEN
    RAISE EXCEPTION 'Leito de destino não pertence à unidade do episódio.';
  END IF;

  v_status_novo := CASE p_tipo_evento
    WHEN 'alta_melhorada' THEN 'alta_melhorada'
    WHEN 'alta_pedido' THEN 'alta_pedido'
    WHEN 'alta_evasao' THEN 'alta_evasao'
    WHEN 'transferencia_externa' THEN 'transferencia_externa'
    WHEN 'obito' THEN 'obito'
    WHEN 'internacao' THEN 'internado'
    WHEN 'entrada_observacao' THEN 'em_observacao'
    ELSE v_ep.status
  END;

  IF p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN
    IF v_ep.status NOT IN ('admitido','em_observacao','internado') THEN
      RAISE EXCEPTION 'Internação já encerrada.';
    END IF;
  END IF;

  SELECT max(seq) INTO v_seq FROM public.eventos_adt WHERE internacao_id = p_internacao;
  v_seq := coalesce(v_seq, 0) + 1;

  SELECT hash_conteudo INTO v_hash_previo FROM public.eventos_adt
    WHERE internacao_id = p_internacao AND seq = v_seq - 1 ORDER BY seq DESC LIMIT 1;

  v_leito_origem := v_ep.leito_atual_id;
  v_setor_origem := v_ep.setor_atual_id;
  v_estado_antes := jsonb_build_object(
    'status', v_ep.status, 'setor', v_setor_origem, 'leito', v_leito_origem);
  v_estado_depois := jsonb_build_object(
    'status', v_status_novo,
    'setor', coalesce(p_setor_destino, v_setor_origem),
    'leito', coalesce(p_leito_destino, v_leito_origem));

  v_hash := private.hash_evento(v_seq, p_tipo_evento, v_estado_depois, v_perfil, p_motivo, v_hash_previo);

  INSERT INTO public.eventos_adt
    (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento,
     estado_antes, estado_depois,
     leito_origem_id, leito_destino_id, setor_origem_id, setor_destino_id,
     autor_id, motivo, payload, hash_previo, hash_conteudo)
  VALUES
    (v_seq, v_ep.organizacao_id, v_ep.unidade_id, v_ep.id, v_ep.paciente_id, p_tipo_evento,
     v_estado_antes, v_estado_depois,
     v_leito_origem, p_leito_destino, v_setor_origem, p_setor_destino,
     v_perfil, p_motivo, p_payload, v_hash_previo, v_hash);

  UPDATE public.internacoes
    SET status = v_status_novo,
        setor_atual_id = coalesce(p_setor_destino, setor_atual_id),
        leito_atual_id = CASE
                          WHEN p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN NULL
                          ELSE coalesce(p_leito_destino, leito_atual_id)
                         END,
        data_entrada_setor = CASE WHEN p_setor_destino IS NOT NULL AND p_setor_destino <> setor_atual_id THEN now() ELSE data_entrada_setor END,
        data_alta = CASE
                      WHEN p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN now()
                      ELSE data_alta
                    END,
        updated_at = now()
    WHERE id = p_internacao;

  IF p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito')
     AND v_leito_origem IS NOT NULL THEN
    UPDATE public.leitos SET status = 'higienizacao' WHERE id = v_leito_origem;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (v_leito_origem, v_ep.unidade_id, 'liberacao', 'ocupado', 'higienizacao', p_internacao, v_perfil, 'Alta/óbito liberou leito');
  END IF;

  IF p_leito_destino IS NOT NULL AND p_leito_destino IS DISTINCT FROM v_leito_origem THEN
    UPDATE public.leitos SET status = 'ocupado' WHERE id = p_leito_destino;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (p_leito_destino, v_ep.unidade_id, 'ocupacao', 'livre', 'ocupado', p_internacao, v_perfil, 'Transferência de leito');
  END IF;
END; $$;


-- ── 8. Documento e log de acesso: paciente precisa ser da unidade informada ─

CREATE OR REPLACE FUNCTION public.salvar_documento(p_paciente uuid, p_unidade uuid, p_tipo text, p_conteudo text,
  p_internacao uuid DEFAULT NULL, p_motivo_retificacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_hash text;
  v_atual public.documentos_clinicos%ROWTYPE;
  v_raiz uuid;
  v_versao integer;
  v_org uuid;
  v_id uuid;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF (private.pode_escrever_documento(p_unidade, p_internacao)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está na escala deste paciente ou da unidade.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente AND unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Paciente não pertence a esta unidade.';
  END IF;
  IF p_internacao IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.internacoes WHERE id = p_internacao AND paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'A internação informada não é deste paciente.';
  END IF;
  IF p_conteudo IS NULL OR trim(p_conteudo) = '' THEN
    RAISE EXCEPTION 'Conteúdo do documento não pode ser vazio.';
  END IF;

  v_hash := encode(sha256(convert_to(p_conteudo, 'UTF8')), 'hex');
  SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = p_unidade;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;

  SELECT * INTO v_atual FROM public.documentos_clinicos
    WHERE paciente_id = p_paciente AND tipo_documento = p_tipo
    ORDER BY versao DESC LIMIT 1;

  IF v_atual.id IS NOT NULL AND v_atual.conteudo_hash = v_hash THEN
    RETURN v_atual.id;
  END IF;

  v_raiz := coalesce(v_atual.documento_raiz_id, gen_random_uuid());
  v_versao := coalesce(v_atual.versao, 0) + 1;

  INSERT INTO public.documentos_clinicos
    (documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
     tipo_documento, conteudo, conteudo_hash, autor_id, estado,
     retificacao_de, motivo_retificacao)
  VALUES
    (v_raiz, v_versao, v_org, p_unidade, p_paciente, p_internacao,
     p_tipo, p_conteudo, v_hash, v_perfil, 'ativo',
     v_atual.id, coalesce(p_motivo_retificacao, 'Nova versão'))
  RETURNING id INTO v_id;

  IF v_atual.id IS NOT NULL THEN
    UPDATE public.documentos_clinicos SET estado = 'retificado', updated_at = now()
      WHERE id = v_atual.id;
  END IF;

  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.registrar_acesso_prontuario(p_paciente uuid, p_unidade uuid,
  p_tipo_acesso text DEFAULT 'leitura_prontuario', p_internacao uuid DEFAULT NULL, p_documento uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil uuid := private.meu_perfil_id();
BEGIN
  IF v_perfil IS NULL THEN RETURN; END IF;
  IF private.membro_da_unidade(p_unidade) IS NOT TRUE
     OR NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente AND unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel,
     tipo_acesso, documento_id, user_agent)
  VALUES
    ((SELECT organizacao_id FROM public.unidades WHERE id = p_unidade),
     p_unidade, p_paciente, p_internacao, v_perfil,
     nullif(private.papel_na_unidade(p_unidade), ''), p_tipo_acesso, p_documento,
     NULL);
END; $$;

-- Auditoria: ninguém grava evento em nome de unidade à qual não pertence.
-- (O redesenho só-inserção com hash é da fase 1.)
CREATE OR REPLACE FUNCTION public.registrar_auditoria(p_acao text, p_entidade text, p_entidade_id uuid DEFAULT NULL,
  p_unidade_id uuid DEFAULT NULL, p_payload jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_unidade_id IS NOT NULL AND private.membro_da_unidade(p_unidade_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN private.registrar_auditoria(p_acao, p_entidade, p_entidade_id, p_unidade_id, p_payload);
END; $$;


-- ── 9. Recolocar a revogação sobre as funções recriadas ─────────────────────
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gerar_censo_todas_unidades(date) FROM authenticated;

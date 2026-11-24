-- ════════════════════════════════════════════════════════════════════════════
-- Cadastros duplicados: registro permanente de "são pessoas diferentes".
--
-- Antes, "Deixar separados" só fechava o par na tela e o par voltava na lista
-- seguinte, porque nada ficava gravado. Agora a decisão fica registrada com
-- quem decidiu, quando e o motivo, e o par deixa de ser sugerido como
-- duplicado até alguém desfazer a marca.
--
-- • public.pacientes_pessoas_diferentes: um par de cadastros por linha, em
--   ordem canônica (paciente_a < paciente_b, a mesma ordem do par em
--   candidatos_duplicados), com a unidade e a organização da unidade. Só uma
--   marca ativa (desfeito_em nulo) por par. Leitura pela RLS de quem pode
--   marcar; escrita só pelas funções abaixo.
-- • marcar_pessoas_diferentes(a, b, motivo) e desfazer_pessoas_diferentes(id):
--   recepção, gestor e administrador geral da unidade (vínculo admin na
--   unidade ou administrador da organização); com auditoria.
-- • pessoas_diferentes_da_unidade(unidade): o histórico da tela.
-- • candidatos_duplicados: mesma assinatura e mesmo corpo, só passa a ignorar
--   os pares com marca ativa.
--
-- Expand: uma tabela, quatro funções novas e o CREATE OR REPLACE de uma.
-- Sem DROP/RENAME. Idempotente.
-- Volta: docs/cadastro/ROLLBACK-20270421000076.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pacientes_pessoas_diferentes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  organizacao_id  uuid REFERENCES public.organizacoes(id),
  paciente_a      uuid NOT NULL REFERENCES public.pacientes(id),
  paciente_b      uuid NOT NULL REFERENCES public.pacientes(id),
  motivo          text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 5 AND 500),
  decidido_por    uuid NOT NULL REFERENCES public.perfis(id),
  decidido_em     timestamptz NOT NULL DEFAULT now(),
  desfeito_por    uuid REFERENCES public.perfis(id),
  desfeito_em     timestamptz,
  CHECK (paciente_a < paciente_b),
  CHECK ((desfeito_em IS NULL) = (desfeito_por IS NULL))
);
COMMENT ON TABLE public.pacientes_pessoas_diferentes IS
  'Pares de cadastros que a recepção, o gestor ou o administrador geral marcaram como pessoas diferentes: não voltam a ser sugeridos como duplicados enquanto a marca estiver ativa (desfeito_em nulo).';
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_pessoas_diferentes_par_ativo
  ON public.pacientes_pessoas_diferentes (paciente_a, paciente_b) WHERE desfeito_em IS NULL;
CREATE INDEX IF NOT EXISTS pacientes_pessoas_diferentes_unidade
  ON public.pacientes_pessoas_diferentes (unidade_id, decidido_em DESC);
CREATE INDEX IF NOT EXISTS pacientes_pessoas_diferentes_paciente_b
  ON public.pacientes_pessoas_diferentes (paciente_b);

-- quem marca e desfaz: recepção e gestor (como no pedido de unificação) e o
-- administrador geral da unidade
CREATE OR REPLACE FUNCTION private.pode_marcar_pessoas_diferentes(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.pode_pedir_unificacao(p_unidade)
      OR EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = private.meu_perfil_id() AND v.unidade_id = p_unidade
                    AND v.ativo AND v.papel = 'admin')
      OR private.eh_admin_da_organizacao((SELECT u.organizacao_id FROM public.unidades u WHERE u.id = p_unidade));
$$;
REVOKE ALL ON FUNCTION private.pode_marcar_pessoas_diferentes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pode_marcar_pessoas_diferentes(uuid) TO authenticated;

ALTER TABLE public.pacientes_pessoas_diferentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pacientes_pessoas_diferentes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pacientes_pessoas_diferentes TO authenticated;
DROP POLICY IF EXISTS pacientes_pessoas_diferentes_select ON public.pacientes_pessoas_diferentes;
CREATE POLICY pacientes_pessoas_diferentes_select ON public.pacientes_pessoas_diferentes
  FOR SELECT TO authenticated
  USING (private.pode_marcar_pessoas_diferentes(unidade_id));

-- ── marcar ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_pessoas_diferentes(p_paciente_a uuid, p_paciente_b uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.pacientes;
  b public.pacientes;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.pacientes WHERE id = least(p_paciente_a, p_paciente_b);
  SELECT * INTO b FROM public.pacientes WHERE id = greatest(p_paciente_a, p_paciente_b);
  IF a.id IS NULL OR b.id IS NULL OR a.id = b.id OR a.unidade_id <> b.unidade_id
     OR NOT private.pode_marcar_pessoas_diferentes(a.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: recepção, gestor ou administrador geral da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(v_motivo) < 5 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 5 letras).'; END IF;
  IF length(v_motivo) > 500 THEN RAISE EXCEPTION 'Motivo longo demais (até 500 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.pedidos_unificacao u WHERE u.status = 'pendente'
              AND least(u.principal_id, u.absorvido_id) = a.id AND greatest(u.principal_id, u.absorvido_id) = b.id) THEN
    RAISE EXCEPTION 'Há um pedido de unificação aguardando o gestor para este par: cancele ou recuse o pedido antes.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pacientes_pessoas_diferentes d
              WHERE d.paciente_a = a.id AND d.paciente_b = b.id AND d.desfeito_em IS NULL) THEN
    RAISE EXCEPTION 'Este par já está marcado como pessoas diferentes.';
  END IF;
  INSERT INTO public.pacientes_pessoas_diferentes (unidade_id, organizacao_id, paciente_a, paciente_b, motivo, decidido_por)
  VALUES (a.unidade_id, (SELECT u.organizacao_id FROM public.unidades u WHERE u.id = a.unidade_id),
          a.id, b.id, v_motivo, private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('marcar_pessoas_diferentes', 'pacientes_pessoas_diferentes', v_id, a.unidade_id,
    jsonb_build_object('paciente_a', a.id, 'paciente_b', b.id));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.marcar_pessoas_diferentes(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_pessoas_diferentes(uuid, uuid, text) TO authenticated;

-- ── desfazer: o par volta a poder ser sugerido ──────────────────────────────
CREATE OR REPLACE FUNCTION public.desfazer_pessoas_diferentes(p_marca uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.pacientes_pessoas_diferentes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.pacientes_pessoas_diferentes WHERE id = p_marca FOR UPDATE;
  IF r.id IS NULL OR NOT private.pode_marcar_pessoas_diferentes(r.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: recepção, gestor ou administrador geral da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF r.desfeito_em IS NOT NULL THEN RAISE EXCEPTION 'Esta marca já foi desfeita.'; END IF;
  UPDATE public.pacientes_pessoas_diferentes
     SET desfeito_por = private.meu_perfil_id(), desfeito_em = now()
   WHERE id = r.id;
  PERFORM private.registrar_auditoria('desfazer_pessoas_diferentes', 'pacientes_pessoas_diferentes', r.id, r.unidade_id,
    jsonb_build_object('paciente_a', r.paciente_a, 'paciente_b', r.paciente_b));
END $$;
REVOKE ALL ON FUNCTION public.desfazer_pessoas_diferentes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desfazer_pessoas_diferentes(uuid) TO authenticated;

-- ── histórico da tela ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pessoas_diferentes_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_marcar_pessoas_diferentes(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: recepção, gestor ou administrador geral da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x.j ORDER BY x.ativo DESC, x.em DESC)
      FROM (
        SELECT d.desfeito_em IS NULL AS ativo, d.decidido_em AS em, jsonb_build_object(
                 'id', d.id, 'motivo', d.motivo,
                 'decidido_por', pd.nome_completo, 'decidido_em', d.decidido_em,
                 'desfeito_por', pf.nome_completo, 'desfeito_em', d.desfeito_em,
                 'a', jsonb_build_object('id', a.id, 'nome', a.nome, 'prontuario', a.prontuario, 'data_nascimento', a.data_nascimento, 'nome_mae', a.nome_mae),
                 'b', jsonb_build_object('id', b.id, 'nome', b.nome, 'prontuario', b.prontuario, 'data_nascimento', b.data_nascimento, 'nome_mae', b.nome_mae)) AS j
          FROM public.pacientes_pessoas_diferentes d
          JOIN public.pacientes a ON a.id = d.paciente_a
          JOIN public.pacientes b ON b.id = d.paciente_b
          LEFT JOIN public.perfis pd ON pd.id = d.decidido_por
          LEFT JOIN public.perfis pf ON pf.id = d.desfeito_por
         WHERE d.unidade_id = p_unidade
         ORDER BY d.desfeito_em IS NULL DESC, d.decidido_em DESC
         LIMIT 200) x), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.pessoas_diferentes_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pessoas_diferentes_da_unidade(uuid) TO authenticated;

-- ── candidatos_duplicados: o mesmo corpo, sem os pares marcados ─────────────
CREATE OR REPLACE FUNCTION public.candidatos_duplicados(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_pedir_unificacao(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: recepção ou gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    WITH p AS (
      SELECT x.*, private.nome_comparavel(x.nome) AS n, private.nome_comparavel(x.nome_mae) AS m
        FROM public.pacientes x WHERE x.unidade_id = p_unidade AND x.ativo
    ), pares AS (
      SELECT a.id AS a_id, b.id AS b_id,
             array_remove(ARRAY[
               CASE WHEN a.n = b.n AND a.data_nascimento = b.data_nascimento THEN 'nome_nascimento' END,
               CASE WHEN a.m IS NOT NULL AND a.m = b.m AND a.data_nascimento = b.data_nascimento THEN 'mae_nascimento' END,
               CASE WHEN nullif(a.cpf, '') = nullif(b.cpf, '') OR nullif(a.cns, '') = nullif(b.cns, '') THEN 'documento' END,
               -- regra ampla (RT, 08/10/2026): mesmo nome, nascimento diferente ou em branco — conferir
               CASE WHEN a.n = b.n AND a.data_nascimento IS DISTINCT FROM b.data_nascimento THEN 'nome_conferir' END], NULL) AS regras
        FROM p a JOIN p b ON a.id < b.id
       WHERE ((a.n = b.n AND a.data_nascimento = b.data_nascimento)
          OR (a.m IS NOT NULL AND a.m = b.m AND a.data_nascimento = b.data_nascimento)
          OR nullif(a.cpf, '') = nullif(b.cpf, '') OR nullif(a.cns, '') = nullif(b.cns, '')
          OR a.n = b.n)
         -- marcado como pessoas diferentes (20270421000076): não volta a ser sugerido
         AND NOT EXISTS (SELECT 1 FROM public.pacientes_pessoas_diferentes d
                          WHERE d.paciente_a = a.id AND d.paciente_b = b.id AND d.desfeito_em IS NULL)
       LIMIT 100
    )
    SELECT jsonb_agg(jsonb_build_object(
             'regras', pr.regras,
             'pedido_pendente', EXISTS (SELECT 1 FROM public.pedidos_unificacao u WHERE u.status = 'pendente'
                                         AND least(u.principal_id, u.absorvido_id) = pr.a_id AND greatest(u.principal_id, u.absorvido_id) = pr.b_id),
             'cadastros', (SELECT jsonb_agg(jsonb_build_object(
                  'id', c.id, 'nome', c.nome, 'nome_mae', c.nome_mae, 'data_nascimento', c.data_nascimento,
                  'prontuario', c.prontuario, 'cpf', c.cpf, 'cns', c.cns, 'criado_em', c.created_at,
                  'atendimentos', (SELECT count(*) FROM public.episodios e WHERE e.paciente_id = c.id),
                  'aberto', EXISTS (SELECT 1 FROM public.episodios e WHERE e.paciente_id = c.id AND e.etapa <> 'encerrado'),
                  'ultimo_atendimento', (SELECT max(e.chegada_em) FROM public.episodios e WHERE e.paciente_id = c.id))
                  ORDER BY c.created_at)
                FROM public.pacientes c WHERE c.id IN (pr.a_id, pr.b_id))))
      FROM pares pr), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.candidatos_duplicados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidatos_duplicados(uuid) TO authenticated;

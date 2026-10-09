-- Fase 1, tarefa 9 do BACKLOG.md — unificação de pacientes duplicados.
--
-- Decisões do RT (08/10/2026):
--   • VINCULAR, sem mover registros: o cadastro absorvido fica inativo e aponta
--     para o principal (pacientes.unificado_em). Nenhum registro clínico muda de
--     paciente; o histórico, o acesso por motivo/pedido e a leitura do
--     prontuário passam a enxergar os dois juntos. Desfazer = desligar o vínculo;
--   • a RECEPÇÃO (ou o gestor) PEDE, com motivo; o GESTOR da unidade (ou super
--     admin) APROVA ou recusa — ninguém aprova o próprio pedido;
--   • candidatos: mesmo nome + nascimento, mesmo nome da mãe + nascimento, mesmo
--     CPF ou CNS (comparação sem acento e sem maiúscula);
--   • com atendimento ABERTO nos dois cadastros, a unificação é recusada.
-- Segurança do paciente: as checagens de alergia da prescrição leem o cadastro
-- em que a alergia foi gravada; por isso a aprovação também é recusada se o
-- absorvido tiver alergia ou evento adverso ativo que não esteja no principal —
-- registre no principal e unifique (nada fica escondido no cadastro inativo).
-- CPF/CNS: se o principal não tem e o absorvido tem, passam para o principal
-- (o índice único da unidade não permite os dois); desfazer devolve.
-- Só aditiva: coluna nova, tabela e funções novas; acesso_encerrado_vigente e
-- historico_encerrado passam a considerar os cadastros unificados.
--
-- ROLLBACK: reaplicar acesso_encerrado_vigente e historico_encerrado de
--   20261030000002; DROP das funções novas e de public.pedidos_unificacao;
--   ALTER TABLE public.pacientes DROP COLUMN unificado_em (só se nenhum vínculo).

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS unificado_em uuid REFERENCES public.pacientes(id);
CREATE INDEX IF NOT EXISTS pacientes_unificado_em ON public.pacientes (unificado_em) WHERE unificado_em IS NOT NULL;

-- ── a família de cadastros: o principal e os absorvidos por ele ────────────
CREATE OR REPLACE FUNCTION private.paciente_principal(p_paciente uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT p.unificado_em FROM public.pacientes p WHERE p.id = p_paciente), p_paciente);
$$;
CREATE OR REPLACE FUNCTION private.familia_paciente(p_paciente uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.paciente_principal(p_paciente)
  UNION
  SELECT p.id FROM public.pacientes p WHERE p.unificado_em = private.paciente_principal(p_paciente);
$$;
REVOKE ALL ON FUNCTION private.paciente_principal(uuid), private.familia_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.paciente_principal(uuid), private.familia_paciente(uuid) TO authenticated;

-- acesso por pedido aprovado ou por motivo vale para a família inteira
CREATE OR REPLACE FUNCTION private.acesso_encerrado_vigente(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pedidos_acesso_prontuario pd
    WHERE pd.paciente_id IN (SELECT private.familia_paciente(p_paciente))
      AND pd.solicitante_id = private.meu_perfil_id()
      AND pd.status = 'aprovado'
      AND pd.valido_ate > now()
      -- o vínculo precisa continuar ativo na unidade
      AND private.papel_na_unidade(pd.unidade_id) <> ''
  ) OR EXISTS (
    -- Fase 1, tarefa 8: detalhe aberto com motivo por quem cuida do paciente
    SELECT 1 FROM private.acessos_historico ah
    WHERE ah.paciente_id IN (SELECT private.familia_paciente(p_paciente))
      AND ah.perfil_id = private.meu_perfil_id()
      AND ah.valido_ate > now()
      AND private.papel_na_unidade(ah.unidade_id) <> ''
  );
$$;

-- ── pedidos de unificação ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pedidos_unificacao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  principal_id    uuid NOT NULL REFERENCES public.pacientes(id),
  absorvido_id    uuid NOT NULL REFERENCES public.pacientes(id),
  motivo          text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  status          text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado', 'desfeito')),
  pedido_por      uuid NOT NULL REFERENCES public.perfis(id),
  pedido_em       timestamptz NOT NULL DEFAULT now(),
  decidido_por    uuid REFERENCES public.perfis(id),
  decidido_em     timestamptz,
  motivo_decisao  text,
  moveu_cpf       text,
  moveu_cns       text,
  desfeito_por    uuid REFERENCES public.perfis(id),
  desfeito_em     timestamptz,
  motivo_desfazer text,
  CHECK (principal_id <> absorvido_id),
  CHECK (decidido_por IS NULL OR decidido_por <> pedido_por)
);
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_unificacao_um_pendente
  ON public.pedidos_unificacao (least(principal_id, absorvido_id), greatest(principal_id, absorvido_id)) WHERE status = 'pendente';
ALTER TABLE public.pedidos_unificacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pedidos_unificacao_select ON public.pedidos_unificacao;
CREATE POLICY pedidos_unificacao_select ON public.pedidos_unificacao FOR SELECT TO authenticated
  USING (pedido_por = private.meu_perfil_id() OR private.gestor_da_unidade(unidade_id));
REVOKE INSERT, UPDATE, DELETE ON public.pedidos_unificacao FROM authenticated, anon;

CREATE OR REPLACE FUNCTION private.pode_pedir_unificacao(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.gestor_da_unidade(p_unidade) OR EXISTS (
    SELECT 1 FROM public.vinculos v
     WHERE v.perfil_id = private.meu_perfil_id() AND v.unidade_id = p_unidade AND v.ativo AND v.papel = 'recepcao');
$$;
REVOKE ALL ON FUNCTION private.pode_pedir_unificacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pode_pedir_unificacao(uuid) TO authenticated;

-- ── candidatos a duplicado (pares de cadastros ativos) ─────────────────────
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
               CASE WHEN nullif(a.cpf, '') = nullif(b.cpf, '') OR nullif(a.cns, '') = nullif(b.cns, '') THEN 'documento' END], NULL) AS regras
        FROM p a JOIN p b ON a.id < b.id
       WHERE (a.n = b.n AND a.data_nascimento = b.data_nascimento)
          OR (a.m IS NOT NULL AND a.m = b.m AND a.data_nascimento = b.data_nascimento)
          OR nullif(a.cpf, '') = nullif(b.cpf, '') OR nullif(a.cns, '') = nullif(b.cns, '')
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

CREATE OR REPLACE FUNCTION public.pedir_unificacao(p_principal uuid, p_absorvido uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.pacientes;
  b public.pacientes;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO a FROM public.pacientes WHERE id = p_principal;
  SELECT * INTO b FROM public.pacientes WHERE id = p_absorvido;
  IF a.id IS NULL OR b.id IS NULL OR a.unidade_id <> b.unidade_id THEN RAISE EXCEPTION 'Os dois cadastros precisam ser da mesma unidade.'; END IF;
  IF NOT private.pode_pedir_unificacao(a.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: recepção ou gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF a.id = b.id THEN RAISE EXCEPTION 'Escolha dois cadastros diferentes.'; END IF;
  IF NOT a.ativo OR NOT b.ativo THEN RAISE EXCEPTION 'Os dois cadastros precisam estar ativos.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.pedidos_unificacao u WHERE u.status = 'pendente'
              AND least(u.principal_id, u.absorvido_id) = least(a.id, b.id) AND greatest(u.principal_id, u.absorvido_id) = greatest(a.id, b.id)) THEN
    RAISE EXCEPTION 'Já existe pedido pendente para estes dois cadastros.';
  END IF;
  INSERT INTO public.pedidos_unificacao (unidade_id, principal_id, absorvido_id, motivo, pedido_por)
  VALUES (a.unidade_id, a.id, b.id, btrim(p_motivo), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('pedir_unificacao', 'pedidos_unificacao', v_id, a.unidade_id,
    jsonb_build_object('principal', a.id, 'absorvido', b.id));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.pedir_unificacao(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_unificacao(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decidir_unificacao(p_pedido uuid, p_aprovar boolean, p_motivo text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.pedidos_unificacao;
  a public.pacientes;
  b public.pacientes;
  v_eu uuid := private.meu_perfil_id();
  v_falta text;
  v_cpf text;
  v_cns text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.pedidos_unificacao WHERE id = p_pedido FOR UPDATE;
  IF r.id IS NULL OR NOT private.gestor_da_unidade(r.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade decide a unificação.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF r.status <> 'pendente' THEN RAISE EXCEPTION 'Este pedido já foi decidido.'; END IF;
  IF r.pedido_por = v_eu THEN RAISE EXCEPTION 'Quem pediu não aprova o próprio pedido.'; END IF;

  IF NOT p_aprovar THEN
    IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo da recusa (mínimo de 10 letras).'; END IF;
    UPDATE public.pedidos_unificacao SET status = 'recusado', decidido_por = v_eu, decidido_em = now(), motivo_decisao = btrim(p_motivo)
     WHERE id = r.id;
    PERFORM private.registrar_auditoria('recusar_unificacao', 'pedidos_unificacao', r.id, r.unidade_id, '{}'::jsonb);
    RETURN 'recusado';
  END IF;

  SELECT * INTO a FROM public.pacientes WHERE id = r.principal_id FOR UPDATE;
  SELECT * INTO b FROM public.pacientes WHERE id = r.absorvido_id FOR UPDATE;
  IF NOT a.ativo OR NOT b.ativo THEN RAISE EXCEPTION 'Um dos cadastros não está mais ativo.'; END IF;
  IF EXISTS (SELECT 1 FROM public.episodios WHERE paciente_id = a.id AND etapa <> 'encerrado')
     AND EXISTS (SELECT 1 FROM public.episodios WHERE paciente_id = b.id AND etapa <> 'encerrado') THEN
    RAISE EXCEPTION 'Os dois cadastros têm atendimento aberto. Encerre o duplicado (Ficha duplicada) e depois unifique.';
  END IF;
  -- segurança: nada de alergia/evento adverso ativo escondido no cadastro absorvido
  SELECT string_agg(x.substancia, ', ') INTO v_falta
    FROM public.alergias_paciente x
   WHERE x.paciente_id = b.id AND x.inativada_em IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.alergias_paciente y
                      WHERE y.paciente_id = a.id AND y.inativada_em IS NULL
                        AND private.nome_comparavel(y.substancia) = private.nome_comparavel(x.substancia));
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'O cadastro absorvido tem alergia ativa que não está no principal (%). Registre no cadastro principal e depois unifique.', v_falta;
  END IF;
  SELECT string_agg(x.evento, ', ') INTO v_falta
    FROM public.eventos_adversos x
   WHERE x.paciente_id = b.id AND x.inativado_em IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.eventos_adversos y
                      WHERE y.paciente_id = a.id AND y.inativado_em IS NULL
                        AND private.nome_comparavel(y.evento) = private.nome_comparavel(x.evento));
  IF v_falta IS NOT NULL THEN
    RAISE EXCEPTION 'O cadastro absorvido tem evento adverso ativo que não está no principal (%). Registre no cadastro principal e depois unifique.', v_falta;
  END IF;

  -- CPF/CNS: o principal herda o que não tem (o índice único não aceita os dois)
  IF nullif(a.cpf, '') IS NULL AND nullif(b.cpf, '') IS NOT NULL THEN v_cpf := b.cpf; END IF;
  IF nullif(a.cns, '') IS NULL AND nullif(b.cns, '') IS NOT NULL THEN v_cns := b.cns; END IF;
  UPDATE public.pacientes
     SET ativo = false, unificado_em = a.id, updated_at = now(),
         cpf = CASE WHEN v_cpf IS NOT NULL THEN NULL ELSE cpf END,
         cns = CASE WHEN v_cns IS NOT NULL THEN NULL ELSE cns END
   WHERE id = b.id;
  UPDATE public.pacientes SET cpf = coalesce(v_cpf, cpf), cns = coalesce(v_cns, cns), updated_at = now() WHERE id = a.id;
  -- quem já tinha sido absorvido pelo duplicado passa a apontar para o principal
  UPDATE public.pacientes SET unificado_em = a.id, updated_at = now() WHERE unificado_em = b.id;
  UPDATE public.pedidos_unificacao
     SET status = 'aprovado', decidido_por = v_eu, decidido_em = now(), motivo_decisao = nullif(btrim(coalesce(p_motivo, '')), ''),
         moveu_cpf = v_cpf, moveu_cns = v_cns
   WHERE id = r.id;
  PERFORM private.registrar_auditoria('aprovar_unificacao', 'pedidos_unificacao', r.id, r.unidade_id,
    jsonb_build_object('principal', a.id, 'absorvido', b.id));
  RETURN 'aprovado';
END $$;
REVOKE ALL ON FUNCTION public.decidir_unificacao(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decidir_unificacao(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.desfazer_unificacao(p_pedido uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.pedidos_unificacao;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.pedidos_unificacao WHERE id = p_pedido FOR UPDATE;
  IF r.id IS NULL OR NOT private.gestor_da_unidade(r.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade desfaz a unificação.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF r.status <> 'aprovado' THEN RAISE EXCEPTION 'Só uma unificação aprovada pode ser desfeita.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  -- devolve CPF/CNS que tinham passado ao principal (se ainda são os mesmos)
  UPDATE public.pacientes SET cpf = CASE WHEN r.moveu_cpf IS NOT NULL AND cpf = r.moveu_cpf THEN NULL ELSE cpf END,
                              cns = CASE WHEN r.moveu_cns IS NOT NULL AND cns = r.moveu_cns THEN NULL ELSE cns END,
                              updated_at = now()
   WHERE id = r.principal_id;
  UPDATE public.pacientes SET ativo = true, unificado_em = NULL, updated_at = now(),
                              cpf = coalesce(r.moveu_cpf, cpf), cns = coalesce(r.moveu_cns, cns)
   WHERE id = r.absorvido_id;
  UPDATE public.pedidos_unificacao SET status = 'desfeito', desfeito_por = private.meu_perfil_id(), desfeito_em = now(),
                                        motivo_desfazer = btrim(p_motivo)
   WHERE id = r.id;
  PERFORM private.registrar_auditoria('desfazer_unificacao', 'pedidos_unificacao', r.id, r.unidade_id,
    jsonb_build_object('principal', r.principal_id, 'absorvido', r.absorvido_id));
END $$;
REVOKE ALL ON FUNCTION public.desfazer_unificacao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desfazer_unificacao(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_unificacao(p_pedido uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.pedidos_unificacao;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO r FROM public.pedidos_unificacao WHERE id = p_pedido FOR UPDATE;
  IF r.id IS NULL OR r.pedido_por <> private.meu_perfil_id() THEN
    RAISE EXCEPTION 'Só quem pediu cancela o pedido.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF r.status <> 'pendente' THEN RAISE EXCEPTION 'Este pedido já foi decidido.'; END IF;
  UPDATE public.pedidos_unificacao SET status = 'cancelado' WHERE id = r.id;
  PERFORM private.registrar_auditoria('cancelar_unificacao', 'pedidos_unificacao', r.id, r.unidade_id, '{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.cancelar_unificacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_unificacao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pedidos_unificacao_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.pode_pedir_unificacao(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: recepção ou gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', u.id, 'status', u.status, 'motivo', u.motivo, 'pedido_em', u.pedido_em,
             'pedido_por', pp.nome_completo, 'meu', u.pedido_por = private.meu_perfil_id(),
             'decidido_por', pd.nome_completo, 'decidido_em', u.decidido_em, 'motivo_decisao', u.motivo_decisao,
             'desfeito_em', u.desfeito_em, 'motivo_desfazer', u.motivo_desfazer,
             'principal', jsonb_build_object('id', a.id, 'nome', a.nome, 'prontuario', a.prontuario, 'data_nascimento', a.data_nascimento, 'nome_mae', a.nome_mae),
             'absorvido', jsonb_build_object('id', b.id, 'nome', b.nome, 'prontuario', b.prontuario, 'data_nascimento', b.data_nascimento, 'nome_mae', b.nome_mae))
             ORDER BY (u.status = 'pendente') DESC, u.pedido_em DESC)
      FROM public.pedidos_unificacao u
      JOIN public.pacientes a ON a.id = u.principal_id
      JOIN public.pacientes b ON b.id = u.absorvido_id
      LEFT JOIN public.perfis pp ON pp.id = u.pedido_por
      LEFT JOIN public.perfis pd ON pd.id = u.decidido_por
     WHERE u.unidade_id = p_unidade
       AND (private.gestor_da_unidade(p_unidade) OR u.pedido_por = private.meu_perfil_id())
     LIMIT 200), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.pedidos_unificacao_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedidos_unificacao_da_unidade(uuid) TO authenticated;

-- os ids da família, para a leitura do prontuário juntar os cadastros
CREATE OR REPLACE FUNCTION public.cadastros_do_paciente(p_paciente uuid)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL OR NOT (private.gestor_da_unidade(v_unidade) OR private.pode_atuar_no_paciente(p_paciente)
                               OR private.acesso_encerrado_vigente(p_paciente) OR private.teleinterconsulta_vigente(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN ARRAY(SELECT private.familia_paciente(p_paciente));
END $$;
REVOKE ALL ON FUNCTION public.cadastros_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cadastros_do_paciente(uuid) TO authenticated;

-- ── o histórico encerrado junta os cadastros unificados ────────────────────
CREATE OR REPLACE FUNCTION public.historico_encerrado(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid;
  v_cuida   boolean;
  v_res     jsonb;
  v_ator    uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  v_cuida := private.cuida_do_paciente_agora(p_paciente);
  IF v_unidade IS NULL OR NOT (v_cuida OR private.gestor_da_unidade(v_unidade) OR private.acesso_encerrado_vigente(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado: o histórico aparece para quem cuida do paciente agora.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
    'pode_abrir_detalhe', v_cuida,
    'detalhe_liberado_ate', (SELECT max(ah.valido_ate) FROM private.acessos_historico ah
                              WHERE ah.paciente_id = p_paciente AND ah.perfil_id = v_ator AND ah.valido_ate > now()),
    'atendimentos', coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'chegada_em', x.chegada_em, 'encerrado_em', x.encerrado_em, 'setor', x.setor,
        'cor', x.cor, 'desfecho', x.desfecho, 'cid', x.cid, 'medico', x.medico, 'cadastro', x.cadastro)
      ORDER BY x.chegada_em DESC), '[]'::jsonb))
    INTO v_res
    FROM (
      SELECT e.id, e.chegada_em,
             coalesce(i.data_alta, e.encerrado_em) AS encerrado_em,
             coalesce(si.nome, s.nome) AS setor,
             e.cor_atual AS cor,
             -- o desfecho final: o da internação/observação quando o atendimento seguiu para lá
             CASE WHEN i.status IS NOT NULL AND i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN i.status
                  ELSE e.desfecho END AS desfecho,
             nullif(coalesce(i.cid_alta, e.desfecho_detalhes ->> 'cid_alta', i.cid_principal), '') AS cid,
             coalesce(pm.nome_completo, pd.nome_completo) AS medico,
             -- prontuário do cadastro em que foi gravado (unificação, tarefa 9)
             (SELECT pc.prontuario FROM public.pacientes pc WHERE pc.id = e.paciente_id) AS cadastro
        FROM public.episodios e
        JOIN public.setores s ON s.id = e.setor_id
        LEFT JOIN LATERAL (
          SELECT x.* FROM public.internacoes x WHERE x.episodio_id = e.id ORDER BY x.created_at DESC LIMIT 1) i ON true
        LEFT JOIN public.setores si ON si.id = i.setor_atual_id
        LEFT JOIN public.perfis pm ON pm.id = e.atendimento_medico_id
        LEFT JOIN public.perfis pd ON pd.id = e.desfecho_por
       WHERE e.paciente_id IN (SELECT private.familia_paciente(p_paciente))
         AND e.unidade_id = v_unidade
         AND e.etapa = 'encerrado'
         -- a internação que ainda corre não é histórico encerrado
         AND (i.status IS NULL OR i.status NOT IN ('admitido', 'em_observacao', 'internado'))
       ORDER BY e.chegada_em DESC
       LIMIT 200) x;

  -- resumo de paciente para quem não é da escala do setor de origem: fica na trilha (15 min)
  IF jsonb_array_length(v_res -> 'atendimentos') > 0 AND NOT EXISTS (
       SELECT 1 FROM public.log_auditoria a
        WHERE a.ator_id = v_ator AND a.entidade_id = p_paciente AND a.acao = 'ver_historico_resumo'
          AND a.created_at > now() - interval '15 minutes') THEN
    PERFORM private.registrar_auditoria('ver_historico_resumo', 'pacientes', p_paciente, v_unidade,
      jsonb_build_object('atendimentos', jsonb_array_length(v_res -> 'atendimentos')));
  END IF;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.historico_encerrado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.historico_encerrado(uuid) TO authenticated;

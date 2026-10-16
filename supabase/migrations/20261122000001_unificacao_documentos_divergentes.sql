-- Portão 2, tarefa 3 (R2-02): unificação de cadastros com CPF ou CNS diferentes
-- é aceita, com alerta. Decisões do RT em 16/10/2026 ("1a 2a 3a 4a 5a 6a"):
--
--  1a. Divergente = CPF ou CNS preenchidos nos dois cadastros e diferentes.
--  2a. No pedido: alerta, motivo de 30 letras ou mais e "confirmo que é a mesma
--      pessoa".
--  3a. Aprova outro gestor (como antes), vendo o alerta e marcando a confirmação.
--  4a. Depois de aprovada, a busca pelo CPF/CNS do absorvido acha o principal,
--      com o aviso "documento de cadastro unificado".
--  5a. A lista de candidatos mostra "documentos diferentes" (na tela, a partir
--      do CPF/CNS que candidatos_duplicados já devolve).
--  6a. Levantamento das unificações já aprovadas: consulta só de leitura, fora
--      desta migration.
--
-- Os corpos de pedir_unificacao, pedidos_unificacao_da_unidade e
-- buscar_pacientes foram conferidos (md5) iguais no local e na produção em
-- 16/10/2026 antes de serem reescritos aqui.

-- 1a. quais documentos divergem entre dois cadastros
CREATE OR REPLACE FUNCTION private.documentos_divergentes(p_a uuid, p_b uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN nullif(private.so_digitos(a.cpf), '') IS NOT NULL AND nullif(private.so_digitos(b.cpf), '') IS NOT NULL
              AND private.so_digitos(a.cpf) <> private.so_digitos(b.cpf) THEN 'CPF' END,
    CASE WHEN nullif(private.so_digitos(a.cns), '') IS NOT NULL AND nullif(private.so_digitos(b.cns), '') IS NOT NULL
              AND private.so_digitos(a.cns) <> private.so_digitos(b.cns) THEN 'CNS' END], NULL)
    FROM public.pacientes a, public.pacientes b
   WHERE a.id = p_a AND b.id = p_b
$$;
REVOKE ALL ON FUNCTION private.documentos_divergentes(uuid, uuid) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.pedidos_unificacao
  ADD COLUMN IF NOT EXISTS divergencias text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS confirmado_no_pedido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_na_decisao boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.pedidos_unificacao.divergencias IS
  'Documentos diferentes entre os dois cadastros (CPF, CNS) no momento do pedido; na aprovação, os do momento da decisão.';

-- 2a. pedido com divergência: motivo de 30 letras e confirmação
DROP FUNCTION IF EXISTS public.pedir_unificacao(uuid, uuid, text);
CREATE FUNCTION public.pedir_unificacao(p_principal uuid, p_absorvido uuid, p_motivo text, p_confirmo boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  a public.pacientes;
  b public.pacientes;
  v_id uuid;
  v_div text[];
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
  v_div := private.documentos_divergentes(a.id, b.id);
  IF cardinality(v_div) > 0 THEN
    IF length(btrim(coalesce(p_motivo, ''))) < 30 OR p_confirmo IS NOT TRUE THEN
      RAISE EXCEPTION 'Documentos diferentes (%): os cadastros podem ser de pessoas diferentes. Para pedir mesmo assim, escreva o motivo (mínimo de 30 letras) e confirme que é a mesma pessoa.',
        array_to_string(v_div, ' e ') USING HINT = 'documentos_divergentes';
    END IF;
  ELSIF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pedidos_unificacao u WHERE u.status = 'pendente'
              AND least(u.principal_id, u.absorvido_id) = least(a.id, b.id) AND greatest(u.principal_id, u.absorvido_id) = greatest(a.id, b.id)) THEN
    RAISE EXCEPTION 'Já existe pedido pendente para estes dois cadastros.';
  END IF;
  INSERT INTO public.pedidos_unificacao (unidade_id, principal_id, absorvido_id, motivo, pedido_por, divergencias, confirmado_no_pedido)
  VALUES (a.unidade_id, a.id, b.id, btrim(p_motivo), private.meu_perfil_id(), v_div, cardinality(v_div) > 0 AND p_confirmo)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('pedir_unificacao', 'pedidos_unificacao', v_id, a.unidade_id,
    jsonb_build_object('principal', a.id, 'absorvido', b.id, 'documentos_divergentes', v_div));
  RETURN v_id;
END $function$;
REVOKE ALL ON FUNCTION public.pedir_unificacao(uuid, uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_unificacao(uuid, uuid, text, boolean) TO authenticated;

-- 3a. aprovar com divergência exige a confirmação do gestor. A decisão antiga
-- muda para private com o mesmo nome (sem renomear) e só é chamada por este
-- invólucro. Expand/contract: a versão anterior do app chama
-- public.decidir_unificacao(p_pedido, p_aprovar, p_motivo), que continua
-- existindo (o invólucro aceita os mesmos argumentos; p_confirmo tem default).
ALTER FUNCTION public.decidir_unificacao(uuid, boolean, text) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.decidir_unificacao(uuid, boolean, text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.decidir_unificacao(p_pedido uuid, p_aprovar boolean, p_motivo text DEFAULT NULL, p_confirmo boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  r public.pedidos_unificacao;
  v_div text[];
  v_res text;
BEGIN
  SELECT * INTO r FROM public.pedidos_unificacao WHERE id = p_pedido;
  IF p_aprovar AND r.id IS NOT NULL AND r.status = 'pendente' AND private.gestor_da_unidade(r.unidade_id) THEN
    v_div := private.documentos_divergentes(r.principal_id, r.absorvido_id);
    IF cardinality(v_div) > 0 AND p_confirmo IS NOT TRUE THEN
      RAISE EXCEPTION 'Documentos diferentes (%): confirme que é a mesma pessoa para aprovar.', array_to_string(v_div, ' e ')
        USING HINT = 'documentos_divergentes';
    END IF;
  END IF;
  v_res := private.decidir_unificacao(p_pedido, p_aprovar, p_motivo);
  IF v_res = 'aprovado' THEN
    UPDATE public.pedidos_unificacao SET divergencias = coalesce(v_div, '{}'), confirmado_na_decisao = cardinality(coalesce(v_div, '{}')) > 0
     WHERE id = p_pedido;
    IF cardinality(coalesce(v_div, '{}')) > 0 THEN
      PERFORM private.registrar_auditoria('aprovar_unificacao_documentos_divergentes', 'pedidos_unificacao', p_pedido, r.unidade_id,
        jsonb_build_object('documentos_divergentes', v_div));
    END IF;
  END IF;
  RETURN v_res;
END $function$;
REVOKE ALL ON FUNCTION public.decidir_unificacao(uuid, boolean, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decidir_unificacao(uuid, boolean, text, boolean) TO authenticated;

-- a lista de pedidos mostra a divergência (a atual, enquanto pendente)
CREATE OR REPLACE FUNCTION public.pedidos_unificacao_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
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
             'divergencias', to_jsonb(CASE WHEN u.status = 'pendente' THEN private.documentos_divergentes(a.id, b.id) ELSE u.divergencias END),
             'confirmado_no_pedido', u.confirmado_no_pedido, 'confirmado_na_decisao', u.confirmado_na_decisao,
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
END $function$;

-- 4a. a busca pelo CPF/CNS de um cadastro absorvido acha o principal
DROP FUNCTION IF EXISTS public.buscar_pacientes(uuid, text);
CREATE FUNCTION public.buscar_pacientes(p_unidade uuid, p_termo text)
RETURNS TABLE(id uuid, nome text, nome_social text, data_nascimento date, nome_mae text, cpf_final text, cns_final text,
              prontuario text, episodio_etapa text, documento_unificado boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_dig text := private.so_digitos(p_termo);
  v_nome text := private.nome_comparavel(p_termo);
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor'
      OR private.na_escala_agora(p_unidade)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: busca só para quem está de plantão na unidade.';
  END IF;
  IF length(coalesce(v_nome, '')) < 3 AND length(coalesce(v_dig, '')) < 4 THEN
    RAISE EXCEPTION 'Digite ao menos 3 letras do nome ou 4 números do documento.';
  END IF;

  RETURN QUERY
  WITH achados AS (
    SELECT p.id AS pid, false AS via_unificado
      FROM public.pacientes p
     WHERE p.unidade_id = p_unidade AND p.ativo
       AND (   (v_dig IS NOT NULL AND length(v_dig) >= 4 AND (p.cpf = v_dig OR p.cns = v_dig OR private.so_digitos(p.prontuario) = v_dig))
            OR (length(coalesce(v_nome, '')) >= 3 AND (private.nome_comparavel(p.nome) LIKE '%' || v_nome || '%'
                                                        OR private.nome_comparavel(p.nome_social) LIKE '%' || v_nome || '%'
                                                        OR private.nome_comparavel(p.nome_mae) LIKE '%' || v_nome || '%')))
    UNION ALL
    -- documento que ficou no cadastro absorvido (inativo): leva ao principal
    SELECT private.paciente_principal(p.id), true
      FROM public.pacientes p
     WHERE p.unidade_id = p_unidade AND NOT p.ativo AND p.unificado_em IS NOT NULL
       AND v_dig IS NOT NULL AND length(v_dig) >= 4 AND (p.cpf = v_dig OR p.cns = v_dig)
  ), unicos AS (
    SELECT x.pid, bool_and(x.via_unificado) AS via_unificado FROM achados x GROUP BY x.pid
  )
  SELECT p.id, p.nome, p.nome_social, p.data_nascimento, p.nome_mae,
         private.mascarar(p.cpf), private.mascarar(p.cns), p.prontuario,
         (SELECT e.etapa FROM public.episodios e WHERE e.paciente_id = p.id AND e.etapa <> 'encerrado'),
         u.via_unificado
  FROM unicos u JOIN public.pacientes p ON p.id = u.pid AND p.ativo
  ORDER BY p.nome
  LIMIT 20;
END $function$;
REVOKE ALL ON FUNCTION public.buscar_pacientes(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_pacientes(uuid, text) TO authenticated, service_role;

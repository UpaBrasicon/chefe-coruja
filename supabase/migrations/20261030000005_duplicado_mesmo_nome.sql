-- Fase 1, tarefa 9 — teste do RT (08/10/2026): os duplicados reais da
-- homologação tinham o MESMO NOME com nascimento DIFERENTE (erro de digitação)
-- ou EM BRANCO, e as três regras não os pegavam. Decisão do RT: incluir a regra
-- ampla "mesmo nome completo" (sem acento/maiúscula), marcada como
-- 'nome_conferir' — o gestor confere antes de aprovar.
-- Só troca o corpo de candidatos_duplicados (mesma assinatura).
--
-- ROLLBACK: reaplicar public.candidatos_duplicados de 20261030000004.
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
       WHERE (a.n = b.n AND a.data_nascimento = b.data_nascimento)
          OR (a.m IS NOT NULL AND a.m = b.m AND a.data_nascimento = b.data_nascimento)
          OR nullif(a.cpf, '') = nullif(b.cpf, '') OR nullif(a.cns, '') = nullif(b.cns, '')
          OR a.n = b.n
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

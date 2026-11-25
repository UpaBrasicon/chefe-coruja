-- Volta da migration 20270421000076_pessoas_diferentes.sql.
--
-- 1. candidatos_duplicados volta ao corpo ANTERIOR, tirado da homologação
--    (kswurfyxxvfydpjfrivy) com pg_get_functiondef em 24/11/2026; é o corpo de
--    20261030000005_duplicado_mesmo_nome.sql. Os pares marcados voltam a ser
--    sugeridos.
-- 2. Saem as funções novas. A tabela public.pacientes_pessoas_diferentes só
--    sai se ninguém tiver marcado par nenhum; com linhas, fica (o registro de
--    quem decidiu é trilha) e só deixa de ser usada.
-- Ensaiado na homologação em 24/11/2026 numa transação desfeita (migration +
-- este arquivo): corpo anterior de volta, funções e tabela vazia fora.
-- Depois de rodar, conferir com supabase/tests/fase1_unificar_pacientes.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.candidatos_duplicados(p_unidade uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$;
REVOKE ALL ON FUNCTION public.candidatos_duplicados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidatos_duplicados(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.pessoas_diferentes_da_unidade(uuid);
DROP FUNCTION IF EXISTS public.desfazer_pessoas_diferentes(uuid);
DROP FUNCTION IF EXISTS public.marcar_pessoas_diferentes(uuid, uuid, text);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pacientes_pessoas_diferentes) THEN
    DROP TABLE public.pacientes_pessoas_diferentes;
    DROP FUNCTION IF EXISTS private.pode_marcar_pessoas_diferentes(uuid);
  ELSE
    RAISE NOTICE 'public.pacientes_pessoas_diferentes tem linhas: a tabela e a política ficam, só sem uso.';
  END IF;
END $$;

COMMIT;

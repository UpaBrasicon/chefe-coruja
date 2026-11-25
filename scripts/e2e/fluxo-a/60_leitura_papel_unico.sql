-- leitura (só SELECT) como contas de papel único da rede Fase 5, para ver o que a RLS entrega
BEGIN;
CREATE TEMP TABLE _o (quem text, o text, n text) ON COMMIT DROP;
GRANT ALL ON _o TO authenticated;
CREATE FUNCTION pg_temp.le(p_quem text, p_sub uuid, p_o text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN EXECUTE p_sql INTO v; EXCEPTION WHEN others THEN v := 'ERRO: ' || SQLERRM; END;
  PERFORM set_config('role', 'postgres', true);
  INSERT INTO _o VALUES (p_quem, p_o, v);
END $$;
SELECT pg_temp.le(q.quem, q.sub, o.o, o.s)
FROM (VALUES ('recepcao UBS F5', 'f5200000-0000-4000-8000-000000000001'::uuid), ('tecnico UBS F5', 'f5200000-0000-4000-8000-000000000003'::uuid),
             ('medica UBS F5', 'f5200000-0000-4000-8000-000000000004'::uuid), ('recepcao UPA F5', 'f5200000-0000-4000-8000-000000000006'::uuid)) q(quem, sub),
     (VALUES ('soap da UBS F5', $$SELECT count(*)::text FROM public.atendimento_registros WHERE unidade_id = 'f5100000-0000-4000-8000-000000000001'$$),
             ('classificacoes da UBS F5', $$SELECT count(*)::text FROM public.classificacoes_risco WHERE unidade_id = 'f5100000-0000-4000-8000-000000000001'$$),
             ('sinais da UBS F5', $$SELECT count(*)::text FROM public.observacao WHERE unidade_id = 'f5100000-0000-4000-8000-000000000001'$$),
             ('pacientes da UBS F5', $$SELECT count(*)::text FROM public.pacientes WHERE unidade_id = 'f5100000-0000-4000-8000-000000000001'$$),
             ('pacientes da UPA F5', $$SELECT count(*)::text FROM public.pacientes WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002'$$),
             ('soap da UPA F5', $$SELECT count(*)::text FROM public.atendimento_registros WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002'$$),
             ('episodios da UPA F5', $$SELECT count(*)::text FROM public.episodios WHERE unidade_id = 'f5100000-0000-4000-8000-000000000002'$$),
             ('envios (origem UBS F5)', $$SELECT jsonb_array_length(public.encaminhamentos_upa_origem('f5100000-0000-4000-8000-000000000001', 365))::text$$),
             ('painel vindo da UBS (UPA F5)', $$SELECT jsonb_array_length(public.encaminhamentos_upa_destino('f5100000-0000-4000-8000-000000000002'))::text$$),
             ('pacientes da UBS Homologacao', $$SELECT count(*)::text FROM public.pacientes WHERE unidade_id = 'f2aa0e11-e57d-4f45-871d-12bedb152bec'$$)) o(o, s);
SELECT jsonb_agg(to_jsonb(x)) todos FROM (SELECT * FROM _o ORDER BY o, quem) x;
ROLLBACK;

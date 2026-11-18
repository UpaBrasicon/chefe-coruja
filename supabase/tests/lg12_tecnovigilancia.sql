-- Testes da migration 20270418000094 (LG12: tecnovigilância do módulo clínico). ROLLBACK no fim.
BEGIN;
UPDATE public.configuracao_plataforma SET valor = false WHERE chave = 'exigir_segundo_fator';
INSERT INTO public.super_admins (perfil_id) VALUES ('10000000-0000-4000-8000-000000000003') ON CONFLICT DO NOTHING;
-- RT médico = ...002; gestora = ...001; quem relata = ...005 (recepção) e ...002
UPDATE public.responsaveis_tecnicos SET ativo = false, encerrado_em = now() WHERE ativo AND tipo = 'medico';
INSERT INTO public.responsaveis_tecnicos (perfil_id, tipo, conselho, registro, uf)
VALUES ('10000000-0000-4000-8000-000000000002', 'medico', 'CRM', '12345', 'SP');
CREATE TEMP TABLE u ON COMMIT DROP AS SELECT id FROM public.unidades ORDER BY id LIMIT 1;
GRANT SELECT ON u TO authenticated;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel, criado_por)
SELECT p.perfil::uuid, u.id, p.papel::public.papel, p.perfil::uuid FROM u,
  (VALUES ('10000000-0000-4000-8000-000000000001', 'gestor'), ('10000000-0000-4000-8000-000000000005', 'recepcao'),
          ('10000000-0000-4000-8000-000000000002', 'plantonista')) p(perfil, papel)
ON CONFLICT (perfil_id, unidade_id, papel) DO UPDATE SET ativo = true;
SELECT private.registrar_versao_ferramenta('teste-tv', 'Ferramenta de teste da tecnovigilância', 'v1', 'adulto', '[{"citacao":"Fonte X"}]');

CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok; RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;
CREATE FUNCTION pg_temp.confere(p_ok boolean, p_msg text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_ok THEN RAISE EXCEPTION 'FALHOU: %', p_msg; END IF;
  RAISE NOTICE 'OK  %', p_msg;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.confere(boolean, text) TO authenticated;
CREATE TEMP TABLE r (k text PRIMARY KEY, v jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

-- dado pessoal no texto
SELECT pg_temp.confere(private.tem_dado_pessoal('paciente CPF 123.456.789-09 com erro'), 'acha CPF com pontos');
SELECT pg_temp.confere(private.tem_dado_pessoal('cpf 12345678909'), 'acha CPF sem pontos');
SELECT pg_temp.confere(private.tem_dado_pessoal('CNS 898 0011 2233 4455'), 'acha CNS');
SELECT pg_temp.confere(private.tem_dado_pessoal('ligar (62) 99876-5432'), 'acha telefone');
SELECT pg_temp.confere(NOT private.tem_dado_pessoal('Versão 2026-11-17.1: dose de 1000 mg em 18/11/2026, plaquetas 150000'), 'versão, data e dose passam');

-- V1: relatar
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SET LOCAL ROLE authenticated;
SELECT pg_temp.falha($$SELECT public.relatar_tecnovigilancia('teste-tv', 'v1', (SELECT id FROM u), 'conteudo', NULL, 'CPF 123.456.789-09 errado')$$,
  'O texto parece ter CPF', 'recusa texto com CPF');
SELECT pg_temp.falha($$SELECT public.relatar_tecnovigilancia('teste-tv', 'v1', (SELECT id FROM u), 'paciente', NULL, 'chegou ao paciente sem desfecho')$$,
  'Quando o problema chegou ao paciente', 'paciente pede desfecho');
SELECT pg_temp.falha($$SELECT public.relatar_tecnovigilancia('teste-tv', 'v1', gen_random_uuid(), 'sistema', NULL, 'unidade sem vínculo nenhum')$$,
  'Você não tem vínculo', 'só na unidade em que tem vínculo');
INSERT INTO r SELECT 'conteudo', public.relatar_tecnovigilancia('teste-tv', 'v1', (SELECT id FROM u), 'conteudo', NULL, 'A conta do clearance sai errada com peso 70.');
INSERT INTO r SELECT 'obito', public.relatar_tecnovigilancia('teste-tv', 'v1', (SELECT id FROM u), 'paciente', 'obito', 'Dose errada seguida, paciente evoluiu a óbito.');
INSERT INTO r SELECT 'sistema', public.relatar_tecnovigilancia('teste-tv', 'v1', NULL, 'sistema', NULL, 'A tela travou ao abrir a ficha.');
SELECT pg_temp.confere((SELECT (v ->> 'grave')::boolean FROM r WHERE k = 'obito') AND NOT (SELECT (v ->> 'grave')::boolean FROM r WHERE k = 'conteudo'), 'óbito é grave; conteúdo não');
SELECT pg_temp.confere((SELECT (v ->> 'prazo_em')::timestamptz FROM r WHERE k = 'obito') = now() + interval '72 hours', 'óbito: prazo de 72 h');
SELECT pg_temp.confere((SELECT (v ->> 'prazo_em')::timestamptz FROM r WHERE k = 'conteudo') = now() + interval '30 days', 'conteúdo: prazo de 30 dias');
SELECT pg_temp.confere(jsonb_array_length(public.meus_relatos_tecnovigilancia()) = 3, 'quem relatou vê os seus');
SELECT pg_temp.confere((public.meus_relatos_tecnovigilancia() -> 0 ->> 'relatado_por') IS NULL, 'a lista de quem relatou não traz nomes');
SELECT pg_temp.falha($$SELECT public.fila_tecnovigilancia()$$, 'A fila de tecnovigilância é do responsável técnico', 'recepção não vê a fila');
SELECT pg_temp.falha($$SELECT public.tecnovigilancia_da_unidade((SELECT id FROM u))$$, 'Só o gestor da unidade', 'recepção não vê os da unidade');
SELECT pg_temp.falha($$SELECT public.aviso_tecnovigilancia((SELECT (v ->> 'id')::uuid FROM r WHERE k = 'obito'))$$, 'permission denied', 'usuário não chama o aviso');
SELECT pg_temp.falha($$SELECT * FROM private.tecnovigilancia_relatos$$, 'permission denied', 'usuário não lê a tabela');

-- cópia do gestor
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.confere(jsonb_array_length(public.tecnovigilancia_da_unidade((SELECT id FROM u))) = 2, 'gestor vê os 2 relatos da unidade');

-- V2: fila, investigação e conclusão pelo RT
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.confere((public.fila_tecnovigilancia() -> 0 ->> 'numero')::bigint = (SELECT (v ->> 'numero')::bigint FROM r WHERE k = 'obito'), 'fila começa pelo prazo mais curto');
SELECT pg_temp.falha($$SELECT public.andamento_tecnovigilancia((SELECT (v ->> 'id')::uuid FROM r WHERE k = 'conteudo'), 'concluido', 'Conferido e corrigido.', NULL, NULL)$$,
  'A conclusão diz a causa', 'conclusão pede causa e ação');
SELECT public.andamento_tecnovigilancia((SELECT (v ->> 'id')::uuid FROM r WHERE k = 'conteudo'), 'em_investigacao', 'Conferindo a fórmula com a fonte.');
SELECT public.andamento_tecnovigilancia((SELECT (v ->> 'id')::uuid FROM r WHERE k = 'conteudo'), 'concluido', 'A fórmula usava o peso ideal.',
  'Peso errado na fórmula', 'Fórmula corrigida e aprovada', 'v2');
SELECT pg_temp.falha($$SELECT public.andamento_tecnovigilancia((SELECT (v ->> 'id')::uuid FROM r WHERE k = 'conteudo'), 'em_investigacao', 'Reabrindo o relato.')$$,
  'Relato já concluído', 'concluído não reabre');

-- V4: suspensão na rede
SELECT pg_temp.confere(public.suspender_versao_rede('teste-tv', 'v1', 'Conta errada relatada pela unidade.', (SELECT (v ->> 'id')::uuid FROM r WHERE k = 'conteudo')) IS NOT NULL, 'RT suspende a versão na rede');
SELECT pg_temp.falha($$SELECT public.suspender_versao_rede('teste-tv', 'v1', 'De novo a mesma versão.')$$, 'Esta versão já está suspensa', 'não suspende duas vezes');
SELECT pg_temp.confere(public.situacao_ferramenta('teste-tv', 'v1') -> 'suspensa_rede' ->> 'motivo' = 'Conta errada relatada pela unidade.', 'a ficha mostra a suspensão na rede');
SELECT pg_temp.confere(public.situacao_ferramenta('teste-tv', 'v2') -> 'suspensa_rede' = 'null'::jsonb OR public.situacao_ferramenta('teste-tv', 'v2') -> 'suspensa_rede' IS NULL, 'a versão corrigida não fica suspensa');
SELECT public.encerrar_suspensao_rede((SELECT (x ->> 'id')::uuid FROM jsonb_array_elements(public.suspensoes_rede_vigentes()) x WHERE x ->> 'ferramenta_id' = 'teste-tv'),
  'Versão corrigida aprovada e publicada.');
SELECT pg_temp.confere(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.suspensoes_rede_vigentes()) x WHERE x ->> 'ferramenta_id' = 'teste-tv'), 'suspensão encerrada');

-- quem relatou vê a conclusão (art. 6º, XI)
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM jsonb_array_elements(public.meus_relatos_tecnovigilancia()) x
  WHERE x ->> 'situacao' = 'concluido' AND x -> 'andamento' @> '[{"causa": "Peso errado na fórmula"}]'), 'quem relatou vê a causa da conclusão');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.suspender_versao_rede('teste-tv', 'v1', 'Gestor tentando suspender.')$$, 'Só o responsável técnico médico', 'gestor não suspende na rede');
RESET ROLE;

-- só inclusão
SELECT pg_temp.falha($$UPDATE private.tecnovigilancia_relatos SET descricao = 'mudado aqui' WHERE ferramenta_id = 'teste-tv'$$,
  'Registro de tecnovigilância é só de inclusão', 'relato não muda');

-- aviso ao RT: só o grave, uma vez
SELECT pg_temp.confere(public.aviso_tecnovigilancia((SELECT (v ->> 'id')::uuid FROM r WHERE k = 'conteudo')) IS NULL, 'relato não grave não avisa');
SELECT pg_temp.confere(jsonb_array_length(public.aviso_tecnovigilancia((SELECT (v ->> 'id')::uuid FROM r WHERE k = 'obito')) -> 'destinatarios') >= 1, 'grave traz o e-mail do RT');
SELECT public.aviso_tecnovigilancia((SELECT (v ->> 'id')::uuid FROM r WHERE k = 'obito'), true);
SELECT pg_temp.confere(public.aviso_tecnovigilancia((SELECT (v ->> 'id')::uuid FROM r WHERE k = 'obito')) IS NULL, 'aviso não se repete');
SELECT pg_temp.confere(has_function_privilege('service_role', 'public.aviso_tecnovigilancia(uuid,boolean)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.aviso_tecnovigilancia(uuid,boolean)', 'EXECUTE'), 'aviso só pela chave de serviço');

-- V3: guarda de 5 anos (simula conclusão antiga)
ALTER TABLE private.tecnovigilancia_andamento DISABLE TRIGGER tecnovigilancia_andamento_so_inclusao;
UPDATE private.tecnovigilancia_andamento SET em = now() - interval '6 years'
 WHERE situacao = 'concluido' AND relato_id = (SELECT (v ->> 'id')::uuid FROM r WHERE k = 'conteudo');
ALTER TABLE private.tecnovigilancia_andamento ENABLE TRIGGER tecnovigilancia_andamento_so_inclusao;
SELECT pg_temp.confere(private.apagar_tecnovigilancia_vencida() = 1, 'rotina apaga o concluído há mais de 5 anos');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM private.tecnovigilancia_relatos WHERE id = (SELECT (v ->> 'id')::uuid FROM r WHERE k = 'obito')), 'o aberto fica');
SELECT pg_temp.confere(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lg12-tecnovigilancia-5-anos' AND schedule = '50 6 * * *'), 'agendamento diário às 06:50 UTC');
SELECT pg_temp.confere(NOT has_function_privilege('anon', 'public.relatar_tecnovigilancia(text,text,uuid,text,text,text)', 'EXECUTE'), 'anônimo não relata');

ROLLBACK;

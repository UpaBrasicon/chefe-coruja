-- Testes do termo de consentimento (migration 20261004000004). ROLLBACK no fim.
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_termo.sql
-- Modelos da unidade: só o gestor escreve; editar cria versão nova e a antiga
-- fica; desativado some da escolha do médico. Termo: documento numerado no
-- prontuário; menor de 14 anos assina pelo responsável ou registra a ausência;
-- adulto sem condições pede motivo; retificar cria versão; cancelar pede
-- justificativa; nada se apaga; segundo fator nas escritas.
BEGIN;
-- médico (…0002) e enfermeira (…0004) e recepção (…0005) de plantão no PS
DELETE FROM public.escala_plantao WHERE perfil_id IN ('10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005');
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', p, private.data_atual(), 'manha', now() - interval '1 hour', 360
  FROM unnest(ARRAY['10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004',
                    '10000000-0000-4000-8000-000000000005']::uuid[]) p;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
UPDATE public.perfis SET crm = '128446', uf_crm = 'SP' WHERE id = '10000000-0000-4000-8000-000000000002';

CREATE TEMP TABLE t (nome text PRIMARY KEY, valor text) ON COMMIT DROP;
GRANT ALL ON t TO authenticated;
CREATE FUNCTION pg_temp.v(p text) RETURNS text LANGUAGE sql AS $$ SELECT valor FROM t WHERE nome = p $$;
CREATE FUNCTION pg_temp.u(p text) RETURNS uuid LANGUAGE sql AS $$ SELECT valor::uuid FROM t WHERE nome = p $$;
GRANT EXECUTE ON FUNCTION pg_temp.v(text), pg_temp.u(text) TO authenticated;
CREATE FUNCTION pg_temp.como(p text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
GRANT EXECUTE ON FUNCTION pg_temp.como(text) TO authenticated;
CREATE FUNCTION pg_temp.falha(p_sql text, p_msg text, p_ok text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE p_msg || '%' THEN RAISE EXCEPTION 'FALHOU (%): erro inesperado: %', p_ok, SQLERRM; END IF;
    RAISE NOTICE 'OK  %', p_ok;
    RETURN;
  END;
  RAISE EXCEPTION 'FALHOU: % — passou sem erro', p_ok;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.falha(text, text, text) TO authenticated;

SET LOCAL ROLE authenticated;

-- ── modelos: gestor cria, edita (versão nova), desativa ─────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha($$SELECT public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'Punção', 'Punção lombar',
  'Texto técnico da punção lombar com riscos e alternativas.')$$, 'Acesso negado', 'enfermagem não escreve modelo de termo');

SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'Punção', 'Punção lombar', 'curto')$$,
  'Escreva o texto técnico', 'modelo sem texto técnico é recusado');
INSERT INTO t SELECT 'm1', public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'Punção lombar', 'Punção lombar',
  'A punção lombar em {paciente} retira líquor para exame. Riscos: dor de cabeça, sangramento. Alternativa: tratar sem o exame.');
INSERT INTO t SELECT 'm2', public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'Acesso venoso central', 'Punção venosa central',
  'O cateter venoso central é colocado numa veia grande. Riscos: pneumotórax, infecção, sangramento.', 'autorizo o procedimento e sei que posso desistir antes.');
SELECT pg_temp.falha($$SELECT public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'punção LOMBAR', 'x punção',
  'Outro texto técnico qualquer com mais de vinte letras.')$$, 'Já existe um modelo com este nome', 'nome repetido na unidade é recusado');
DO $$
BEGIN
  IF public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'Punção lombar', 'Punção lombar',
       'A punção lombar em {paciente} retira líquor para exame. Riscos: dor de cabeça, sangramento. Alternativa: tratar sem o exame.',
       NULL, pg_temp.u('m1')) <> pg_temp.u('m1') THEN
    RAISE EXCEPTION 'FALHOU: salvar sem mudança não deveria criar versão';
  END IF;
  RAISE NOTICE 'OK  salvar sem mudança devolve a mesma versão';
END $$;
INSERT INTO t SELECT 'm1v2', public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'Punção lombar', 'Punção lombar diagnóstica',
  'A punção lombar em {paciente} ({idade}) retira líquor para exame. Riscos: dor de cabeça, sangramento. Alternativa: tratar sem o exame.',
  NULL, pg_temp.u('m1'));
SELECT pg_temp.falha(format('SELECT public.salvar_modelo_termo(%L, %L, %L, %L, NULL, %L)', '21000000-0000-4000-8000-000000000001',
  'Punção lombar', 'Punção lombar', 'Texto antigo editado de novo, que já não vale mais.', pg_temp.v('m1')),
  'Este modelo já foi editado', 'editar versão substituída é recusado');
DO $$
DECLARE a public.termos_modelos; b public.termos_modelos;
BEGIN
  SELECT * INTO a FROM public.termos_modelos WHERE id = pg_temp.u('m1');
  SELECT * INTO b FROM public.termos_modelos WHERE id = pg_temp.u('m1v2');
  IF a.vigente OR NOT b.vigente OR a.raiz_id <> b.raiz_id OR b.versao <> 2 OR a.texto NOT LIKE '%{paciente} retira%' THEN
    RAISE EXCEPTION 'FALHOU: edição deveria criar versão 2 e manter a 1 (% / %)', a, b;
  END IF;
  RAISE NOTICE 'OK  editar cria versão 2 e a versão 1 fica, substituída';
END $$;
SELECT public.ativar_modelo_termo(pg_temp.u('m2'), false);
SELECT pg_temp.falha(format('SELECT public.ativar_modelo_termo(%L, false)', pg_temp.v('m1')),
  'Esta versão já foi substituída', 'desativar versão substituída é recusado');
SELECT pg_temp.falha(format('DELETE FROM public.termos_modelos WHERE id = %L', pg_temp.v('m1')),
  'permission denied', 'ninguém apaga modelo pela tabela');
SELECT pg_temp.falha(format('UPDATE public.termos_modelos SET texto = %L WHERE id = %L', 'mudado por fora da RPC', pg_temp.v('m1v2')),
  'permission denied', 'ninguém altera modelo pela tabela');
DO $$
BEGIN
  IF (SELECT count(*) FROM public.termos_modelos WHERE unidade_id = '21000000-0000-4000-8000-000000000001') <> 3 THEN
    RAISE EXCEPTION 'FALHOU: gestor deveria ver as 3 versões';
  END IF;
  RAISE NOTICE 'OK  gestor vê o histórico inteiro';
END $$;

-- ── pacientes: um adulto e uma criança de 8 anos sem responsável ───────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
INSERT INTO t SELECT 'ep_a', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Cefaleia', NULL,
  json_build_object('nome', 'Termo Adulto Silva', 'data_nascimento', (current_date - interval '40 years 6 months')::date)::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'ep_c', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  json_build_object('nome', 'Termo Criança Souza', 'data_nascimento', (current_date - interval '8 years 6 months')::date)::jsonb) ->> 'episodio_id';
INSERT INTO t SELECT 'pa', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep_a');
INSERT INTO t SELECT 'pc', paciente_id::text FROM public.episodios WHERE id = pg_temp.u('ep_c');

-- ── médico: vê os modelos ativos, não o desativado nem a versão velha ───────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$
BEGIN
  IF (SELECT array_agg(id ORDER BY titulo) FROM public.termos_modelos) <> ARRAY[pg_temp.u('m1v2')] THEN
    RAISE EXCEPTION 'FALHOU: médico deveria ver só a versão vigente dos ativos';
  END IF;
  RAISE NOTICE 'OK  médico lê só a versão vigente dos modelos ativos';
END $$;
SELECT pg_temp.falha(format('SELECT public.termos_consentimento_do_paciente(%L, %L)', pg_temp.v('pa'), pg_temp.v('ep_a')),
  'Abra o prontuário', 'painel exige prontuário aberto');
SELECT public.abrir_prontuario(pg_temp.u('pa'), NULL), public.abrir_prontuario(pg_temp.u('pc'), NULL);

-- adulto: modelo desativado recusado; sem condições pede motivo
SELECT pg_temp.falha(format('SELECT public.emitir_termo_consentimento(%L, %L, %L)', pg_temp.v('pa'),
  json_build_object('modelo_id', pg_temp.v('m2'), 'procedimento', 'Punção venosa central',
    'texto', 'Texto técnico do acesso central com riscos.', 'assinante', 'paciente'), pg_temp.v('ep_a')),
  'Este modelo foi desativado', 'modelo desativado não gera termo novo');
SELECT pg_temp.falha(format('SELECT public.emitir_termo_consentimento(%L, %L, %L)', pg_temp.v('pa'),
  json_build_object('procedimento', 'Sutura', 'texto', 'Sutura de corte na mão com anestesia local.', 'assinante', 'responsavel',
    'responsavel', json_build_object('nome', 'Maria Silva', 'documento', '12.345.678-9', 'vinculo', 'esposa')), pg_temp.v('ep_a')),
  'Diga por que o paciente não tem condições', 'adulto que não assina precisa de motivo');
SELECT pg_temp.falha(format('SELECT public.emitir_termo_consentimento(%L, %L, %L)', pg_temp.v('pa'),
  json_build_object('procedimento', 'Sutura', 'texto', 'Sutura de corte na mão com anestesia local.', 'assinante', 'responsavel',
    'sem_condicoes_motivo', 'Rebaixamento de consciência', 'responsavel', json_build_object('nome', 'Maria Silva', 'vinculo', 'esposa')), pg_temp.v('ep_a')),
  'Informe o documento do responsável', 'responsável precisa de documento');
INSERT INTO t SELECT 'd1', public.emitir_termo_consentimento(pg_temp.u('pa'),
  json_build_object('modelo_id', pg_temp.v('m1v2'), 'procedimento', 'Punção lombar diagnóstica',
    'texto', 'A punção lombar em {paciente} ({idade}) retira líquor. Médico: {medico} {crm}.', 'informacoes', 'Usa AAS.',
    'assinante', 'paciente', 'sem_condicoes_motivo', 'ignorado quando o paciente assina',
    'testemunha', json_build_object('nome', 'Carla Técnica', 'documento', ''))::jsonb, pg_temp.u('ep_a'))::text;
RESET ROLE; -- documentos_clinicos da porta: leitura direta só como dono do banco
DO $$
DECLARE d public.documentos_clinicos; c jsonb;
BEGIN
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = (pg_temp.v('d1')::jsonb ->> 'id')::uuid;
  c := d.conteudo::jsonb -> 'termo';
  IF d.tipo_documento <> 'termo_consentimento' OR d.numero IS NULL OR d.estado <> 'ativo' OR d.episodio_id <> pg_temp.u('ep_a')
     OR d.autor_id <> '10000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'FALHOU: termo deveria virar documento numerado do episódio (%)', d;
  END IF;
  IF c ->> 'texto' <> 'A punção lombar em Termo Adulto Silva (40 anos) retira líquor. Médico: Plantonista de Teste 128446/SP.'
     OR c -> 'modelo' ->> 'versao' <> '2' OR c ->> 'sem_condicoes_motivo' IS NOT NULL OR c ->> 'assinante' <> 'paciente'
     OR c -> 'testemunha' <> '{"nome":"Carla Técnica","documento":null}'::jsonb
     OR c ->> 'declaracao' NOT LIKE 'declaro que recebi as informações acima%' THEN
    RAISE EXCEPTION 'FALHOU: conteúdo do termo (%)', c;
  END IF;
  RAISE NOTICE 'OK  termo do adulto: número, episódio, campos preenchidos no servidor, declaração padrão';
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE r jsonb;
BEGIN
  -- duplo clique devolve o mesmo documento
  r := public.emitir_termo_consentimento(pg_temp.u('pa'),
    json_build_object('modelo_id', pg_temp.v('m1v2'), 'procedimento', 'Punção lombar diagnóstica',
      'texto', 'A punção lombar em {paciente} ({idade}) retira líquor. Médico: {medico} {crm}.', 'informacoes', 'Usa AAS.',
      'assinante', 'paciente', 'sem_condicoes_motivo', 'ignorado quando o paciente assina',
      'testemunha', json_build_object('nome', 'Carla Técnica', 'documento', ''))::jsonb, pg_temp.u('ep_a'));
  IF r ->> 'id' <> pg_temp.v('d1')::jsonb ->> 'id' THEN RAISE EXCEPTION 'FALHOU: duplo clique criou outro termo'; END IF;
  RAISE NOTICE 'OK  duplo clique devolve o mesmo termo';
END $$;

-- criança: não assina; responsável ou ausência registrada
SELECT pg_temp.falha(format('SELECT public.emitir_termo_consentimento(%L, %L, %L)', pg_temp.v('pc'),
  json_build_object('procedimento', 'Sutura', 'texto', 'Sutura de corte no joelho com anestesia local.', 'assinante', 'paciente'), pg_temp.v('ep_c')),
  'Paciente menor de 14 anos', 'menor de 14 anos não assina');
SELECT pg_temp.falha(format('SELECT public.emitir_termo_consentimento(%L, %L, %L)', pg_temp.v('pc'),
  json_build_object('procedimento', 'Sutura', 'texto', 'Sutura de corte no joelho com anestesia local.', 'assinante', 'ninguem_presente',
    'ausencia_motivo', 'escola'), pg_temp.v('ep_c')),
  'Registre por que não há responsável', 'ausência do responsável precisa de motivo');
INSERT INTO t SELECT 'd2', public.emitir_termo_consentimento(pg_temp.u('pc'),
  json_build_object('procedimento', 'Sutura', 'texto', 'Sutura de corte no joelho de {paciente} com anestesia local.',
    'assinante', 'ninguem_presente', 'ausencia_motivo', 'Trazida pela escola; mãe avisada por telefone, a caminho.')::jsonb,
  pg_temp.u('ep_c'))::text;
INSERT INTO t SELECT 'd3', public.emitir_termo_consentimento(pg_temp.u('pc'),
  json_build_object('procedimento', 'Drenagem de abscesso', 'texto', 'Drenagem de abscesso na coxa com anestesia local.',
    'assinante', 'responsavel', 'responsavel', json_build_object('nome', 'Joana Souza', 'documento', 'RG 11.222.333-4', 'vinculo', 'mãe'))::jsonb,
  pg_temp.u('ep_c'))::text;
RESET ROLE;
DO $$
DECLARE c jsonb;
BEGIN
  SELECT conteudo::jsonb -> 'termo' INTO c FROM public.documentos_clinicos WHERE id = (pg_temp.v('d2')::jsonb ->> 'id')::uuid;
  IF c ->> 'assinante' <> 'ninguem_presente' OR c ->> 'ausencia_motivo' NOT LIKE 'Trazida pela escola%'
     OR (c -> 'paciente' ->> 'menor_14')::boolean IS NOT TRUE OR c -> 'responsavel' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: termo do menor sem responsável (%)', c;
  END IF;
  SELECT conteudo::jsonb -> 'termo' INTO c FROM public.documentos_clinicos WHERE id = (pg_temp.v('d3')::jsonb ->> 'id')::uuid;
  IF c -> 'responsavel' <> '{"nome":"Joana Souza","documento":"RG 11.222.333-4","vinculo":"mãe"}'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: responsável do menor (%)', c;
  END IF;
  RAISE NOTICE 'OK  menor: assina o responsável, ou a ausência fica registrada com motivo';
END $$;
SET LOCAL ROLE authenticated;

-- ── retificar: versão nova, a anterior fica como retificada ─────────────────
SELECT pg_temp.falha(format('SELECT public.emitir_termo_consentimento(%L, %L, NULL, NULL, %L, %L)', pg_temp.v('pc'),
  json_build_object('procedimento', 'Sutura', 'texto', 'Sutura de corte no joelho com anestesia local e curativo.',
    'assinante', 'ninguem_presente', 'ausencia_motivo', 'Trazida pela escola; mãe avisada por telefone.'),
  pg_temp.v('d2')::jsonb ->> 'id', 'curto'), 'Informe o motivo da retificação', 'retificação pede motivo');
INSERT INTO t SELECT 'd2v2', public.emitir_termo_consentimento(pg_temp.u('pc'),
  json_build_object('procedimento', 'Sutura', 'texto', 'Sutura de corte no joelho com anestesia local e curativo.',
    'assinante', 'responsavel', 'responsavel', json_build_object('nome', 'Joana Souza', 'documento', 'RG 11.222.333-4', 'vinculo', 'mãe'))::jsonb,
  NULL, NULL, (pg_temp.v('d2')::jsonb ->> 'id')::uuid, 'A mãe chegou e assinou o termo.')::text;
RESET ROLE;
DO $$
DECLARE a public.documentos_clinicos; b public.documentos_clinicos;
BEGIN
  SELECT * INTO a FROM public.documentos_clinicos WHERE id = (pg_temp.v('d2')::jsonb ->> 'id')::uuid;
  SELECT * INTO b FROM public.documentos_clinicos WHERE id = (pg_temp.v('d2v2')::jsonb ->> 'id')::uuid;
  IF a.estado <> 'retificado' OR b.estado <> 'ativo' OR b.versao <> 2 OR b.documento_raiz_id <> a.documento_raiz_id
     OR b.retificacao_de <> a.id OR b.episodio_id <> a.episodio_id OR b.numero = a.numero THEN
    RAISE EXCEPTION 'FALHOU: retificação (% / %)', a.estado, b;
  END IF;
  RAISE NOTICE 'OK  retificar cria a versão 2 com número próprio e a 1 fica retificada';
END $$;
SET LOCAL ROLE authenticated;

-- ── cancelar: justificativa; enfermagem não cancela ─────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000004');
SELECT pg_temp.falha(format('SELECT public.cancelar_termo_consentimento(%L, %L)', pg_temp.v('d3')::jsonb ->> 'id', 'Procedimento não será feito.'),
  'Só o médico que emitiu', 'enfermagem não cancela termo');
SELECT pg_temp.falha(format('SELECT public.emitir_termo_consentimento(%L, %L)', pg_temp.v('pa'),
  json_build_object('procedimento', 'Sutura', 'texto', 'Sutura de corte na mão com anestesia local.', 'assinante', 'paciente')),
  'O termo de consentimento é do médico', 'enfermagem não emite termo');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.cancelar_termo_consentimento(%L, %L)', pg_temp.v('d3')::jsonb ->> 'id', 'curto'),
  'Justifique o cancelamento', 'cancelar pede justificativa');
SELECT pg_temp.falha(format('SELECT public.cancelar_termo_consentimento(%L, %L)', pg_temp.v('d2')::jsonb ->> 'id', 'Versão antiga não se cancela.'),
  'Só se cancela o termo em vigor', 'versão retificada não se cancela');
SELECT public.cancelar_termo_consentimento((pg_temp.v('d3')::jsonb ->> 'id')::uuid, 'A drenagem foi suspensa pela cirurgia.');
SELECT pg_temp.falha(format('SELECT public.emitir_termo_consentimento(%L, %L, NULL, NULL, %L, %L)', pg_temp.v('pc'),
  json_build_object('procedimento', 'Drenagem', 'texto', 'Drenagem de abscesso na coxa com anestesia local.', 'assinante', 'ninguem_presente',
    'ausencia_motivo', 'Mãe saiu para buscar documentos.'), pg_temp.v('d3')::jsonb ->> 'id', 'Corrigir termo cancelado.'),
  'Só se retifica documento ativo', 'termo cancelado não se retifica');

-- ── painel da aba ───────────────────────────────────────────────────────────
DO $$
DECLARE r jsonb; t3 jsonb; t2 jsonb;
BEGIN
  r := public.termos_consentimento_do_paciente(pg_temp.u('pc'), pg_temp.u('ep_c'));
  IF (r -> 'paciente' ->> 'menor_14')::boolean IS NOT TRUE OR (r -> 'paciente' ->> 'idade_anos')::int <> 8
     OR (r ->> 'pode_emitir')::boolean IS NOT TRUE OR jsonb_array_length(r -> 'modelos') <> 1
     OR jsonb_array_length(r -> 'termos') <> 2 THEN
    RAISE EXCEPTION 'FALHOU: painel (%)', r;
  END IF;
  SELECT x INTO t3 FROM jsonb_array_elements(r -> 'termos') x WHERE x ->> 'id' = pg_temp.v('d3')::jsonb ->> 'id';
  SELECT x INTO t2 FROM jsonb_array_elements(r -> 'termos') x WHERE x ->> 'id' = pg_temp.v('d2v2')::jsonb ->> 'id';
  IF t3 ->> 'estado' <> 'cancelado' OR t3 -> 'cancelamento' ->> 'motivo' <> 'A drenagem foi suspensa pela cirurgia.'
     OR t3 -> 'cancelamento' ->> 'por' <> 'Plantonista de Teste' THEN
    RAISE EXCEPTION 'FALHOU: cancelado no painel (%)', t3;
  END IF;
  IF jsonb_array_length(t2 -> 'versoes') <> 2 OR t2 ->> 'motivo_retificacao' <> 'A mãe chegou e assinou o termo.'
     OR t2 -> 'conteudo' ->> 'assinante' <> 'responsavel' THEN
    RAISE EXCEPTION 'FALHOU: retificado no painel (%)', t2;
  END IF;
  RAISE NOTICE 'OK  painel: criança, modelos ativos, termo em vigor com versões e o cancelado com justificativa';
  -- o termo do adulto não aparece no episódio da criança; o do outro episódio, filtrado
  r := public.termos_consentimento_do_paciente(pg_temp.u('pa'), pg_temp.u('ep_c'));
  IF jsonb_array_length(r -> 'termos') <> 0 THEN RAISE EXCEPTION 'FALHOU: filtro por episódio (%)', r -> 'termos'; END IF;
  RAISE NOTICE 'OK  painel filtra pelo episódio';
END $$;

-- ── nada se apaga; tabela de cancelamentos fechada ─────────────────────────
SELECT pg_temp.falha('SELECT count(*) FROM public.termos_cancelamentos', 'permission denied', 'cancelamentos só pela RPC');
RESET ROLE;
SELECT pg_temp.falha(format('DELETE FROM public.termos_cancelamentos WHERE documento_id = %L', pg_temp.v('d3')::jsonb ->> 'id'),
  '', 'cancelamento não se apaga');
SELECT pg_temp.falha(format('UPDATE public.termos_modelos SET texto = %L WHERE id = %L', 'reescrito direto no banco, sem versão', pg_temp.v('m1v2')),
  'O texto de um modelo de termo não muda', 'texto do modelo não muda nem direto no banco');

-- ── segundo fator ──────────────────────────────────────────────────────────
UPDATE public.configuracao_plataforma SET valor = true WHERE chave = 'exigir_segundo_fator';
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
SELECT pg_temp.falha(format('SELECT public.emitir_termo_consentimento(%L, %L, %L)', pg_temp.v('pa'),
  json_build_object('procedimento', 'Sutura', 'texto', 'Sutura de corte na mão com anestesia local.', 'assinante', 'paciente'), pg_temp.v('ep_a')),
  'SEGUNDO_FATOR', 'emitir termo exige segundo fator');
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
SELECT pg_temp.falha($$SELECT public.salvar_modelo_termo('21000000-0000-4000-8000-000000000001', 'Toracocentese', 'Toracocentese',
  'Retirada de líquido da pleura com agulha. Riscos: pneumotórax.')$$, 'SEGUNDO_FATOR', 'salvar modelo exige segundo fator');
RESET ROLE;

ROLLBACK;

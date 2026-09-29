-- Testes da migration 20261003000003_cadastro_paciente.sql
-- Banco local com o seed, transação com ROLLBACK:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/porte_cadastro_paciente.sql
BEGIN;

-- ── validadores ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT private.cpf_valido('529.982.247-25') OR private.cpf_valido('529.982.247-24')
     OR private.cpf_valido('111.111.111-11') OR private.cpf_valido('5299822472') THEN
    RAISE EXCEPTION 'FALHOU: cpf_valido';
  END IF;
  RAISE NOTICE 'OK  CPF: dígitos verificadores, todos iguais e tamanho';
  IF NOT private.cns_valido('100000000000007') OR NOT private.cns_valido('104000000000018')
     OR private.cns_valido('104000000000008') OR private.cns_valido('100000000000104') THEN
    RAISE EXCEPTION 'FALHOU: CNS definitivo';
  END IF;
  RAISE NOTICE 'OK  CNS definitivo (1/2) gerado do PIS, inclusive o caso DV 10 ("001")';
  IF NOT private.cns_valido('700 0000 0000 0005') OR NOT private.cns_valido('800000000000001')
     OR private.cns_valido('900000000000009') OR private.cns_valido('300000000000000') THEN
    RAISE EXCEPTION 'FALHOU: CNS provisório';
  END IF;
  RAISE NOTICE 'OK  CNS provisório (7/8/9) pela soma ponderada; 3 a 6 não existem';
END $$;

-- ── cadastro antigo com documento fora da regra (antes da validação) ────────
ALTER TABLE public.pacientes DISABLE TRIGGER trg_pacientes_documentos;
INSERT INTO public.pacientes (id, unidade_id, nome, cpf, cns, prontuario, setor_id, data_nascimento)
VALUES ('23000000-0000-4000-8000-0000000000c1', '21000000-0000-4000-8000-000000000001', 'Cadastro Antigo Teste',
        '12345678900', '123456789012345', 'LEGADO-1', '22000000-0000-4000-8000-000000000003', '1980-01-01');
ALTER TABLE public.pacientes ENABLE TRIGGER trg_pacientes_documentos;

DO $$ BEGIN
  BEGIN
    INSERT INTO public.pacientes (unidade_id, nome, cpf) VALUES ('21000000-0000-4000-8000-000000000001', 'Direto Teste', '111.111.111-11');
    RAISE EXCEPTION 'FALHOU: CPF inválido gravado direto na tabela';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'CPF inválido%' THEN RAISE; END IF;
  END;
  INSERT INTO public.pacientes (id, unidade_id, nome, cpf) VALUES ('23000000-0000-4000-8000-0000000000c2', '21000000-0000-4000-8000-000000000001', 'Direto Teste', '111.444.777-35');
  IF (SELECT cpf FROM public.pacientes WHERE id = '23000000-0000-4000-8000-0000000000c2') <> '11144477735' THEN
    RAISE EXCEPTION 'FALHOU: CPF não foi guardado só com dígitos';
  END IF;
  UPDATE public.pacientes SET telefone = '11 99999-0000' WHERE id = '23000000-0000-4000-8000-0000000000c1';
  UPDATE public.pacientes SET cpf = '123.456.789-00' WHERE id = '23000000-0000-4000-8000-0000000000c1';
  RAISE NOTICE 'OK  gatilho: documento novo conferido e guardado em dígitos; o antigo segue gravável';
END $$;

-- recepcionista de teste escalada AGORA no Pronto Socorro (porta)
INSERT INTO auth.users (id, email) VALUES ('10000000-0000-4000-8000-0000000000c1', 'recepcao@cadastro.local');
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-0000000000c1', 'Recepção Cadastro Teste')
  ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-0000000000c1', '21000000-0000-4000-8000-000000000001', 'recepcao');

CREATE TEMP TABLE r (caso text, saida jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

DO $$ BEGIN
  PERFORM public.fila_da_porta('22000000-0000-4000-8000-000000000003');
  RAISE EXCEPTION 'FALHOU: fila lida sem plantão';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  sem plantão na porta, não lê a fila';
END $$;

RESET ROLE;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-0000000000c1', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

-- ── ficha: documentos e campos novos ────────────────────────────────────────
DO $$
DECLARE
  casos text[][] := ARRAY[
    ARRAY['{"nome":"CPF Errado Teste","cpf":"529.982.247-24"}', 'CPF inválido%'],
    ARRAY['{"nome":"CNS Errado Teste","cns":"700000000000006"}', 'Cartão SUS inválido%'],
    ARRAY['{"nome":"Raça Errada Teste","raca_cor":"morena"}', 'Raça/cor%'],
    ARRAY['{"nome":"Categoria Errada","categoria":"plano"}', 'Categoria%'],
    ARRAY['{"nome":"Muito Velho Teste","data_nascimento":"1850-01-01"}', '%130 anos%']];
  i int;
BEGIN
  FOR i IN 1..array_length(casos, 1) LOOP
    BEGIN
      PERFORM public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse seca', NULL, casos[i][1]::jsonb);
      RAISE EXCEPTION 'FALHOU: ficha aceitou %', casos[i][1];
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE casos[i][2] THEN RAISE; END IF;
    END;
  END LOOP;
  RAISE NOTICE 'OK  ficha recusa CPF/CNS inválidos, raça/cor e categoria fora da lista, nascimento > 130 anos';
END $$;

INSERT INTO r SELECT 'nova', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor abdominal', NULL,
  '{"nome":"Ana Cadastro Teste","data_nascimento":"1990-03-04","sexo":"F","cpf":"529.982.247-25","cns":"700 0000 0000 0005",
    "raca_cor":"parda","estado_civil":"Casado(a)","categoria":"convenio","convenio":"Plano Teste","nome_mae":"Rita"}');

-- cadastro antigo: o mesmo CPF fora da regra reenviado não bloqueia a ficha
INSERT INTO r SELECT 'antigo', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Cefaleia', '23000000-0000-4000-8000-0000000000c1',
  '{"cpf":"12345678900","telefone":"11 98888-0000"}');

RESET ROLE;
DO $$
DECLARE p public.pacientes;
BEGIN
  SELECT * INTO p FROM public.pacientes WHERE id = ((SELECT saida FROM r WHERE caso = 'nova') ->> 'paciente_id')::uuid;
  IF p.raca_cor <> 'parda' OR p.categoria <> 'convenio' OR p.convenio <> 'Plano Teste' OR p.estado_civil <> 'Casado(a)'
     OR p.cpf <> '52998224725' OR p.cns <> '700000000000005' OR p.sexo <> 'F' THEN
    RAISE EXCEPTION 'FALHOU: ficha não gravou os campos novos (% % % % % %)', p.raca_cor, p.categoria, p.convenio, p.estado_civil, p.cpf, p.cns;
  END IF;
  RAISE NOTICE 'OK  ficha grava raça/cor, categoria, convênio, estado civil; documentos em dígitos';
  IF (SELECT telefone FROM public.pacientes WHERE id = '23000000-0000-4000-8000-0000000000c1') <> '11 98888-0000' THEN
    RAISE EXCEPTION 'FALHOU: cadastro antigo não atualizou';
  END IF;
  RAISE NOTICE 'OK  cadastro antigo com CPF fora da regra abre ficha (só valor novo é conferido)';
END $$;

-- a Recepção chama? não; a chamada entra pelo banco para testar a lista
INSERT INTO public.chamadas (unidade_id, setor_id, episodio_id, sala_id, etapa, numero, chamado_por)
SELECT '21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003',
       ((SELECT saida FROM r WHERE caso = 'nova') ->> 'episodio_id')::uuid,
       (SELECT id FROM public.salas WHERE setor_id = '22000000-0000-4000-8000-000000000003' AND nome = 'Triagem 1'),
       'triagem', 1, '10000000-0000-4000-8000-0000000000c1';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

DO $$
DECLARE f record; c record; n int;
BEGIN
  SELECT * INTO f FROM public.fila_da_porta('22000000-0000-4000-8000-000000000003') WHERE nome = 'Ana Cadastro Teste';
  IF f.etapa <> 'triagem' OR f.chamadas <> 1 OR f.ultima_sala <> 'Triagem 1' OR f.ultimo_chamador <> 'Recepção Cadastro Teste' THEN
    RAISE EXCEPTION 'FALHOU: fila da porta (% % % %)', f.etapa, f.chamadas, f.ultima_sala, f.ultimo_chamador;
  END IF;
  RAISE NOTICE 'OK  fila da porta: etapa, chamadas, sala e quem chamou';
  SELECT * INTO c FROM public.ultimas_chamadas_porta('22000000-0000-4000-8000-000000000003') LIMIT 1;
  IF c.nome <> 'Ana Cadastro Teste' OR c.sala <> 'Triagem 1' OR c.quem <> 'Recepção Cadastro Teste' THEN
    RAISE EXCEPTION 'FALHOU: últimas chamadas (% % %)', c.nome, c.sala, c.quem;
  END IF;
  RAISE NOTICE 'OK  últimas chamadas com hora, nome, sala e quem chamou';
  SELECT count(*) INTO n FROM public.atendimentos_do_paciente(((SELECT saida FROM r WHERE caso = 'nova') ->> 'paciente_id')::uuid);
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: atendimentos do paciente = %', n; END IF;
  SELECT count(*) INTO n FROM public.atendimentos_do_paciente('23000000-0000-4000-8000-000000000001');
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: viu atendimento de outro setor (%)', n; END IF;
  RAISE NOTICE 'OK  atendimentos do paciente: só os que a RLS de episódios deixaria ver';
END $$;

DO $$
DECLARE a record; pid uuid := ((SELECT saida FROM r WHERE caso = 'nova') ->> 'paciente_id')::uuid;
BEGIN
  SELECT * INTO a FROM public.atendimento_aberto_do_paciente(pid);
  IF a.etapa <> 'triagem' OR a.setor IS NULL OR a.chegada_em IS NULL OR NOT a.na_minha_porta OR a.em_atendimento THEN
    RAISE EXCEPTION 'FALHOU: atendimento aberto (% % % %)', a.etapa, a.setor, a.na_minha_porta, a.em_atendimento;
  END IF;
  -- paciente internado (outro setor): a Recepção sabe onde e desde quando, sem ler o episódio
  SELECT * INTO a FROM public.atendimento_aberto_do_paciente('23000000-0000-4000-8000-000000000002');
  IF a.episodio_id IS NOT NULL AND a.na_minha_porta THEN
    RAISE EXCEPTION 'FALHOU: episódio de outro setor marcado como da minha porta';
  END IF;
  BEGIN
    PERFORM public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'De novo', pid);
    RAISE EXCEPTION 'FALHOU: segunda ficha aberta';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'FICHA_EPISODIO_ABERTO%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  atendimento aberto: desde quando, setor e etapa, para o aviso da ficha (regra de um aberto mantida)';
END $$;

-- ── salvar_cadastro_paciente ────────────────────────────────────────────────
DO $$
DECLARE pid uuid := ((SELECT saida FROM r WHERE caso = 'nova') ->> 'paciente_id')::uuid; v jsonb;
BEGIN
  v := public.salvar_cadastro_paciente(pid, '{"raca_cor":"preta","endereco":"Rua das Flores, 10","municipio":"São Paulo","uf":"SP","cpf":"52998224725"}');
  IF (SELECT raca_cor FROM public.pacientes WHERE id = pid) IS DISTINCT FROM 'preta' THEN RAISE EXCEPTION 'FALHOU: correção não gravou'; END IF;
  RAISE NOTICE 'OK  completar/corrigir cadastro grava só o que veio';
  BEGIN
    PERFORM public.salvar_cadastro_paciente(pid, '{"nome":"  "}');
    RAISE EXCEPTION 'FALHOU: nome apagado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'O nome%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.salvar_cadastro_paciente(pid, '{"cpf":"93541134780"}');
    PERFORM public.salvar_cadastro_paciente(NULL, '{"nome":"Outro Teste","cpf":"935.411.347-80"}', '22000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'FALHOU: CPF repetido aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'CADASTRO_DUPLICATA_DOCUMENTO:' || pid || '%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.salvar_cadastro_paciente(NULL, '{"nome":"ANA cadastro teste","data_nascimento":"1990-03-04"}', '22000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'FALHOU: homônimo passou';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'CADASTRO_DUPLICATA_PROVAVEL:' || pid || '%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  cadastro fora da ficha: nome obrigatório, CPF repetido e homônimo apontam o existente';
  v := public.salvar_cadastro_paciente(NULL, '{"nome":"ANA cadastro teste","data_nascimento":"1990-03-04","raca_cor":"sem_informacao"}',
                                       '22000000-0000-4000-8000-000000000003', true);
  IF (v ->> 'prontuario') !~ '^\d{4}\.\d{6}$' THEN RAISE EXCEPTION 'FALHOU: sem prontuário: %', v; END IF;
  RAISE NOTICE 'OK  "é outra pessoa" cadastra com prontuário da unidade';
  BEGIN
    PERFORM public.salvar_cadastro_paciente('23000000-0000-4000-8000-000000000001', '{"telefone":"1"}');
    RAISE EXCEPTION 'FALHOU: editou paciente fora do plantão';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Acesso negado%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.salvar_cadastro_paciente(NULL, '{"nome":"Fora Teste"}', '22000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FALHOU: cadastrou em setor fora do plantão';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Acesso negado%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  só quem pode atuar no paciente (ou está no setor) cadastra e corrige';
END $$;

RESET ROLE;
DO $$
DECLARE a jsonb;
BEGIN
  SELECT payload INTO a FROM public.log_auditoria
   WHERE acao = 'editar' AND entidade = 'pacientes' AND ator_id = '10000000-0000-4000-8000-0000000000c1'
   ORDER BY seq DESC LIMIT 1;
  IF a IS NULL OR NOT (a -> 'campos_alterados') ? 'raca_cor' OR a::text LIKE '%Flores%' OR a::text LIKE '%preta%' THEN
    RAISE EXCEPTION 'FALHOU: auditoria da correção: %', a;
  END IF;
  RAISE NOTICE 'OK  auditoria registra os campos alterados, sem os valores';
END $$;

ROLLBACK;

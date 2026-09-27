-- Testes da migration 20260927000001_fase2_ficha_episodio.sql
-- Banco local com o seed, transação com ROLLBACK:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase2_ficha_episodio.sql
BEGIN;

-- recepcionista de teste, escalada AGORA no Pronto Socorro (porta)
INSERT INTO auth.users (id, email) VALUES ('10000000-0000-4000-8000-0000000000a1', 'recepcao@ficha.local');
INSERT INTO public.perfis (id, nome_completo) VALUES ('10000000-0000-4000-8000-0000000000a1', 'Recepção de Teste')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
VALUES ('10000000-0000-4000-8000-0000000000a1', '21000000-0000-4000-8000-000000000001', 'recepcao');

CREATE TEMP TABLE r (caso text, saida jsonb) ON COMMIT DROP;
GRANT ALL ON r TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

DO $$ BEGIN
  PERFORM public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'dor torácica', NULL, '{"nome":"Fulano"}');
  RAISE EXCEPTION 'FALHOU: ficha aberta sem plantão';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  RAISE NOTICE 'OK  sem plantão na porta, não abre ficha';
END $$;

RESET ROLE;
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_janela;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, inicio, duracao_min)
VALUES ('21000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-0000000000a1', private.data_atual(), 'manha', now() - interval '1 hour', 360);
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_janela;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

INSERT INTO r SELECT 'nova', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor torácica há 2 h', NULL,
  '{"nome":"José da Silva Teste","data_nascimento":"1943-05-10","cpf":"529.982.247-25","nome_mae":"Maria da Silva"}',
  ARRAY['gestante']);
INSERT INTO r SELECT 'menor', public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Febre', NULL,
  '{"nome":"Criança Abrigo Teste","data_nascimento":"2020-02-01"}', ARRAY['idoso_80']);

DO $$
DECLARE e public.episodios; v jsonb := (SELECT saida FROM r WHERE caso = 'nova'); m jsonb := (SELECT saida FROM r WHERE caso = 'menor');
BEGIN
  SELECT * INTO e FROM public.episodios WHERE id = (v ->> 'episodio_id')::uuid;
  IF e.etapa <> 'triagem' OR e.aberto_por <> '10000000-0000-4000-8000-0000000000a1' OR (v ->> 'prontuario') !~ '^\d{4}\.\d{6}$' THEN
    RAISE EXCEPTION 'FALHOU: episódio/prontuário errados (%, %, %)', e.etapa, e.aberto_por, v ->> 'prontuario';
  END IF;
  RAISE NOTICE 'OK  ficha abre episódio na triagem, autor do login, prontuário %', v ->> 'prontuario';
  IF e.prioridades_legais <> ARRAY['gestante', 'idoso_60', 'idoso_80'] THEN
    RAISE EXCEPTION 'FALHOU: prioridades de 83 anos erradas: %', e.prioridades_legais;
  END IF;
  IF (m -> 'prioridades_legais') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'FALHOU: criança recebeu prioridade de idoso: %', m -> 'prioridades_legais';
  END IF;
  RAISE NOTICE 'OK  60+/80+ pela idade no servidor; idoso enviado pelo app é ignorado';
  RAISE NOTICE 'OK  menor sem responsável é cadastrado';
END $$;

DO $$
DECLARE pid uuid := ((SELECT saida FROM r WHERE caso = 'nova') ->> 'paciente_id')::uuid;
BEGIN
  BEGIN
    PERFORM public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Outra queixa', pid);
    RAISE EXCEPTION 'FALHOU: segundo episódio aberto';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'FICHA_EPISODIO_ABERTO%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  um episódio aberto por paciente';
  END;
  BEGIN
    PERFORM public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse', NULL, '{"nome":"Outro Nome","cpf":"52998224725"}');
    RAISE EXCEPTION 'FALHOU: CPF repetido aceito';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'FICHA_DUPLICATA_DOCUMENTO:' || pid || '%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  CPF repetido bloqueia e aponta o cadastro existente';
  END;
  BEGIN
    PERFORM public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse', NULL, '{"nome":"JOSE DA SILVA  teste","data_nascimento":"1943-05-10"}');
    RAISE EXCEPTION 'FALHOU: homônimo com mesmo nascimento passou sem confirmar';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'FICHA_DUPLICATA_PROVAVEL:' || pid || '%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  mesmo nome (sem acento/caixa) + nascimento pede confirmação';
  END;
  PERFORM public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Tosse', NULL,
    '{"nome":"José da Silva Teste","data_nascimento":"1943-05-10"}', '{}', true);
  RAISE NOTICE 'OK  confirmado "é outra pessoa", cadastra';
  BEGIN
    PERFORM public.registrar_ficha('22000000-0000-4000-8000-000000000003', 'Dor', '23000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FALHOU: ficha para paciente internado';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'FICHA_INTERNADO%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  paciente internado não abre ficha nova';
  END;
  BEGIN
    PERFORM public.registrar_ficha('22000000-0000-4000-8000-000000000001', 'Dor', NULL, '{"nome":"Fulano de Tal"}');
    RAISE EXCEPTION 'FALHOU: ficha aberta fora da porta';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
    RAISE NOTICE 'OK  ficha só abre em setor de emergência';
  END;
END $$;

DO $$
DECLARE n integer; c text;
BEGIN
  SELECT count(*), max(cpf_final) INTO n, c FROM public.buscar_pacientes('21000000-0000-4000-8000-000000000001', 'jose da silva');
  IF n <> 2 OR c <> '•••••••4725' THEN RAISE EXCEPTION 'FALHOU: busca sem acento devolveu % (cpf %)', n, c; END IF;
  RAISE NOTICE 'OK  busca por nome sem acento acha os dois, CPF mascarado';
  IF NOT EXISTS (SELECT 1 FROM public.episodios WHERE aberto_por = '10000000-0000-4000-8000-0000000000a1') THEN
    RAISE EXCEPTION 'FALHOU: recepção não vê a fila da sua porta';
  END IF;
  IF EXISTS (SELECT 1 FROM public.observacao) OR EXISTS (SELECT 1 FROM public.documentos_clinicos) THEN
    RAISE EXCEPTION 'FALHOU: recepção leu conteúdo clínico';
  END IF;
  RAISE NOTICE 'OK  recepção vê os episódios da porta e nenhum conteúdo clínico';
END $$;

RESET ROLE;
ROLLBACK;

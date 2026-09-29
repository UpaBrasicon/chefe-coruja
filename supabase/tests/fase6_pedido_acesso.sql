-- Testes da migration 20261001000001_fase6_pedido_acesso_encerrado.sql
-- Banco local com o seed, transação com ROLLBACK:
--   docker exec -i supabase_db_chefe-coruja psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/fase6_pedido_acesso.sql
--
-- O plantonista do seed (…0002) fica SEM plantão agora. O paciente Um
-- (…0001) fica fora do alcance dele. O gestor (…0001) decide; a recepção
-- (…0005) e o administrador (…0003) não pedem.
BEGIN;

DELETE FROM public.escala_plantao WHERE perfil_id = '10000000-0000-4000-8000-000000000002';
-- um documento do paciente Um, para provar a leitura
INSERT INTO public.documentos_clinicos (organizacao_id, unidade_id, paciente_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado, documento_raiz_id, versao)
SELECT u.organizacao_id, u.id, '23000000-0000-4000-8000-000000000001', 'evolucao', 'evolução de teste', 'h', '10000000-0000-4000-8000-000000000001', 'ativo', gen_random_uuid(), 1
FROM public.unidades u WHERE u.id = '21000000-0000-4000-8000-000000000001';

CREATE FUNCTION pg_temp.como(perfil text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', perfil, 'role', 'authenticated')::text, true);
END $$;

SET LOCAL ROLE authenticated;

-- ── 1. fora da escala, o plantonista não lê e não abre ──────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: paciente visível sem escala e sem pedido';
  END IF;
  BEGIN
    PERFORM public.abrir_prontuario('23000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FALHOU: abriu o prontuário sem pedido';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  sem pedido: nada visível, abrir recusado';
END $$;

-- ── 2. busca exige identificação; motivo curto é recusado ───────────────────
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.buscar_paciente_para_pedido('21000000-0000-4000-8000-000000000001', NULL, 'Pa', NULL);
    RAISE EXCEPTION 'FALHOU: busca por nome sem nascimento';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.pedir_acesso_prontuario('23000000-0000-4000-8000-000000000001', 'curto');
    RAISE EXCEPTION 'FALHOU: pedido com motivo curto';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  busca sem identificação e motivo curto recusados';
END $$;

-- ── 3. pede; pedido duplicado recusado; ainda não lê ────────────────────────
DO $$
DECLARE v uuid;
BEGIN
  v := public.pedir_acesso_prontuario('23000000-0000-4000-8000-000000000001', 'Revisar a evolução do atendimento de ontem');
  PERFORM set_config('teste.pedido', v::text, true);
  BEGIN
    PERFORM public.pedir_acesso_prontuario('23000000-0000-4000-8000-000000000001', 'Outro pedido igual para o mesmo paciente');
    RAISE EXCEPTION 'FALHOU: dois pedidos pendentes';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: pedido pendente já dá leitura';
  END IF;
  IF (SELECT count(*) FROM public.meus_pedidos_acesso('21000000-0000-4000-8000-000000000001')) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: meus pedidos não lista o pedido';
  END IF;
  RAISE NOTICE 'OK  pedido criado, duplicado recusado, pendente não abre';
END $$;

-- ── 4. quem pediu não decide; recepção e administrador não pedem ────────────
DO $$ BEGIN
  BEGIN
    PERFORM public.decidir_pedido_acesso(current_setting('teste.pedido')::uuid, true);
    RAISE EXCEPTION 'FALHOU: plantonista decidiu pedido';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  plantonista não decide';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  BEGIN
    PERFORM public.pedir_acesso_prontuario('23000000-0000-4000-8000-000000000001', 'Recepção pedindo acesso ao prontuário');
    RAISE EXCEPTION 'FALHOU: recepção pediu acesso';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.pedidos_acesso_prontuario) THEN
    RAISE EXCEPTION 'FALHOU: recepção vê pedidos de outros';
  END IF;
  RAISE NOTICE 'OK  recepção não pede e não vê pedidos';
END $$;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000003');
DO $$ BEGIN
  BEGIN
    PERFORM public.pedir_acesso_prontuario('23000000-0000-4000-8000-000000000001', 'Administrador pedindo acesso ao prontuário');
    RAISE EXCEPTION 'FALHOU: administrador pediu acesso';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  administrador não pede';
END $$;

-- ── 5. gestor: recusa sem motivo não passa; aprova ──────────────────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000001');
DO $$
DECLARE r public.pedidos_acesso_prontuario;
BEGIN
  IF (SELECT count(*) FROM public.pedidos_acesso_da_unidade('21000000-0000-4000-8000-000000000001')) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: gestor não vê o pedido pendente';
  END IF;
  BEGIN
    PERFORM public.decidir_pedido_acesso(current_setting('teste.pedido')::uuid, false, '');
    RAISE EXCEPTION 'FALHOU: recusa sem motivo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  r := public.decidir_pedido_acesso(current_setting('teste.pedido')::uuid, true);
  IF r.status <> 'aprovado' OR r.valido_ate < now() + interval '23 hours 59 minutes' OR r.valido_ate > now() + interval '24 hours 1 minute' THEN
    RAISE EXCEPTION 'FALHOU: aprovação sem validade de 24 h (%)', r.valido_ate;
  END IF;
  BEGIN
    PERFORM public.decidir_pedido_acesso(current_setting('teste.pedido')::uuid, false, 'mudei de ideia');
    RAISE EXCEPTION 'FALHOU: decidiu duas vezes';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'OK  gestor vê, recusa exige motivo, aprova com 24 h, não decide duas vezes';
END $$;

-- ── 6. aprovado: lê depois de abrir; não escreve; não imprime ───────────────
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: pedido aprovado não dá leitura do paciente';
  END IF;
  IF EXISTS (SELECT 1 FROM public.documentos_clinicos WHERE paciente_id = '23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: documento visível antes de abrir o prontuário';
  END IF;
  PERFORM public.abrir_prontuario('23000000-0000-4000-8000-000000000001');
  IF NOT EXISTS (SELECT 1 FROM public.documentos_clinicos WHERE paciente_id = '23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: documento invisível com pedido aprovado e prontuário aberto';
  END IF;
  IF private.pode_atuar_no_paciente('23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: pedido aprovado deu escrita';
  END IF;
  BEGIN
    PERFORM public.registrar_impressao('23000000-0000-4000-8000-000000000001', 'evolucao', NULL, NULL);
    RAISE EXCEPTION 'FALHOU: pedido aprovado deu impressão';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  UPDATE public.pacientes SET nome = nome || ' x' WHERE id = '23000000-0000-4000-8000-000000000001';
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000001' AND nome LIKE '% x') THEN
    RAISE EXCEPTION 'FALHOU: pedido aprovado permitiu alterar o paciente';
  END IF;
  RAISE NOTICE 'OK  aprovado: lê após abrir, sem escrita e sem impressão';
END $$;

-- ── 7. vencido: some ────────────────────────────────────────────────────────
RESET ROLE;
UPDATE public.pedidos_acesso_prontuario SET valido_ate = now() - interval '1 minute', decidido_em = now() - interval '25 hours'
 WHERE id = current_setting('teste.pedido')::uuid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.como('10000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = '23000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'FALHOU: pedido vencido ainda dá leitura';
  END IF;
  RAISE NOTICE 'OK  pedido vencido não dá leitura';
END $$;

-- ── 8. trilha: pedido e decisão, sem o texto do motivo ──────────────────────
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.log_auditoria WHERE entidade = 'pedidos_acesso_prontuario'
        AND entidade_id = current_setting('teste.pedido')::uuid) <> 2 THEN
    RAISE EXCEPTION 'FALHOU: trilha sem pedido e decisão';
  END IF;
  IF EXISTS (SELECT 1 FROM public.log_auditoria WHERE entidade = 'pedidos_acesso_prontuario' AND payload::text ILIKE '%evolução%') THEN
    RAISE EXCEPTION 'FALHOU: motivo livre entrou na trilha';
  END IF;
  RAISE NOTICE 'OK  trilha com pedido e decisão, sem texto livre';
END $$;

ROLLBACK;

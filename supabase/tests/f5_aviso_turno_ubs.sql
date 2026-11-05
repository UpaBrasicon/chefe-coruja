-- ════════════════════════════════════════════════════════════════════════════
-- Testes da migration 20270220000001_aviso_turno_ubs.sql (F5-T1 do portão da
-- Fase 5). Tudo em transação com ROLLBACK.
--
-- 1. na UPA, os quatro avisos fixos de turno continuam nos mesmos horários;
-- 2. na UBS, nenhum aviso fixo de turno;
-- 3. gerar_notificacoes_turno usa a função nova e não tem mais o texto fixo;
-- 4. authenticated não chama a função privada.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

INSERT INTO public.organizacoes (id, nome) VALUES ('00000000-0000-4000-8000-0000000064a1', 'Rede do aviso de turno');
INSERT INTO public.unidades (id, organizacao_id, nome, tipo) VALUES
  ('00000000-0000-4000-8000-0000000064a2', '00000000-0000-4000-8000-0000000064a1', 'UPA do aviso', 'upa'),
  ('00000000-0000-4000-8000-0000000064a3', '00000000-0000-4000-8000-0000000064a1', 'UBS do aviso', 'ubs');

DO $$
DECLARE
  upa constant uuid := '00000000-0000-4000-8000-0000000064a2';
  ubs constant uuid := '00000000-0000-4000-8000-0000000064a3';
  c record;
  t text;
BEGIN
  -- ── 1 e 2: cada horário na UPA e na UBS ────────────────────────────────────
  FOR c IN SELECT * FROM (VALUES
      ('19:40'::time, 'noite', 'noite_1930'), ('20:10'::time, 'noite', 'noite_2000'), ('23:50'::time, 'noite', 'noite_2000'),
      ('07:40'::time, 'manha', 'manha_0730'), ('09:00'::time, 'manha', 'manha_0800'),
      ('14:00'::time, 'tarde', NULL), ('03:00'::time, 'noite', NULL)) v(hora, turno, esperado)
  LOOP
    SELECT a.tipo INTO t FROM private.aviso_fixo_turno(upa, c.hora, c.turno) a;
    IF t IS DISTINCT FROM c.esperado THEN
      RAISE EXCEPTION 'FALHOU: UPA às % (%): esperado %, veio %', c.hora, c.turno, c.esperado, t;
    END IF;
    SELECT a.tipo INTO t FROM private.aviso_fixo_turno(ubs, c.hora, c.turno) a;
    IF t IS NOT NULL THEN
      RAISE EXCEPTION 'FALHOU: UBS às % (%) recebeu o aviso %', c.hora, c.turno, t;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK  UPA com os quatro avisos nos mesmos horários; UBS sem aviso fixo';

  IF (SELECT a.mensagem FROM private.aviso_fixo_turno(upa, '20:10', 'noite') a)
     <> 'Plantão noturno em andamento. Verifique os pacientes internados e em observação da sua escala.' THEN
    RAISE EXCEPTION 'FALHOU: o texto do aviso da noite na UPA mudou';
  END IF;
  RAISE NOTICE 'OK  texto da UPA igual ao de antes';

  -- ── 3: a função pública usa a nova ─────────────────────────────────────────
  IF position('private.aviso_fixo_turno' in pg_get_functiondef('public.gerar_notificacoes_turno(uuid)'::regprocedure)) = 0
     OR position('Plantão noturno em andamento' in pg_get_functiondef('public.gerar_notificacoes_turno(uuid)'::regprocedure)) > 0 THEN
    RAISE EXCEPTION 'FALHOU: gerar_notificacoes_turno não usa private.aviso_fixo_turno';
  END IF;
  RAISE NOTICE 'OK  gerar_notificacoes_turno usa private.aviso_fixo_turno';

  -- ── 4: privada ─────────────────────────────────────────────────────────────
  IF has_function_privilege('authenticated', 'private.aviso_fixo_turno(uuid, time, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'private.aviso_fixo_turno(uuid, time, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: anon ou authenticated executa private.aviso_fixo_turno';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.gerar_notificacoes_turno(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALHOU: authenticated perdeu gerar_notificacoes_turno';
  END IF;
  RAISE NOTICE 'OK  grants';
END $$;

ROLLBACK;

-- ════════════════════════════════════════════════════════════════════════════
-- 5A, tarefa 2, parte 2.2 (BACKLOG.md; decisões do RT em 02/11/2026, D5 e D7 =
-- A): o consultório da UBS usa a fila e a chamada da porta.
--
-- 1. private.acompanha_porta: aceita o setor 'consultorio' além do de
--    emergência. Com isso a recepção da UBS vê a fila do consultório
--    (fila_da_porta) e as últimas chamadas (ultimas_chamadas_porta).
-- 2. private.porta_nova_ganha_salas: o consultório novo ganha uma sala com o
--    nome dele (D5, "sala padrão de consultório"); sem sala, o médico não
--    chama o paciente (chamar_paciente) nem marca o consultório do plantão.
-- 3. Consultórios já cadastrados ganham a sala que faltava.
--
-- As trocas 1 e 2 são feitas na definição atual da função, lida sem o CR do
-- fim de linha, como em 20270211000002. Mesma assinatura, dono e grants.
-- Idempotente. Teste: supabase/tests/5a_consultorio_fila.sql
--
-- Rollback (na ordem):
--   as trocas 1 e 2 invertidas;
--   DELETE FROM public.salas sa USING public.setores s
--    WHERE sa.setor_id = s.id AND s.tipo = 'consultorio'
--      AND NOT EXISTS (SELECT 1 FROM public.chamadas c WHERE c.sala_id = sa.id);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.aps_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(p_pares[k + 1] IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- 1. a fila da recepção também no consultório
SELECT pg_temp.aps_trocar('private.acompanha_porta(uuid)',
  'WHERE s.id = p_setor AND s.tipo = ''emergencia''',
  'WHERE s.id = p_setor AND s.tipo IN (''emergencia'', ''consultorio'')');

-- 2. o consultório novo ganha a sala dele
SELECT pg_temp.aps_trocar('private.porta_nova_ganha_salas()',
  'IF NEW.tipo = ''emergencia'' THEN PERFORM private.salas_padrao(NEW.id); END IF;',
  'IF NEW.tipo = ''emergencia'' THEN PERFORM private.salas_padrao(NEW.id); ELSIF NEW.tipo = ''consultorio'' THEN INSERT INTO public.salas (setor_id, nome, tipo, ordem) VALUES (NEW.id, NEW.nome, ''consultorio'', 1) ON CONFLICT (setor_id, nome) DO NOTHING; END IF;');

DROP FUNCTION pg_temp.aps_trocar(regprocedure, text[]);

-- 3. consultórios que já existem
INSERT INTO public.salas (setor_id, nome, tipo, ordem)
SELECT s.id, s.nome, 'consultorio', 1 FROM public.setores s
 WHERE s.tipo = 'consultorio' AND NOT EXISTS (SELECT 1 FROM public.salas sa WHERE sa.setor_id = s.id)
ON CONFLICT (setor_id, nome) DO NOTHING;

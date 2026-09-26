-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — segundo fator também nas RPCs clínicas (ADR 0010).
--
-- Funções SECURITY DEFINER não passam pela RLS; a policy restritiva da
-- migration anterior não as alcança. Em vez de copiar o corpo de cada uma,
-- a definição ATUAL é lida do banco e a checagem entra como primeira linha
-- do bloco principal. Idempotente: função que já chama a checagem é pulada.
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  f regprocedure;
  def text;
  alvo regprocedure[] := ARRAY[
    'public.dar_alta_internado(uuid,text,text)',
    'public.abrir_internacao(uuid,uuid,text,text,uuid,uuid)',
    'public.registrar_evento_adt(uuid,text,uuid,uuid,text,jsonb)',
    'public.salvar_documento(uuid,uuid,text,text,uuid,text)',
    'public.registrar_acesso_prontuario(uuid,uuid,text,uuid,uuid)',
    'public.transferir_paciente(uuid,uuid,text)',
    'public.transferir_internado(uuid,uuid,text,text)',
    'public.registrar_prescricao_itens(uuid,text,jsonb)',
    'public.registrar_prescricao_observacao(uuid,text)'
  ]::regprocedure[];
BEGIN
  FOREACH f IN ARRAY alvo LOOP
    IF (SELECT l.lanname FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.oid = f) <> 'plpgsql' THEN
      RAISE EXCEPTION 'segundo fator: % não é plpgsql; incluir a checagem à mão', f;
    END IF;
    def := pg_get_functiondef(f);
    CONTINUE WHEN def LIKE '%private.exigir_segundo_fator()%';
    IF def !~ E'\nBEGIN\n' THEN
      RAISE EXCEPTION 'segundo fator: bloco principal de % não encontrado', f;
    END IF;
    def := regexp_replace(def, E'\nBEGIN\n', E'\nBEGIN\n  PERFORM private.exigir_segundo_fator();  -- ADR 0010\n');
    EXECUTE def;
  END LOOP;
END $$;

-- Portão 2, tarefa 7 (R2-09): evasão gravada sem data do desfecho. Decisões do
-- RT em 16/10/2026 ("1a 2a 3a 4a").
--
-- Origem: public.retirar_da_fila ("Excluir da fila" na porta) gravava o
-- desfecho (evasão ou cancelamento) e o encerramento, mas não desfecho_em nem
-- desfecho_por; o indicador de evasão conta por desfecho_em e deixava a ficha
-- de fora. Levantamento de 16/10: homologação com 2 evasões e 3 cancelamentos
-- sem data; produção sem nenhum episódio com desfecho.
--
--  1a. desfecho_em = hora da retirada (a mesma do encerramento).
--  2a. Registros antigos: desfecho_em = encerramento, desfecho_por = quem
--      encerrou, com auditoria.
--  3a. Cancelamento também grava a data (o indicador de evasão continua só
--      com evasão).
--  4a. Regra no banco: episódio com desfecho tem data do desfecho.
--
-- Corpo de retirar_da_fila conferido (md5 cc27dc9f…) igual no local e na
-- produção em 16/10/2026; o trecho é procurado sem \r.

DO $$
DECLARE def text; antigo text; novo text;
BEGIN
  def := replace(pg_get_functiondef('public.retirar_da_fila(uuid, text, text)'::regprocedure), E'\r', '');
  antigo := '         encerrado_em = now(), encerrado_por = private.meu_perfil_id(), updated_at = now()';
  novo := '         encerrado_em = now(), encerrado_por = private.meu_perfil_id(), updated_at = now(),' || E'\n'
       || '         -- Portão 2, tarefa 7 (R2-09): o desfecho tem data e autor, como nos outros caminhos' || E'\n'
       || '         desfecho_em = now(), desfecho_por = private.meu_perfil_id()';
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'retirar_da_fila mudou: trecho do encerramento não encontrado'; END IF;
  def := replace(def, antigo, novo);
  -- o gatilho private.fila_sem_atendimento_aberto reconhecia este caminho por
  -- desfecho_por vazio; com o autor gravado, a regra passa a ser explícita aqui
  antigo := '  IF p_motivo NOT IN (''evasao'', ''duplicada'', ''engano'') THEN';
  novo := '  IF e.atendimento_iniciado_em IS NOT NULL THEN' || E'\n'
       || '    RAISE EXCEPTION ''Atendimento já aberto: registre o desfecho (evasão) pelo médico.'';' || E'\n'
       || '  END IF;' || E'\n' || antigo;
  IF position(antigo IN def) = 0 THEN RAISE EXCEPTION 'retirar_da_fila mudou: trecho do motivo não encontrado'; END IF;
  EXECUTE replace(def, antigo, novo);
END $$;

-- 2a. registros antigos (só o que ficou sem data), com auditoria de cada um
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    UPDATE public.episodios e
       SET desfecho_em = coalesce(e.encerrado_em, e.updated_at),
           desfecho_por = coalesce(e.desfecho_por, e.encerrado_por)
     WHERE e.desfecho IS NOT NULL AND e.desfecho_em IS NULL
    RETURNING e.id, e.unidade_id, e.desfecho, e.desfecho_em
  LOOP
    PERFORM private.registrar_auditoria('corrigir_data_desfecho', 'episodios', r.id, r.unidade_id,
      jsonb_build_object('desfecho', r.desfecho, 'desfecho_em', r.desfecho_em,
                         'motivo', 'R2-09: retirar_da_fila não gravava a data do desfecho; preenchida com a hora do encerramento'));
  END LOOP;
END $$;

-- 4a. não volta a acontecer
ALTER TABLE public.episodios
  ADD CONSTRAINT episodios_desfecho_tem_data CHECK (desfecho IS NULL OR desfecho_em IS NOT NULL);

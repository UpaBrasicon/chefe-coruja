-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — base do modo sem conexão (ADR 0009).
--
-- Todo registro nasce no aparelho com identificador próprio e entra por uma
-- única porta, sincronizar_registros(), com ou sem conexão:
--   • idempotente: o id vem do aparelho; reenviar devolve "ja_recebido";
--   • o acesso é conferido NA HORA DO FATO: quem estava em plantão no setor
--     do paciente naquele momento (até 15 min depois do fim) pode sincronizar
--     mesmo depois de o plantão acabar — é para isso que a fila existe;
--   • sem conexão, o fato não pode estar a mais de 2 h do último contato com
--     o servidor;
--   • duas horas guardadas: aferido_em (hora clínica, calculada no aparelho a
--     partir do relógio do servidor) e created_at (chegada ao servidor);
--   • o autor é sempre o login, nunca um campo enviado pelo app.
-- Cada item é gravado ou recusado sozinho: um item ruim não derruba o lote.
--
-- Primeiro tipo aceito: 'observacao' (sinais vitais). Outros tipos entram
-- aqui, um a um, nas fases seguintes.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.observacao
  ADD COLUMN IF NOT EXISTS sem_conexao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aparelho_id text;

-- Limites do ADR 0009, num lugar só.
CREATE OR REPLACE FUNCTION private.tolerancia_fim_plantao() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '15 minutes' $$;
CREATE OR REPLACE FUNCTION private.limite_sem_conexao() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '2 hours' $$;

-- Setores em que o usuário estava em plantão num instante (com a tolerância).
CREATE OR REPLACE FUNCTION private.setores_em_plantao_em(p_momento timestamptz)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT e.setor_id
  FROM public.escala_plantao e
  JOIN public.setores s ON s.id = e.setor_id AND s.unidade_id = e.unidade_id
  WHERE e.perfil_id = private.meu_perfil_id()
    AND e.ativo
    AND e.inicio <= p_momento
    AND p_momento < e.inicio + make_interval(mins => e.duracao_min) + private.tolerancia_fim_plantao();
$$;
REVOKE ALL ON FUNCTION private.setores_em_plantao_em(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.setores_em_plantao_em(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION private.podia_atuar_no_paciente_em(p_paciente uuid, p_momento timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
    WHERE pa.id = p_paciente
      AND (   private.eh_super_admin()
           OR private.papel_na_unidade(pa.unidade_id) = 'gestor'
           OR pa.setor_id IN (SELECT private.setores_em_plantao_em(p_momento))
           OR EXISTS (SELECT 1 FROM public.internacoes i
                      WHERE i.paciente_id = pa.id
                        AND i.setor_atual_id IN (SELECT private.setores_em_plantao_em(p_momento))))
  );
$$;
REVOKE ALL ON FUNCTION private.podia_atuar_no_paciente_em(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.podia_atuar_no_paciente_em(uuid, timestamptz) TO authenticated;

-- ── um item de observação ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.sincronizar_observacao(
  p_id uuid, p_hora timestamptz, p_sem_conexao boolean, p_aparelho text, d jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_paciente uuid := (d ->> 'paciente_id')::uuid;
  v_internacao uuid := nullif(d ->> 'internacao_id', '')::uuid;
  v_unidade uuid;
  v_dono uuid;
BEGIN
  SELECT registrado_por INTO v_dono FROM public.observacao WHERE id = p_id;
  IF FOUND THEN
    IF v_dono IS DISTINCT FROM v_perfil THEN
      RAISE EXCEPTION 'SYNC_ID_EM_USO: identificador já usado por outro registro.';
    END IF;
    RETURN 'ja_recebido';
  END IF;

  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = v_paciente;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'SYNC_PACIENTE: paciente não encontrado.';
  END IF;
  IF private.podia_atuar_no_paciente_em(v_paciente, p_hora) IS NOT TRUE THEN
    RAISE EXCEPTION 'SYNC_FORA_DO_PLANTAO: na hora do registro você não estava em plantão no setor deste paciente.';
  END IF;
  IF v_internacao IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.internacoes WHERE id = v_internacao AND paciente_id = v_paciente) THEN
    RAISE EXCEPTION 'SYNC_INTERNACAO: internação não pertence ao paciente.';
  END IF;

  INSERT INTO public.observacao
    (id, unidade_id, internacao_id, paciente_id, conceito_id, aferido_em, registrado_por,
     valor_num, valor_texto, valor_conceito_id, unidade, origem, sem_conexao, aparelho_id)
  VALUES
    (p_id, v_unidade, v_internacao, v_paciente, (d ->> 'conceito_id')::uuid, p_hora, v_perfil,
     (d ->> 'valor_num')::numeric, d ->> 'valor_texto', nullif(d ->> 'valor_conceito_id', '')::uuid,
     d ->> 'unidade', coalesce(d ->> 'origem', 'manual'), p_sem_conexao, left(p_aparelho, 64));
  RETURN 'gravado';
END $$;
REVOKE ALL ON FUNCTION private.sincronizar_observacao(uuid, timestamptz, boolean, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ── a porta ─────────────────────────────────────────────────────────────────
-- p_itens: [{ id, tipo, hora, sem_conexao, ultimo_contato, aparelho_id, dados }]
-- devolve: [{ id, status: gravado | ja_recebido | recusado, motivo? }]
CREATE OR REPLACE FUNCTION public.sincronizar_registros(p_itens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  v_id uuid;
  v_hora timestamptz;
  v_contato timestamptz;
  v_sem boolean;
  v_status text;
  saida jsonb := '[]'::jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) > 200 THEN
    RAISE EXCEPTION 'Envie de 1 a 200 registros por vez.';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_id := NULL;
    BEGIN
      v_id := (item ->> 'id')::uuid;
      v_hora := (item ->> 'hora')::timestamptz;
      v_sem := coalesce((item ->> 'sem_conexao')::boolean, false);
      v_contato := (item ->> 'ultimo_contato')::timestamptz;
      IF v_id IS NULL OR v_hora IS NULL THEN
        RAISE EXCEPTION 'SYNC_INVALIDO: id e hora são obrigatórios.';
      END IF;
      IF v_hora > now() + interval '1 minute' THEN
        RAISE EXCEPTION 'SYNC_HORA_FUTURA: hora do registro no futuro.';
      END IF;
      IF v_sem THEN
        IF v_contato IS NULL OR v_contato > now() OR v_contato > v_hora + interval '1 minute' THEN
          RAISE EXCEPTION 'SYNC_CONTATO: último contato com o servidor ausente ou inconsistente.';
        END IF;
        IF v_hora - v_contato > private.limite_sem_conexao() THEN
          RAISE EXCEPTION 'SYNC_LIMITE: registro feito depois de 2 h sem conexão.';
        END IF;
      ELSIF v_hora < now() - interval '5 minutes' THEN
        -- com conexão, a hora é a do servidor; hora antiga só vem pela fila
        RAISE EXCEPTION 'SYNC_HORA: registro com conexão precisa ter a hora atual.';
      END IF;

      CASE item ->> 'tipo'
        WHEN 'observacao' THEN
          v_status := private.sincronizar_observacao(v_id, v_hora, v_sem, item ->> 'aparelho_id', item -> 'dados');
        ELSE
          RAISE EXCEPTION 'SYNC_TIPO: tipo de registro não aceito (%).', item ->> 'tipo';
      END CASE;
      saida := saida || jsonb_build_object('id', v_id, 'status', v_status);
    EXCEPTION WHEN others THEN
      saida := saida || jsonb_build_object('id', coalesce(v_id::text, item ->> 'id'), 'status', 'recusado', 'motivo', SQLERRM);
    END;
  END LOOP;
  RETURN saida;
END $$;
REVOKE ALL ON FUNCTION public.sincronizar_registros(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_registros(jsonb) TO authenticated;

-- O que o aparelho precisa guardar para continuar sem conexão: a hora do
-- servidor e o fim do plantão em curso (o relógio do aparelho não conta).
CREATE OR REPLACE FUNCTION public.contexto_sem_conexao()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'servidor', now(),
    'fim_plantao', (SELECT max(e.inicio + make_interval(mins => e.duracao_min)) FROM private.plantoes_agora() e),
    'tolerancia_min', extract(epoch FROM private.tolerancia_fim_plantao()) / 60,
    'limite_min', extract(epoch FROM private.limite_sem_conexao()) / 60
  );
$$;
REVOKE ALL ON FUNCTION public.contexto_sem_conexao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contexto_sem_conexao() TO authenticated;

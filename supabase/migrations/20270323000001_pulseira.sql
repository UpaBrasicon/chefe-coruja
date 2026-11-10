-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 2 do Portão de 11/10/2026: pulseira de identificação.
-- Decisão do RT em 10/11/2026: A em P1 a P8
-- (docs/porta/LACUNA-02-PULSEIRA-DIAGNOSTICO.md). Fonte: Protocolo de
-- Identificação do Paciente (Anexo 02 da Portaria MS/GM nº 2.095/2013).
--
-- Os dados da pulseira saem do servidor, numa função só, para toda tela
-- imprimir a mesma coisa (P1 a P3): nome completo, nome social, nascimento
-- (só a data real), prontuário e nome da mãe; no não identificado, sexo
-- aparente, raça/cor, idade estimada em meses (nunca a data estimada) e os
-- sinais; no recém-nascido (até 27 dias, ligado à mãe), a mãe atual e a
-- ordem do gêmeo. Sem leito, setor, diagnóstico, alergia ou risco (P1, P5).
--
-- P8. Toda impressão grava a mesma linha que registrar_impressao grava em
-- log_acesso_prontuario (tipo 'impressao', quem = o login, quando, IP e
-- navegador) e devolve o protocolo IMP- no mesmo formato. registrar_impressao
-- não aceita motivo; por isso a função nova. O documento_tipo leva só o
-- código fixo ('Pulseira' ou 'Pulseira (reimpressão: caiu)'), sem dado de
-- pessoa. O motivo e o texto do "outro" ficam em public.impressoes_pulseira,
-- ligada à linha do registro de acesso; lê só o gestor da unidade, o super
-- admin e quem imprimiu.
--
-- Quem imprime (private.pode_imprimir_pulseira):
--   - quem pode atuar no paciente (pode_atuar_no_paciente: super admin,
--     gestor da unidade, plantão agora no setor do paciente com a ficha
--     aberta, ou no da internação aberta; a recepção e a enfermagem de
--     plantão na porta entram por aqui, porque registrar_ficha põe o
--     paciente no setor da porta);
--   - a recepção da unidade de plantão agora (como identificar_paciente, que
--     aceita a recepção da unidade, mas exigindo o plantão): ela cadastra o
--     RN sem setor e reimprime a pulseira que caiu. Os dados são os mesmos que
--     buscar_pacientes já entrega a quem está de plantão na unidade, mais
--     sexo, raça/cor e sinais do não identificado, que a recepção já lê em
--     pacientes_nao_identificados;
--   - para o recém-nascido ligado à mãe (até 27 dias), quem pode atuar na
--     mãe (o RN nasce sem setor; a enfermagem do leito da mãe imprime).
--   Na UBS não há pulseira (P7): a função recusa.
--   A pulseira não é obrigatória em toda unidade (RT, 10/11/2026): só imprime
--   na unidade em que o gestor ligou unidades.usa_pulseira (desligada por
--   padrão), em Configuração (public.definir_pulseira_unidade).
--   Como registrar_impressao, passa por exigir_segundo_fator.
--
-- Só aditiva: uma coluna em unidades, uma tabela, um índice, um gatilho e
-- quatro funções novas.
-- Nenhuma função existente muda. Idempotente.
-- Teste: supabase/tests/pulseira.sql
--
-- Rollback (na ordem):
--   1. DROP FUNCTION IF EXISTS public.registrar_impressao_pulseira(uuid, boolean, text, text),
--        private.dados_pulseira(uuid), private.pode_imprimir_pulseira(uuid);
--      DROP FUNCTION IF EXISTS public.definir_pulseira_unidade(uuid, boolean);
--   2. DROP TABLE IF EXISTS public.impressoes_pulseira;
--      (apaga os motivos de reimpressão: exportar antes se já houver linhas
--      de uso real; as linhas de log_acesso_prontuario ficam, com o
--      documento_tipo 'Pulseira ...').
--   3. ALTER TABLE public.unidades DROP COLUMN IF EXISTS usa_pulseira;
-- ════════════════════════════════════════════════════════════════════════════

-- ── a unidade usa pulseira? (decisão do gestor; desligada por padrão) ───────
ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS usa_pulseira boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.unidades.usa_pulseira IS
  'A unidade imprime pulseira de identificação (lacuna 2). Não é obrigatória: o gestor liga em Configuração (RT, 10/11/2026).';

CREATE OR REPLACE FUNCTION public.definir_pulseira_unidade(p_unidade uuid, p_usa boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_antes boolean; v_tipo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'gestor') OR private.eh_super_admin()) THEN
    RAISE EXCEPTION 'Quem liga a pulseira da unidade é o gestor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_usa IS NULL THEN RAISE EXCEPTION 'Diga se a unidade usa pulseira.'; END IF;
  SELECT usa_pulseira, tipo INTO v_antes, v_tipo FROM public.unidades WHERE id = p_unidade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;
  IF p_usa AND v_tipo = 'ubs' THEN RAISE EXCEPTION 'A UBS não usa pulseira de identificação.'; END IF;
  UPDATE public.unidades SET usa_pulseira = p_usa, updated_at = now() WHERE id = p_unidade;
  PERFORM private.registrar_auditoria('pulseira_unidade_definida', 'unidades', p_unidade, p_unidade,
    jsonb_build_object('antes', v_antes, 'depois', p_usa));
  RETURN p_usa;
END $$;
REVOKE ALL ON FUNCTION public.definir_pulseira_unidade(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_pulseira_unidade(uuid, boolean) TO authenticated;

-- ── motivo da reimpressão ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.impressoes_pulseira (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acesso_id    uuid NOT NULL UNIQUE REFERENCES public.log_acesso_prontuario(id),
  paciente_id  uuid NOT NULL REFERENCES public.pacientes(id),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  impresso_por uuid NOT NULL REFERENCES public.perfis(id),
  impresso_em  timestamptz NOT NULL DEFAULT now(),
  reimpressao  boolean NOT NULL,
  motivo       text CHECK (motivo IN ('caiu', 'ilegivel', 'paciente_identificado', 'dados_corrigidos', 'outro')),
  detalhe      text CHECK (char_length(detalhe) <= 200),
  CONSTRAINT impressoes_pulseira_motivo CHECK (
    (NOT reimpressao AND motivo IS NULL AND detalhe IS NULL)
    OR (reimpressao AND motivo IS NOT NULL
        AND (motivo = 'outro') = (detalhe IS NOT NULL)))
);
COMMENT ON TABLE public.impressoes_pulseira IS
  'Pulseira de identificação impressa (lacuna 2, RT 10/11/2026): liga a linha de log_acesso_prontuario ao motivo da reimpressão (caiu, ilegível, paciente identificado, dados corrigidos ou outro, com texto). Só registrar_impressao_pulseira grava.';
CREATE INDEX IF NOT EXISTS impressoes_pulseira_paciente ON public.impressoes_pulseira (paciente_id, impresso_em DESC);
ALTER TABLE public.impressoes_pulseira ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.impressoes_pulseira FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.impressoes_pulseira TO authenticated;
DROP POLICY IF EXISTS impressoes_pulseira_select ON public.impressoes_pulseira;
CREATE POLICY impressoes_pulseira_select ON public.impressoes_pulseira
  FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor'
         OR impresso_por = private.meu_perfil_id());
-- como o registro de acesso: não se altera nem se apaga
DROP TRIGGER IF EXISTS trg_impressoes_pulseira_so_insercao ON public.impressoes_pulseira;
CREATE TRIGGER trg_impressoes_pulseira_so_insercao
  BEFORE UPDATE OR DELETE ON public.impressoes_pulseira
  FOR EACH ROW EXECUTE FUNCTION private.recusar_alteracao_de_registro();

-- ── quem imprime ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.pode_imprimir_pulseira(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes p
     WHERE p.id = p_paciente AND p.ativo
       AND (   private.pode_atuar_no_paciente(p.id) IS TRUE
            OR (private.tenho_papel(p.unidade_id, 'recepcao') IS TRUE AND private.na_escala_agora(p.unidade_id) IS TRUE)
            OR (p.mae_id IS NOT NULL AND NOT p.data_nascimento_estimada
                AND p.data_nascimento > private.data_atual() - 28
                AND private.pode_atuar_no_paciente(p.mae_id) IS TRUE))
  );
$$;
REVOKE ALL ON FUNCTION private.pode_imprimir_pulseira(uuid) FROM PUBLIC, anon, authenticated;

-- ── os dados da pulseira (P1, P2, P3) ───────────────────────────────────────
-- Nascimento só o real. Estimado: idade em meses completos, para a etiqueta
-- dizer "idade estimada" e nunca uma data inventada.
CREATE OR REPLACE FUNCTION private.dados_pulseira(p_paciente uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
           'nome', p.nome,
           'nome_social', nullif(btrim(coalesce(p.nome_social, '')), ''),
           'data_nascimento', CASE WHEN NOT p.data_nascimento_estimada THEN p.data_nascimento END,
           'idade_estimada_meses', CASE WHEN p.data_nascimento_estimada AND p.data_nascimento IS NOT NULL
             THEN (extract(year FROM age(h.hoje, p.data_nascimento)) * 12
                   + extract(month FROM age(h.hoje, p.data_nascimento)))::int END,
           'prontuario', p.prontuario,
           'nome_mae', CASE WHEN r.rn THEN coalesce(nullif(btrim(m.nome), ''), nullif(btrim(coalesce(p.nome_mae, '')), ''))
                            ELSE nullif(btrim(coalesce(p.nome_mae, '')), '') END,
           'sexo', p.sexo,
           'raca_cor', p.raca_cor,
           'identidade_desconhecida', p.identidade_desconhecida,
           'sinais_identificacao', CASE WHEN p.identidade_desconhecida THEN nullif(btrim(coalesce(p.sinais_identificacao, '')), '') END,
           'rn', r.rn,
           'rn_ordem', CASE WHEN r.rn THEN p.rn_ordem END)
    FROM public.pacientes p
    LEFT JOIN public.pacientes m ON m.id = p.mae_id
    CROSS JOIN LATERAL (SELECT private.data_atual() AS hoje) h
    CROSS JOIN LATERAL (SELECT p.mae_id IS NOT NULL AND NOT p.data_nascimento_estimada
                               AND p.data_nascimento IS NOT NULL AND p.data_nascimento > h.hoje - 28 AS rn) r
   WHERE p.id = p_paciente;
$$;
REVOKE ALL ON FUNCTION private.dados_pulseira(uuid) FROM PUBLIC, anon, authenticated;

-- ── imprimir e reimprimir (P8) ──────────────────────────────────────────────
-- Devolve {protocolo, emitido_em, reimpressao, pulseira: {...}}: o papel só
-- sai com o protocolo, e os dados vêm na mesma chamada que registra.
CREATE OR REPLACE FUNCTION public.registrar_impressao_pulseira(
  p_paciente uuid,
  p_reimpressao boolean DEFAULT false,
  p_motivo text DEFAULT NULL,
  p_detalhe text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_reimp boolean := coalesce(p_reimpressao, false);
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_detalhe text := nullif(regexp_replace(btrim(coalesce(p_detalhe, '')), '\s+', ' ', 'g'), '');
  v_pac public.pacientes;
  r public.log_acesso_prontuario;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO v_pac FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF private.pode_imprimir_pulseira(v_pac.id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF (SELECT u.tipo FROM public.unidades u WHERE u.id = v_pac.unidade_id) = 'ubs' THEN
    RAISE EXCEPTION 'A UBS não usa pulseira de identificação.';
  END IF;
  IF (SELECT u.usa_pulseira FROM public.unidades u WHERE u.id = v_pac.unidade_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Esta unidade não usa pulseira de identificação. O gestor liga em Configuração.';
  END IF;

  IF v_reimp THEN
    IF v_motivo IS NULL THEN RAISE EXCEPTION 'Informe o motivo da reimpressão.'; END IF;
    IF v_motivo NOT IN ('caiu', 'ilegivel', 'paciente_identificado', 'dados_corrigidos', 'outro') THEN
      RAISE EXCEPTION 'Motivo da reimpressão: caiu, ilegível, paciente identificado, dados corrigidos ou outro.';
    END IF;
    IF v_motivo = 'outro' THEN
      IF length(coalesce(v_detalhe, '')) < 3 THEN
        RAISE EXCEPTION 'Motivo "outro": escreva qual é (ao menos 3 letras).';
      END IF;
      IF char_length(v_detalhe) > 200 THEN RAISE EXCEPTION 'Motivo "outro": no máximo 200 letras.'; END IF;
    ELSE
      v_detalhe := NULL;
    END IF;
  ELSE
    v_motivo := NULL;
    v_detalhe := NULL;
  END IF;

  -- a mesma linha que private.gravar_acesso grava para registrar_impressao
  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel,
     tipo_acesso, documento_id, documento_tipo, ip, user_agent)
  VALUES
    ((SELECT organizacao_id FROM public.unidades WHERE id = v_pac.unidade_id),
     v_pac.unidade_id, v_pac.id, NULL, v_perfil,
     nullif(private.papel_na_unidade(v_pac.unidade_id), ''), 'impressao', NULL,
     CASE WHEN v_reimp THEN 'Pulseira (reimpressão: ' || v_motivo || ')' ELSE 'Pulseira' END,
     private.requisicao_ip(), private.requisicao_navegador())
  RETURNING * INTO r;

  INSERT INTO public.impressoes_pulseira (acesso_id, paciente_id, unidade_id, impresso_por, impresso_em, reimpressao, motivo, detalhe)
  VALUES (r.id, v_pac.id, v_pac.unidade_id, v_perfil, r.created_at, v_reimp, v_motivo, v_detalhe);

  RETURN jsonb_build_object(
    'protocolo', 'IMP-' || upper(left(replace(r.id::text, '-', ''), 10)),
    'emitido_em', r.created_at,
    'reimpressao', v_reimp,
    'pulseira', private.dados_pulseira(v_pac.id));
END $$;
REVOKE ALL ON FUNCTION public.registrar_impressao_pulseira(uuid, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_impressao_pulseira(uuid, boolean, text, text) TO authenticated;

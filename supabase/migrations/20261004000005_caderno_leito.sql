-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend — CADERNO DO LEITO e LISTA DE INTERNADOS (protótipo,
-- index.html 2602–2721, 3050–3142; ESTADO.md, etapa 5).
--
-- 1. Diagnóstico do episódio (manual PEP 3.5): CID-10 da tabela de
--    terminologia, um PRIMÁRIO obrigatório e único por internação (ou por
--    atendimento da porta), secundários só com primário, status hipótese ou
--    confirmado, tempo da doença com unidade, autor e hora. Nada se apaga nem
--    se reescreve: trocar o primário ENCERRA o anterior ("substituido") e grava
--    outro; retirar um secundário o encerra ("retirado"). O primário vigente
--    vira internacoes.cid_principal (o Phoenix e o pacote de alta já leem ali).
--    A notificação compulsória (LNNC, Portaria GM/MS 10.175/2026) ainda não tem
--    catálogo no banco: fica para a onda 6 (a tela tem o gancho).
-- 2. Tendência da acuidade: cada lançamento de sinal vital grava o escore
--    (NEWS2/PEWS) calculado pela MESMA função do leito (private.calcular_acuidade),
--    para a linha de tendência. A série começa nesta migration — o escore de
--    antes não é recalculado (a função só olha as últimas 24 h a partir de agora).
-- 3. Classificação da porta vista do leito: o histórico do episódio que originou
--    a internação. classificacoes_do_episodio exige o setor do EPISÓDIO (a porta)
--    na escala de quem lê; no leito, vale quem pode atuar no paciente agora.
-- 4. Altas que eu dei nas últimas 24 h (a janela de cancelar_alta), para a lista
--    de internados: depois da alta o paciente sai do censo e a RLS de pacientes
--    deixa de mostrá-lo.
--
-- Reaplicável (IF NOT EXISTS / OR REPLACE / DROP … IF EXISTS).
-- DOWN (manual):
--   DROP FUNCTION IF EXISTS public.minhas_altas_recentes(uuid);
--   DROP FUNCTION IF EXISTS public.classificacoes_do_leito(uuid);
--   DROP FUNCTION IF EXISTS public.tendencia_acuidade(uuid, int);
--   DROP TRIGGER IF EXISTS trg_observacao_acuidade_ins ON public.observacao;
--   DROP TRIGGER IF EXISTS trg_observacao_acuidade_upd ON public.observacao;
--   DROP FUNCTION IF EXISTS private.observacao_grava_acuidade();
--   DROP TABLE IF EXISTS public.acuidade_afericoes;   (a guarda impede DELETE de linhas, não DROP)
--   DROP FUNCTION IF EXISTS public.diagnosticos_do_leito(uuid);
--   DROP FUNCTION IF EXISTS public.retirar_diagnostico(uuid, text);
--   DROP FUNCTION IF EXISTS public.registrar_diagnostico(uuid, text, text, text, int, text, uuid);
--   DROP TABLE IF EXISTS public.diagnosticos_episodio;
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. diagnóstico do episódio ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diagnosticos_episodio (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id       uuid REFERENCES public.internacoes(id),
  episodio_id         uuid REFERENCES public.episodios(id),
  tipo                text NOT NULL CHECK (tipo IN ('primario', 'secundario')),
  cid                 text NOT NULL CHECK (cid ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,2})?$'),
  descricao           text,
  status              text NOT NULL CHECK (status IN ('hipotese', 'confirmado')),
  tempo_doenca        int CHECK (tempo_doenca BETWEEN 0 AND 999),
  tempo_unidade       text CHECK (tempo_unidade IN ('horas', 'dias', 'meses', 'anos')),
  registrado_por      uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em       timestamptz NOT NULL DEFAULT now(),
  substitui_id        uuid REFERENCES public.diagnosticos_episodio(id),
  encerrado_em        timestamptz,
  encerrado_por       uuid REFERENCES public.perfis(id),
  encerramento        text CHECK (encerramento IN ('substituido', 'retirado')),
  motivo_encerramento text,
  CONSTRAINT diagnosticos_contexto CHECK (internacao_id IS NOT NULL OR episodio_id IS NOT NULL),
  CONSTRAINT diagnosticos_tempo_par CHECK ((tempo_doenca IS NULL) = (tempo_unidade IS NULL)),
  CONSTRAINT diagnosticos_tempo_do_primario CHECK (tipo = 'primario' OR tempo_doenca IS NULL),
  CONSTRAINT diagnosticos_encerramento_par CHECK ((encerrado_em IS NULL) = (encerramento IS NULL))
);
COMMENT ON TABLE public.diagnosticos_episodio IS
  'Diagnóstico do episódio (CID-10): um primário vigente por internação ou atendimento, secundários só com primário; histórico preservado (encerrar, nunca apagar). Manual PEP 3.5.';

-- contexto = a internação; sem ela, o atendimento da porta
CREATE UNIQUE INDEX IF NOT EXISTS diagnosticos_um_primario_vigente
  ON public.diagnosticos_episodio ((coalesce(internacao_id, episodio_id))) WHERE tipo = 'primario' AND encerrado_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS diagnosticos_cid_vigente_unico
  ON public.diagnosticos_episodio ((coalesce(internacao_id, episodio_id)), cid) WHERE encerrado_em IS NULL;
CREATE INDEX IF NOT EXISTS diagnosticos_episodio_paciente_idx ON public.diagnosticos_episodio (paciente_id);
CREATE INDEX IF NOT EXISTS diagnosticos_episodio_internacao_idx ON public.diagnosticos_episodio (internacao_id);

-- a única mudança possível numa linha é encerrá-la, uma vez
CREATE OR REPLACE FUNCTION private.diagnostico_so_encerra() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.encerrado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Diagnóstico encerrado não muda: registre outro.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.unidade_id, NEW.paciente_id, NEW.internacao_id, NEW.episodio_id, NEW.tipo, NEW.cid, NEW.descricao, NEW.status,
      NEW.tempo_doenca, NEW.tempo_unidade, NEW.registrado_por, NEW.registrado_em, NEW.substitui_id)
     IS DISTINCT FROM
     (OLD.unidade_id, OLD.paciente_id, OLD.internacao_id, OLD.episodio_id, OLD.tipo, OLD.cid, OLD.descricao, OLD.status,
      OLD.tempo_doenca, OLD.tempo_unidade, OLD.registrado_por, OLD.registrado_em, OLD.substitui_id) THEN
    RAISE EXCEPTION 'Diagnóstico registrado não se reescreve: registre outro.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_diagnostico_so_encerra ON public.diagnosticos_episodio;
CREATE TRIGGER trg_diagnostico_so_encerra BEFORE UPDATE ON public.diagnosticos_episodio
  FOR EACH ROW EXECUTE FUNCTION private.diagnostico_so_encerra();

ALTER TABLE public.diagnosticos_episodio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS diagnosticos_episodio_select ON public.diagnosticos_episodio;
CREATE POLICY diagnosticos_episodio_select ON public.diagnosticos_episodio FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS diagnosticos_episodio_pedido_acesso ON public.diagnosticos_episodio;
CREATE POLICY diagnosticos_episodio_pedido_acesso ON public.diagnosticos_episodio FOR SELECT TO authenticated
  USING (private.acesso_encerrado_vigente(paciente_id));
DROP POLICY IF EXISTS diagnosticos_episodio_teleinterconsulta ON public.diagnosticos_episodio;
CREATE POLICY diagnosticos_episodio_teleinterconsulta ON public.diagnosticos_episodio FOR SELECT TO authenticated
  USING (private.teleinterconsulta_vigente(paciente_id));
DROP POLICY IF EXISTS diagnosticos_episodio_segundo_fator ON public.diagnosticos_episodio;
CREATE POLICY diagnosticos_episodio_segundo_fator ON public.diagnosticos_episodio AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());
REVOKE ALL ON public.diagnosticos_episodio FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.diagnosticos_episodio FROM authenticated;
GRANT SELECT ON public.diagnosticos_episodio TO authenticated;

-- Registra (ou troca) um diagnóstico. p_internacao ou, sem internação, p_episodio.
CREATE OR REPLACE FUNCTION public.registrar_diagnostico(
  p_internacao uuid, p_tipo text, p_cid text, p_status text,
  p_tempo int DEFAULT NULL, p_tempo_unidade text DEFAULT NULL, p_episodio uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_unidade uuid; v_paciente uuid; v_internacao uuid; v_episodio uuid;
  v_cid text := private.cid_normalizado(p_cid);
  v_desc text;
  v_atual public.diagnosticos_episodio;
  v_id uuid;
  v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_internacao IS NOT NULL THEN
    SELECT i.unidade_id, i.paciente_id, i.id, i.episodio_id INTO v_unidade, v_paciente, v_internacao, v_episodio
      FROM public.internacoes i WHERE i.id = p_internacao AND i.status IN ('admitido', 'em_observacao', 'internado');
    IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada ou já encerrada.'; END IF;
  ELSIF p_episodio IS NOT NULL THEN
    SELECT e.unidade_id, e.paciente_id, e.id INTO v_unidade, v_paciente, v_episodio
      FROM public.episodios e WHERE e.id = p_episodio AND e.encerrado_em IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Atendimento não encontrado ou já encerrado.'; END IF;
  ELSE
    RAISE EXCEPTION 'Informe a internação ou o atendimento.';
  END IF;
  IF NOT private.paciente_no_meu_plantao(v_paciente) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O diagnóstico é registrado pelo médico de plantão com o paciente.';
  END IF;

  IF p_tipo NOT IN ('primario', 'secundario') THEN RAISE EXCEPTION 'Tipo de diagnóstico inválido.'; END IF;
  IF p_status NOT IN ('hipotese', 'confirmado') THEN RAISE EXCEPTION 'Status: hipótese ou confirmado.'; END IF;
  IF v_cid IS NULL THEN RAISE EXCEPTION 'CID fora do formato (ex.: J18.9).'; END IF;
  -- com a tabela CID-10 carregada, o código tem de existir nela
  IF EXISTS (SELECT 1 FROM terminologia.cid10) THEN
    SELECT c.descricao INTO v_desc FROM terminologia.cid10 c
     WHERE c.codigo IN (v_cid, replace(v_cid, '.', '')) ORDER BY c.codigo = v_cid DESC LIMIT 1;
    IF v_desc IS NULL THEN RAISE EXCEPTION 'CID % não encontrado na CID-10.', v_cid; END IF;
  END IF;
  IF p_tempo IS NOT NULL THEN
    IF p_tipo <> 'primario' THEN RAISE EXCEPTION 'O tempo da doença vai no diagnóstico primário.'; END IF;
    IF p_tempo < 0 OR p_tempo > 999 THEN RAISE EXCEPTION 'Tempo da doença: até 3 números.'; END IF;
    IF p_tempo_unidade NOT IN ('horas', 'dias', 'meses', 'anos') OR p_tempo_unidade IS NULL THEN
      RAISE EXCEPTION 'Escolha a unidade do tempo da doença (horas, dias, meses ou anos).';
    END IF;
  END IF;

  SELECT * INTO v_atual FROM public.diagnosticos_episodio d
   WHERE coalesce(d.internacao_id, d.episodio_id) = coalesce(v_internacao, v_episodio)
     AND d.tipo = 'primario' AND d.encerrado_em IS NULL
   FOR UPDATE;

  IF p_tipo = 'secundario' THEN
    IF v_atual.id IS NULL THEN RAISE EXCEPTION 'Informe primeiro o diagnóstico primário.'; END IF;
    IF EXISTS (SELECT 1 FROM public.diagnosticos_episodio d
                WHERE coalesce(d.internacao_id, d.episodio_id) = coalesce(v_internacao, v_episodio)
                  AND d.cid = v_cid AND d.encerrado_em IS NULL) THEN
      RAISE EXCEPTION 'O CID % já está no diagnóstico.', v_cid;
    END IF;
    INSERT INTO public.diagnosticos_episodio (unidade_id, paciente_id, internacao_id, episodio_id, tipo, cid, descricao, status, registrado_por)
    VALUES (v_unidade, v_paciente, v_internacao, v_episodio, 'secundario', v_cid, v_desc, p_status, v_eu)
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  -- primário: igual ao vigente não grava nada
  IF v_atual.id IS NOT NULL AND v_atual.cid = v_cid AND v_atual.status = p_status
     AND v_atual.tempo_doenca IS NOT DISTINCT FROM p_tempo
     AND v_atual.tempo_unidade IS NOT DISTINCT FROM (CASE WHEN p_tempo IS NULL THEN NULL ELSE p_tempo_unidade END) THEN
    RETURN v_atual.id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.diagnosticos_episodio d
              WHERE coalesce(d.internacao_id, d.episodio_id) = coalesce(v_internacao, v_episodio)
                AND d.tipo = 'secundario' AND d.cid = v_cid AND d.encerrado_em IS NULL) THEN
    RAISE EXCEPTION 'O CID % está entre os secundários: retire-o antes de fazê-lo primário.', v_cid;
  END IF;
  IF v_atual.id IS NOT NULL THEN
    UPDATE public.diagnosticos_episodio
       SET encerrado_em = now(), encerrado_por = v_eu, encerramento = 'substituido'
     WHERE id = v_atual.id;
  END IF;
  INSERT INTO public.diagnosticos_episodio (unidade_id, paciente_id, internacao_id, episodio_id, tipo, cid, descricao, status,
                                            tempo_doenca, tempo_unidade, registrado_por, substitui_id)
  VALUES (v_unidade, v_paciente, v_internacao, v_episodio, 'primario', v_cid, v_desc, p_status,
          p_tempo, CASE WHEN p_tempo IS NULL THEN NULL ELSE p_tempo_unidade END, v_eu, v_atual.id)
  RETURNING id INTO v_id;
  IF v_internacao IS NOT NULL THEN
    UPDATE public.internacoes SET cid_principal = v_cid WHERE id = v_internacao;
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_diagnostico(uuid, text, text, text, int, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_diagnostico(uuid, text, text, text, int, text, uuid) TO authenticated;

-- Retira um secundário (o primário só se troca).
CREATE OR REPLACE FUNCTION public.retirar_diagnostico(p_diagnostico uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.diagnosticos_episodio;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.diagnosticos_episodio WHERE id = p_diagnostico FOR UPDATE;
  IF NOT FOUND OR d.encerrado_em IS NOT NULL THEN RAISE EXCEPTION 'Diagnóstico não encontrado ou já encerrado.'; END IF;
  IF NOT private.paciente_no_meu_plantao(d.paciente_id) OR private.tenho_papel(d.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'O diagnóstico é registrado pelo médico de plantão com o paciente.';
  END IF;
  IF d.tipo = 'primario' THEN RAISE EXCEPTION 'O primário é obrigatório: troque-o por outro, não o retire.'; END IF;
  UPDATE public.diagnosticos_episodio
     SET encerrado_em = now(), encerrado_por = private.meu_perfil_id(), encerramento = 'retirado',
         motivo_encerramento = nullif(btrim(coalesce(p_motivo, '')), '')
   WHERE id = d.id;
END $$;
REVOKE ALL ON FUNCTION public.retirar_diagnostico(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_diagnostico(uuid, text) TO authenticated;

-- Diagnósticos do leito: os da internação e os do atendimento da porta que a
-- originou, vigentes e encerrados, com o nome de quem registrou e de quem encerrou.
CREATE OR REPLACE FUNCTION public.diagnosticos_do_leito(p_internacao uuid)
RETURNS TABLE (
  id uuid, origem text, tipo text, cid text, descricao text, status text,
  tempo_doenca int, tempo_unidade text, registrado_em timestamptz, autor_nome text,
  encerrado_em timestamptz, encerramento text, encerrado_por_nome text, motivo_encerramento text, substitui_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  SELECT * INTO i FROM public.internacoes WHERE internacoes.id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF NOT private.pode_atuar_no_paciente(i.paciente_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT d.id, CASE WHEN d.internacao_id IS NULL THEN 'porta' ELSE 'internacao' END, d.tipo, d.cid, d.descricao, d.status,
         d.tempo_doenca, d.tempo_unidade, d.registrado_em, a.nome_completo,
         d.encerrado_em, d.encerramento, e.nome_completo, d.motivo_encerramento, d.substitui_id
    FROM public.diagnosticos_episodio d
    LEFT JOIN public.perfis a ON a.id = d.registrado_por
    LEFT JOIN public.perfis e ON e.id = d.encerrado_por
   WHERE d.internacao_id = i.id
      OR (d.internacao_id IS NULL AND i.episodio_id IS NOT NULL AND d.episodio_id = i.episodio_id)
   ORDER BY d.registrado_em DESC;
END $$;
REVOKE ALL ON FUNCTION public.diagnosticos_do_leito(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.diagnosticos_do_leito(uuid) TO authenticated;

-- ── 2. tendência da acuidade ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.acuidade_afericoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id  uuid NOT NULL REFERENCES public.pacientes(id),
  aferido_em   timestamptz NOT NULL,
  escala       text NOT NULL CHECK (escala IN ('NEWS2', 'PEWS')),
  total        int NOT NULL,
  banda        int NOT NULL CHECK (banda BETWEEN 0 AND 2),
  parcial      boolean NOT NULL,
  calculado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, aferido_em)
);
COMMENT ON TABLE public.acuidade_afericoes IS
  'Escore de acuidade (NEWS2/PEWS) a cada lançamento de sinal vital, calculado por private.calcular_acuidade: a linha de tendência do leito.';

ALTER TABLE public.acuidade_afericoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acuidade_afericoes_select ON public.acuidade_afericoes;
CREATE POLICY acuidade_afericoes_select ON public.acuidade_afericoes FOR SELECT TO authenticated
  USING (private.papel_na_unidade(unidade_id) = 'gestor' OR private.paciente_no_meu_plantao(paciente_id));
DROP POLICY IF EXISTS acuidade_afericoes_segundo_fator ON public.acuidade_afericoes;
CREATE POLICY acuidade_afericoes_segundo_fator ON public.acuidade_afericoes AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());
REVOKE ALL ON public.acuidade_afericoes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.acuidade_afericoes FROM authenticated;
GRANT SELECT ON public.acuidade_afericoes TO authenticated;

-- Um cálculo por paciente por comando (o lançamento traz vários sinais juntos).
-- Falha aqui não pode impedir o registro do sinal vital: vira aviso no log.
CREATE OR REPLACE FUNCTION private.observacao_grava_acuidade() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_pac uuid; r jsonb;
BEGIN
  FOR v_pac IN
    SELECT DISTINCT n.paciente_id FROM novas n
      JOIN public.conceito c ON c.id = n.conceito_id AND c.categoria = 'sinal_vital'
     WHERE n.paciente_id IS NOT NULL
  LOOP
    BEGIN
      r := private.calcular_acuidade(v_pac);
      IF r ->> 'escala' IN ('NEWS2', 'PEWS') AND r ->> 'aferido_em' IS NOT NULL THEN
        INSERT INTO public.acuidade_afericoes (unidade_id, paciente_id, aferido_em, escala, total, banda, parcial)
        SELECT pa.unidade_id, v_pac, (r ->> 'aferido_em')::timestamptz, r ->> 'escala',
               (r ->> 'total')::int, (r ->> 'banda')::int, coalesce((r ->> 'parcial')::boolean, false)
          FROM public.pacientes pa WHERE pa.id = v_pac
        ON CONFLICT (paciente_id, aferido_em) DO UPDATE
          SET escala = EXCLUDED.escala, total = EXCLUDED.total, banda = EXCLUDED.banda,
              parcial = EXCLUDED.parcial, calculado_em = now();
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'acuidade_afericoes: escore não gravado para %: %', v_pac, SQLERRM;
    END;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.observacao_grava_acuidade() FROM PUBLIC, anon, authenticated;

-- transição de tabela não aceita dois eventos no mesmo gatilho
DROP TRIGGER IF EXISTS trg_observacao_acuidade_ins ON public.observacao;
CREATE TRIGGER trg_observacao_acuidade_ins AFTER INSERT ON public.observacao
  REFERENCING NEW TABLE AS novas FOR EACH STATEMENT EXECUTE FUNCTION private.observacao_grava_acuidade();
DROP TRIGGER IF EXISTS trg_observacao_acuidade_upd ON public.observacao;
CREATE TRIGGER trg_observacao_acuidade_upd AFTER UPDATE ON public.observacao
  REFERENCING NEW TABLE AS novas FOR EACH STATEMENT EXECUTE FUNCTION private.observacao_grava_acuidade();

-- A série do leito: as últimas aferições (72 h) na escala de agora, da mais antiga à mais nova.
CREATE OR REPLACE FUNCTION public.tendencia_acuidade(p_paciente uuid, p_limite int DEFAULT 9)
RETURNS TABLE (aferido_em timestamptz, escala text, total int, banda int, parcial boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_unidade uuid; v_escala text;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.papel_na_unidade(v_unidade) = 'gestor' OR private.paciente_no_meu_plantao(p_paciente)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  SELECT a.escala INTO v_escala FROM public.acuidade_afericoes a
   WHERE a.paciente_id = p_paciente ORDER BY a.aferido_em DESC LIMIT 1;
  RETURN QUERY
  SELECT s.aferido_em, s.escala, s.total, s.banda, s.parcial FROM (
    SELECT a.aferido_em, a.escala, a.total, a.banda, a.parcial FROM public.acuidade_afericoes a
     WHERE a.paciente_id = p_paciente AND a.escala = v_escala AND a.aferido_em > now() - interval '72 hours'
     ORDER BY a.aferido_em DESC LIMIT greatest(2, least(coalesce(p_limite, 9), 24))
  ) s ORDER BY s.aferido_em;
END $$;
REVOKE ALL ON FUNCTION public.tendencia_acuidade(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tendencia_acuidade(uuid, int) TO authenticated;

-- ── 3. classificação da porta, vista do leito ──────────────────────────────
CREATE OR REPLACE FUNCTION public.classificacoes_do_leito(p_internacao uuid)
RETURNS TABLE(
  id uuid, cor text, publico text, publico_pela_idade text, grupo_trocado boolean,
  fluxograma_nome text, discriminador text, discriminador_cor text, discriminador_livre boolean,
  queixa text, reclassificacao boolean, motivo text, justificativa text,
  autor_nome text, autor_papel text, criado_em timestamptz,
  dor jsonb, oxigenio jsonb, gestacao jsonb, avaliacao jsonb, sinais jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE internacoes.id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.pode_atuar_no_paciente(i.paciente_id)
     OR NOT private.prontuario_aberto(i.paciente_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF i.episodio_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.id, c.cor, c.publico, c.publico_pela_idade, c.grupo_trocado,
         c.fluxograma_nome, c.discriminador, c.discriminador_cor, c.discriminador_livre,
         c.queixa, c.reclassificacao, c.motivo, c.justificativa,
         pf.nome_completo, c.autor_papel, c.criado_em,
         c.dor, c.oxigenio, c.gestacao, c.avaliacao,
         (SELECT jsonb_object_agg(cc.nome, o.valor_num)
            FROM public.observacao o JOIN public.conceito cc ON cc.id = o.conceito_id
           WHERE o.episodio_id = c.episodio_id AND o.aferido_em = c.criado_em AND o.registrado_por = c.autor_id)
    FROM public.classificacoes_risco c
    LEFT JOIN public.perfis pf ON pf.id = c.autor_id
   WHERE c.episodio_id = i.episodio_id
   ORDER BY c.criado_em DESC;
END $$;
REVOKE ALL ON FUNCTION public.classificacoes_do_leito(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classificacoes_do_leito(uuid) TO authenticated;

-- ── 4. altas que eu dei nas últimas 24 h ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.minhas_altas_recentes(p_unidade uuid)
RETURNS TABLE (
  internacao_id uuid, paciente_id uuid, paciente_nome text, leito text, setor_nome text,
  status text, data_alta timestamptz, alta_registrada_em timestamptz, cid_alta text, pacote_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE THEN RAISE EXCEPTION 'Segundo fator pendente.'; END IF;
  RETURN QUERY
  SELECT i.id, i.paciente_id, coalesce(pa.nome_social, pa.nome), l.identificador, s.nome,
         i.status, i.data_alta, i.alta_registrada_em, i.cid_alta,
         (SELECT pk.id FROM public.pacotes_alta pk WHERE pk.internacao_id = i.id ORDER BY pk.criado_em DESC LIMIT 1)
    FROM public.internacoes i
    JOIN public.pacientes pa ON pa.id = i.paciente_id
    LEFT JOIN public.leitos l ON l.id = (
      SELECT ev.leito_destino_id FROM public.eventos_adt ev
       WHERE ev.internacao_id = i.id AND ev.leito_destino_id IS NOT NULL ORDER BY ev.seq DESC LIMIT 1)
    LEFT JOIN public.setores s ON s.id = i.setor_atual_id
   WHERE i.unidade_id = p_unidade
     AND i.alta_por = private.meu_perfil_id()
     AND i.alta_registrada_em > now() - interval '24 hours'
     AND i.status NOT IN ('admitido', 'em_observacao', 'internado')
   ORDER BY i.alta_registrada_em DESC;
END $$;
REVOKE ALL ON FUNCTION public.minhas_altas_recentes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minhas_altas_recentes(uuid) TO authenticated;

-- ── 5. guarda de 20 anos: registro clínico não se apaga ────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['diagnosticos_episodio', 'acuidade_afericoes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.%I
                      FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica()', t);
  END LOOP;
END $$;

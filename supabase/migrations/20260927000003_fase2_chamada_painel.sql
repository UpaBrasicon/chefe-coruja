-- ════════════════════════════════════════════════════════════════════════════
-- Fase 2.3 — chamada, painel e saída da fila (CONTEXT.md: Chamada).
--
-- • Salas por porta (Triagem 1–2, Consultório 1–3, Sala de Emergência): quem
--   chama escolhe a sala. Toda chamada fica registrada (só inserção).
-- • Três chamadas sem resposta geram AVISO; o sistema nunca tira ninguém da
--   fila sozinho. Retirar (evasão, ficha duplicada, engano) é decisão de quem
--   está de plantão na porta, com justificativa.
-- • Painel da TV: link por porta com um token aleatório (guardado só como
--   hash). Sem login, a TV lê SÓ nome (social, se houver) e sala das últimas
--   chamadas daquela porta. Gerar um link novo revoga o anterior.
-- ════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── salas ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.salas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id  uuid NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  nome      text NOT NULL,
  tipo      text NOT NULL CHECK (tipo IN ('triagem', 'consultorio', 'emergencia')),
  ordem     integer NOT NULL DEFAULT 0,
  ativo     boolean NOT NULL DEFAULT true,
  UNIQUE (setor_id, nome)
);
ALTER TABLE public.salas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.salas FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.salas TO authenticated;
DROP POLICY IF EXISTS salas_select ON public.salas;
CREATE POLICY salas_select ON public.salas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.setores s WHERE s.id = setor_id AND private.membro_da_unidade(s.unidade_id)));
DROP POLICY IF EXISTS salas_gestor ON public.salas;
CREATE POLICY salas_gestor ON public.salas FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.setores s WHERE s.id = setor_id
                    AND (private.eh_super_admin() OR private.papel_na_unidade(s.unidade_id) = 'gestor')));
DROP POLICY IF EXISTS salas_gestor_update ON public.salas;
CREATE POLICY salas_gestor_update ON public.salas FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.setores s WHERE s.id = setor_id
               AND (private.eh_super_admin() OR private.papel_na_unidade(s.unidade_id) = 'gestor')));

-- salas-padrão em toda porta existente e nas que vierem
CREATE OR REPLACE FUNCTION private.salas_padrao(p_setor uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.salas (setor_id, nome, tipo, ordem)
  SELECT p_setor, n, t, o FROM (VALUES ('Triagem 1', 'triagem', 1), ('Triagem 2', 'triagem', 2),
    ('Consultório 1', 'consultorio', 3), ('Consultório 2', 'consultorio', 4), ('Consultório 3', 'consultorio', 5),
    ('Sala de Emergência', 'emergencia', 6)) AS v(n, t, o)
  ON CONFLICT (setor_id, nome) DO NOTHING;
$$;
DO $$ BEGIN PERFORM private.salas_padrao(id) FROM public.setores WHERE tipo = 'emergencia'; END $$;

CREATE OR REPLACE FUNCTION private.porta_nova_ganha_salas() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.tipo = 'emergencia' THEN PERFORM private.salas_padrao(NEW.id); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_porta_nova_ganha_salas ON public.setores;
CREATE TRIGGER trg_porta_nova_ganha_salas AFTER INSERT OR UPDATE OF tipo ON public.setores
  FOR EACH ROW EXECUTE FUNCTION private.porta_nova_ganha_salas();

-- ── chamadas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chamadas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id   uuid NOT NULL REFERENCES public.unidades(id),
  setor_id     uuid NOT NULL REFERENCES public.setores(id),
  episodio_id  uuid NOT NULL REFERENCES public.episodios(id),
  sala_id      uuid NOT NULL REFERENCES public.salas(id),
  etapa        text NOT NULL CHECK (etapa IN ('triagem', 'atendimento')),
  numero       integer NOT NULL,  -- 1ª, 2ª, 3ª chamada desta etapa
  chamado_por  uuid NOT NULL REFERENCES public.perfis(id),
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chamadas_painel ON public.chamadas (setor_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS chamadas_episodio ON public.chamadas (episodio_id, etapa);
DROP TRIGGER IF EXISTS trg_chamadas_so_insercao ON public.chamadas;
CREATE TRIGGER trg_chamadas_so_insercao BEFORE UPDATE OR DELETE ON public.chamadas
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();
ALTER TABLE public.chamadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chamadas FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.chamadas FROM authenticated;
GRANT SELECT ON public.chamadas TO authenticated;
DROP POLICY IF EXISTS chamadas_select ON public.chamadas;
CREATE POLICY chamadas_select ON public.chamadas FOR SELECT TO authenticated
USING (private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor'
       OR setor_id IN (SELECT private.setores_na_escala_agora()));

CREATE OR REPLACE FUNCTION public.chamar_paciente(p_episodio uuid, p_sala uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.episodios;
  v_etapa text;
  v_n integer;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND OR e.etapa NOT IN ('triagem', 'atendimento') THEN
    RAISE EXCEPTION 'Paciente não está em fila.';
  END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  v_etapa := e.etapa;
  IF v_etapa = 'triagem' AND private.tenho_papel(e.unidade_id, 'enfermeiro') IS NOT TRUE THEN
    RAISE EXCEPTION 'A chamada para a triagem é da enfermagem.';
  END IF;
  IF v_etapa = 'atendimento' AND private.tenho_papel(e.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'A chamada para o atendimento é do médico.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.salas WHERE id = p_sala AND setor_id = e.setor_id AND ativo) THEN
    RAISE EXCEPTION 'Sala não pertence a esta porta.';
  END IF;

  SELECT count(*) + 1 INTO v_n FROM public.chamadas WHERE episodio_id = e.id AND etapa = v_etapa;
  INSERT INTO public.chamadas (unidade_id, setor_id, episodio_id, sala_id, etapa, numero, chamado_por)
  VALUES (e.unidade_id, e.setor_id, e.id, p_sala, v_etapa, v_n, private.meu_perfil_id());
  RETURN jsonb_build_object('numero', v_n, 'aviso', v_n >= 3);
END $$;
REVOKE ALL ON FUNCTION public.chamar_paciente(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chamar_paciente(uuid, uuid) TO authenticated;

-- ── retirar da fila ─────────────────────────────────────────────────────────
ALTER TABLE public.episodios ADD COLUMN IF NOT EXISTS desfecho_motivo text;

CREATE OR REPLACE FUNCTION public.retirar_da_fila(p_episodio uuid, p_motivo text, p_justificativa text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE e public.episodios;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND OR e.etapa NOT IN ('triagem', 'atendimento') THEN
    RAISE EXCEPTION 'Paciente não está em fila.';
  END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão nesta porta.';
  END IF;
  IF p_motivo NOT IN ('evasao', 'duplicada', 'engano') THEN
    RAISE EXCEPTION 'Motivo: evasão, ficha duplicada ou engano.';
  END IF;
  IF length(btrim(coalesce(p_justificativa, ''))) < 15 THEN
    RAISE EXCEPTION 'Justifique a retirada da fila (mínimo de 15 letras).';
  END IF;
  UPDATE public.episodios
     SET etapa = 'encerrado',
         desfecho = CASE WHEN p_motivo = 'evasao' THEN 'evasao' ELSE 'cancelado' END,
         desfecho_motivo = p_motivo || ': ' || btrim(p_justificativa),
         encerrado_em = now(), encerrado_por = private.meu_perfil_id(), updated_at = now()
   WHERE id = e.id;
  PERFORM private.registrar_auditoria('retirar_da_fila', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('status', 'encerrado', 'motivo_codigo', p_motivo));
END $$;
REVOKE ALL ON FUNCTION public.retirar_da_fila(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_da_fila(uuid, text, text) TO authenticated;

-- ── painel da TV ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS private.paineis (
  setor_id    uuid PRIMARY KEY REFERENCES public.setores(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  criado_por  uuid NOT NULL,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- Gera (e devolve UMA vez) o link do painel da porta. O anterior deixa de valer.
CREATE OR REPLACE FUNCTION public.gerar_link_painel(p_setor uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unidade uuid;
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT unidade_id INTO v_unidade FROM public.setores WHERE id = p_setor AND tipo = 'emergencia';
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Painel é de uma porta (setor de emergência).'; END IF;
  IF (private.eh_super_admin() OR private.papel_na_unidade(v_unidade) = 'gestor'
      OR p_setor IN (SELECT private.setores_na_escala_agora())) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  INSERT INTO private.paineis (setor_id, token_hash, criado_por)
  VALUES (p_setor, encode(extensions.digest(v_token, 'sha256'), 'hex'), private.meu_perfil_id())
  ON CONFLICT (setor_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, criado_por = EXCLUDED.criado_por, criado_em = now();
  PERFORM private.registrar_auditoria('gerar_link_painel', 'setores', p_setor, v_unidade, NULL);
  RETURN v_token;
END $$;
REVOKE ALL ON FUNCTION public.gerar_link_painel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_link_painel(uuid) TO authenticated;

-- O que a TV lê: nome de exibição, sala, hora — das últimas 8 horas, no
-- máximo 8 chamadas. Nada de prontuário, idade, cor ou queixa.
CREATE OR REPLACE FUNCTION public.painel_chamadas(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_setor uuid;
BEGIN
  SELECT setor_id INTO v_setor FROM private.paineis
   WHERE token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  IF v_setor IS NULL THEN RAISE EXCEPTION 'PAINEL_INVALIDO'; END IF;
  RETURN jsonb_build_object(
    'porta', (SELECT s.nome FROM public.setores s WHERE s.id = v_setor),
    'unidade', (SELECT u.nome FROM public.setores s JOIN public.unidades u ON u.id = s.unidade_id WHERE s.id = v_setor),
    'servidor', now(),
    'chamadas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nome', coalesce(nullif(p.nome_social, ''), p.nome),
                                          'sala', sa.nome, 'em', c.criado_em) ORDER BY c.criado_em DESC)
      FROM (SELECT * FROM public.chamadas WHERE setor_id = v_setor AND criado_em > now() - interval '8 hours'
            ORDER BY criado_em DESC LIMIT 8) c
      JOIN public.episodios e ON e.id = c.episodio_id
      JOIN public.pacientes p ON p.id = e.paciente_id
      JOIN public.salas sa ON sa.id = c.sala_id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.painel_chamadas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.painel_chamadas(text) TO anon, authenticated;

-- ── estrutura da unidade para os papéis novos ───────────────────────────────
-- setores, leitos, ocupação e conceitos só abriam para gestor e plantonista:
-- Recepção e enfermagem (ADR 0008) não viam nem as portas. Nenhuma destas
-- tabelas identifica paciente; passam a abrir para quem tem vínculo na unidade.
DROP POLICY IF EXISTS setores_membro_select ON public.setores;
CREATE POLICY setores_membro_select ON public.setores FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
DROP POLICY IF EXISTS leitos_membro_select ON public.leitos;
CREATE POLICY leitos_membro_select ON public.leitos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.setores s WHERE s.id = setor_id AND private.membro_da_unidade(s.unidade_id)));
DROP POLICY IF EXISTS eventos_leito_membro_select ON public.eventos_leito;
CREATE POLICY eventos_leito_membro_select ON public.eventos_leito FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
DROP POLICY IF EXISTS censo_membro_select ON public.censo_ocupacao;
CREATE POLICY censo_membro_select ON public.censo_ocupacao FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
DROP POLICY IF EXISTS conceito_membro_select ON public.conceito;
CREATE POLICY conceito_membro_select ON public.conceito FOR SELECT TO authenticated
  USING (unidade_id IS NULL OR private.membro_da_unidade(unidade_id));
DROP POLICY IF EXISTS conceito_opcao_membro_select ON public.conceito_opcao;
CREATE POLICY conceito_opcao_membro_select ON public.conceito_opcao FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conceito c WHERE c.id = conceito_id
                 AND (c.unidade_id IS NULL OR private.membro_da_unidade(c.unidade_id))));

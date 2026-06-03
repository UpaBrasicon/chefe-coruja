-- ── Tabela de datas fixas ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_datas_fixas (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo        text    NOT NULL,   -- ex: 'fechamento_ponto', 'contracheque', 'reuniao'
  titulo      text    NOT NULL,
  mensagem    text,
  link        text,
  dia_do_mes  integer NOT NULL CHECK (dia_do_mes BETWEEN 1 AND 28),
  ativo       boolean DEFAULT true,
  criado_em   timestamptz DEFAULT now()
);

-- RLS: somente admins gerenciam; todos os autenticados podem ler (a função usa SECURITY DEFINER)
ALTER TABLE config_datas_fixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cdf_select" ON config_datas_fixas;
DROP POLICY IF EXISTS "cdf_admin"  ON config_datas_fixas;

CREATE POLICY "cdf_select" ON config_datas_fixas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cdf_admin" ON config_datas_fixas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profissionais WHERE auth_user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profissionais WHERE auth_user_id = auth.uid() AND role = 'admin'));

-- ── Função: processa datas do dia e cria avisos ───────────────────────────────
CREATE OR REPLACE FUNCTION fn_processar_datas_fixas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  hoje_dia    integer     := EXTRACT(DAY FROM CURRENT_DATE)::integer;
  hoje_inicio timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo');
  cfg         record;
  prof        record;
  total       integer := 0;
BEGIN
  FOR cfg IN
    SELECT * FROM config_datas_fixas WHERE ativo = true AND dia_do_mes = hoje_dia
  LOOP
    FOR prof IN
      SELECT id FROM profissionais WHERE ativo = true
    LOOP
      -- Evita duplicatas no mesmo dia
      IF NOT EXISTS (
        SELECT 1 FROM avisos
        WHERE profissional_id = prof.id
          AND tipo = cfg.tipo
          AND criada_em >= hoje_inicio
      ) THEN
        INSERT INTO avisos (profissional_id, tipo, titulo, mensagem, link)
        VALUES (prof.id, cfg.tipo, cfg.titulo, cfg.mensagem, cfg.link);
        total := total + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN total;
END;
$$;

-- Dados iniciais de exemplo (comentados — admin ativa pelo painel)
-- INSERT INTO config_datas_fixas (tipo, titulo, mensagem, dia_do_mes) VALUES
--   ('fechamento_ponto', 'Fechamento do ponto hoje!', 'O ponto fecha hoje. Certifique-se de que todos os registros estão corretos.', 25),
--   ('contracheque', 'Contracheque disponível', 'Seu contracheque do mês está disponível para consulta.', 5);

-- ════════════════════════════════════════════════════════════════════════════
-- Pedido do RT em 16/11/2026: "Médico" no lugar de "Plantonista" na tela
-- (docs/produto/ROTULO-MEDICO-DIAGNOSTICO.md, R4 = A). Só o texto das
-- mensagens de erro muda; o papel no banco continua `plantonista`.
-- Regra: "médico" onde a frase fala do papel médico; "profissional" (ou
-- "você") onde vale para qualquer categoria da escala.
--
-- As funções são grandes e mudaram em várias migrations; em vez de copiar
-- cada uma, a troca é feita no texto da definição que está no banco. Só troca
-- quando a frase antiga está lá; rodar de novo não faz nada.
-- Rollback: a mesma troca com os pares invertidos (lista abaixo).
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  t record;
  def text;
  novo text;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('public.candidatar_faixa(uuid,date,text)',
     'A candidatura pela Escala geral é do plantonista.', 'A candidatura pela Escala geral é do médico.'),
    ('public.candidatar_faixa(uuid,date,text)',
     'Esta faixa já tem plantonista escalado.', 'Esta faixa já tem médico escalado.'),
    ('public.fracionar_plantao(uuid,integer)',
     'Acesso negado: apenas o plantonista escalado ou o gestor podem fracionar.',
     'Acesso negado: só quem está escalado ou o gestor pode fracionar.'),
    ('public.definir_minhas_especialidades(text[])',
     'Acesso negado: só médico (plantonista ou telemedicina) declara especialidade.',
     'Acesso negado: só médico (de plantão ou da telemedicina) declara especialidade.'),
    ('public.passar_plantao(uuid,uuid,text)',
     'Conflito de horário: o plantonista de destino já tem plantão no mesmo horário',
     'Conflito de horário: o profissional de destino já tem plantão no mesmo horário'),
    ('public.passar_plantao(uuid,uuid,text)',
     'O destino não pode ser o próprio plantonista', 'O destino não pode ser você mesmo'),
    ('private.aplicar_troca(trocas_plantao)',
     'Conflito de horário: o plantonista do plantão A já tem plantão no mesmo horário',
     'Conflito de horário: o profissional do plantão A já tem plantão no mesmo horário'),
    ('private.aplicar_troca(trocas_plantao)',
     'Conflito de horário: o plantonista do plantão B já tem plantão no mesmo horário',
     'Conflito de horário: o profissional do plantão B já tem plantão no mesmo horário'),
    ('public.encaminhar_interno(uuid,text,text,uuid,text,uuid,uuid)',
     'O médico de destino não é plantonista desta unidade.', 'O destino não é médico desta unidade.'),
    ('public.solicitar_troca(uuid,uuid,text)',
     'O plantão B deve pertencer a outro plantonista', 'O plantão B deve pertencer a outro profissional'),
    ('public.regulacao_destino_aceitar(uuid,uuid,text)',
     'Responde pelo destino o médico plantonista ou o gestor da unidade.',
     'Responde pelo destino o médico de plantão ou o gestor da unidade.'),
    ('public.regulacao_destino_recusar(uuid,text,text)',
     'Responde pelo destino o médico plantonista ou o gestor da unidade.',
     'Responde pelo destino o médico de plantão ou o gestor da unidade.'),
    ('public.reservar_leito(uuid,integer,uuid,text)',
     'Só plantonista, enfermeiro ou gestor da unidade reservam leito.',
     'Só médico, enfermeiro ou gestor da unidade reservam leito.'),
    ('public.remover_fracionamento(uuid)',
     'Uma parte já foi assumida por outro plantonista:', 'Uma parte já foi assumida por outro profissional:'),
    ('private.obito_validado(jsonb,timestamp with time zone)',
     'como substituto (plantonista).', 'como substituto (médico de plantão).')
  ) AS x(fn, antigo, novo)
  LOOP
    IF to_regprocedure(t.fn) IS NULL THEN
      RAISE NOTICE 'rótulo médico: função % não existe aqui, pulada', t.fn;
      CONTINUE;
    END IF;
    def := pg_get_functiondef(t.fn::regprocedure);
    IF position(t.antigo IN def) = 0 THEN
      CONTINUE;   -- já trocada (ou a frase mudou: o teste de mensagens aponta)
    END IF;
    novo := replace(def, t.antigo, t.novo);
    EXECUTE novo;
  END LOOP;
END $$;

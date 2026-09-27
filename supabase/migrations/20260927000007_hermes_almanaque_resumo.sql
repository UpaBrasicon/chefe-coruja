-- ════════════════════════════════════════════════════════════════════════════
-- Hermes (rodada C) — Almanaque e resumo da unidade: menos tokens por pergunta.
--
-- • Almanaque: perguntas frequentes sobre o USO da plataforma, com resposta
--   pronta e revisável. A Corujinha consulta primeiro e, achando, responde com
--   o texto — sem raciocinar nem chamar outras ferramentas. Busca em português,
--   sem acento, por qualquer palavra da pergunta. As respostas descrevem o que
--   a plataforma faz HOJE (fases 0–2); nada clínico.
-- • Resumo da unidade: uma linha por unidade, refeita a cada 15 minutos pelo
--   banco — plantão agora, leitos, porta (filas por cor), observação,
--   internação, pendências. Só números.
-- Tudo lido pelo backend do Hermes (service role).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.hermes_almanaque (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pergunta      text NOT NULL,
  palavras      text NOT NULL DEFAULT '',   -- sinônimos e termos de busca
  resposta      text NOT NULL CHECK (length(resposta) <= 900),
  ativo         boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pergunta)
);
ALTER TABLE public.hermes_almanaque ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hermes_almanaque FROM anon;
GRANT SELECT ON public.hermes_almanaque TO authenticated;
DROP POLICY IF EXISTS hermes_almanaque_leitura ON public.hermes_almanaque;
CREATE POLICY hermes_almanaque_leitura ON public.hermes_almanaque FOR SELECT TO authenticated USING (ativo);

CREATE OR REPLACE FUNCTION public.hermes_almanaque_buscar(p_texto text, p_limite integer DEFAULT 2)
RETURNS TABLE (pergunta text, resposta text, relevancia real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH termos AS (
    SELECT string_agg(DISTINCT t, ' | ') AS q
    FROM regexp_split_to_table(coalesce(private.nome_comparavel(p_texto), ''), '[^a-z0-9]+') t
    WHERE length(t) >= 3
  )
  SELECT a.pergunta, a.resposta,
         ts_rank(to_tsvector('portuguese', private.nome_comparavel(a.pergunta || ' ' || a.palavras)),
                 to_tsquery('portuguese', termos.q)) AS relevancia
  FROM public.hermes_almanaque a, termos
  WHERE a.ativo AND termos.q IS NOT NULL
    AND to_tsvector('portuguese', private.nome_comparavel(a.pergunta || ' ' || a.palavras)) @@ to_tsquery('portuguese', termos.q)
  ORDER BY relevancia DESC
  LIMIT least(greatest(p_limite, 1), 3);
$$;
REVOKE ALL ON FUNCTION public.hermes_almanaque_buscar(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hermes_almanaque_buscar(text, integer) TO service_role;

INSERT INTO public.hermes_almanaque (pergunta, palavras, resposta) VALUES
('Como faço check-in?', 'checkin entrada chegar bater ponto presença gps localização raio',
 'Em Meu Plantão, toque em Fazer check-in. O celular precisa estar dentro do raio da unidade (o GPS é conferido). Fora do raio o check-in é bloqueado: tente de novo. Se continuar falhando, o app pergunta se o GPS está com problema e aceita uma justificativa, que o gestor vê no mesmo dia.'),
('E o check-out?', 'checkout saída sair fim do plantão',
 'O check-out é automático no fim do plantão, pelo relógio do servidor. Você não precisa fazer nada.'),
('Quais são os turnos?', 'turno horário plantão 12 horas 6 horas manhã tarde noite madrugada',
 'Turnos de 12 horas (07h–19h e 19h–07h) ou de 6 horas (07h–13h, 13h–19h, 19h–01h e 01h–07h). A escala é por setor.'),
('Por que não consigo entrar ou ver pacientes?', 'acesso bloqueado fora do expediente não aparece paciente escala setor entrar',
 'O acesso vem da escala: você entra e vê os pacientes dos setores em que está escalado AGORA, pelo relógio do servidor. Fora do plantão a tela mostra Fora do expediente. Se a escala estiver errada, fale com o gestor da unidade.'),
('O plantão da noite continua depois da meia-noite?', 'noite meia noite madrugada virada perdeu acesso',
 'Sim. O plantão é uma janela (início + duração): quem começou às 19h continua com acesso depois da meia-noite, até o fim do turno.'),
('E se a internet cair?', 'sem internet offline conexão caiu fora do ar',
 'Quem já estava em plantão no aparelho continua registrando sinais vitais por até 2 horas sem conexão, e até 15 minutos depois do fim do plantão. Os registros ficam guardados cifrados no aparelho e são enviados sozinhos quando a conexão volta; o aviso no topo mostra quantos estão no aparelho. Ninguém começa plantão sem conexão.'),
('O que é registro tardio?', 'registro tardio revisão atrasado sincronizar depois de dias',
 'Registro feito sem conexão que chega ao servidor mais de 24 horas depois do fato. Ele não entra sozinho no prontuário: vai para o gestor em Unidade → Registros tardios, que aceita ou descarta com motivo.'),
('Quem faz a classificação de risco?', 'classificação risco cor triagem manchester protocolo reclassificar',
 'O enfermeiro, na Triagem. O protocolo da unidade aparece como referência, mas a cor é escolhida por ele — o sistema nunca sugere. Só o médico reclassifica, com motivo e sinais vitais novos; para baixar a prioridade, também com justificativa.'),
('Como funciona a prioridade legal na fila?', 'prioridade preferencial idoso idosa anos 60 80 passa na frente primeiro gestante grávida lactante criança de colo deficiência deficiente tea autismo fila ordem',
 'Na fila da triagem: 80+ primeiro, depois as demais prioridades legais (60+, gestante, lactante ou com criança de colo, pessoa com deficiência, TEA), depois a ordem de chegada. Na fila médica a cor manda; a prioridade legal só desempata dentro da mesma cor.'),
('O paciente não respondeu à chamada', 'chamada chamar três vezes não veio sumiu evasão retirar da fila',
 'Depois da 3ª chamada aparece um aviso, mas o paciente continua na fila. Quem chamou decide: manter, ou Retirar da fila (evasão, ficha duplicada ou aberta por engano), sempre com justificativa.'),
('Como abro o painel da TV?', 'painel tv televisão chamada sala voz som',
 'Na Recepção, toque em Abrir painel da TV e abra o link na TV (não precisa login). O painel mostra só o nome (o social, se houver) e a sala. Toque em Ativar som para a voz. Gerar um link novo desliga o anterior.'),
('O sistema avisou cadastro duplicado', 'duplicado duplicata cpf cartão sus mesmo nome cadastro existente',
 'Mesmo CPF ou Cartão SUS bloqueia: use o cadastro existente. Mesmo nome e data de nascimento pede confirmação: use o cadastro existente ou marque que é outra pessoa.'),
('Posso cadastrar menor sem responsável?', 'menor criança adolescente sem responsável abrigo escola',
 'Pode. O responsável legal é opcional: menor que chega de abrigo, escola ou outro local é cadastrado mesmo sem responsável.'),
('Até que idade é pediatria?', 'pediatria criança idade 14 anos pediátrico pressão arterial pa',
 'Pediatria vai do nascimento até 13 anos, 11 meses e 29 dias; com 14 anos completos é adulto. Na triagem pediátrica a PA não é obrigatória.'),
('Por que a impressão tem um código no rodapé?', 'imprimir impressão protocolo rodapé código papel',
 'Toda impressão é registrada no servidor e recebe um protocolo (IMP-…) que sai no rodapé. Por isso só imprime com o paciente selecionado ou cadastrado: a impressão fica no prontuário dele.'),
('O sistema registra quem abriu o prontuário?', 'prontuário acesso consulta registro auditoria quem abriu',
 'Sim. Abrir o prontuário é registrado pelo servidor (quem, quando, de onde), como exige a certificação. O gestor consulta esses acessos.'),
('Como conecto o Telegram?', 'telegram conectar vincular corujinha código bot',
 'No Chefe Coruja, abra Perfil → Conectar ao Telegram. Aparece um código de 6 dígitos que vale 10 minutos e uma vez só. Mande o código para a Corujinha no Telegram. Para desligar, use Desconectar no mesmo lugar.'),
('Como funciona o segundo fator?', 'segundo fator autenticador código 2fa mfa login',
 'O cadastro do aplicativo autenticador fica em Perfil. Quando a unidade ligar a exigência, o código é pedido a cada 24 horas e em aparelho novo.'),
('O administrador vê dados de paciente?', 'administrador admin lgpd privacidade paciente',
 'Não. O administrador vê a rede de unidades, pessoas e indicadores, mas nenhuma identidade de paciente. A Recepção também não lê prontuário.'),
('Quais desfechos o médico pode registrar?', 'desfecho alta óbito transferência evasão internação observação encerrar',
 'Alta médica, alta após medicação, alta a pedido, transferência (com destino), evasão, óbito (com hora e número da Declaração de Óbito), observação e internação. Evasão, alta a pedido e óbito pedem relato; todo desfecho, exceto evasão, exige o SOAP antes.'),
('O que a Corujinha faz?', 'corujinha bot assistente ajuda o que você faz',
 'Respondo sobre os seus plantões, a escala e a operação da unidade, e sobre como usar o Chefe Coruja. Não falo de pacientes nem de assuntos fora da plataforma.')
ON CONFLICT (pergunta) DO UPDATE SET palavras = EXCLUDED.palavras, resposta = EXCLUDED.resposta, atualizado_em = now();

-- ── resumo da unidade ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hermes_resumo_unidade (
  unidade_id    uuid PRIMARY KEY REFERENCES public.unidades(id) ON DELETE CASCADE,
  dados         jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hermes_resumo_unidade ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hermes_resumo_unidade FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.hermes_atualizar_resumos() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.hermes_resumo_unidade (unidade_id, dados, atualizado_em)
  SELECT u.id, jsonb_build_object(
    'atualizado_brasilia', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    'plantao_agora', (SELECT coalesce(jsonb_object_agg(x.setor, x.n), '{}') FROM (
        SELECT s.nome AS setor, count(DISTINCT e.perfil_id) AS n
        FROM public.escala_plantao e JOIN public.setores s ON s.id = e.setor_id
        WHERE e.unidade_id = u.id AND e.ativo
          AND e.inicio <= now() AND now() < e.inicio + make_interval(mins => e.duracao_min)
        GROUP BY s.nome) x),
    'leitos', (SELECT jsonb_build_object('total', count(*), 'ocupados', count(*) FILTER (WHERE l.status = 'ocupado'))
               FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id WHERE s.unidade_id = u.id),
    'porta', jsonb_build_object(
        'aguardando_triagem', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.etapa = 'triagem'),
        'aguardando_medico_por_cor', (SELECT coalesce(jsonb_object_agg(c.cor_atual, c.n), '{}') FROM (
            SELECT e.cor_atual, count(*) AS n FROM public.episodios e
            WHERE e.unidade_id = u.id AND e.etapa = 'atendimento' AND e.atendimento_iniciado_em IS NULL
            GROUP BY e.cor_atual) c),
        'em_atendimento', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.etapa = 'atendimento' AND e.atendimento_iniciado_em IS NOT NULL)),
    'observacao', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.etapa = 'observacao'),
    'internacao_aguardando', (SELECT count(*) FROM public.episodios e WHERE e.unidade_id = u.id AND e.etapa = 'internacao'),
    'registros_tardios_pendentes', (SELECT count(*) FROM public.sincronizacao_revisao r WHERE r.unidade_id = u.id AND r.decisao IS NULL)
  ), now()
  FROM public.unidades u
  WHERE u.ativo
  ON CONFLICT (unidade_id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = EXCLUDED.atualizado_em;
$$;
REVOKE ALL ON FUNCTION private.hermes_atualizar_resumos() FROM PUBLIC, anon, authenticated;

SELECT private.hermes_atualizar_resumos();

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'hermes-resumos';
  PERFORM cron.schedule('hermes-resumos', '*/15 * * * *', 'SELECT private.hermes_atualizar_resumos()');
END $$;

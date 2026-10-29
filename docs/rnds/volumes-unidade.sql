-- Números da unidade para o formulário da credencial da RNDS (5C-5.5a;
-- docs/rnds/FORMULARIO-CREDENCIAL.md). Só contagens: nenhum dado de paciente.
-- Rodar na produção, só leitura, trocando o id da unidade piloto na linha abaixo.
WITH alvo AS (SELECT '00000000-0000-0000-0000-000000000000'::uuid AS unidade),
dias AS (
  SELECT (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia, count(*) AS n
    FROM public.episodios e, alvo
   WHERE e.unidade_id = alvo.unidade AND e.chegada_em >= now() - interval '90 days'
   GROUP BY 1
),
documentos AS (
  -- o que vira envio: atendimentos encerrados (RAC) e altas de internação (SA), por hora
  SELECT date_trunc('hour', t AT TIME ZONE 'America/Sao_Paulo') AS hora, count(*) AS n FROM (
    SELECT e.encerrado_em AS t FROM public.episodios e, alvo
     WHERE e.unidade_id = alvo.unidade AND e.encerrado_em >= now() - interval '90 days'
    UNION ALL
    SELECT i.data_alta FROM public.internacoes i, alvo
     WHERE i.unidade_id = alvo.unidade AND i.data_alta >= now() - interval '90 days') x
   GROUP BY 1
)
SELECT
  (SELECT count(*) FROM public.episodios e, alvo WHERE e.unidade_id = alvo.unidade) AS atendimentos_registrados,
  (now() AT TIME ZONE 'America/Sao_Paulo')::date AS contado_em,
  (SELECT min(n) FROM dias) AS atendimentos_dia_min,
  (SELECT max(n) FROM dias) AS atendimentos_dia_max,
  (SELECT round(avg(n)) FROM dias) AS atendimentos_dia_media,
  (SELECT max(n) FROM documentos) AS documentos_hora_pico,
  (SELECT extract(hour FROM hora)::int FROM (
     SELECT hora, n FROM documentos ORDER BY n DESC LIMIT 1) p) AS hora_de_pico;

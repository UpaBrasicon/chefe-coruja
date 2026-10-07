-- Fase 0, item 12 do BACKLOG.md — reserva de leito, parte 1: o status novo.
-- Separado da parte 2 porque o Postgres não deixa usar um valor de enum na
-- mesma transação em que ele foi criado. Só aditivo (expand).
-- ROLLBACK: não há DROP VALUE em enum; o valor sem uso não atrapalha.
ALTER TYPE public.status_leito ADD VALUE IF NOT EXISTS 'reservado';

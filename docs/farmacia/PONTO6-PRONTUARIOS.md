# Ponto 6 — o farmacêutico não pede acesso ao prontuário

Pedido do RT em 27/10/2026, aprovado no mesmo dia como o primeiro dos seis pontos da revisão das
telas do farmacêutico (`docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md`, no PR #262). Vale a proposta
do documento: só o farmacêutico sai; enfermagem e telemedicina seguem como estão.

## O que mudou

- **Banco** (`supabase/migrations/20270105000001_farmaceutico_sem_pedido_prontuario.sql`):
  - `private.papel_pode_pedir_acesso` sem `farmaceutico`. `buscar_paciente_para_pedido` e
    `pedir_acesso_prontuario` passam a recusar o farmacêutico, sem mudar de corpo;
  - `private.acesso_encerrado_vigente`: o pedido aprovado só abre leitura enquanto o papel atual na
    unidade ainda pode pedir. Pedido aprovado do farmacêutico, de antes da mudança, deixa de abrir;
  - pedidos pendentes do farmacêutico são cancelados, com linha na auditoria.
  - Quem tem papel acima na unidade (por exemplo, plantonista e farmacêutico) segue pelo
    `papel_na_unidade`, como antes.
- **Tela:**
  - sai "Prontuários" do menu do farmacêutico (`src/components/casca/navegacao.ts`). A paleta de
    busca e a barra do celular leem o mesmo menu, então saem também;
  - saem as rotas `/prontuarios` e `/prontuarios/:pacienteId` do farmacêutico (`src/App.tsx`).

## Rollback

Reaplicar `private.papel_pode_pedir_acesso` de `20261001000001` (com `farmaceutico`) e
`private.acesso_encerrado_vigente` de `20261030000004`, e voltar o menu e as rotas. Os pedidos
cancelados ficam cancelados (é registro).

## Evidência

- Teste do banco `supabase/tests/farmaceutico_sem_pedido_prontuario.sql` (roda no CI, com o seed):
  o farmacêutico não busca nem pede; o pedido aprovado antigo não abre leitura nem o prontuário; o
  mesmo perfil com papel do cuidado volta a ler; plantonista, telemedicina, enfermeiro e técnico
  seguem podendo pedir. O teste da Fase 6 (`fase6_pedido_acesso.sql`) continua cobrindo o fluxo do
  plantonista.
- Teste de tela `src/lib/acessoProntuario.test.ts` (CI, `src/lib/*.test.ts`): o menu do
  farmacêutico não tem Prontuários e as duas rotas não aceitam o farmacêutico.
- Homologação (`kswurfyxxvfydpjfrivy`), 27/10/2026:
  - migration aplicada e registrada como `20270105000001 farmaceutico_sem_pedido_prontuario`. Foi
    aplicada pelo SQL, porque o `db push` desta branch recusaria a `20270104000001_porta_grade`,
    que já está na homologação mas ainda não está no master;
  - depois: `papel_pode_pedir_acesso('farmaceutico') = false`, `('plantonista')` e
    `('enfermeiro') = true`; `acesso_encerrado_vigente` com a checagem nova; nenhum pedido
    pendente de farmacêutico (havia zero);
  - rollback testado em transação desfeita: com ele, `papel_pode_pedir_acesso('farmaceutico') =
    true`; depois do ROLLBACK, `false`.

## Teste do RT na homologação

1. Entrar como farmacêutico: o menu não mostra "Prontuários", e a paleta (Ctrl+K) também não.
2. Abrir `/prontuarios` direto no endereço: a tela não abre.
3. Entrar como plantonista ou enfermeiro: "Prontuários" continua no menu, e o pedido ao gestor
   funciona como antes.

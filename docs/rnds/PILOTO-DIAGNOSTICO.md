# RNDS: unidade piloto (5.5b), diagnóstico

O RT pediu em 11/11/2026 que a fila andasse para a RNDS piloto. Este documento é só diagnóstico, sem código. Cada opção tem o que a unidade precisa ter, o que fica pronto do nosso lado e o risco.

## Onde a RNDS está

- **Pronto e na produção desde 29/10/2026 (5.1 a 5.4):**
  - o banco da fila;
  - o serviço de envio no VPS, com IP fixo e TLS mútuo;
  - o cofre de certificados;
  - o bloqueio do profissional sem CBO;
  - a aba RNDS em Integrações.
  Nenhuma credencial está cadastrada e nenhuma unidade tem o envio ligado.
- **5.5a (29/10/2026):** o serviço de envio já deixou prontos os itens abaixo. O BACKLOG registra "Falta o RT indicar a unidade piloto".
  - o PDF da evidência (`npm run rnds:evidencia`);
  - o formulário da credencial (`docs/rnds/FORMULARIO-CREDENCIAL.md`);
  - a consulta de volumes (`docs/rnds/volumes-unidade.sql`);
  - o texto do chamado (`docs/rnds/CHAMADO-DATASUS.md`).
- **Decisões do RT de 29/10/2026 que valem para o piloto:**
  - uma unidade piloto real;
  - primeira leva com RAC e Sumário de Alta;
  - testes na homologação oficial com os pacientes fictícios da nossa homologação;
  - o chamado ao DATASUS é aberto pelo RT;
  - a produção da RNDS (5.5c) vem depois da aprovação.

## O que a unidade piloto precisa ter (`docs/rnds/CHECKLIST.md`, seção 2)

Isto não depende de nós. É da unidade e do gestor.

| # | Requisito |
|---|---|
| E1 | CNES válido da unidade |
| E2 | Certificado ICP-Brasil **A1** (`.pfx` e senha): e-CNPJ da unidade ou e-CPF do gestor |
| E3 | Conta gov.br do gestor, com CPF ou CNS cadastrado no CNES |
| E4 | Profissionais com vínculo e CBO autorizado no CNES da unidade (sem isso a RNDS recusa com EHR-ERR906) |
| E5 | O gestor pede a credencial de homologação no Portal de Serviços do DATASUS, copiando a parte técnica que nós preparamos |

## As unidades da produção hoje (consulta só de cadastro, 11/11/2026)

| Unidade | Tipo | CNES preenchido | Equipe em uso |
|---|---|---|---|
| UPA Centro | UPA | sim | não: só o RT tem vínculo ativo (decisão de 31/10/2026, "ainda não" entra em uso) |
| Hospital Regional | hospital | sim | não |
| UPA Homologação | UPA | não | não |

Não conferi se os CNES cadastrados são de estabelecimentos reais. Para isso eu teria de consultar um serviço externo, e isso só se faz com o seu ok. A consulta de volumes (`volumes-unidade.sql`) da UPA Centro daria hoje números de teste, não de operação.

## Opções

- **A. A RNDS espera a primeira unidade real em implantação (recomendada).** O piloto passa a ser a primeira unidade que entrar em uso, junto com a pulseira, que você decidiu ligar só na implantação. Nada muda no código; a 5.5b e a 5.5c ficam paradas com o motivo registrado. Motivo: E1 a E5 dependem de uma unidade com CNES, certificado, gestor e profissionais reais. O formulário pede volumes de operação que a produção ainda não tem.
- **B. Você indica agora uma unidade real em que atua, mesmo antes de ela usar o Chefe Coruja.** O gestor dela junta E1 a E4 e pede a credencial de homologação. Os testes usam os pacientes fictícios da nossa homologação, como já decidido. Risco:
  - os volumes do formulário seriam estimativas, e não números do sistema;
  - o gestor de outra unidade assina o pedido por um sistema que ela ainda não usa.
- **C. A UPA Centro da produção como piloto.** Só serve se o CNES dela for de um estabelecimento real, com certificado e gestor. Hoje ela não tem equipe nem atendimento. Risco: o pedido sai com volume zero ou de teste.

## O que eu faço em cada caso

- **A:** registro no BACKLOG que a RNDS fica com a implantação. Sem código.
- **B ou C:** com o CNES confirmado por você, rodo `volumes-unidade.sql` (só contagens), monto o formulário com os números e deixo o chamado pronto para você abrir. Depois disso, a 5.5b anda quando a credencial de homologação chegar.

## Decisão do RT

| Pergunta | Recomendação | Decisão |
|---|---|---|
| Unidade piloto da RNDS | A | A (11/11/2026): a RNDS espera a primeira unidade real em implantação |

# Exames da parceria da gestante (U6, decisão E3): diagnóstico (17/11/2026)

O RT decidiu E3 = A em `docs/ubs/U6-LISTA-EXAMES-ENFERMEIRO.md`: os exames da parceria ficam na consulta da gestante e o pedido sai em nome da parceria cadastrada.

Antes de implementar, conferi a fonte do Ministério da Saúde. **Ela pede outro desenho.** O RT decide abaixo.

**Decisões do RT (18/11/2026): PP1 = A, PP2 = A, PP3 = A, PP4 = A.** A E3 passa a ser o pré-natal do parceiro em consulta própria, ligada à gestante.

## Fontes conferidas

As páginas são as impressas, menos no PCDT, que não tem número impresso confiável.

- Ministério da Saúde, *Guia do Pré-Natal do Parceiro para Profissionais de Saúde* (2016).
- Ministério da Saúde/SAPS, *Guia do pré-natal do parceiro para profissionais de saúde* (2023). É o guia em vigor.
- PCDT para Prevenção da Transmissão Vertical de HIV, Sífilis e Hepatites Virais (Portaria SCTIE 55/2020, anexo de 04/07/2024).

## O que a fonte diz

**A consulta é da parceria, não da gestante.**
- O guia de 2023, p. 40: "A consulta é um atendimento individual". A parceria não precisa vir junto com a gestante.
- Tem procedimento próprio: Consulta Pré-Natal do Parceiro, SIGTAP 03.01.01.023-4 (p. 42; o código existe na tabela da homologação).
- No e-SUS APS o registro vai no SOAP do atendimento da parceria (p. 44).
  - Sem queixa, o problema é CID Z76.8 ou CIAP A29.
  - O registro sai na ficha de atendimento individual e na de procedimentos.
- São duas consultas (p. 36):
  - na 1ª, testes rápidos e pedido de exames;
  - na 2ª, os resultados.
- A parceria pode ser homem ou mulher (p. 10).

**Quem faz:** o enfermeiro e/ou o médico do pré-natal (p. 33). A consulta começa "em consulta médica ou de enfermagem" (p. 40).

**Exames de rotina da parceria** (guia de 2023, p. 47–48; o de 2016 diz o mesmo, p. 26):

| Exame | SIGTAP | Observação |
|---|---|---|
| Sífilis, não treponêmico, em parceria de gestante | 02.02.03.162-4 | |
| HIV em parceria de gestante | 02.02.03.152-7 | |
| Hepatite B (HBsAg) em parceria de gestante | 02.02.03.146-2 | |
| Hepatite C (anti-HCV) em parceria de gestante | 02.02.03.149-7 | |
| Hemograma | 02.02.02.038-0 | |
| Glicose | 02.02.01.047-3 | jejum |
| Colesterol total, HDL e triglicerídeos | 02.02.01.029-5, 02.02.01.027-9, 02.02.01.067-8 | |
| Eletroforese de hemoglobina | 02.02.02.035-5 | doença falciforme |
| Grupo ABO e fator Rh | 02.02.12.002-3, 02.02.12.008-2 | só se a gestante for Rh negativo |

- Testes rápidos de sífilis, HIV e hepatites da parceria (p. 35 e 45): já estão nos procedimentos da UBS (PR 5), com os códigos de parceria de gestante.
- Fora dos dois guias e do PCDT para a parceria: HTLV e exame de urina.
- O PCDT (p. 28) manda oferecer testagem de HIV, sífilis e hepatites B e C na primeira consulta da parceria. Na p. 144 diz que todas as parcerias devem ser testadas para sífilis.

## O que o app tem hoje

- A ficha da UBS é sempre de um paciente. Não existe ligação entre a parceria e a gestação (`pre_natal_gestacoes` não tem parceria).
- O pedido de exame é sempre do paciente da ficha. Pedir na consulta da gestante em nome de outra pessoa misturaria dois prontuários no mesmo atendimento.
  - Exemplo: a pendência de exame aparece na ficha da gestante.
- O tipo de atendimento da ficha da UBS não tem "pré-natal do parceiro".

## Decisões para o RT

**PP1. Como entra (revisa a E3)**
- **A:** pré-natal do parceiro como consulta própria da parceria, como manda o guia.
  - A recepção abre a ficha da parceria com o tipo "Pré-natal do parceiro" e liga à gestante.
  - O enfermeiro ou o médico atende, pede os exames da lista abaixo e faz os testes rápidos.
  - A consulta conta como 03.01.01.023-4.
- **B:** manter a E3 como estava, com o pedido feito dentro da consulta da gestante em nome da parceria. Não conta como consulta da parceria e foge do registro do e-SUS.

**PP2. Lista de exames da parceria**
- **A:** a lista do guia de 2023 acima. A tipagem só se a gestante for Rh negativo.
- **B:** só as IST (sífilis, HIV, hepatites B e C).

**PP3. Ligação com a gestação**
- **A:** a ficha do pré-natal do parceiro pede a gestante (busca no cadastro).
  - A gestação passa a mostrar a parceria e os exames dela.
  - O painel do pré-natal mostra se a parceria fez a consulta.
- **B:** sem ligação: a consulta da parceria fica solta.

**PP4. Quem atende**
- **A:** enfermeiro e médico, como no pré-natal da gestante.
- **B:** só o médico.

## Como ficaria (se PP1 a PP4 = A)

Um PR, como os outros do U6:

- **Banco:**
  - tipo de atendimento `pre_natal_parceiro`;
  - ligação parceria–gestação;
  - lista de exames da parceria no mesmo gatilho do enfermeiro, que só vale na ficha desse tipo;
  - consulta registrada como 03.01.01.023-4 (Z76.8 / A29 quando não houver queixa).
- **Tela:**
  - recepção: o tipo "Pré-natal do parceiro" e a busca da gestante;
  - consulta: aba Exames com a linha "Parceria";
  - pré-natal: a parceria e os exames dela.
- Testes de banco e de tela, homologação, PR com CI verde, ok produção.

## Implementação (18/11/2026)

- **Migration `20270415000011_ubs_pre_natal_parceiro.sql`:**
  - tipo de atendimento `pre_natal_parceiro` no CHECK e na lista da ficha;
  - tabela `pre_natal_parcerias`, que liga a ficha da parceria à gestação (acesso só por RPC);
  - `registrar_ficha`: com o tipo novo, exige a gestante (`gestante_id`) com pré-natal ativo na UBS;
  - lista do enfermeiro com a linha "parceria". Na ficha da parceria só vale essa linha; nas outras fichas, pré-natal e hiperdia;
  - o registro da gestação ganha `parceria`: nome, consultas encerradas, situação dos exames e número de testes rápidos. Nunca o resultado, que é da parceria e fica no prontuário dela.
- **Tela:**
  - recepção: o tipo "Pré-natal do parceiro" pede a gestante (busca no cadastro);
  - consulta da parceria: a aba Exames mostra a linha "Pré-natal do parceiro", com o aviso de que ABO e Rh são só para gestante Rh negativo;
  - a Conduta já vem com CIAP A29;
  - Pré-natal: cada gestante mostra a linha da parceria.
- **SISAB (U15):** o tipo `pre_natal_parceiro` é a Consulta Pré-Natal do Parceiro (03.01.01.023-4). A exportação ainda não existe.
- **Fica de fora:** marcar o pré-natal do parceiro pela agenda. A agenda aceita só consulta agendada ou programada; a parceria vem pela recepção.

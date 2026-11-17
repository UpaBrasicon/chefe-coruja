# LG11: dossiê para o consultor regulatório e rascunho do primeiro contato

Decisões do RT em 17/11/2026: C1 = A (lista curta e contato feito por você), C2 = A (primeiro contrato só de enquadramento). A lista curta está em `LG11-CONSULTORES.md`.

## O que mandar

Mande em PDF. O repositório é privado, então não mande link para ele.

| # | Documento | Para quê |
|---|---|---|
| 1 | `docs/regulatorio/SAMD-CAMINHO-1-DIAGNOSTICO.md` | a ideia de separar a plataforma do módulo clínico, a fronteira proposta e as perguntas 1 a 8 |
| 2 | `docs/regulatorio/LG11-SAMD-CONSULTOR-DIAGNOSTICO.md` | o que mudou desde 16/11 e as perguntas 9 a 12 |
| 3 | `docs/regulatorio/LG11-MAPA-MODULO-CLINICO.md` | as 332 fichas e as 10 funções, cada uma marcada dentro, fora ou zona cinzenta |
| 4 | `docs/regulatorio/LG10-GATE-APROVACAO-DIAGNOSTICO.md` | como uma versão nova só entra depois de aprovada (controle de mudança) |
| 5 | `docs/regulatorio/LG4-INVENTARIO.md` | os dados tratados, para o consultor ver o contexto LGPD |

Só depois do acordo de confidencialidade: o RIPD (`juridico/LG3-RIPD-PLATAFORMA.md`), que descreve riscos e controles de segurança.

**Nunca mande:** dado de paciente, print de tela com paciente, chave, senha ou o `.env`.

## O que pedir na proposta (escopo C2 = A, só enquadramento)

1. Parecer escrito: que partes do produto são SaMD, a classe de cada grupo pela Regra 12 da RDC 751/2022 e se o caminho é notificação ou registro.
2. Resposta às 12 perguntas dos documentos 1 e 2.
3. Se dá para regularizar o módulo clínico separado da plataforma.
4. O que é preciso para notificar: autorização de funcionamento da empresa (AFE), responsável técnico, boas práticas (RDC 665/2022) e documentação (IEC 62304, ISO 14971).
5. Estimativa de prazo e de custo do resto, como proposta separada e sem compromisso.
6. Prazo de entrega e valor fechado do parecer.

## Roteiro da primeira reunião (cerca de 60 minutos)

1. **O produto (10 min):** prontuário e gestão para UPA, hospital e UBS, com a Central de ferramentas clínicas e os avisos. Mostrar o documento 3.
2. **A ideia (10 min):** plataforma fora de SaMD, módulo clínico dentro, e o modo "referência" para quem não contratar o módulo.
3. **As perguntas (25 min):** começar pela 1 (classe dos escores e das doses), pela 10 (aviso de sepse) e pela 5 (módulo separado).
4. **O que já existe (5 min):** fonte citada em cada ficha, versões com aprovação, testes automáticos, trilha de auditoria.
5. **Próximos passos (10 min):** escopo, prazo e valor do parecer.

## Rascunho do e-mail

O RT revisa e manda pelo e-mail dele. Os campos entre colchetes ficam para ele preencher.

> **Assunto:** Pedido de proposta: enquadramento de software como dispositivo médico (RDC 657/2022)
>
> Olá, [nome],
>
> Sou [nome], médico e responsável técnico da Chefe Coruja, uma empresa brasileira de software para urgência, internação e atenção primária. O produto tem prontuário, gestão e um conjunto de ferramentas clínicas: escores, cálculo de dose pelo peso e avisos automáticos, como o de sepse do adulto.
>
> Queremos, antes de tudo, um **parecer de enquadramento**: que partes são software como dispositivo médico, em que classe pela RDC 751/2022 e se o caminho é notificação ou registro. Já temos um mapa técnico das 332 ferramentas e 12 perguntas por escrito.
>
> Vocês fazem esse tipo de parecer separado do pacote completo de regularização? Se sim, poderiam mandar prazo e valor? Mando os documentos depois de um acordo de confidencialidade.
>
> Obrigado,
> [nome]
> [telefone]

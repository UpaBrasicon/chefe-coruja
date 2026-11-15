# Roteiro da demo — gestor de UPA (15 minutos)

*Backlog comercial, item 1. Decisões do RT em 15/11/2026: D1 a D6 = A (`docs/comercial/DEMO-ROTEIRO-DIAGNOSTICO.md`). Substitui o roteiro de 07/10/2026 (`produto/docs/demo/roteiro-demo-gestor-upa.md`, que fica como histórico).*

**Público:** gestor de UPA. **Ambiente:** homologação, na UPA 24h Jardim Primavera (pacientes e equipe fictícios). **Apresentador:** uma pessoa, com uma conta que tem os papéis gestor, plantonista, recepção e enfermeiro na unidade e troca de perfil pelo menu do usuário (Trocar perfil).

**A mensagem:** o Chefe Coruja acompanha o paciente da porta à alta, com a regra no sistema e não no papel, e o gestor vê tudo na hora. E é seguro: segundo fator, auditoria e cópia guardada por 20 anos.

> **Rascunho.** Os nomes de tela e os tempos ainda vão ser conferidos na homologação (subtarefa 3). Depois, o RT faz o ensaio cronometrado.

---

## Antes da demo

**Uma vez por conta** (homologação):
1. `scripts/demo/01_rede_demonstracao.sql`, se a escala da unidade não cobrir o mês da demo.
2. `scripts/demo/03_acesso_conta.sql`, com o e-mail de quem apresenta numa cópia local (o e-mail não vai para o git).

**Até uma hora antes:**
1. `scripts/demo/02_plantao_agora.sql`: monta o plantão de agora, com 17 pacientes e 8 de 11 leitos ocupados. Rodado na véspera, as esperas ficam longas demais.
2. Rodar de novo o `03` se a demo cair em outro dia: ele põe quem apresenta na escala de hoje do Pronto Socorro.
3. Entrar em `https://homolog.chefecoruja.com.br` (antes, o login da Vercel), confirmar o segundo fator e marcar "Manter conectado neste aparelho". Escolher a unidade **UPA 24h Jardim Primavera**.
4. Deixar duas abas abertas: uma no **Painel** do gestor e outra para o fluxo.
5. Ter à mão um paciente fictício e uma queixa, por exemplo: *"José Demonstração da Silva, 68 anos, falta de ar e febre há 3 dias"*.

**Não usar dado real** em nenhum campo. **Não ditar dose:** na prescrição, quem apresenta digita o que prescreveria. O sistema não sugere dose; é regra do produto e vale mostrar.

---

## Fluxo principal — porta à alta (15 min)

Todo o fluxo fica no Pronto Socorro, que é o setor da escala de quem apresenta. A Observação e os leitos aparecem pela visão do gestor.

| Min | Perfil | Tela | O que fazer | O que dizer |
|---|---|---|---|---|
| 0–1 | Gestor | **Painel** | Abrir o painel: ocupação, plantão agora, check-in da equipe | "É isto que o senhor vê ao abrir o sistema: a unidade agora. Quem está de plantão, quem chegou, quanto do leito está ocupado." |
| 1–2 | Gestor | **Porta** | Mostrar as etapas (aguardando triagem, aguardando médico, em atendimento, observação), a espera mais antiga e o gargalo | "A porta em tempo real: onde o paciente está parado e há quanto tempo, pela cor da classificação." |
| 2–3 | Plantonista | **Plantão** | Trocar para Plantonista; fazer o **check-in**. Fora da cerca, na segunda tentativa, escrever a justificativa ("Demonstração fora da unidade") | "O médico só abre prontuário se estiver na escala e fizer check-in. Fora da unidade, ele justifica, e o gestor vê o motivo na auditoria." |
| 3–4 | Recepção | **Nova ficha** | Trocar para Recepção; buscar o nome antes; cadastrar com nascimento, mãe e queixa; enviar para a triagem | "A recepção busca antes de cadastrar e não duplica paciente. A prioridade legal entra sozinha." |
| 4–6 | Enfermeiro | **Triagem** | Trocar para Enfermeiro; chamar o paciente; sinais vitais, fluxograma "Queixas respiratórias", discriminador, cor **Amarelo**; registrar | "A cor é do enfermeiro; o protocolo aparece como referência. Se a página recarregar, o rascunho volta, cifrado." |
| 6–8 | Plantonista | **Atendimento** | Trocar para Plantonista; fila por cor e espera; abrir o paciente: sinais da triagem já trazidos e NEWS2; escrever a avaliação ("pneumonia") e aceitar o **CID sugerido** | "O médico não redigita a triagem. O CID vem sugerido pela avaliação, e quem escolhe é ele." |
| 8–9 | Plantonista | Aba **Prescrição** | Aviso de alergia não registrada; buscar o medicamento; **digitar a dose**, a via e **Agora**; prescrever | "A dose é do médico; o sistema não inventa dose. Sem alergia registrada, ele avisa." |
| 9–10 | Enfermeiro | **Checagem** | Trocar para Enfermeiro; no item prescrito, **Feito** | "A checagem sai com nome e hora. 'Não feito' e 'Recusado' pedem motivo: nada some." |
| 10–11 | Plantonista | Aba **Desfecho** | Trocar para Plantonista; **Alta** com CID; confirmar | "A alta fecha o atendimento com o CID, e o paciente sai da porta na hora." |
| 11–12 | Gestor | **Porta** e **Observação** | Voltar ao gestor: a porta mudou; abrir **Observação** (grupo Leitos): leitos ocupados, tempo de permanência e quem passou de 6 horas | "Tudo o que aconteceu nos últimos dez minutos já está aqui. Na observação, o relógio das 6 horas tem consequência clínica." |
| 12–13 | Gestor | **Indicadores** e **Auditoria** | Indicadores: espera até a triagem e até o médico, pacientes por cor; Auditoria: o check-in com a justificativa | "Os indicadores saem do registro, sem planilha. E toda ação tem autor." |
| 13–15 | — | (fala) | Fechar com segurança | "Cada acesso pede segundo fator; a tela bloqueia sozinha com 10 minutos parada; toda ação tem autor numa trilha que denuncia adulteração; os dados ficam em São Paulo, com cópia diária cifrada guardada por 20 anos. Temos documento de segurança e LGPD para a sua TI." |

## Desvios de 3 minutos (só se o público pedir)

**A. Central do plantonista e "Perguntar à IA"** (perfil Plantonista, **Central do Plantonista**)
- Abrir uma ferramenta (por exemplo, um escore) e mostrar a fonte e a data da revisão.
- Perguntar: "pneumonia adquirida na comunidade: quando internar?". A resposta vem com a fonte citada; quando a diretriz nova diverge do manual, aparecem as duas.
- Fala: "São cerca de 230 ferramentas, revistas contra as diretrizes mais recentes e aprovadas pelo responsável técnico. A IA só responde com fonte, e sem nome de paciente."

**B. Regulação** (perfil Gestor, **Regulação**, no grupo Leitos)
- Mostrar a fila de solicitações de vaga, a situação de cada uma e a decisão registrada.
- Fala: "A transferência sai daqui com a solicitação, a fila e a resposta da central, sem telefone e papel perdidos."

**C. UBS e faturamento**
- Faturamento (perfil Gestor, grupo **Faturamento**): **Contas do atendimento** e **BPA** da produção do dia.
- UBS: trocar de unidade para a **UBS** da rede de teste da Fase 5 e mostrar a agenda de consultas. **Avisar na fala que é outra unidade de teste**, com nomes de teste.
- Fala: "A mesma plataforma cobre a atenção básica e gera a produção para o SUS."

## Perguntas prováveis (resposta curta)

- **"E se cair a internet?"** — Os registros essenciais seguem sem conexão e sincronizam quando a rede volta; recarregar a página sem rede não derruba o sistema. Num desastre, o sistema volta em até 4 h, e a unidade segue o plano de contingência em papel, com a reentrada marcada depois.
- **"Onde ficam os dados?"** — Banco em São Paulo, cópia diária cifrada em São Paulo, guardada por 20 anos (Lei 13.787/2018). Documento de segurança e LGPD disponível.
- **"Integra com a RNDS e o e-SUS?"** — A integração está pronta para a implantação; não prometer data.
- **"Tem assinatura digital?"** — Responder pelo estado na implantação, sem prometer certificação que o produto não tem.
- **"Quanto tempo para implantar?"** — Responder com a proposta de piloto (item 5 do backlog comercial).
- **"Por que não MV, Tasy ou TOTVS?"** — Responder pela matriz competitiva interna; o roteiro completo de objeções é o item 6 do backlog comercial.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Porta do médico fechada / "não está na escala" | Fazer o check-in; conferir se o `03` rodou hoje |
| Check-in "você está a N m da unidade" | Tocar Check-in de novo: na segunda recusa aparece a justificativa. Não mexer na cerca da unidade |
| Esperas de muitas horas na porta | O `02` rodou cedo demais: rodar de novo (apaga e recria os pacientes da unidade de demonstração) |
| Triagem sem fluxograma | Protocolo não carregado na homologação: `supabase/dados/protocolo_aparecida_2025.sql` |
| Prescrição "Nada no cadastro" | Catálogo de medicamentos da homologação: `npm run homolog:copiar -- 9` |
| Checagem vazia | O paciente tem de estar no Pronto Socorro; a checagem vale para paciente no setor da escala |
| Pede o código do segundo fator no meio | Usar o código; na véspera, marcar "Manter conectado neste aparelho" |
| "Perguntar à IA" não responde | Pular o desvio A |
| Aparece "E2E", "F5" ou "teste" na tela | Conferir a unidade escolhida: o fluxo principal é só na Jardim Primavera |

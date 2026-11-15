# Roteiro da demo — gestor de UPA (15 minutos)

*Backlog comercial, item 1. Decisões do RT em 15/11/2026: D1 a D6 = A (`docs/comercial/DEMO-ROTEIRO-DIAGNOSTICO.md`). Substitui o roteiro de 07/10/2026 (`produto/docs/demo/roteiro-demo-gestor-upa.md`, que fica como histórico). Telas conferidas na homologação em 15/11/2026 (`docs/comercial/demo/evidencia.md`).*

**Público:** gestor de UPA. **Ambiente:** homologação, na UPA 24h Jardim Primavera (pacientes e equipe fictícios). **Apresentador:** uma pessoa, com uma conta que tem os papéis gestor, plantonista, recepção e enfermeiro na unidade e troca de perfil pelo menu do usuário (o círculo com as iniciais, no canto de cima): **Trocar perfil**.

**A mensagem:** o Chefe Coruja acompanha o paciente da porta à alta, com a regra no sistema e não no papel, e o gestor vê tudo na hora. E é seguro: segundo fator, auditoria e cópia guardada por 20 anos.

---

## Antes da demo

**Uma vez por conta** (homologação):
1. `scripts/demo/01_rede_demonstracao.sql`, se a escala da unidade não cobrir o mês da demo.
2. `scripts/demo/03_acesso_conta.sql`, com o e-mail de quem apresenta numa cópia local (o e-mail não vai para o git).

**No dia, até uma hora antes:**
1. `scripts/demo/02_plantao_agora.sql`: monta o plantão de agora, com 17 pacientes e 8 de 11 leitos ocupados (73%). Rodado na véspera, as esperas ficam longas demais.
2. `03` de novo, se a demo cair em outro dia: ele põe quem apresenta na escala de hoje do Pronto Socorro.
3. Entrar em `https://homolog.chefecoruja.com.br` (antes, o login da Vercel), confirmar o segundo fator e marcar "Manter conectado neste aparelho".
4. Em **Trocar unidade**, escolher a **UPA 24h Jardim Primavera**.
5. Ensaiar uma vez, cronometrando. Deixar duas abas abertas: uma no **Painel** do gestor e outra para o fluxo.
6. Ter à mão um paciente fictício e uma queixa, por exemplo: *"José Demonstração da Silva, nascido em 12/03/1958, mãe Maria Demonstração da Silva, falta de ar e febre há 3 dias"*.

**Não usar dado real** em nenhum campo. **Não ditar dose:** na prescrição, quem apresenta digita o que prescreveria. O sistema não sugere dose; é regra do produto e vale mostrar.

**O nome da conta aparece na tela:** no check-in da auditoria, como autor da classificação, da prescrição e da checagem. Use uma conta com nome neutro.

---

## Fluxo principal — porta à alta (15 min)

Todo o fluxo fica no Pronto Socorro, o setor da escala de quem apresenta. A regra da escala não deixa a mesma pessoa estar em dois setores ao mesmo tempo, e a checagem só vale para paciente no setor da escala. Por isso o paciente da demo sai pela alta da porta, e a Observação aparece pela tela do gestor.

| Min | Perfil | Tela | O que fazer | O que dizer |
|---|---|---|---|---|
| 0–1 | Gestor | **Painel** | Mostrar a faixa de cima: ocupação 73% (8 de 11 leitos), em plantão agora, check-in com divergência, estoque crítico | "É isto que o senhor vê ao abrir o sistema: a unidade agora. Quem está de plantão, quem chegou, quanto do leito está ocupado." |
| 1–2 | Gestor | **Porta** | Mostrar a faixa vermelha do gargalo, os seis cartões (aguardando triagem, aguardando médico, em atendimento, medicação pendente, em observação, altas hoje) e "Aguardando médico, por cor" | "A porta em tempo real: onde o paciente está parado e há quanto tempo, pela cor. O sistema aponta o gargalo sozinho." |
| 2–3 | Plantonista | (porta de entrada do plantonista) | Trocar perfil para **Plantonista**. Aparece "Faça o check-in para entrar". **Fazer check-in agora**; fora da cerca, **Tentar de novo**; na segunda recusa, escrever a justificativa ("Demonstração fora da unidade") e **Registrar com justificativa** | "O médico só abre prontuário se estiver na escala e fizer check-in. Passou de 30 minutos do início, o acesso fecha até ele fazer. Fora da unidade, ele justifica, e o gestor vê." |
| 3–4 | Recepção | **Nova ficha** | Trocar perfil para **Recepção**. Buscar o nome; **Novo cadastro**: nome, nascimento, mãe, sexo e queixa; **Enviar para a triagem** | "A recepção busca antes de cadastrar e não duplica paciente. Com 60 anos ou mais, a prioridade legal entra sozinha." |
| 4–6 | Enfermeiro | **Triagem** | Trocar perfil para **Enfermeiro**. Escolher a sala **Triagem 1**; **Chamar**; **Triar**: sinais vitais, AVPU, fluxograma "Queixas respiratórias", discriminador, prioridade **Amarelo**, SpO₂ em ar ambiente; **Registrar classificação** | "A cor é do enfermeiro; o protocolo aparece como referência. A chamada vai para o painel da sala de espera. Se a página recarregar, o rascunho volta, cifrado." |
| 6–8 | Plantonista | **Atendimento** | Trocar perfil para **Plantonista**. Escolher o **Consultório 1**; **Abrir** o paciente: NEWS2 e sinais da triagem já na tela. Escrever o subjetivo e, na avaliação, "Pneumonia": aparecem os **CIDs de referência**; escolher **J18.9**; **Registrar** | "O médico não redigita a triagem. O CID vem sugerido pela avaliação, e quem escolhe é ele." |
| 8–9 | Plantonista | Aba **Prescrição** | Mostrar o aviso **Alergia não registrada**. Em **Novo item**, Medicamento: o sistema pede o **peso** antes; registrar o peso; buscar o medicamento, **digitar a dose**, a via e **Agora**; prescrever | "A dose é do médico; o campo diz 'escrita pelo médico'. Sem alergia registrada, ele avisa; sem peso, ele não deixa prescrever medicamento." |
| 9–10 | Enfermeiro | **Checagem** | Trocar perfil para **Enfermeiro**. No item prescrito, **Feito**: aparece "Última checagem", com data, hora e nome | "A checagem sai com nome e hora. 'Não feito' e 'Recusado' pedem motivo: nada some." |
| 10–11 | Plantonista | **Atendimento** › Em atendimento › aba **Desfecho** | Trocar perfil para **Plantonista**. **Abrir atendimento**; **Alta médica**: o CID de alta vem do atendimento; mostrar o "Antes de confirmar"; **Confirmar desfecho** | "Antes da alta, o sistema confere o registro, a hipótese, os exames e o CID. A alta fecha o atendimento, e o paciente sai da porta na hora." |
| 11–12 | Gestor | **Porta** e **Leitos › Observação** | Trocar perfil para **Gestor**. A porta mudou. Em **Observação**, mostrar a coluna "Prazo de 6 h" | "Tudo o que aconteceu nos últimos dez minutos já está aqui. Na observação, o relógio das 6 horas tem consequência clínica." |
| 12–13 | Gestor | **Painel** | Na **Auditoria de check-in**, filtrar **Divergências**: o check-in de quem apresenta, com atraso, fora do raio e com a justificativa. Na caixa de cima, perguntar: "Qual a taxa de ocupação agora?" | "Toda ação tem autor. E o senhor pergunta em português, sem nome de paciente na resposta." |
| 13–15 | — | (fala) | Fechar com segurança | "Cada acesso pede segundo fator; a tela bloqueia sozinha com 10 minutos parada; toda ação tem autor numa trilha que denuncia adulteração; os dados ficam em São Paulo, com cópia diária cifrada guardada por 20 anos. Temos documento de segurança e LGPD para a sua TI." |

## Desvios de 3 minutos (só se o público pedir)

**A. Central do plantonista e "Perguntar à IA"** (perfil Plantonista, **Central do Plantonista**)
- Mostrar as seções (condutas do adulto, pediatria, escores, protocolos): 232 ferramentas.
- Na caixa "Buscar ferramenta ou perguntar à IA", escrever: **"noradrenalina pode correr em acesso periférico no adulto?"** e tocar **Perguntar à IA**. A resposta traz a diretriz alemã de 2025, o manual de 2022 ao lado e as fontes clicáveis.
- Fala: "As ferramentas foram revistas contra as diretrizes mais recentes e aprovadas pelo responsável técnico. Quando a diretriz nova diverge do manual, aparecem as duas. A IA só responde com fonte."
- Não usar perguntas de ponto de corte de internação (por exemplo, PAC): a IA responde que os trechos não trazem o critério.

**B. Faturamento** (perfil Gestor, grupo **Faturamento**, na Jardim Primavera)
- **Contas do atendimento**: cada atendimento da porta abre uma conta (BPA), com as pendências que travam o fechamento.
- Fala: "A conta nasce do atendimento, e o sistema mostra o que falta antes de faturar."

**C. Regulação e UBS** (em **Trocar unidade**, a **UBS Fase 5**, rede de teste)
- **Avisar na fala que é outra unidade de teste, com nomes de teste.** A rede de demonstração não tem Central de Regulação.
- **Leitos › Regulação**: pedidos com prioridade, prazo da regulação, alerta de "destino sem resposta" e o **mapa de vagas da rede**.
- **Hiperdia**: hipertensos e diabéticos da unidade, com as regras C5 e C4 do Ministério da Saúde.
- Fala: "A mesma plataforma cobre a atenção básica e a regulação da rede."

## Perguntas prováveis (resposta curta)

- **"E se cair a internet?"** — Os registros essenciais seguem sem conexão e sincronizam quando a rede volta; recarregar a página sem rede não derruba o sistema. Num desastre, o sistema volta em até 4 h, e a unidade segue o plano de contingência em papel, com a reentrada marcada depois.
- **"Onde ficam os dados?"** — Banco em São Paulo, cópia diária cifrada em São Paulo, guardada por 20 anos (Lei 13.787/2018). Documento de segurança e LGPD disponível.
- **"Integra com a RNDS e o e-SUS?"** — A integração fica para a implantação; não prometer data.
- **"Tem assinatura digital?"** — Responder pelo estado na implantação, sem prometer certificação que o produto não tem.
- **"Quanto tempo para implantar?"** — Responder com a proposta de piloto (item 5 do backlog comercial).
- **"Por que não MV, Tasy ou TOTVS?"** — Responder pela matriz competitiva interna; o roteiro completo de objeções é o item 6 do backlog comercial.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| "Faça o check-in para entrar" com "30 min de atraso" | É esperado se a demo começar mais de 30 min depois do início do turno: fazer o check-in como no passo 2–3 |
| Check-in "você está a N m da unidade" | Tocar **Tentar de novo**: na segunda recusa aparece a justificativa. Não mexer na cerca da unidade |
| Porta do médico fechada / "não está na escala" | Conferir se o `03` rodou hoje para a conta |
| Esperas de muitas horas na porta | O `02` rodou cedo demais: rodar de novo (apaga e recria os pacientes da unidade de demonstração) |
| Triagem sem fluxograma | Protocolo não carregado na homologação: `supabase/dados/protocolo_aparecida_2025.sql` |
| Prescrição "Nada no cadastro" | Catálogo de medicamentos da homologação: `npm run homolog:copiar -- 9` |
| Medicamento não deixa prescrever | Registrar antes o peso do atendimento, no mesmo bloco |
| Checagem vazia | O paciente tem de estar no Pronto Socorro; a checagem vale para paciente no setor da escala |
| Pede o código do segundo fator no meio | Usar o código; na véspera, marcar "Manter conectado neste aparelho" |
| "Perguntar à IA" não responde | Pular o desvio A |
| Aparece "E2E", "F5" ou "teste" na tela | Conferir a unidade escolhida: o fluxo principal é só na Jardim Primavera |

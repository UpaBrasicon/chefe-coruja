# LG12: tecnovigilância do módulo clínico (diagnóstico, 18/11/2026)

Trilha de obrigatórios legais e regulatórios, item LG12 (P2). **Decisão do RT, 18/11/2026: "A em todas"** (V1–V5). Este documento não muda código nem banco e não é parecer jurídico.

**Base:** RDC 67/2009 da ANVISA, lida no texto do Ministério da Saúde (saudelegis) em 18/11/2026:
- art. 2º: tecnovigilância é a vigilância de eventos adversos e queixas técnicas de produtos para a saúde depois que chegam ao mercado.
- art. 4º:
  - evento adverso é qualquer efeito não desejado, em humanos, do uso do produto;
  - evento adverso grave inclui óbito, dano permanente e internação ou internação prolongada;
  - queixa técnica é a suspeita de alteração ou irregularidade técnica ou legal do produto.
- art. 5º: o detentor do registro designa, por escrito, pelo menos um profissional de nível superior, com registro no conselho, para a tecnovigilância.
- art. 6º:
  - procedimentos escritos;
  - investigação conforme a gravidade e o risco;
  - arquivo documentado das notificações, guardado pela vida útil do produto e nunca menos de 2 anos;
  - conclusão escrita ao notificador, quando pedida.
- art. 8º, prazos de aviso à ANVISA (Notivisa), contados de quando a empresa sabe:
  - óbito ou ameaça grave à saúde pública: 72 horas;
  - evento adverso grave sem óbito: 10 dias corridos;
  - queixa técnica que pode levar a evento grave: 30 dias corridos.
- RDC 551/2021: ações de campo, como recolher ou corrigir uma versão com defeito.

A norma está em vigor. Segundo buscas de 18/11/2026, a ANVISA anunciou uma revisão sem data, que não confirmei na fonte. Antes de cada notificação, conferir a versão vigente no portal da ANVISA.

## Como está hoje

**Por que o LG12 depende do LG11.** As obrigações da RDC 67 são do **detentor de registro**. Enquanto o módulo clínico não for notificado ou registrado na ANVISA, a Chefe Coruja não tem a obrigação formal de notificar como fabricante. Mesmo assim, o canal, a investigação e o registro são boa prática, e o consultor vai pedir que já existam (LG11). Quem atende o paciente (a unidade, pelo Núcleo de Segurança do Paciente) pode notificar no Notivisa a qualquer momento.

| Exigência | Como está |
|---|---|
| Canal para receber erro e evento ligado ao software | **Parcial.** A página "Sobre o módulo clínico" (LG11, C5) diz: "Avise o gestor da sua unidade, que abre um chamado técnico, ou escreva para contato@chefecoruja.com.br". O chamado técnico vai para o administrador do cliente, não para a Chefe Coruja como fabricante, e não tem tipo "clínico" nem gravidade clínica. O e-mail não tem registro, prazo nem fila |
| Ferramenta e versão do relato | **Falta.** Quem avisa precisa copiar a versão da tela à mão |
| Investigação com prazo | **Falta.** Não há relógio de 72 h, 10 dias ou 30 dias |
| Arquivo das notificações (art. 6º, X) | **Falta** |
| Conclusão ao notificador (art. 6º, XI) | **Falta** |
| Ação de campo (RDC 551) | **Parcial.** O gestor pode esconder uma ficha na sua unidade (`ferramenta_unidade.oculta`, LG10 e LG13). Não há como suspender a ficha na rede toda, com aviso na tela |
| Responsável designado (art. 5º) | **Falta** o documento. O RT é médico com CRM, então cumpre o requisito |
| Evento adverso de medicamento no paciente (aba "Alergias e eventos adversos") | **Existe**, mas é outra coisa: é o evento do remédio no prontuário, não o defeito do software |

## Decisões para o RT

**V1. Canal**
- **A (recomendada):** um botão "Relatar problema" no rodapé de cada ferramenta da Central, nos avisos automáticos (como o de sepse) e na página "Sobre o módulo clínico".
  - Ferramenta, versão, unidade, data e quem relatou vêm preenchidos. O autor é quem está no login.
  - A pessoa escolhe o tipo: erro de conteúdo ou de cálculo, falha do sistema, ou problema que chegou ao paciente.
  - Se chegou ao paciente, a pessoa diz o desfecho: sem dano, dano temporário, dano permanente ou internação, ou óbito.
  - O texto é livre. A tela pede para não pôr dado do paciente e recusa o envio se achar CPF, CNS ou telefone.
  - O relato vai para a fila da Chefe Coruja (RT e super admin), não para o administrador do cliente. O gestor da unidade recebe uma cópia, para o Núcleo de Segurança do Paciente dele.
  - O e-mail continua como reserva.
- **B:** usar o chamado técnico que já existe, com uma categoria "clínico". O chamado continua indo para o administrador do cliente.
- **C:** só o e-mail, como hoje.

**V2. Investigação e prazos**
- **A (recomendada):** a fila mostra o relógio do art. 8º desde já, mesmo antes do registro.
  - Prazos: óbito, 72 h; dano permanente ou internação, 10 dias; erro de conteúdo ou cálculo que pode causar dano, 30 dias; o resto sem prazo legal, com meta de 30 dias.
  - Cada relato passa por: recebido, em investigação e concluído. A conclusão diz a causa, a ação tomada e a versão corrigida.
  - O registro é só de inclusão.
  - Quem relatou recebe a conclusão por escrito na tela (art. 6º, XI).
  - Relato grave avisa o RT por e-mail na hora, sem dado do paciente.
- **B:** a fila sem relógio. O prazo fica para depois do registro.

**V3. Guarda do arquivo**
- **A (recomendada):** 5 anos depois da conclusão, apagados por rotina com registro. O art. 6º pede pelo menos 2 anos e a vida útil do produto, que no software não tem data fixa. Uma ficha costuma ficar no ar alguns anos.
- **B:** 2 anos, o mínimo.
- **C:** 20 anos, junto com a auditoria do prontuário.

**V4. Ação de campo**
- **A (recomendada):** o RT pode **suspender uma versão na rede toda**.
  - A ficha volta para a versão aprovada anterior. Se não houver, sai do ar com o aviso "suspensa para correção".
  - Fica registrado o motivo e o relato que levou à suspensão.
  - A versão corrigida passa pelo gate de sempre (LG10 e LG13).
  - A suspensão por unidade continua com o gestor.
- **B:** só a suspensão por unidade, como hoje. O RT pede a cada gestor.

**V5. Notivisa e responsável**
- **A (recomendada):**
  - **Agora:** você assina a designação de responsável pela tecnovigilância (art. 5º). O modelo vai neste PR. O suplente pode ser o farmacêutico do LG13, quando for nomeado.
  - **Antes do registro:** quando o problema chega ao paciente, avisamos o gestor da unidade para o Núcleo de Segurança do Paciente notificar (RDC 36/2013). Você decide caso a caso se a Chefe Coruja também notifica no Notivisa, como queixa técnica voluntária.
  - **Depois do registro (LG11):** notificação obrigatória nos prazos do art. 8º.
- **B:** nada no Notivisa até o registro; só o canal e a fila.

## Perguntas para o consultor (vão com o dossiê do LG11)

1. Antes da notificação ou registro, a notificação voluntária no Notivisa como fabricante ajuda ou atrapalha o processo?
2. Para software, qual "vida útil" usar na guarda do arquivo (art. 6º, parágrafo único)?
3. A suspensão de uma versão na rede (V4) conta como ação de campo da RDC 551/2021? Precisa de aviso à ANVISA?

## Plano depois das decisões (com V1–V5 = A)

1. **Banco** (migration expand, idempotente, com rollback):
   - a tabela de relatos de tecnovigilância, só de inclusão, com o andamento;
   - funções para relatar, investigar, concluir e suspender a versão na rede;
   - o prazo calculado pela gravidade;
   - a rotina de guarda de 5 anos;
   - o teste em `supabase/tests`.
2. **Tela:**
   - o botão "Relatar problema" no rodapé das ferramentas e nos avisos;
   - a fila "Tecnovigilância" do RT, com o relógio;
   - a conclusão para quem relatou;
   - o aviso "suspensa para correção" na ficha.
3. **E-mail ao RT** no relato grave, pela Resend que já existe, sem dado do paciente.
4. **Documentos:**
   - procedimento de tecnovigilância (art. 6º, II);
   - modelo da designação do responsável (art. 5º);
   - atualizar o texto "Achou um erro?" da página "Sobre o módulo clínico", com o seu ok no texto;
   - LG4 e o mapa do módulo clínico do LG11.
5. CI, homologação e o seu "ok produção".

# LG12: procedimento de tecnovigilância do módulo clínico

Versão 1, 18/11/2026. Decisões V1–V5 = A do RT (`docs/regulatorio/LG12-TECNOVIGILANCIA-DIAGNOSTICO.md`). É o procedimento escrito do art. 6º, II, da RDC 67/2009. Não é parecer jurídico. O consultor do LG11 revisa este texto.

## 1. Quem faz o quê

| Papel | Quem | O que faz |
|---|---|---|
| Responsável pela tecnovigilância (art. 5º) | o RT médico da Chefe Coruja, designado por escrito (`LG12-DESIGNACAO-RESPONSAVEL.md`) | investiga, conclui, suspende a versão na rede e decide a notificação |
| Suplente | o farmacêutico do comitê clínico (LG13), quando for nomeado | faz o mesmo na ausência do responsável |
| Quem relata | qualquer profissional com login | usa "Relatar problema" |
| Gestor da unidade | gestor do cliente | vê os relatos da unidade; leva ao Núcleo de Segurança do Paciente o que chegou ao paciente |

## 2. Receber

- **Canal:** o botão "Relatar problema" fica no topo de cada ferramenta da Central, ao lado do título, no aviso de sepse do atendimento e na página "Sobre o módulo clínico".
- **Reserva:** quem não tem acesso ao sistema escreve para contato@chefecoruja.com.br. Quem recebe o e-mail registra o relato no sistema no mesmo dia, sem dado do paciente.
- **O que vem preenchido:** ferramenta, versão, unidade, data e quem relatou.
- **Dado do paciente:** a tela e o banco recusam CPF, CNS e telefone.
- **Relato grave** (óbito, dano permanente ou internação): o responsável recebe um e-mail na hora (função `avisar-tecnovigilancia`), sem dado do paciente.

## 3. Prazos (RDC 67/2009, art. 8º, contados do recebimento)

| Relato | Prazo |
|---|---|
| Chegou ao paciente, com óbito | 72 horas |
| Chegou ao paciente, com dano permanente ou internação | 10 dias corridos |
| Erro de conteúdo ou de cálculo, ou chegou ao paciente sem dano grave | 30 dias corridos |
| Falha do sistema sem efeito clínico | meta interna de 30 dias |

A fila mostra o relógio de cada relato. Antes do registro (LG11), o prazo é uma meta interna. Depois, é o prazo de notificação.

## 4. Investigar

1. Ler o relato e marcar "Em investigação".
2. Reproduzir o problema na homologação, com os mesmos dados, sem dado real de paciente.
3. Conferir a ficha com a fonte citada.
4. Se pode causar dano: **suspender a versão na rede** (aba Tecnovigilância). A ficha some de todas as unidades com o aviso "suspensa para correção" e o motivo.
5. Corrigir pelo caminho de sempre:
   - versão nova da ficha;
   - revisões do comitê (LG13);
   - aprovação na produção (gate do LG10).
   Para voltar à versão anterior já aprovada, o caminho é um PR que devolve o código da ficha; o gate confere que ela está aprovada.
6. Com a versão corrigida no ar, encerrar a suspensão, dizendo por quê.

## 5. Concluir

A conclusão tem:
- o texto do que foi feito;
- a causa;
- a ação tomada;
- a versão corrigida, quando houver.

Ela aparece para quem relatou em "Meus relatos" (art. 6º, XI). Concluído não reabre: um problema novo é um relato novo.

## 6. Notificar (V5)

- **Antes da notificação ou do registro do módulo na ANVISA (LG11):**
  - quando o problema chegou ao paciente, o gestor da unidade já vê o relato. O responsável confirma com ele que o Núcleo de Segurança do Paciente avaliou a notificação no Notivisa (RDC 36/2013);
  - o responsável decide, caso a caso, se a Chefe Coruja também notifica no Notivisa como queixa técnica voluntária. É a pergunta 1 ao consultor.
- **Depois do registro:** o responsável notifica no Notivisa nos prazos do item 3 e guarda o protocolo no andamento do relato.
- Antes de cada notificação, conferir a versão vigente da RDC 67/2009 no portal da ANVISA, porque a norma está em revisão.

## 7. Guardar

- Relato, andamento e suspensões ficam no banco, só de inclusão.
- A rotina diária `lg12-tecnovigilancia-5-anos` (06:50 UTC) apaga o que foi concluído há mais de 5 anos e anota a quantidade na auditoria. Relato com suspensão vigente não é apagado.
- O mínimo da norma é 2 anos (art. 6º, parágrafo único). A vida útil do software é a pergunta 2 ao consultor.

## 8. Como reverter

- **Rollback do banco:** `docs/regulatorio/LG12-ROLLBACK-20270418000094.sql`. Apaga os relatos: exporte as tabelas antes.
- **E-mail:** tirar a função `avisar-tecnovigilancia` do Supabase. O relato continua na fila sem o e-mail.
- **Tela:** reverter o PR.

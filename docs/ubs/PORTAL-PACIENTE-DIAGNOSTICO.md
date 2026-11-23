# Portal do paciente: diagnóstico (PP1 a PP6)

Ideia do RT em 20/11/2026, no meio da conferência da vacina: um **portal do paciente**, simples, com as medicações, as condutas e as vacinas feitas na UBS, dentro da LGPD, para o paciente levar e facilitar o atendimento em outros serviços.

Em 23/11/2026 o RT deu fase e prioridade (opção A): **trilha própria "Portal do paciente", P2**. Agora só o diagnóstico, em documento e sem código. **O código fica para depois da revisão do advogado nas peças da LGPD (LG1 a LG5).**

Lido na master (cc5c6bf9). Nada foi programado.

## O que já existe e serve de base

- **Link do paciente com código (pacote de alta, Fase 3):** `/alta/:token` abre os documentos de alta no celular do paciente, sem login. O token é aleatório; o código de 6 dígitos é entregue à parte e guardado só como hash; vence em 30 dias; bloqueia depois de 3 códigos errados; a equipe pode revogar; cada documento sai em PDF (`DocumentosAlta.tsx`, migrations `20260928000004` e `20261003000006`). É o mesmo problema (o paciente lê o próprio dado fora do app) já resolvido uma vez.
- **Vacinas:** caderneta completa (`vacina_caderneta`), com o bloco "Em atraso ou a completar" do RF6.
- **Medicações:** receitas da consulta (documentos assinados, `receita_protocolos` para o protocolo da enfermagem) e dispensação na farmácia (`dispensacoes`).
- **Condutas:** conduta da consulta da UBS (`conduta_aps`), encaminhamentos e agendamentos futuros.
- **Registro de acesso (LG9)** e **auditoria**, para registrar cada abertura do portal.
- **RNDS:** RAC e RIA prontos, esperando a credencial. Quando ligar, o paciente vê vacinas e atendimentos no **Meu SUS Digital**.

## O que a LGPD muda aqui

- Na UBS, o **controlador** do dado de saúde é o município; o Chefe Coruja é **operador** (peças LG1 a LG5). O portal é um serviço do controlador ao titular: o município precisa aprovar e assumir.
- Base legal: tutela da saúde para o tratamento (art. 11, II, f) e direito de acesso do titular (art. 18, II). Dado sensível, então o acesso precisa de autenticação forte e de registro.
- Criança e adolescente: o acesso é do responsável legal (art. 14).
- O advogado confirma tudo isso junto com LG1 a LG5, antes do código.

## Decisões

### PP1. O que o portal mostra

**A (recomendo).** Vacinas (a caderneta e o que está em atraso), medicações (receitas da UBS e o que a farmácia entregou), condutas e encaminhamentos, e as próximas consultas marcadas. Sem as anotações clínicas da consulta (SOAP) e sem resultados de exame.

**B.** Tudo de A, mais o resumo de cada consulta (SOAP) e os resultados de exame.

### PP2. Como o paciente entra

**A (recomendo).** Link com código, como o pacote de alta: a recepção ou o enfermeiro gera, entrega o código impresso (ou por mensagem) e o paciente abre no celular. Vence (prazo a decidir, ex. 90 dias), bloqueia em 3 erros, pode ser revogado e gerado de novo. Não cria conta nem senha para o paciente.

**B.** Conta do paciente: Login Único gov.br (o município precisa aderir ao gov.br, e leva tempo) ou código por SMS a cada entrada (precisa de provedor de SMS, com custo por mensagem).

### PP3. Para quem

**A (recomendo).** Adulto recebe o próprio link. Criança e adolescente até 17 anos: o link é entregue ao responsável legal, e fica registrado quem recebeu.

**B.** Só adultos na primeira versão.

### PP4. E o Meu SUS Digital

**A (recomendo).** Portal próprio com o resumo da UBS, e um aviso de que o registro nacional fica no Meu SUS Digital quando a RNDS estiver ligada.

**B.** Só ponte: o app manda tudo à RNDS e o paciente usa o Meu SUS Digital. Depende da credencial da RNDS, que ainda não chegou.

### PP5. Formato

**A (recomendo).** Página no celular, como a do pacote de alta, com "Baixar em PDF" para levar a outro serviço.

**B.** Só o PDF impresso na recepção ("resumo da UBS para levar"), sem link. Mais simples e com menos risco, mas o paciente não consulta de novo sem voltar à UBS.

### PP6. Registro e consentimento

**A (recomendo).** Cada abertura do portal fica no registro de acesso (LG9); a geração do link registra quem gerou, para quem e quem recebeu; o paciente pode pedir a revogação a qualquer momento; o texto de ciência entregue com o código passa pelo advogado.

**B.** Só a auditoria da geração do link, sem registrar cada abertura.

## Ordem sugerida, depois das decisões

1. Decisões PP1 a PP6 (RT).
2. Texto de ciência e base legal com o advogado, junto com LG1 a LG5. **Sem isso, nenhum código.**
3. Plano em PRs: banco (link do portal e conteúdo), página do paciente, geração na recepção e no enfermeiro, testes, homologação e "ok produção".

## Perguntas ao RT

1. PP1 a PP6: A ou B em cada um?

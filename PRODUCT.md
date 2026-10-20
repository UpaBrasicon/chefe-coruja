# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Os papéis têm **o mesmo peso**: cada um é o usuário principal da sua área, sem
hierarquia entre eles (decisão do responsável técnico em 19/10/2026).

- **Recepção:** abre a ficha do paciente na porta e acompanha as filas.
- **Enfermagem** (enfermeiro e técnico): triagem e classificação de risco (só o
  enfermeiro classifica), checagem da medicação, coleta, observação e internação.
- **Plantonista** (médico): atendimento na porta, prescrição, exames, evolução,
  alta e passagem de plantão.
- **Farmacêutico:** dispensação, estoque e alta vigilância.
- **Gestor:** escala, presença, painel da unidade, listas da unidade (exames,
  códigos do BPA) e reabertura de contas.
- **Faturamento:** contas do atendimento, BPA, AIH e APAC, pré-auditoria e glosas.
- **Regulador e NIR:** fila regulada, decisão, mapa de vagas e cobranças.
- **Telemedicina:** apoio remoto ao plantonista.
- **Administrador:** enxerga as unidades da organização só em agregado.

Um mesmo usuário pode ter papéis diferentes em unidades diferentes; o papel
ativo é o da unidade selecionada. Cena de uso: posto, balcão ou sala, em
monitor, com a luz acesa na maior parte do tempo, e também de madrugada, com a
unidade no escuro. O celular existe, mas não é a cena dominante.

## Product Purpose

Prontuário eletrônico de unidade hospitalar do SUS (UPA, hospital), centrado no
plantão: tudo o que um turno exige — receber, classificar, atender, observar,
internar, dar alta, passar o plantão, dispensar, faturar e regular — acontece num
lugar só. Sucesso é a equipe atravessar o turno sem trocar de sistema e sem
deixar passar uma pendência com prazo.

## Positioning

**A escala é a porta.** O profissional só entra na unidade se estiver na escala
naquele momento, pelo relógio do servidor, e o check-in confirma a presença.
O produto não é um prontuário com agenda anexa: é a escala operando como acesso.

## Operating Context

- Turnos de plantão (manhã, tarde, noite); a janela de observação e os prazos de
  reavaliação têm consequência clínica.
- Unidade com setores, leitos nomeados ("12A") e boxes de observação.
- Terminologia em pt-BR e no vocabulário do SUS: plantão, escala, check-in, leito,
  box, observação, internação, evolução, SIGTAP, CID, BPA, AIH, APAC, CNES, CNS.
  O glossário fica em `../produto/CONTEXT.md`.
- Números decimais com vírgula; datas e horas no fuso de Brasília.
- Integrações: laboratório (LIS) por FHIR R4; imagem (RIS/PACS) em andamento.

## Capabilities and Constraints

- App em React 19 + TypeScript + Vite + Tailwind 4 + componentes shadcn/base-ui,
  com Supabase (banco, autenticação, Edge Functions) e PWA. Homologação antes de
  produção em toda mudança.
- Regras clínicas da unidade (do `CLAUDE.md` do projeto): a classificação de
  risco é da enfermagem e o sistema não sugere cor; pediatria vai até 13 anos,
  11 meses e 29 dias; o autor de todo registro é o usuário do login; sinais
  vitais em ficha impressa saem crus; dose, faixa e limite nunca são inventados
  nem convertidos de adulto para criança.
- **Modo escuro é obrigatório** (decisão de 19/10/2026): o padrão do frontend
  precisa funcionar no tema claro e no escuro.
- O guia do padrão do frontend (`docs/frontend/GUIA.md`, trilha "Padrão do
  frontend" do BACKLOG) define cores, tipografia, componentes e tom dos textos.

## Brand Commitments

Confirmados como intocáveis em 19/10/2026: o nome **"Chefe Coruja"**, o **ícone da
coruja** e o **quadrado teal da marca**.

Voz: direta, em pt-BR, sem jargão de desenvolvedor na interface; rótulos nomeiam
a ação; o produto fala como um prontuário, não como uma marca.

## Evidence on Hand

- O app de produção neste repositório (`src/`), com as telas por papel.
- `BACKLOG.md` — o plano do projeto, com as decisões do responsável técnico.
- `docs/frontend/LEVANTAMENTO.md` — levantamento do frontend (parte 1 da trilha
  do padrão).
- `../produto/docs/` — auditoria do frontend de 03/10/2026, mapa do frontend e o
  design system do protótipo (referência histórica, não o mundo atual).

**Não existe e não deve ser inventado:** dados de pacientes reais, depoimentos,
números de adoção, preços, benchmarks ou integrações que o produto não tem. Os
pacientes de homologação são fictícios.

## Product Principles

1. **A escala é a porta.** Acesso, presença e turno são o mesmo fato.
2. **Cada papel vê o seu.** Nenhum papel é acessório do outro; cada tela serve ao
   trabalho de quem a usa.
3. **O prazo é conteúdo de primeira classe.** Permanência, reavaliação, janela de
   observação e pendências com prazo ficam à vista e levam a resolvê-las.
4. **Segurança antes de fluidez.** Onde um erro tem consequência clínica — dose,
   prazo, prescrição, alta — o produto interrompe, mostra a referência e pede
   confirmação; a decisão clínica é do profissional.
5. **O sistema não interpreta pelo profissional.** Resultado e classificação
   aparecem como vieram; o sistema não sugere cor nem marca crítico por conta
   própria.

## Accessibility & Inclusion

**WCAG AA é piso obrigatório nos dois temas** (decisão do RT no guia, 19/10/2026):
4,5:1 para texto e 3:1 para ícone, borda e elemento não textual. Foco visível ao
teclado, `lang="pt-BR"` e nomes acessíveis nos controles. O modo escuro é
obrigatório pela cena de madrugada.

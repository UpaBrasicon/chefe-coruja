# Lacuna 10: óbitos no painel do gestor e em Indicadores (diagnóstico, 10/11/2026)

Trilha "Lacunas do Portão de 11/10/2026", item 10 (P2), aprovada pelo RT em
10/11/2026. O RT liberou esta lacuna em paralelo com a lacuna 6. Origem:
relatório do teste de ponta a ponta de 11/10/2026, passo `11.obitos_painel`
("Não há contagem").

## 1. Fonte

**Portaria SAS/MS nº 312/2002, "Padronização da Nomenclatura do Censo
Hospitalar"**. Lida na cópia do CFF:
https://www.cff.org.br/userfiles/file/portarias/312.pdf. Edição da BVS:
https://bvsms.saude.gov.br/bvs/publicacoes/padronizacao_censo.pdf.

- **Taxa de mortalidade hospitalar (3.6):** óbitos de internados divididos
  pelas saídas do período.
- **Saídas (2.1.5):** alta, evasão, desistência, transferência externa e
  óbito. A transferência interna não conta.
- **Taxa de mortalidade institucional (3.7):** o texto se contradiz. Uma
  frase fala em óbitos "após 24 horas", e a frase seguinte e o item 2.1.12
  falam em "até 24 horas". Por isso o app não usa esse nome.
- **Quem chega morto (2.1.11):** não é óbito hospitalar.
- **Observação (2.2.2):** o leito de observação não é leito de internação.
- **Alcance:** a portaria é do censo hospitalar. A UPA não é hospital, então
  ela serve de referência de nomenclatura, não de regra.

## 2. Estado atual (master em 10/11/2026)

- **Indicadores do gestor (`src/pages/gestor/Indicadores.tsx`):** não mostram
  óbitos. Os cartões da porta (espera, cor, evasão) usam a barra de filtros
  do BI, com o dia do plantão (7h às 7h).
- **Painel do administrador (`painel_organizacao`, `NumerosOrganizacao.tsx`):**
  conta só `episodios.desfecho = 'obito'`. **Os óbitos da observação e da
  internação ficam de fora.**
- **Tabela `obitos` (lacuna 5):** passou a ser a fonte única. Tem origem
  (porta, observação ou internação), setor, hora do óbito, tipo de morte e
  encaminhamento, e marca de anulação. Os óbitos de antes da lacuna 5 ficam
  só em `episodios.desfecho` e `internacoes.status`.
- **Rede, API e Power BI:** não têm óbitos. O recurso `/atendimentos` só
  traz o desfecho da porta.
- **Privacidade:** os números do admin suprimem contagens de 1 a 4
  (`private.suprimir`). Os indicadores do gestor não suprimem e podem
  mostrar nomes, com registro de quem viu (como na evasão).

## 3. Pontos para o RT decidir (recomendação em A)

### P1. Onde aparece
- **A:**
  - um cartão "Óbitos" em Indicadores do gestor, com a barra de filtros
    (período);
  - o painel do admin corrigido para contar todos os óbitos.
  - Rede, API e Power BI ficam para depois.
- **B:** também na rede e na API agora.

### P2. Quais números
- **A:**
  - total;
  - por origem (porta, observação, internação);
  - por setor;
  - por tipo de morte e encaminhamento (unidade, SVO, IML);
  - adulto ou pediátrico;
  - óbitos com menos de 24 h e com 24 h ou mais desde a chegada à unidade;
  - "óbitos sobre saídas" do período, com as saídas de porta, observação e
    internação. Cada parte mostra o numerador e o denominador.
  - O nome "taxa de mortalidade institucional" não é usado, por causa da
    contradição da portaria e porque a UPA não é hospital.
- **B:** só o total e o recorte por setor.

### P3. Lista com nome para o gestor
- **A:** sim, como na evasão: o gestor da unidade vê a lista dos óbitos do
  período, e cada consulta fica registrada, sem dado de pessoa na auditoria.
- **B:** só números.

### P4. Período
- **A:** pela hora do óbito, no dia do plantão (7h às 7h), igual ao resto do
  BI.
  - Da barra de filtros valem o período e o setor do óbito.
  - Cor, médico e turno da chegada não se aplicam.
- **B:** dia civil (meia-noite).

### P5. Supressão de números pequenos
- **A:**
  - o gestor vê os números da própria unidade sem supressão, como hoje nos
    outros cartões;
  - no painel do admin continua a supressão de 1 a 4;
  - o total do admin não é mostrado junto das quebras, para não permitir
    deduzir uma célula escondida.
- **B:** suprimir também para o gestor.

### P6. Óbitos de antes da lacuna 5
- **A:** entram na contagem a partir de `episodios.desfecho` e
  `internacoes.status`, sem contar duas vezes, marcados como "registro
  anterior" (sem tipo de morte nem encaminhamento).
- **B:** contar só os da tabela nova.

### P7. Quem chega morto
- **A:** fica fora desta lacuna. O app não tem marca para isso, e a portaria
  o exclui. Pode entrar depois, com uma marca no óbito da porta.

### P8. Exportação
- **A:** CSV dos números agregados, sem nome. A lista com nome fica só na
  tela.

## 4. Fora do escopo
- Rede, API e Power BI.
- Quem chega morto.
- Indicadores clínicos de qualidade além da contagem.

## 5. Decisão do RT (10/11/2026)

"A em todos": A em P1 a P8.

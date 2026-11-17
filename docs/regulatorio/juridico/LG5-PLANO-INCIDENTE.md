# Plano de Resposta a Incidente de Segurança

> **Rascunho técnico para revisão do advogado.** Decisões do RT de 17/11/2026: P1 a P3 = A. Base: LGPD, art. 48; Resolução CD/ANPD 15/2024.

## 1. Papéis

| Papel | Quem | O que faz |
|---|---|---|
| Responsável pela decisão | RT ([NOME]), também encarregado | declara o incidente, decide a contenção, assina os avisos |
| Suplente técnico | [NOME] | assume se o RT não responder em 2 horas |
| Encarregado | RT, `encarregado@chefecoruja.com.br` | fala com o cliente, a ANPD (quando o Chefe Coruja for controlador) e os titulares |
| Cliente controlador | encarregado de cada cliente | comunica à ANPD e aos titulares os incidentes com dado dele |

## 2. O que é incidente

Qualquer evento de segurança, confirmado, que afete a confidencialidade, a integridade ou a disponibilidade de dado pessoal. Exemplos:
- acesso sem permissão;
- vazamento de chave;
- arquivo exposto;
- perda de dado;
- sistema fora do ar com perda de registro;
- envio de dado a quem não devia.

## 3. Roteiro técnico

1. **Detectar.** As fontes são:
   - alertas do Sentry e do Cérbero e a Sentinela do Hermes;
   - auditoria encadeada;
   - aviso de usuário, cliente ou fornecedor;
   - achado de auditoria.
2. **Conter, na primeira hora:**
   - trocar a chave ou senha exposta;
   - bloquear a conta ou o acesso;
   - tirar o arquivo do ar;
   - suspender a integração;
   - na camada da unidade, suspender a ferramenta.
3. **Preservar a evidência:**
   - copiar os registros (auditoria, Supabase, Vercel, VPS) para uma pasta do incidente;
   - não apagar nada que possa ser prova.
4. **Avaliar o risco,** em até 24 horas:
   - que dados e quantos titulares;
   - se havia dado de saúde;
   - se estava cifrado;
   - quem pode ter tido acesso;
   - que dano pode causar.
   Se puder causar risco ou dano relevante ao titular, o incidente é **comunicável**.
5. **Avisar** (item 4).
6. **Corrigir a causa,** com PR, teste e registro no BACKLOG.
7. **Registrar** (item 5) e fazer a revisão do caso em até 15 dias.

## 4. Avisos e prazos

| Para quem | Quando | Modelo |
|---|---|---|
| Cliente controlador | até **24 h** da confirmação (anexo de operador, item 7) | 4.1 |
| ANPD | pelo controlador, em até **3 dias úteis** do conhecimento, pelo formulário da ANPD. O Chefe Coruja só comunica direto quando o dado é dele, como o login dos profissionais | 4.2 |
| Titulares | pelo controlador, no mesmo prazo, em linguagem simples | 4.3 |

### 4.1. Aviso ao cliente (modelo)

> **Assunto:** Incidente de segurança na plataforma Chefe Coruja: [data]
>
> Em [data e hora], confirmamos [descrição curta].
> - **Dados envolvidos:** [tipos]; **titulares:** [número ou estimativa]; havia dado de saúde: [sim/não]; estava cifrado: [sim/não].
> - **Medidas tomadas:** [contenção].
> - **Próximos passos:** [correção e prazo].
>
> A comunicação à ANPD e aos titulares cabe a vocês, como controladores, em até 3 dias úteis (Resolução CD/ANPD 15/2024). Seguem as informações do formulário da ANPD já preenchidas por nós.
>
> Encarregado: [nome], encarregado@chefecoruja.com.br, [telefone].

### 4.2. Informações para o formulário da ANPD (roteiro)

- quem são o controlador e o encarregado;
- data da ciência e data do incidente;
- natureza: confidencialidade, integridade ou disponibilidade;
- categorias de dados e de titulares; número de titulares;
- consequências prováveis;
- medidas de segurança que existiam antes, medidas tomadas e medidas futuras;
- se os titulares foram avisados e como;
- motivo da demora, se passou do prazo.

### 4.3. Aviso ao titular (modelo)

> Informamos que, em [data], houve [descrição simples] envolvendo [seus dados de ...]. Já [medida]. Recomendamos [o que a pessoa pode fazer]. Dúvidas: [canal do encarregado do controlador].

## 5. Registro de incidentes

O registro guarda todos os incidentes, comunicáveis ou não, por **5 anos**. Ele fica em `docs/regulatorio/juridico/LG5-REGISTRO-INCIDENTES.md`, sem dado pessoal: só tipos e números.

## 6. Simulado anual

- **Frequência:** uma vez por ano, com registro do tempo de cada etapa e do que falhou.
- **Primeiro simulado:** pode usar o caso real do backup do VPS (entrada 1 do registro). Exercita a troca de chaves e o aviso ao cliente.

"""IA1 e IA2 da busca com IA (decisão do RT de 24/11/2026).

IA1, conversa de seguimento: a pergunta nova chega com as últimas trocas da
sessão (no máximo 2, já mascaradas pela Edge e pseudonimizadas de novo aqui).
A conversa serve só para entender a pergunta: a resposta continua só com os
TRECHOS da busca nova, citados com [n].

IA2, perguntas sugeridas: depois de uma resposta com fonte, até 3 próximas
perguntas curtas sobre o que a resposta não cobriu e os trechos tratam. São
perguntas, não conteúdo: clicar faz uma busca nova, com fonte, como qualquer
outra.

Sem dependências de fora: os testes rodam com `python -m unittest test_seguimento`.
"""
import json
import re

MAX_TROCAS = 2
MAX_SUGESTOES = 3
MAX_CARACTERES_SUGESTAO = 80

CITACAO = re.compile(r"\s*\[\d+(?:,\s*\d+)*\]")
PSEUDONIMO = re.compile(r"\[[A-Z]+(?:_\d+)?\]")
# dose ou dado do paciente na sugestão: a linha sai (nome de escore com número fica)
QUANTIDADE = re.compile(r"\d+(?:[,.]\d+)?\s*(?:mg|ml|mcg|µg|ui|meq|mmol|g|kg|j|joules?|anos?|meses|dias)\b", re.I)


def sem_citacoes(texto: str) -> str:
    """Os [n] da resposta anterior eram dos trechos daquela busca: saem."""
    return CITACAO.sub("", texto or "")


def ultimas(historico: list) -> list:
    """As últimas trocas, no máximo MAX_TROCAS, só com pergunta."""
    return [t for t in (historico or []) if (t.get("pergunta") or "").strip()][-MAX_TROCAS:]


def pergunta_de_busca(q: str, historico: list) -> str:
    """Texto da busca no seguimento: a pergunta anterior completa a atual
    ("e na criança?" sozinha não acha nada). Sem histórico, a própria pergunta."""
    trocas = ultimas(historico)
    if not trocas:
        return q
    return f"{trocas[-1]['pergunta'].strip()} {q}".strip()


def para_reescrita(q: str, historico: list) -> str:
    """Entrada da reescrita (R2-12) no seguimento: a anterior como contexto."""
    trocas = ultimas(historico)
    if not trocas:
        return q
    anteriores = "\n".join(f"- {t['pergunta'].strip()}" for t in trocas)
    return f"Perguntas anteriores (contexto):\n{anteriores}\nPergunta atual (escreva os termos desta): {q}"


def bloco_da_conversa(historico: list) -> str:
    """Conversa anterior para o pedido ao modelo; vazio sem histórico."""
    trocas = ultimas(historico)
    if not trocas:
        return ""
    partes = []
    for t in trocas:
        partes.append(f"Pergunta: {t['pergunta'].strip()}")
        resposta = sem_citacoes(t.get("resposta") or "").strip()
        if resposta:
            partes.append(f"Resposta dada: {resposta}")
    return ("CONVERSA ANTERIOR (só para entender a pergunta atual; não é fonte, não cite nem repita o que já foi dito):\n"
            + "\n".join(partes) + "\n\n")


LEMBRETE_SEGUIMENTO = (" Esta pergunta continua a CONVERSA ANTERIOR: use a conversa só para entender o que se pergunta;"
                       " responda só com os TRECHOS desta busca, com [n], e não repita o que a resposta anterior já disse.")


SYSTEM_SUGESTOES = """Você sugere as próximas perguntas de um médico de pronto-socorro depois de uma resposta clínica.
Regras:
1. Escreva até 3 perguntas curtas (no máximo 8 palavras cada), uma por linha, sem número, marcador ou aspas.
2. Cada pergunta trata de algo que a RESPOSTA não cobriu e que os TRECHOS tratam (ex.: depois de "dose de ataque de amiodarona na FA com instabilidade": "Carga da cardioversão sincronizada", "Dose na FA estável", "Interação com anticoagulante").
3. Não repita a pergunta nem o que a resposta já disse. Não escreva dose, número, nome de pessoa nem dado do paciente.
4. Se os trechos não trazem nada além do que foi respondido, escreva só: NENHUMA"""


def pedido_sugestoes(q: str, resposta: str, trechos: list) -> str:
    """Mensagem do usuário para as sugestões: pergunta, resposta e de onde vêm os trechos
    (título, seção e o começo do texto, para não sugerir o que o material não traz)."""
    linhas = []
    for i, p in enumerate(trechos):
        pl = p.payload if hasattr(p, "payload") else p
        texto = re.sub(r"\s+", " ", pl.get("texto") or "")[:300]
        linhas.append(f"[{i + 1}] {pl.get('titulo', '')}, {pl.get('secao') or 'sem seção'}: {texto}")
    return (f"PERGUNTA: {q}\n\nRESPOSTA:\n{sem_citacoes(resposta)[:2500]}\n\n"
            "TRECHOS:\n" + "\n".join(linhas))


def ler_sugestoes(texto: str, q: str = "") -> list[str]:
    """Até 3 perguntas limpas a partir do texto do modelo. Linha com dose,
    pseudônimo ou longa demais sai; "NENHUMA" devolve lista vazia."""
    if not texto or texto.strip().upper().startswith("NENHUMA"):
        return []
    vistas = {re.sub(r"\W+", " ", q).strip().lower()} if q else set()
    itens: list[str] = []
    for linha in texto.splitlines():
        s = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", linha).strip().strip('"“”\'').strip()
        if not s or s.upper().startswith("NENHUMA"):
            continue
        if PSEUDONIMO.search(s) or QUANTIDADE.search(s) or len(s) > MAX_CARACTERES_SUGESTAO:
            continue
        chave = re.sub(r"\W+", " ", s).strip().lower()
        if chave in vistas:
            continue
        vistas.add(chave)
        itens.append(s[0].upper() + s[1:])
        if len(itens) == MAX_SUGESTOES:
            break
    return itens


def evento(itens: list[str]) -> str | None:
    """Linha do stream com as sugestões; None sem nenhuma."""
    if not itens:
        return None
    return json.dumps({"type": "sugestoes", "itens": itens}, ensure_ascii=False) + "\n"

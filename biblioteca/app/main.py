"""API "biblioteca": busca híbrida (denso + lexical) nas fontes licenciadas e nas
ferramentas da Central, e resposta com citação [n] via DeepSeek. O modelo não
calcula (R3); a pergunta chega pseudonimizada (R5) e é pseudonimizada de novo."""
import json
import logging
import os
import re
import time
import unicodedata

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient, models

from pii import pseudonimizar
from siglas import expandir_siglas

E = os.environ
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
qd = QdrantClient(url=E["QDRANT_URL"], timeout=30)
llm = OpenAI(api_key=E["DEEPSEEK_API_KEY"], base_url=E["DEEPSEEK_BASE_URL"])
logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("biblioteca")
# Gate em dois níveis (evals de 28/09): quando algum trecho do topo contém uma
# palavra-chave da pergunta, basta GATE_MIN_SCORE; sem nenhuma palavra em comum
# (ex.: "configurar o wifi" caindo em trecho clínico com 0,52) exige-se mais.
GATE_MIN = float(E.get("GATE_MIN_SCORE", 0.50))
GATE_SEM_LEXICO = float(E.get("GATE_MIN_SEM_LEXICO", 0.58))
TOP_K = int(E.get("TOP_K", 6))
MODELO = E.get("DEEPSEEK_MODEL", "deepseek-v4-flash")
MAX_TOKENS = int(E.get("LLM_MAX_TOKENS", 3000))
# parâmetros extras do provedor (JSON), ex.: {"thinking": {"type": "disabled"}}
EXTRA_LLM = json.loads(E.get("LLM_EXTRA_BODY", "{}") or "{}")

STOP = set("""a o os as um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre e ou que qual quais
como quando onde quanto quantos qual é são ser está estão foi ao aos à às se não sim mais menos muito pouco já ainda
paciente pacientes caso casos conduta manejo tratamento dose doses qual devo posso fazer usar uso deve pode anos ano
meses idade kg peso""".split())


class Req(BaseModel):
    q: str = Field(min_length=2, max_length=800)
    tenant_id: str = Field(min_length=1, max_length=64)
    request_id: str = Field(min_length=1, max_length=80)


def auth(h: str | None):
    if not h or h != f"Bearer {E['BIBLIOTECA_API_KEY']}":
        raise HTTPException(401)


def embed(t: str) -> list[float]:
    r = httpx.post(f"{E['OLLAMA_URL']}/api/embed", json={"model": E["EMBED_MODEL"], "input": [t]}, timeout=60)
    r.raise_for_status()
    return r.json()["embeddings"][0]


def sem_acento(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def palavras_chave(q: str) -> list[str]:
    toks = re.findall(r"[a-zA-ZÀ-ÿ0-9][\w\-]{2,}", q)
    out: list[str] = []
    for t in toks:
        tl = t.lower()
        if tl in STOP or sem_acento(tl) in STOP or len(tl) < 3:
            continue
        if tl not in out:
            out.append(tl)
    return out[:8]


def filtro_tenant(tid: str) -> models.Filter:
    return models.Filter(should=[
        models.FieldCondition(key="tenant_id", match=models.MatchValue(value="global")),
        models.FieldCondition(key="tenant_id", match=models.MatchValue(value=tid))])


def buscar(q: str, tid: str):
    v = embed(q)
    tools = qd.query_points("ferramentas", query=v, limit=5, with_payload=True).points
    n = TOP_K * 4
    densos = qd.query_points("biblioteca", query=v, limit=n, query_filter=filtro_tenant(tid), with_payload=True).points
    chaves = palavras_chave(q)
    lex = []
    if chaves:
        f = models.Filter(
            must=[models.Filter(should=[models.FieldCondition(key="texto", match=models.MatchText(text=c)) for c in chaves])],
            should=filtro_tenant(tid).should)
        lex = qd.scroll("biblioteca", limit=n, with_payload=True, scroll_filter=f)[0]
    # fusão: RRF do denso + cobertura das palavras-chave no texto
    por_id, score = {}, {}
    for rank, p in enumerate(densos):
        por_id[p.id] = p
        score[p.id] = score.get(p.id, 0) + 1 / (60 + rank) + max(p.score - 0.4, 0) * 0.05
    for p in lex:
        por_id.setdefault(p.id, p)
    for pid, p in por_id.items():
        txt = sem_acento(p.payload["texto"])
        cobertura = sum(1 for c in chaves if sem_acento(c) in txt) / (len(chaves) or 1)
        score[pid] = score.get(pid, 0) + cobertura * 0.02
    ordem = sorted(score, key=score.get, reverse=True)
    # no máximo 3 trechos da mesma fonte, para diversificar
    trechos, por_fonte = [], {}
    for pid in ordem:
        p = por_id[pid]
        fid = p.payload["fonte_id"]
        if por_fonte.get(fid, 0) >= 3:
            continue
        por_fonte[fid] = por_fonte.get(fid, 0) + 1
        trechos.append(p)
        if len(trechos) >= TOP_K:
            break
    melhor = densos[0].score if densos else 0.0
    # cobertura lexical do topo denso: alguma palavra-chave da pergunta aparece?
    topo = " ".join(sem_acento(p.payload["texto"]) for p in densos[:3])
    com_lexico = any(sem_acento(c) in topo for c in chaves) if chaves else False
    return tools, trechos, melhor, com_lexico


def passa_gate(melhor: float, com_lexico: bool, trechos: list) -> bool:
    if not trechos:
        return False
    return melhor >= (GATE_MIN if com_lexico else GATE_SEM_LEXICO)


def fmt_tool(p):
    return {k: p.payload.get(k) for k in ("id", "nome", "tipo", "categoria", "rota")} | {"score": round(p.score, 3)}


def fmt_src(i, p):
    pl = p.payload
    return {"n": i + 1, "titulo": pl["titulo"], "editor": pl["editor"], "ano": pl["ano"], "secao": pl.get("secao") or "",
            "pagina": pl.get("pagina"), "ref": pl.get("ref") or None, "url": pl.get("url"), "licenca": pl.get("licenca")}


def local(p) -> str:
    pl = p.payload
    if pl.get("pagina"):
        return f"p. {pl['pagina']}"
    return pl.get("ref") or "sem página"


@app.get("/health")
def health():
    try:
        n = qd.get_collection("biblioteca").points_count
    except Exception:
        n = None
    return {"ok": True, "chunks": n, "modelo": MODELO}


@app.post("/v1/search")
def search(r: Req, authorization: str | None = Header(None)):
    auth(authorization)
    q = expandir_siglas(pseudonimizar(r.q))
    tools, trechos, melhor, _ = buscar(q, r.tenant_id)
    return {"request_id": r.request_id, "melhor_score": round(melhor, 3),
            "ferramentas": [fmt_tool(t) for t in tools if t.score > 0.45],
            "trechos": [fmt_src(i, p) | {"preview": p.payload["texto"][:240]} for i, p in enumerate(trechos)]}


SYSTEM = """Você é um assistente de suporte à decisão clínica para médicos plantonistas de UPA e pronto-socorro no Brasil.
Regras obrigatórias:
1. Responda SOMENTE com base nos TRECHOS fornecidos. Não use conhecimento externo. Não complete lacunas com o que você "sabe".
2. Cite cada afirmação com [n], onde n é o número do trecho. Toda frase com dado clínico precisa de citação.
3. Se os trechos não cobrem a pergunta, diga exatamente: "Não encontrei isso no material de referência." e pare.
4. Nunca calcule doses, volumes, velocidades de infusão ou escores para um paciente específico. Se a pergunta trouxer peso, idade ou valores do paciente, NÃO multiplique nem some: responda só com a dose de referência do trecho (por kg, por dose) e a apresentação, e indique a ferramenta da Central para o cálculo, se houver na lista FERRAMENTAS.
5. Pediatria: só afirme algo para criança se o trecho for explicitamente pediátrico. Nunca converta dado de adulto para criança.
6. Formato: resposta direta primeiro; depois tópicos curtos (avaliação, conduta, sinais de alarme) quando aplicável. Português do Brasil, linguagem técnica médica, sem floreios.
7. Você dá suporte; a decisão é do médico assistente. Não escreva avisos de responsabilidade: o sistema já mostra."""


@app.post("/v1/ask")
def ask(r: Req, authorization: str | None = Header(None)):
    auth(authorization)
    t0 = time.time()
    # siglas expandidas ("icc" → "icc (insuficiência cardíaca congestiva)"):
    # sem isso a similaridade da pergunta curta com os trechos fica abaixo do gate
    q = expandir_siglas(pseudonimizar(r.q))
    tools, trechos, melhor, com_lexico = buscar(q, r.tenant_id)
    fontes = [fmt_src(i, p) for i, p in enumerate(trechos)]
    gate_ok = passa_gate(melhor, com_lexico, trechos)
    ferramentas = [fmt_tool(t) for t in tools if t.score > 0.5]
    tem_peso = bool(re.search(r"\d+[,.]?\d*\s*(kg|quilos?|anos?|meses)\b", q, re.I))

    def gerar():
        yield json.dumps({"type": "meta", "request_id": r.request_id, "gate": gate_ok, "melhor_score": round(melhor, 3),
                          "ferramentas": ferramentas, "fontes": fontes if gate_ok else []}, ensure_ascii=False) + "\n"
        if not gate_ok:
            yield json.dumps({"type": "delta", "text": "Não encontrei isso no material de referência."}, ensure_ascii=False) + "\n"
            yield json.dumps({"type": "done", "citacoes_invalidas": [], "sem_citacao": False}) + "\n"
            log.info(json.dumps({"rid": r.request_id, "tenant": r.tenant_id, "gate": False, "top": round(melhor, 3),
                                 "ms": int((time.time() - t0) * 1000)}))
            return
        contexto = "\n\n".join(
            f"[{i + 1}] ({p.payload['titulo']}, {p.payload.get('secao') or 'sem seção'}, {local(p)})\n{p.payload['texto']}"
            for i, p in enumerate(trechos))
        lista_tools = "\n".join(f"- {t['nome']} ({t['rota']})" for t in ferramentas) or "- nenhuma"
        lembrete = "\n\nLembrete: cada afirmação clínica termina com a citação [n] do trecho."
        if tem_peso:
            lembrete += " A pergunta traz dados do paciente: NÃO calcule a dose para ele; dê só a dose de referência por kg e aponte a ferramenta."
        texto = ""
        try:
            # max_tokens alto: em modelo com "raciocínio" os tokens de pensamento
            # contam no limite e um limite curto devolvia resposta vazia (evals 28/09).
            stream = llm.chat.completions.create(
                model=MODELO, temperature=0.1, stream=True, max_tokens=MAX_TOKENS, extra_body=EXTRA_LLM,
                messages=[{"role": "system", "content": SYSTEM},
                          {"role": "user", "content": f"TRECHOS:\n{contexto}\n\nFERRAMENTAS DA CENTRAL:\n{lista_tools}\n\nPERGUNTA: {q}{lembrete}"}])
            for ch in stream:
                d = (ch.choices[0].delta.content or "") if ch.choices else ""
                if d:
                    texto += d
                    yield json.dumps({"type": "delta", "text": d}, ensure_ascii=False) + "\n"
        except Exception as e:  # modelo fora do ar: o cliente mostra "IA indisponível"
            log.error(json.dumps({"rid": r.request_id, "erro": type(e).__name__}))
            yield json.dumps({"type": "error", "text": "IA indisponível no momento."}, ensure_ascii=False) + "\n"
            return
        if not texto.strip():
            log.error(json.dumps({"rid": r.request_id, "erro": "resposta_vazia"}))
            yield json.dumps({"type": "error", "text": "O modelo não devolveu texto. Tente reformular a pergunta."}, ensure_ascii=False) + "\n"
            return
        citadas = {int(n) for n in re.findall(r"\[(\d+)\]", texto)}
        invalidas = sorted(n for n in citadas if n < 1 or n > len(trechos))
        nao_encontrou = "Não encontrei isso no material de referência" in texto
        # pós-checagem R3: com dados do paciente na pergunta, uma quantidade na
        # resposta que não existe em nenhum trecho sugere cálculo feito pelo modelo
        calculo_suspeito = False
        if tem_peso:
            base = re.sub(r"\s+", "", " ".join(p.payload["texto"] for p in trechos)).lower()
            for qtd in re.findall(r"\d+(?:[,.]\d+)?\s*(?:mg|ml|mcg|µg|ui|meq|mmol|g)\b", texto, re.I):
                if re.sub(r"\s+", "", qtd).lower() not in base:
                    calculo_suspeito = True
                    break
        yield json.dumps({"type": "done", "citacoes_invalidas": invalidas,
                          "sem_citacao": (not citadas) and (not nao_encontrou),
                          "calculo_suspeito": calculo_suspeito}) + "\n"
        log.info(json.dumps({"rid": r.request_id, "tenant": r.tenant_id, "gate": True, "top": round(melhor, 3),
                             "fontes": [f["titulo"] for f in fontes], "ms": int((time.time() - t0) * 1000)}, ensure_ascii=False))

    return StreamingResponse(gerar(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})

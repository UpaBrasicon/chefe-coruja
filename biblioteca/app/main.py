"""API "biblioteca": busca híbrida (denso + lexical) nas fontes licenciadas e nas
ferramentas da Central, e resposta com citação [n] via DeepSeek. O modelo não
calcula (R3); a pergunta chega pseudonimizada (R5) e é pseudonimizada de novo."""
import json
import threading
from collections import OrderedDict
import logging
import os
import re
import time
import unicodedata
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel, Field
from qdrant_client import QdrantClient, models

from armadilhas import RESPOSTA as RESPOSTA_ARMADILHA, armadilha
from pii import pseudonimizar, nomes_proprios, ner_disponivel
from publico import ADULTO, AMBOS, MSG_SEM_PEDIATRIA, PED, Fontes, ferramenta_serve, publico_com_termos, publico_da_pergunta
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
# público de cada fonte (fontes.yaml + cabeçalho das fichas): R2-13
FONTES = Fontes(Path(E.get("BIBLIOTECA_DIR", "/srv/biblioteca")))
NAO_ENCONTREI = "Não encontrei isso no material de referência."
# coleção dos trechos: a homologação usa uma cópia (biblioteca_homolog), para
# reingerir o corpus sem mexer no que a produção lê (Portão 2, tarefa 1b)
COLECAO = E.get("BIBLIOTECA_COLECAO", "biblioteca")
# corte de semelhança para sugerir ferramenta (R2-15): só com material achado
FERRAMENTA_MIN = float(E.get("FERRAMENTA_MIN_SCORE", 0.55))
# R2-12: a pergunta que descreve o paciente é reescrita nos termos do manual
# antes da busca; a busca usa a original e a reescrita. REESCRITA=0 desliga.
REESCRITA = E.get("REESCRITA", "1") != "0"
REESCRITA_TIMEOUT_S = float(E.get("REESCRITA_TIMEOUT_S", 8))
REESCRITA_MAX_TOKENS = int(E.get("REESCRITA_MAX_TOKENS", 600))

STOP = set("""a o os as um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre e ou que qual quais
como quando onde quanto quantos qual é são ser está estão foi ao aos à às se não sim mais menos muito pouco já ainda
paciente pacientes caso casos conduta manejo tratamento dose doses qual devo posso fazer usar uso deve pode anos ano
meses idade kg peso""".split())


class Req(BaseModel):
    q: str = Field(min_length=2, max_length=800)
    tenant_id: str = Field(min_length=1, max_length=64)
    request_id: str = Field(min_length=1, max_length=80)
    # modo do paciente na tela da Central; o texto da pergunta também conta
    publico: Literal["adulto", "pediatrico"] | None = None


def auth(h: str | None):
    if not h or h != f"Bearer {E['BIBLIOTECA_API_KEY']}":
        raise HTTPException(401)


def embed(t: str) -> list[float]:
    # keep_alive: sem ele o Ollama descarrega o modelo após 5 min parado e a
    # próxima pergunta espera a recarga (5–15 s no CPU do VPS)
    r = httpx.post(f"{E['OLLAMA_URL']}/api/embed",
                   json={"model": E["EMBED_MODEL"], "input": [t], "keep_alive": E.get("OLLAMA_KEEP_ALIVE", "24h")},
                   timeout=60)
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


def filtro_publico(publico: str) -> tuple[list, list] | None:
    """(must, must_not) por fonte. Criança: só fontes pediátricas ou gerais;
    adulto: tudo menos as só pediátricas. None = não há fonte para a criança."""
    if publico == PED:
        ids = FONTES.ids({PED, AMBOS})
        if not ids:
            return None
        return [models.FieldCondition(key="fonte_id", match=models.MatchAny(any=ids))], []
    so_ped = FONTES.ids({PED})
    return [], ([models.FieldCondition(key="fonte_id", match=models.MatchAny(any=so_ped))] if so_ped else [])


SYSTEM_REESCRITA = """Você recebe a pergunta de um médico de pronto-socorro sobre um paciente. Escreva os termos que um manual de emergência usaria no título do capítulo ou da seção que responde a ela: diagnóstico ou síndrome provável, intoxicação e classe do medicamento envolvido, procedimento ou escore. Comece pelo nome geral do quadro (ex.: "intoxicação exógena aguda", "politrauma, atendimento inicial", "emergência hipertensiva na gestação") e depois o específico. Escreva "criança" só quando a pergunta falar de criança ou quando a doença for própria da criança (ex.: bronquiolite, invaginação intestinal, doença de Kawasaki); escreva "adulto" ou "gestante" quando a pergunta indicar; se servir para qualquer idade, não escreva faixa etária.
Não responda à pergunta. Não dê dose, conduta nem número. Não invente dado que a pergunta não traz.
A pergunta pode ter erro de digitação ou abreviação ("anafilaxa", "hipocalemia" escrita "ipocalemia"): escreva os termos corretos.
Escreva só os termos, separados por vírgula, em até 25 palavras. Se a pergunta não for clínica, escreva só: FORA"""

_reescritas: "OrderedDict[str, str | None]" = OrderedDict()
_reescritas_trava = threading.Lock()


def reescrever(q: str) -> str | None:
    """Termos de manual para a pergunta (R2-12). None: desligada, fora do escopo
    ou o modelo não respondeu a tempo (a busca segue só com a pergunta)."""
    if not REESCRITA:
        return None
    chave = re.sub(r"\s+", " ", sem_acento(q)).strip(" ?!.")
    with _reescritas_trava:
        if chave in _reescritas:
            _reescritas.move_to_end(chave)
            return _reescritas[chave]
    try:
        r = llm.with_options(timeout=REESCRITA_TIMEOUT_S, max_retries=0).chat.completions.create(
            model=MODELO, temperature=0, max_tokens=REESCRITA_MAX_TOKENS, extra_body=EXTRA_LLM,
            messages=[{"role": "system", "content": SYSTEM_REESCRITA}, {"role": "user", "content": q}])
        t = re.sub(r"\s+", " ", (r.choices[0].message.content or "")).strip()
    except Exception as e:  # noqa: BLE001 — sem reescrita a busca continua
        log.warning(json.dumps({"reescrita": type(e).__name__}))
        return None
    termos = None if not t or t.upper().startswith("FORA") else t[:300]
    with _reescritas_trava:
        _reescritas[chave] = termos
        while len(_reescritas) > CACHE_MAX:
            _reescritas.popitem(last=False)
    return termos


def buscar(q: str, tid: str, publico: str = ADULTO, termos: str | None = None):
    """Trechos para a pergunta. `termos` (a reescrita) entra como segunda
    consulta: densa e lexical, fundidas com a da pergunta original."""
    vetores = [embed(q)] + ([embed(termos)] if termos else [])
    melhores_tools: dict = {}
    for v in vetores:
        for t in qd.query_points("ferramentas", query=v, limit=12, with_payload=True).points:
            k = t.payload.get("id") or t.payload.get("nome")
            if ferramenta_serve(t.payload, publico) and (k not in melhores_tools or t.score > melhores_tools[k].score):
                melhores_tools[k] = t
    tools = sorted(melhores_tools.values(), key=lambda t: t.score, reverse=True)[:5]
    pf = filtro_publico(publico)
    if pf is None:
        return tools, [], 0.0, False
    must_pub, must_not_pub = pf
    n = TOP_K * 4
    filtro = models.Filter(must=[models.Filter(should=filtro_tenant(tid).should), *must_pub], must_not=must_not_pub)
    listas = [qd.query_points(COLECAO, query=v, limit=n, query_filter=filtro, with_payload=True).points for v in vetores]
    densos = listas[0]
    chaves = palavras_chave(q)
    for c in (palavras_chave(termos) if termos else []):
        if c not in chaves:
            chaves.append(c)
    chaves = chaves[:12]
    lex = []
    if chaves:
        f = models.Filter(
            must=[models.Filter(should=[models.FieldCondition(key="texto", match=models.MatchText(text=c)) for c in chaves]),
                  models.Filter(should=filtro_tenant(tid).should), *must_pub],
            must_not=must_not_pub)
        lex = qd.scroll(COLECAO, limit=n, with_payload=True, scroll_filter=f)[0]
    # fusão: RRF de cada lista densa + cobertura das palavras-chave no texto
    por_id, score = {}, {}
    for lista in listas:
        for rank, p in enumerate(lista):
            por_id.setdefault(p.id, p)
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
    melhor = max((lista[0].score for lista in listas if lista), default=0.0)
    # cobertura lexical do topo denso: alguma palavra-chave da pergunta aparece?
    topo = " ".join(sem_acento(p.payload["texto"]) for lista in listas for p in lista[:3])
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
        n = qd.get_collection(COLECAO).points_count
    except Exception:
        n = None
    return {"ok": True, "chunks": n, "modelo": MODELO}


class DeidReq(BaseModel):
    texto: str = Field(min_length=1, max_length=8000)


@app.on_event("startup")
def _aquecer():
    # carrega o modelo de busca já na subida, fora da primeira pergunta
    threading.Thread(target=lambda: _tentar(lambda: embed("aquecimento")), daemon=True).start()


def _tentar(f):
    try:
        f()
    except Exception as e:  # noqa: BLE001 — aquecimento é melhor esforço
        log.warning(json.dumps({"aquecimento": type(e).__name__}))


# ── Respostas recentes ────────────────────────────────────────────────────────
# A mesma pergunta (já sem dado pessoal e com siglas expandidas) nas mesmas
# fontes volta na hora, por até CACHE_TTL_S (padrão 6 h). Não guarda pergunta
# com dado do paciente (peso/idade), resposta com erro nem "não encontrei".
CACHE_TTL_S = int(E.get("CACHE_TTL_S", "21600"))
CACHE_MAX = int(E.get("CACHE_MAX", "200"))
_cache: "OrderedDict[tuple, tuple[float, list[str]]]" = OrderedDict()
_cache_trava = threading.Lock()


def _chave_cache(tenant: str, q: str) -> tuple:
    return (tenant, re.sub(r"\s+", " ", sem_acento(q)).strip(" ?!.").lower())


def cache_ler(chave: tuple) -> list[str] | None:
    with _cache_trava:
        item = _cache.get(chave)
        if not item:
            return None
        quando, linhas = item
        if time.time() - quando > CACHE_TTL_S:
            _cache.pop(chave, None)
            return None
        _cache.move_to_end(chave)
        return linhas


def cache_gravar(chave: tuple, linhas: list[str]) -> None:
    with _cache_trava:
        _cache[chave] = (time.time(), linhas)
        _cache.move_to_end(chave)
        while len(_cache) > CACHE_MAX:
            _cache.popitem(last=False)


@app.post("/v1/deid")
def deid(r: DeidReq, authorization: str | None = Header(None)):
    """Desidentificação NER (red-team V5): os gateways (clinical-search, Hermes)
    chamam antes do egress. Retorna o texto mascarado e os nomes encontrados —
    `found` não-vazio = o chamador deve falhar fechado (não enviar à IA).
    Fail-safe: sem o modelo spaCy, `found` vem vazio e `texto` só com a regex."""
    auth(authorization)
    found = nomes_proprios(r.texto)
    return {"texto": pseudonimizar(r.texto), "found": found, "ner_ativo": ner_disponivel()}


@app.post("/v1/search")
def search(r: Req, authorization: str | None = Header(None)):
    auth(authorization)
    q = expandir_siglas(pseudonimizar(r.q))
    publico = publico_da_pergunta(q, r.publico)
    if armadilha(q):
        return {"request_id": r.request_id, "melhor_score": 0.0, "publico": publico, "ferramentas": [], "trechos": []}
    tools, trechos, melhor, com_lexico = buscar(q, r.tenant_id, publico)
    # R2-15: "Sugestões por significado" só quando a busca acha material
    gate_ok = passa_gate(melhor, com_lexico, trechos)
    return {"request_id": r.request_id, "melhor_score": round(melhor, 3), "publico": publico,
            "ferramentas": [fmt_tool(t) for t in tools if t.score > FERRAMENTA_MIN] if gate_ok else [],
            "trechos": [fmt_src(i, p) | {"preview": p.payload["texto"][:240]} for i, p in enumerate(trechos)] if gate_ok else []}


SYSTEM = """Você é um assistente de suporte à decisão clínica para médicos plantonistas de UPA e pronto-socorro no Brasil.
Regras obrigatórias:
1. Responda SOMENTE com base nos TRECHOS fornecidos. Não use conhecimento externo. Não complete lacunas com o que você "sabe".
2. Cite cada afirmação com [n], onde n é o número do trecho. Toda frase com dado clínico precisa de citação.
3. Se nenhum trecho trata do assunto perguntado, diga exatamente: "Não encontrei isso no material de referência." e pare, sem acrescentar nada. Se a pergunta é ampla (só o nome da doença ou do escore) ou os trechos respondem só a uma parte, responda com o que os trechos trazem, sem essa frase, e diga em uma linha o que o material não traz. Se nenhum trecho fala do agente ou do detalhe específico, mas há trechos sobre o quadro geral (ex.: conduta geral na intoxicação exógena, atendimento inicial ao trauma, droga da emergência hipertensiva na gestação), responda com a conduta geral desses trechos e diga em uma linha que o material não traz o específico.
4. Nunca calcule doses, volumes, velocidades de infusão ou escores para um paciente específico. Se a pergunta trouxer peso, idade ou valores do paciente, NÃO multiplique nem some: responda só com a dose de referência do trecho (por kg, por dose) e a apresentação, e indique a ferramenta da Central para o cálculo, se houver na lista FERRAMENTAS.
5. Cada trecho traz o título e a seção de onde vem. Use só o trecho cuja seção trata da condição perguntada; não leve o dado de uma condição para outra (ex.: estado hiperosmolar não é cetoacidose).
6. Formato: resposta direta primeiro; depois tópicos curtos (avaliação, conduta, sinais de alarme) quando aplicável. Português do Brasil, linguagem técnica médica, sem floreios.
7. Você dá suporte; a decisão é do médico assistente. Não escreva avisos de responsabilidade: o sistema já mostra."""

# R2-18: a regra de pediatria só entra quando a pergunta é de criança
REGRA_PED = """
8. Pediatria: só afirme algo para criança se o trecho for explicitamente pediátrico. Nunca converta dado de adulto para criança. Se nenhum trecho pediátrico (ou de adulto e criança) trata do assunto, diga exatamente: "Não há referência pediátrica no material para esta pergunta." e pare. Se tratam de parte da pergunta, ou só do quadro geral (ex.: conduta geral na intoxicação exógena da criança, sem o agente específico), responda essa parte só com eles, sem essa frase, e diga em uma linha o que o material pediátrico não traz."""


def resposta_fixa(r: Req, publico: str, tipo: str, t0: float):
    """Armadilha (dose letal, dado pessoal, assinatura): resposta fixa, sem busca."""
    def gerar():
        yield json.dumps({"type": "meta", "request_id": r.request_id, "gate": True, "melhor_score": 0.0, "publico": publico,
                          "armadilha": tipo, "ferramentas": [], "fontes": []}, ensure_ascii=False) + "\n"
        yield json.dumps({"type": "delta", "text": RESPOSTA_ARMADILHA[tipo]}, ensure_ascii=False) + "\n"
        yield json.dumps({"type": "done", "citacoes_invalidas": [], "sem_citacao": False, "calculo_suspeito": False,
                          "nao_encontrou": False, "recusa": True}) + "\n"
        log.info(json.dumps({"rid": r.request_id, "tenant": r.tenant_id, "publico": publico, "armadilha": tipo,
                             "ms": int((time.time() - t0) * 1000)}))
    return StreamingResponse(gerar(), media_type="application/x-ndjson")


@app.post("/v1/ask")
def ask(r: Req, authorization: str | None = Header(None)):
    auth(authorization)
    t0 = time.time()
    # siglas expandidas ("icc" → "icc (insuficiência cardíaca congestiva)"):
    # sem isso a similaridade da pergunta curta com os trechos fica abaixo do gate
    # chave da memória pela pergunta já sem dado pessoal, antes de expandir siglas
    # ("icc" e "ICC?" expandem diferente e são a mesma pergunta)
    pq = pseudonimizar(r.q)
    q = expandir_siglas(pq)
    tem_peso = bool(re.search(r"\d+[,.]?\d*\s*(kg|quilos?|anos?|meses)\b", q, re.I))
    tipo = armadilha(q)
    if tipo:
        return resposta_fixa(r, publico_da_pergunta(q, r.publico), tipo, t0)
    termos = reescrever(q)
    t_reescrita = int((time.time() - t0) * 1000)
    # pergunta sem idade sobre doença da criança ("bronquiolite precisa de
    # corticoide"): os termos da reescrita levam à pediatria (avaliação de 14/10)
    publico = publico_com_termos(q, termos, r.publico)
    chave = _chave_cache(f"{r.tenant_id}|{publico}", pq)
    guardada = None if tem_peso else cache_ler(chave)
    if guardada is not None:
        def repetir():
            # o request_id da meta é o da pergunta atual
            primeira = json.loads(guardada[0]); primeira["request_id"] = r.request_id; primeira["cache"] = True
            yield json.dumps(primeira, ensure_ascii=False) + "\n"
            yield from guardada[1:]
            log.info(json.dumps({"rid": r.request_id, "tenant": r.tenant_id, "cache": True, "ms": int((time.time() - t0) * 1000)}))
        return StreamingResponse(repetir(), media_type="application/x-ndjson")
    tools, trechos, melhor, com_lexico = buscar(q, r.tenant_id, publico, termos)
    t_busca = int((time.time() - t0) * 1000)
    fontes = [fmt_src(i, p) for i, p in enumerate(trechos)]
    gate_ok = passa_gate(melhor, com_lexico, trechos)
    # R2-11: sem resposta, nenhuma ferramenta ou fonte sem relação na tela
    ferramentas = [fmt_tool(t) for t in tools if t.score > FERRAMENTA_MIN] if gate_ok else []
    sem_resposta = MSG_SEM_PEDIATRIA if publico == PED else NAO_ENCONTREI

    def gerar():
        linhas: list[str] = []
        t_primeiro = None
        meta = json.dumps({"type": "meta", "request_id": r.request_id, "gate": gate_ok, "melhor_score": round(melhor, 3),
                           "publico": publico, "termos": termos, "ferramentas": ferramentas, "fontes": fontes if gate_ok else []},
                          ensure_ascii=False) + "\n"
        linhas.append(meta)
        yield meta
        if not gate_ok:
            yield json.dumps({"type": "delta", "text": sem_resposta}, ensure_ascii=False) + "\n"
            yield json.dumps({"type": "done", "citacoes_invalidas": [], "sem_citacao": False, "nao_encontrou": True}) + "\n"
            log.info(json.dumps({"rid": r.request_id, "tenant": r.tenant_id, "publico": publico, "gate": False, "top": round(melhor, 3),
                                 "reescrita": termos is not None, "ms_reescrita": t_reescrita, "ms": int((time.time() - t0) * 1000)}))
            return
        mapa = FONTES.mapa()
        rotulo = {PED: "fonte pediátrica", AMBOS: "fonte adulto e criança", ADULTO: "fonte de adulto"}
        contexto = "\n\n".join(
            f"[{i + 1}] ({p.payload['titulo']}, {p.payload.get('secao') or 'sem seção'}, {local(p)}; "
            f"{rotulo[mapa.get(p.payload.get('fonte_id'), ADULTO)]})\n{p.payload['texto']}"
            for i, p in enumerate(trechos))
        lista_tools = "\n".join(f"- {t['nome']} ({t['rota']})" for t in ferramentas) or "- nenhuma"
        # a tela mostra só a frase quando a resposta começa por "Não encontrei" (R2-11);
        # resposta parcial que começava pela frase sumia (avaliação de 14/10/2026)
        lembrete = ("\n\nLembrete: cada afirmação clínica termina com a citação [n] do trecho."
                    " Se algum trecho responde a qualquer parte da pergunta, NÃO comece com"
                    f' "{NAO_ENCONTREI}": comece pela parte que o material traz.')
        if tem_peso:
            lembrete += " A pergunta traz dados do paciente: NÃO calcule a dose para ele; dê só a dose de referência por kg e aponte a ferramenta."
        if publico == PED:
            lembrete += (" A pergunta é de CRIANÇA (pediatria até 13 anos e 11 meses): use só o que o trecho afirma para criança;"
                         " em trecho de adulto e criança, só a parte pediátrica. Se nenhum trecho para criança tratar do assunto, diga exatamente:"
                         f' "{MSG_SEM_PEDIATRIA}" e pare; se tratarem de parte, responda essa parte.')
        texto = ""
        try:
            # max_tokens alto: em modelo com "raciocínio" os tokens de pensamento
            # contam no limite e um limite curto devolvia resposta vazia (evals 28/09).
            stream = llm.chat.completions.create(
                model=MODELO, temperature=0.1, stream=True, max_tokens=MAX_TOKENS, extra_body=EXTRA_LLM,
                messages=[{"role": "system", "content": SYSTEM + (REGRA_PED if publico == PED else "")},
                          {"role": "user", "content": f"TRECHOS:\n{contexto}\n\nFERRAMENTAS DA CENTRAL:\n{lista_tools}\n\nPERGUNTA: {q}{lembrete}"}])
            for ch in stream:
                d = (ch.choices[0].delta.content or "") if ch.choices else ""
                if d:
                    if t_primeiro is None:
                        t_primeiro = int((time.time() - t0) * 1000)
                    texto += d
                    linha = json.dumps({"type": "delta", "text": d}, ensure_ascii=False) + "\n"
                    linhas.append(linha)
                    yield linha
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
        nao_encontrou = NAO_ENCONTREI.rstrip(".") in texto or MSG_SEM_PEDIATRIA.rstrip(".") in texto
        # pós-checagem R3: com dados do paciente na pergunta, uma quantidade na
        # resposta que não existe em nenhum trecho sugere cálculo feito pelo modelo
        # R2-17: "não encontrei" não leva o alerta de cálculo (a tela mostra só a frase)
        calculo_suspeito = False
        if tem_peso and not nao_encontrou:
            base = re.sub(r"\s+", "", " ".join(p.payload["texto"] for p in trechos)).lower()
            for qtd in re.findall(r"\d+(?:[,.]\d+)?\s*(?:mg|ml|mcg|µg|ui|meq|mmol|g)\b", texto, re.I):
                if re.sub(r"\s+", "", qtd).lower() not in base:
                    calculo_suspeito = True
                    break
        fim = json.dumps({"type": "done", "citacoes_invalidas": invalidas,
                          "sem_citacao": (not citadas) and (not nao_encontrou),
                          "calculo_suspeito": calculo_suspeito, "nao_encontrou": nao_encontrou}) + "\n"
        linhas.append(fim)
        yield fim
        if not tem_peso and not nao_encontrou and not invalidas and not calculo_suspeito and citadas:
            cache_gravar(chave, linhas)
        log.info(json.dumps({"rid": r.request_id, "tenant": r.tenant_id, "publico": publico, "gate": True, "top": round(melhor, 3),
                             "fontes": [f["titulo"] for f in fontes], "reescrita": termos is not None, "ms_reescrita": t_reescrita, "ms_busca": t_busca, "ms_1o_trecho": t_primeiro,
                             "ms": int((time.time() - t0) * 1000)}, ensure_ascii=False))

    return StreamingResponse(gerar(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})

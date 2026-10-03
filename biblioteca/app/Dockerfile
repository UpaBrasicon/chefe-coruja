FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Modelo de nomes do NER (pii.py). Sem ele /v1/deid responde ner_ativo=false e o
# gateway do Hermes recusa toda conversa (falha fechada): tem de vir na imagem.
RUN python -m spacy download pt_core_news_sm && python -c "import spacy; spacy.load('pt_core_news_sm')"
COPY *.py ./
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8710", "--workers", "1"]

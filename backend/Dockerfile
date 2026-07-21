# sup-port FastAPI backend
FROM python:3.12-slim

# Uvicorn'un tampon yapmadan log basması ve pyc üretmemesi için.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=4000

WORKDIR /app

# Önce bağımlılıklar: kod değişince pip katmanı yeniden kurulmasın.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Kimlik bilgileri config.yaml yerine ortam değişkenlerinden gelir
# (MONGODB_URI, DB_NAME, JWT_SECRET). Bkz. app/config.py.
EXPOSE 4000

# PORT ortam değişkeni değişirse ona uy; shell formu genişletme için gerekli.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-4000}"]

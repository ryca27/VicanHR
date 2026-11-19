FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY config config
COPY todo todo
COPY attendance attendance
COPY manage.py .
ENV DJANGO_DEBUG=false
USER 65534
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8080}"]

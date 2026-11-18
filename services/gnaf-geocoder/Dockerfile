FROM python:3.12-slim
WORKDIR /app
COPY geocoder.py /app/geocoder.py
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 GNAF_DB=/data/gnaf.sqlite GNAF_HOST=0.0.0.0
USER 65534:65534
EXPOSE 8765
CMD ["python3", "/app/geocoder.py"]

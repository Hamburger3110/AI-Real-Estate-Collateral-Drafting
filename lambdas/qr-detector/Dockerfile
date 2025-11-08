FROM public.ecr.aws/lambda/python:3.11

# System deps for PDF to image (poppler)
RUN yum -y install poppler-utils && yum clean all

# Python deps
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt -t .

# App code
COPY app.py ${LAMBDA_TASK_ROOT}

CMD ["app.handler"]


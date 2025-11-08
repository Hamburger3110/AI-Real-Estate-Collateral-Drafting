FROM public.ecr.aws/lambda/python:3.10

# System deps
RUN yum -y install poppler-utils && yum clean all

# Python deps
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
RUN pip3 install --upgrade pip

# Install CPU wheels for torch/vision first to avoid compiling
RUN pip3 install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.2.2 torchvision==0.17.2 -t .

# Then install remaining requirements (without torch/vision lines)
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt -t .

# App code
COPY index.py ${LAMBDA_TASK_ROOT}

CMD ["index.handler"]


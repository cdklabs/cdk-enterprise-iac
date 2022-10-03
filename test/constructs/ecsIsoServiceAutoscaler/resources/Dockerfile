FROM public.ecr.aws/lambda/python:3.7

# add everything to /opt/awscli (this is where `aws` is executed from)
ADD . ${LAMBDA_TASK_ROOT}

# install boto3, which is available on Lambda, and pytest
RUN pip3 install boto3 pytest

# run tests
WORKDIR ${LAMBDA_TASK_ROOT}
RUN ["pytest"]

ENTRYPOINT [ "/bin/bash" ]


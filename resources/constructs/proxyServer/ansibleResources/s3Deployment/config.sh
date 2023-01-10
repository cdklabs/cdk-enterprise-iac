#!/bin/bash
REGION=`curl http://169.254.169.254/latest/dynamic/instance-identity/document|grep region|awk -F\" '{print $4}'`
echo $REGION
sed -i  "s/REPLACE_REGION/$REGION/" /opt/aws/ansible-playbook-proxy/group_vars/all.yml
sed -i  "s/REPLACE_REGION/$REGION/" /opt/aws/ansible-playbook-proxy/roles/ansible-role-cloudwatch/defaults/main.yaml
sed -i  "s/REPLACE_REGION/$REGION/" /opt/aws/ansible-playbook-proxy/roles/ansible-role-squid/defaults/main.yaml

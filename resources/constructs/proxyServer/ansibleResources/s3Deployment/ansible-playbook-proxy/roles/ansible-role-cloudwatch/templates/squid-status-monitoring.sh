#!/bin/bash
#
# restarts the squid service upon failure and sends SNS notification
#
###
## Defining SNS ARN
region=`curl --silent http://169.254.169.254/latest/dynamic/instance-identity/document | grep region | cut -f 4 -d '"'`
if ! systemctl is-active --quiet squid;
then
  aws sns publish --topic-arn {{ squid_cloudwatch.sns_topic_arn }} --message "Squid proxy went down and is being restarted" --region $region || echo "SNS notification failed!"
  systemctl stop squid
  systemctl start squid
fi

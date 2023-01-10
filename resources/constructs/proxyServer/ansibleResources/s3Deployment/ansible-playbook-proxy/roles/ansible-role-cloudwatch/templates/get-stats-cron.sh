#!/bin/bash
#
# Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0#
#
# gets statistics from squid proxy and pushes them to CloudWatch
#
###
region=`curl --silent http://169.254.169.254/latest/dynamic/instance-identity/document | grep region | cut -f 4 -d '"'`
instanceId=`curl --silent http://169.254.169.254/latest/meta-data/instance-id`

squidclient -h localhost cache_object://localhost/ mgr:5min | grep "client_http.request\|client_http.hits\|client_http.errors\|client_http.kbytes_in\|client_http.kbytes_out\|server.all." | while read line ; do
    name=`echo $line | cut -d "=" -f 1 | xargs`
    value=`echo $line | cut -d "=" -f 2 | sed "s/[^0-9\.]*//g" `
    aws cloudwatch put-metric-data --metric-name "$name" --namespace Proxy --dimensions Proxy="{{squid_cloudwatch.proxy_dimension}}" --value "$value"  --region $region
done

import datetime
from typing import Any, Dict

import pytest
from dateutil.tz import tzlocal, tzutc


@pytest.fixture
def boto3_ecs_service_response(request) -> Dict[str, Any]:
    try:
        time_diff = request.param
    except:
        time_diff = 300

    return {
        "services": [
            {
                "serviceArn": "arn:aws:ecs:us-east-1:123456789012:service/Infra-Cluster535D1A46-2okCNvnaxoaU/Task-Service292C7250-9ncKQXCQxd5E",
                "serviceName": "Task-Service292C7250-9ncKQXCQxd5E",
                "clusterArn": "arn:aws:ecs:us-east-1:123456789012:cluster/Infra-Cluster535D1A46-2okCNvnaxoaU",
                "loadBalancers": [],
                "serviceRegistries": [],
                "status": "ACTIVE",
                "desiredCount": 3,
                "runningCount": 3,
                "pendingCount": 0,
                "launchType": "EC2",
                "taskDefinition": "arn:aws:ecs:us-east-1:123456789012:task-definition/TaskTaskDefinition0707ECB5:8",
                "deploymentConfiguration": {
                    "deploymentCircuitBreaker": {
                        "enable": False,
                        "rollback": False
                    },
                    "maximumPercent": 200,
                    "minimumHealthyPercent": 50
                },
                "deployments": [
                    {
                        "id": "ecs-svc/3665271676139587657",
                        "status": "PRIMARY",
                        "taskDefinition": "arn:aws:ecs:us-east-1:123456789012:task-definition/TaskTaskDefinition0707ECB5:8",
                        "desiredCount": 3,
                        "pendingCount": 0,
                        "runningCount": 3,
                        "failedTasks": 0,
                        "createdAt": datetime.datetime(2022, 4, 15, 11, 0, 32, 707000, tzinfo=tzlocal()),
                        "updatedAt": datetime.datetime.now(tz=tzlocal()) - datetime.timedelta(seconds=time_diff),
                        "launchType": "EC2",
                        "rolloutState": "COMPLETED",
                        "rolloutStateReason": "ECS deployment ecs-svc/3665271676139587657 completed."
                    }
                ],
                "events": [
                    {
                        "id": "b1dc4b42-5562-471e-93d0-e4683e18b5b3",
                        "createdAt": datetime.datetime(2022, 4, 21, 4, 0, 17, 762000, tzinfo=tzlocal()),
                        "message": "(service Task-Service292C7250-9ncKQXCQxd5E) has reached a steady state."
                    },
                ],
                "createdAt": datetime.datetime(2022, 4, 15, 11, 0, 32, 707000, tzinfo=tzlocal()),
                "placementConstraints": [],
                "placementStrategy": [],
                "schedulingStrategy": "REPLICA",
                "createdBy": "arn:aws:iam::123456789012:role/cdk-hnb659fds-cfn-exec-role-123456789012-us-east-1",
                "enableECSManagedTags": False,
                "propagateTags": "NONE",
                "enableExecuteCommand": False
            }
        ],
        "failures": [],
        "ResponseMetadata":
        {
            "RequestId": "fb847398-dba4-4df9-b3a2-5864b1937277",
            "HTTPStatusCode": 200,
            "HTTPHeaders": {
                "x-amzn-requestid": "fb847398-dba4-4df9-b3a2-5864b1937277",
                "content-type": "application/x-amz-json-1.1",
                "content-length": "18494",
                "date": "Thu, 21 Apr 2022 13:44:05 GMT"
            },
            "RetryAttempts": 0}
    }

@pytest.fixture
def boto3_cw_alarm_not_ok_response() -> Dict[str, Any]:
    return {
        "CompositeAlarms": [
            {
                'ActionsEnabled': True,
                'AlarmActions': [],
                'AlarmArn': 'arn:aws:cloudwatch:us-east-2:672774589314:alarm:TaskScalingAlarm84928327',
                'AlarmConfigurationUpdatedTimestamp': datetime.datetime(2022, 10, 30, 20, 40, 38, 309000, tzinfo=tzutc()),
                'AlarmName': 'TaskScalingAlarm84928327',
                'AlarmRule': '(ALARM("arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-RegionQueueScalingAlarm03E56567-LL8Z2IXZJQ5V") OR ALARM("arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ImageQueueScalingAlarm846F1F23-19LPTQIB9ANUQ") OR ALARM("arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ServiceMemAlarmC912E54C-1QNESY6WB4QW9") OR ALARM("arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ServiceCPUAlarmF42C7BBC-1TJ9IFELBG9IK"))',
                'InsufficientDataActions': [],
                'OKActions': [],
                'StateReason': 'arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ImageQueueScalingAlarm846F1F23-19LPTQIB9ANUQ transitioned to ALARM at Sunday 30 October, 2022 20:47:35 UTC',
                'StateReasonData': """
                    {
                        "triggeringAlarms":[
                            {
                                "arn":"arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ImageQueueScalingAlarm846F1F23-19LPTQIB9ANUQ",
                                "state":{
                                    "value":"ALARM",
                                    "timestamp":"2022-10-30T20:47:35.671+0000"
                                }
                            }
                        ]
                }""",
                'StateUpdatedTimestamp': datetime.datetime(2022, 10, 30, 20, 47, 35, 671000, tzinfo=tzutc()),
                'StateValue': 'ALARM',
                'StateTransitionedTimestamp': datetime.datetime(2022, 10, 30, 20, 47, 35, 671000, tzinfo=tzutc())
            }
        ],
        "MetricAlarms": [
            {
                "AlarmName": "Task-EcsScalingAlarm61D4C776-93VGP1UMJQ4A",
                "AlarmArn": "arn:aws:cloudwatch:us-east-1:123456789012:alarm:Task-EcsScalingAlarm61D4C776-93VGP1UMJQ4A",
                "AlarmConfigurationUpdatedTimestamp": datetime.datetime(2022,
                    4,
                    15,
                    16,
                    0,
                    6,
                    652000, tzinfo=tzutc()
                ),
            "ActionsEnabled": True,
            "OKActions": [],
            "AlarmActions": [],
            "InsufficientDataActions": [],
            "StateValue": "ALARM",
            "StateReason": "Threshold Crossed: 1 datapoint [1.0 (18/04/22 14: 27: 00)] was not greater than or equal to the threshold (5.0).",
            "StateReasonData": """
            {
                    "version": "1.0",
                    "queryDate": "2022-04-18T14:32:36.846+0000",
                    "startDate": "2022-04-18T14:27:00.000+0000",
                    "statistic": "Maximum",
                    "period": 300,
                    "recentDatapoints": [
                        1.0
                    ],
                    "threshold": 5.0,
                    "evaluatedDatapoints": [
                        {
                            "timestamp": "2022-04-18T14:27:00.000+0000",
                            "sampleCount": 5.0,
                            "value": 1.0
                        }
                    ]
                }""",
            "StateUpdatedTimestamp": datetime.datetime(
                2022,
                4,
                18,
                14,
                32,
                36,
                850000, tzinfo=tzutc()
            ),
            "MetricName": "ApproximateNumberOfMessagesVisible",
            "Namespace": "AWS/SQS",
            "Statistic": "Maximum",
            "Dimensions": [
                    {"Name": "QueueName", "Value": "ImageQueue"
                    }
                ],
            "Period": 300,
            "EvaluationPeriods": 1,
            "Threshold": 5.0,
            "ComparisonOperator": "GreaterThanOrEqualToThreshold"
            }
        ],
        "ResponseMetadata": {
            "RequestId": "4eaabf61-2dea-42d8-a3db-9d42df6d0b3d",
            "HTTPStatusCode": 200,
            "HTTPHeaders": {"x-amzn-requestid": "4eaabf61-2dea-42d8-a3db-9d42df6d0b3d",
            "content-type": "text/xml",
            "content-length": "2109",
            "date": "Thu,21 Apr 2022 13: 36: 56 GMT"
        },
        "RetryAttempts": 1
        }
    }

@pytest.fixture
def boto3_cw_alarm_ok_response() -> Dict[str, Any]:
    return {
        "CompositeAlarms": [
            {
                'ActionsEnabled': True,
                'AlarmActions': [],
                'AlarmArn': 'arn:aws:cloudwatch:us-east-2:672774589314:alarm:TaskScalingAlarm84928327',
                'AlarmConfigurationUpdatedTimestamp': datetime.datetime(2022, 10, 30, 20, 40, 38, 309000, tzinfo=tzutc()),
                'AlarmName': 'TaskScalingAlarm84928327',
                'AlarmRule': '(ALARM("arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-RegionQueueScalingAlarm03E56567-LL8Z2IXZJQ5V") OR ALARM("arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ImageQueueScalingAlarm846F1F23-19LPTQIB9ANUQ") OR ALARM("arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ServiceMemAlarmC912E54C-1QNESY6WB4QW9") OR ALARM("arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ServiceCPUAlarmF42C7BBC-1TJ9IFELBG9IK"))',
                'InsufficientDataActions': [],
                'OKActions': [],
                'StateReason': 'arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ImageQueueScalingAlarm846F1F23-19LPTQIB9ANUQ transitioned to ALARM at Sunday 30 October, 2022 20:47:35 UTC',
                'StateReasonData': """
                    {
                        "triggeringAlarms":[
                            {
                                "arn":"arn:aws:cloudwatch:us-east-2:672774589314:alarm:-Task-ImageQueueScalingAlarm846F1F23-19LPTQIB9ANUQ",
                                "state":{
                                    "value":"ALARM",
                                    "timestamp":"2022-10-30T20:47:35.671+0000"
                                }
                            }
                        ]
                }""",
                'StateUpdatedTimestamp': datetime.datetime(2022, 10, 30, 20, 47, 35, 671000, tzinfo=tzutc()),
                'StateValue': 'OK',
                'StateTransitionedTimestamp': datetime.datetime(2022, 10, 30, 20, 47, 35, 671000, tzinfo=tzutc())
            }
        ],
        "MetricAlarms": [
            {
                "AlarmName": "Task-EcsScalingAlarm61D4C776-93VGP1UMJQ4A",
                "AlarmArn": "arn:aws:cloudwatch:us-east-1:123456789012:alarm:Task-EcsScalingAlarm61D4C776-93VGP1UMJQ4A",
                "AlarmConfigurationUpdatedTimestamp": datetime.datetime(2022,
                    4,
                    15,
                    16,
                    0,
                    6,
                    652000, tzinfo=tzutc()
                ),
            "ActionsEnabled": True,
            "OKActions": [],
            "AlarmActions": [],
            "InsufficientDataActions": [],
            "StateValue": "OK",
            "StateReason": "Threshold Crossed: 1 datapoint [1.0 (18/04/22 14: 27: 00)] was not greater than or equal to the threshold (5.0).",
            "StateReasonData": """
            {
                    "version": "1.0",
                    "queryDate": "2022-04-18T14:32:36.846+0000",
                    "startDate": "2022-04-18T14:27:00.000+0000",
                    "statistic": "Maximum",
                    "period": 300,
                    "recentDatapoints": [
                        1.0
                    ],
                    "threshold": 5.0,
                    "evaluatedDatapoints": [
                        {
                            "timestamp": "2022-04-18T14:27:00.000+0000",
                            "sampleCount": 5.0,
                            "value": 1.0
                        }
                    ]
                }""",
            "StateUpdatedTimestamp": datetime.datetime(
                2022,
                4,
                18,
                14,
                32,
                36,
                850000, tzinfo=tzutc()
            ),
            "MetricName": "ApproximateNumberOfMessagesVisible",
            "Namespace": "AWS/SQS",
            "Statistic": "Maximum",
            "Dimensions": [
                    {"Name": "QueueName", "Value": "ImageQueue"
                    }
                ],
            "Period": 300,
            "EvaluationPeriods": 1,
            "Threshold": 5.0,
            "ComparisonOperator": "GreaterThanOrEqualToThreshold"
            }
        ],
        "ResponseMetadata": {
            "RequestId": "4eaabf61-2dea-42d8-a3db-9d42df6d0b3d",
            "HTTPStatusCode": 200,
            "HTTPHeaders": {"x-amzn-requestid": "4eaabf61-2dea-42d8-a3db-9d42df6d0b3d",
            "content-type": "text/xml",
            "content-length": "2109",
            "date": "Thu,21 Apr 2022 13: 36: 56 GMT"
        },
        "RetryAttempts": 1
        }
    }
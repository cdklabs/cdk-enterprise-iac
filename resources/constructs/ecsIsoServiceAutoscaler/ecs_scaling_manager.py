# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Union, cast

import boto3

# Environment
ECS_CLUSTER_NAME = os.environ.get("ECS_CLUSTER_NAME", "")
ECS_SERVICE_NAME = os.environ.get("ECS_SERVICE_NAME", "")
SCALE_ALARM_NAME = os.environ.get("SCALE_ALARM_NAME", "")
SCALE_OUT_INCREMENT = int(os.environ.get("SCALE_OUT_INCREMENT", 1))
SCALE_IN_INCREMENT = int(os.environ.get("SCALE_IN_INCREMENT", 1))
SCALE_OUT_COOLDOWN = int(os.environ.get("SCALE_OUT_COOLDOWN", 60))
SCALE_IN_COOLDOWN = int(os.environ.get("SCALE_IN_COOLDOWN", 60))
MINIMUM_TASK_COUNT = int(os.environ.get("MINIMUM_TASK_COUNT", 1))
MAXIMUM_TASK_COUNT = int(os.environ.get("MAXIMUM_TASK_COUNT", 10))

# Logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Clients
cw_client = boto3.client("cloudwatch")
ecs_client = boto3.client("ecs")


def _get_alarm_states(alarm_name: str) -> List[Union[str, None]]:
    """
    Gets a list of alarm states for a given alarm

    :param alarm_name: the alarm name to find states for
    :returns: list of alarm states, ex: ["OK", "ALARM"]
    """
    alarm = cw_client.describe_alarms(AlarmNames=[alarm_name])

    alarm_states = []
    metric_alarms = alarm.get("MetricAlarms", None)
    if metric_alarms is not None:
        alarm_states = [x.get("StateValue") for x in alarm["MetricAlarms"]]

    return alarm_states


def _get_ecs_service(cluster_name: str, service_name: str) -> Dict[str, Any]:
    """
    Gets the ECS Service boto3 response object

    :param cluster_name: name of ECS Cluster
    :param service_name: name of ECS Service
    :returns: boto3 dictionary response object for service
    """
    services = ecs_client.describe_services(
        cluster=cluster_name, services=[service_name]
    )
    service: Dict[str, Any] = cast(list, services["services"])[0]
    return service


def _get_time_since_last_ecs_update(
    service: Dict[str, Any]
) -> float:
    """
    Retrieve the time since the ECS Service was last updated

    :param service: the boto3 service response object
    :returns: time in seconds since ECS Service was last updated
    """
    last_update = 0.0
    deployments = cast(list, service.get("deployments", None))
    if len(deployments) == 1:
        current_deployment: Dict[str, Any] = deployments[0]
        last_updated = cast(datetime, current_deployment.get("updatedAt"))
        last_update = datetime.now().timestamp() - last_updated.timestamp()
    return last_update


def _trigger_scaling_action(
    type_: str,
    increment: int,
    current_count: int,
    end_count: int,
    cooldown: int,
    last_update: float
) -> None:
    """
    Triggers a scaling action for ECS

    :param type_: the type of scale to perform, should be "in" or "out"
    :param increment: the scaling increase or decrease increment to take
    :param end: the minimum or maximum task count to stop at
    :param cooldown: time elapsed from previous scaling action where no scaling
    action should be performed
    :param last_update: time the last update was performed on the service
    """
    new_desired_count = current_count
    proposed_count = current_count

    if last_update >= cooldown:
        if current_count is not None:
            if type_.lower() == "out":
                proposed_count = current_count + increment
                new_desired_count = proposed_count if proposed_count <= end_count else end_count
            elif type_.lower() == "in":
                proposed_count = current_count - increment
                new_desired_count = proposed_count if proposed_count >= end_count else end_count

        if new_desired_count != current_count:
            ecs_client.update_service(
                cluster=ECS_CLUSTER_NAME,
                service=ECS_SERVICE_NAME,
                desiredCount=new_desired_count
            )
            logger.info(f"Changed desired count from {current_count} to {new_desired_count}")
        else:
            logger.info(
                "Service is already at expected capacity, no action taken"
            )
    else:
        logger.info(
            "Cooldown period has not been exceeded, no action taken"
        )


def handler(event, context):
    alarm_states = _get_alarm_states(SCALE_ALARM_NAME)
    service = _get_ecs_service(ECS_CLUSTER_NAME, ECS_SERVICE_NAME)

    desired_count = service.get("desiredCount")
    running_count = service.get("runningCount")

    if desired_count != running_count:
        logger.info(
            "Task count has not caught up with desired count, no action taken"
        )
        return

    last_updated = _get_time_since_last_ecs_update(service)

    if alarm_states is not None and "ALARM" in alarm_states:
        _trigger_scaling_action(
            type_="OUT",
            increment=SCALE_OUT_INCREMENT,
            current_count=desired_count,
            end_count=MAXIMUM_TASK_COUNT,
            cooldown=SCALE_OUT_COOLDOWN,
            last_update=last_updated
        )
    elif alarm_states is not None and all(x == "OK" for x in alarm_states):
        _trigger_scaling_action(
            type_="IN",
            increment=SCALE_IN_INCREMENT,
            current_count=desired_count,
            end_count=MINIMUM_TASK_COUNT,
            cooldown=SCALE_IN_COOLDOWN,
            last_update=last_updated
        )


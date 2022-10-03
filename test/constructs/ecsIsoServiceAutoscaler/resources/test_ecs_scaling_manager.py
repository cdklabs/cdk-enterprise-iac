# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
from typing import Any, Dict
from unittest.mock import patch

import pytest

with patch("boto3.client"):
    from ecs_scaling_manager import ( #type: ignore 
        _get_alarm_states,
        _get_ecs_service,
        _get_time_since_last_ecs_update,
        _trigger_scaling_action,
    )


def test_get_alarm_states(boto3_cw_alarm_response):
    """
    Tests getting alarm state data from a mocked boto3 response. The expected
    response should be a list in the format of ["OK", "ALARM"].
    """
    with patch("ecs_scaling_manager.cw_client.describe_alarms") as mock:
        mock.return_value = boto3_cw_alarm_response
        alarm_states = _get_alarm_states(alarm_name="Alarm")

    assert mock.called
    assert isinstance(alarm_states, list)
    assert "OK" in alarm_states
    assert "ALARM" not in alarm_states


def test_get_ecs_service(boto3_ecs_service_response):
    """
    Tests getting ECS Service data from a mocked boto3 response. The expected
    response should be in a dictionary format {...} that contains the single
    ECS service.
    """
    with patch("ecs_scaling_manager.ecs_client.describe_services") as mock:
        mock.return_value = boto3_ecs_service_response
        service = _get_ecs_service(
            cluster_name="Cluster", service_name="Service"
        )

    assert mock.called
    assert isinstance(service, dict)
    assert "deployments" in service


@pytest.mark.parametrize('boto3_ecs_service_response', [180], indirect=True)
def test_get_time_since_last_ecs_update(boto3_ecs_service_response):
    """
    Tests getting the time since the ECS Service was last updated by pulling
    the value out of the ECS Service response data, which is mocked.
    """
    with patch("ecs_scaling_manager.ecs_client.describe_services") as mock:
        mock.return_value = boto3_ecs_service_response
        service = _get_ecs_service(
            cluster_name="Cluster", service_name="Service"
        )

        time_since = _get_time_since_last_ecs_update(service)

    assert mock.called == True
    assert isinstance(time_since, float)
    assert int(time_since) > 178 and int(time_since) < 182


def test_trigger_scaling_action_out_outside_cooldown():
    """
    Tests logic to perform an ECS Scaling OUT Action outside of the cooldown
    window, which should correctly call the ECS Service to update the service.
    """
    with patch("ecs_scaling_manager.ecs_client.update_service") as mock:
        _trigger_scaling_action(
            type_="OUT",
            increment=8,
            current_count=3,
            end_count=50,
            cooldown=300,
            last_update=301
        )
        call_args: Dict[str, Any] = mock.call_args[1]

    assert mock.called == True
    assert call_args.get("desiredCount") == 11


def test_trigger_scaling_action_out_inside_cooldown():
    """
    Tests logic to perform an ECS Scaling OUT Action inside of the cooldown
    window, which should not actually scale out since we are still in the
    cooldown period.
    """
    with patch("ecs_scaling_manager.ecs_client.update_service") as mock:
        _trigger_scaling_action(
            type_="out",
            increment=8,
            current_count=3,
            end_count=50,
            cooldown=300,
            last_update=250
        )

    assert mock.called == False


def test_trigger_scaling_action_in_outside_cooldown():
    """
    Tests logic to perform an ECS Scaling IN Action outside of the cooldown
    window, which should correctly call the ECS Service to update the service.
    """
    with patch("ecs_scaling_manager.ecs_client.update_service") as mock:
        _trigger_scaling_action(
            type_="IN",
            increment=8,
            current_count=20,
            end_count=3,
            cooldown=300,
            last_update=301
        )
        call_args: Dict[str, Any] = mock.call_args[1]

    assert mock.called == True
    assert call_args.get("desiredCount") == 12


def test_trigger_scaling_action_in_inside_cooldown():
    """
    Tests logic to perform an ECS Scaling IN Action inside of the cooldown
    window, which should not actually scale in since we are still in the
    cooldown period.
    """
    with patch("ecs_scaling_manager.ecs_client.update_service") as mock:
        _trigger_scaling_action(
            type_="in",
            increment=8,
            current_count=20,
            end_count=3,
            cooldown=300,
            last_update=250
        )

    assert mock.called == False


def test_trigger_scaling_action_in_to_limit():
    """
    Tests logic to scale in to the limit defined. The function should see that
    the end count is at the limit and perform the correct math to only scale in
    to the end_count defined and not beyond that.
    """
    with patch("ecs_scaling_manager.ecs_client.update_service") as mock:
        _trigger_scaling_action(
            type_="in",
            increment=8,
            current_count=8,
            end_count=3,
            cooldown=300,
            last_update=301
        )
        call_args: Dict[str, Any] = mock.call_args[1]

    assert mock.called == True
    assert call_args.get("desiredCount") == 3


def test_trigger_scaling_action_out_to_limit():
    """
    Tests logic to scale out to the limit defined. The function should see that
    the end count is at the limit and perform the correct math to only scale
    out to the end_count defined and not beyond that.
    """
    with patch("ecs_scaling_manager.ecs_client.update_service") as mock:
        _trigger_scaling_action(
            type_="Out",
            increment=8,
            current_count=45,
            end_count=50,
            cooldown=300,
            last_update=301
        )
        call_args: Dict[str, Any] = mock.call_args[1]

    assert mock.called == True
    assert call_args.get("desiredCount") == 50


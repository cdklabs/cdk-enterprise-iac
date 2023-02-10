/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

import * as path from 'path';
import { Duration } from 'aws-cdk-lib';
import { AlarmBase } from 'aws-cdk-lib/aws-cloudwatch';
import { Cluster, IService } from 'aws-cdk-lib/aws-ecs';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Effect, IRole, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface EcsIsoServiceAutoscalerProps {
  /**
   * Optional IAM role to attach to the created lambda to adjust the desired count on the ECS Service
   *
   * Ensure this role has appropriate privileges. Example IAM policy statements:
   * ```json
   * {
   *  "PolicyDocument": {
   *    "Statement": [
   *      {
   *        "Action": "cloudwatch:DescribeAlarms",
   *        "Effect": "Allow",
   *        "Resource": "*"
   *      },
   *      {
   *        "Action": [
   *          "ecs:DescribeServices",
   *          "ecs:UpdateService"
   *        ],
   *        "Condition": {
   *          "StringEquals": {
   *            "ecs:cluster": "arn:${Partition}:ecs:${Region}:${Account}:cluster/${ClusterName}"
   *          }
   *        },
   *        "Effect": "Allow",
   *        "Resource": "arn:${Partition}:ecs:${Region}:${Account}:service/${ClusterName}/${ServiceName}"
   *      }
   *    ],
   *    "Version": "2012-10-17"
   *  }
   *}
   * ```
   * @default A role is created for you with least privilege IAM policy
   */
  readonly role?: IRole;
  /**
   * The cluster the service you wish to scale resides in.
   */
  readonly ecsCluster: Cluster;
  /**
   * The ECS service you wish to scale.
   */
  readonly ecsService: IService;
  /**
   * The minimum number of tasks the service will have.
   *
   * @default 1
   */
  readonly minimumTaskCount?: number;
  /**
   * The maximum number of tasks that the service will scale out to.
   * Note: This does not provide any protection from scaling out above the maximum allowed in your account, set this variable and manage account quotas appropriately.
   *
   * @default 10
   */
  readonly maximumTaskCount?: number;
  /**
   * The Cloudwatch Alarm that will cause scaling actions to be invoked, whether it's in or not in alarm will determine scale up and down actions.
   *
   * Note: composite alarms can not be generated with CFN in all regions, while this allows you to pass in a composite alarm alarm creation is outside the scope of this construct
   */
  readonly scaleAlarm: AlarmBase;
  /**
   * The number of tasks that will scale out on scale out alarm status
   *
   * @default 1
   */
  readonly scaleOutIncrement?: number;
  /**
   * The number of tasks that will scale in on scale in alarm status
   *
   * @default 1
   */
  readonly scaleInIncrement?: number;
  /**
   * How long will a the application wait before performing another scale out action.
   *
   * @default 60 seconds
   */
  readonly scaleOutCooldown?: Duration;
  /**
   * How long will the application wait before performing another scale in action
   *
   * @default 60 seconds
   */
  readonly scaleInCooldown?: Duration;
}

/**
 * Creates a EcsIsoServiceAutoscaler construct. This construct allows you to scale an ECS service in an ISO
 * region where classic ECS Autoscaling may not be available.
 *
 * @param scope The parent creating construct (usually `this`).
 * @param id The construct's name.
 * @param this A `EcsIsoServiceAutoscalerthis` interface.
 */

export class EcsIsoServiceAutoscaler extends Construct {
  public readonly ecsScalingManagerFunction: Function;

  constructor(
    scope: Construct,
    id: string,
    props: EcsIsoServiceAutoscalerProps
  ) {
    super(scope, id);

    const {
      minimumTaskCount = 1,
      maximumTaskCount = 10,
      scaleOutIncrement = 1,
      scaleInIncrement = 1,
      scaleOutCooldown = Duration.seconds(60),
      scaleInCooldown = Duration.seconds(60),
    } = props;

    this.ecsScalingManagerFunction = new Function(
      this,
      `${id}-EcsServiceScalingManager`,
      {
        code: Code.fromAsset(
          path.join(
            __dirname,
            '../../../resources/constructs/ecsIsoServiceAutoscaler'
          )
        ),
        handler: 'ecs_scaling_manager.handler',
        runtime: Runtime.PYTHON_3_7,
        role: props.role || undefined,
        environment: {
          ECS_CLUSTER_NAME: props.ecsCluster.clusterName,
          ECS_SERVICE_NAME: props.ecsService.serviceName,
          MINIMUM_TASK_COUNT: minimumTaskCount.toString(),
          MAXIMUM_TASK_COUNT: maximumTaskCount.toString(),
          SCALE_ALARM_NAME: props.scaleAlarm.alarmName,
          SCALE_OUT_INCREMENT: scaleOutIncrement.toString(),
          SCALE_OUT_COOLDOWN: scaleOutCooldown.toSeconds().toString(),
          SCALE_IN_INCREMENT: scaleInIncrement.toString(),
          SCALE_IN_COOLDOWN: scaleInCooldown.toSeconds().toString(),
        },
      }
    );

    new Rule(this, `${id}-EcsScalingManagerSchedule`, {
      description: `Kicks off Lambda to adjust ECS scaling for service: ${props.ecsService.serviceName}`,
      enabled: true,
      schedule: Schedule.rate(Duration.minutes(1)),
      targets: [new LambdaFunction(this.ecsScalingManagerFunction)],
    });

    if (!props.role) {
      // Set permissions for ecsScalingManagerFunction role
      this.ecsScalingManagerFunction.addToRolePolicy(
        new PolicyStatement({
          actions: ['cloudwatch:DescribeAlarms'],
          effect: Effect.ALLOW,
          // Required to be * and can not scope down due to composite alarm role constraints listed here:
          // https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/permissions-reference-cw.html
          // "cloudwatch:DescribeAlarms permission must have a * scope. You can't return information about
          // composite alarms if your cloudwatch:DescribeAlarms permission has a narrower scope."
          resources: ['*'],
        })
      );

      this.ecsScalingManagerFunction.addToRolePolicy(
        new PolicyStatement({
          actions: ['ecs:DescribeServices', 'ecs:UpdateService'],
          effect: Effect.ALLOW,
          resources: [props.ecsService.serviceArn],
          conditions: {
            StringEquals: {
              'ecs:cluster': props.ecsCluster.clusterArn,
            },
          },
        })
      );
    }
  }
}

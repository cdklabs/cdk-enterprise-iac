/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { spawnSync } from 'child_process';
import * as path from 'path';
import { CfnElement, Duration, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Alarm } from 'aws-cdk-lib/aws-cloudwatch';
import {
  CfnCluster,
  CfnService,
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
} from 'aws-cdk-lib/aws-ecs';
import { CfnRole, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';
import { EcsIsoServiceAutoscaler } from '../../../src/constructs/ecsIsoServiceAutoscaler/ecsIsoServiceAutoscaler';

let stack: Stack;

describe('Python Lambda function tests', () => {
  test('lambda python pytest', () => {
    const result = spawnSync(path.join(__dirname, 'resources', 'test.sh'), {
      stdio: 'inherit',
    });
    expect(result.status).toBe(0);
  });
});

describe('EcsIsoServiceAutoscaler construct', () => {
  let cluster: Cluster;
  let service: FargateService;
  let alarm: Alarm;
  let role: Role;
  beforeEach(() => {
    stack = new Stack();
    cluster = new Cluster(stack, 'TestCluster');
    const taskDefinition = new FargateTaskDefinition(
      stack,
      'TestTaskDefinition'
    );
    taskDefinition.addContainer('SomeContainer', {
      image: ContainerImage.fromRegistry(
        'public.ecr.aws/ecs-sample-image/amazon-ecs-sample:latest'
      ),
    });
    service = new FargateService(stack, 'TestService', {
      cluster,
      taskDefinition,
      desiredCount: 5,
    });
    role = new Role(stack, 'TestTaskRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    alarm = new Alarm(stack, 'TestAlarm', {
      metric: cluster.metricCpuUtilization(),
      threshold: 10,
      evaluationPeriods: 2,
    });
  });

  test('Expected number of resources are created with defaults', () => {
    new EcsIsoServiceAutoscaler(stack, 'TestEcsIsoServiceAutoscaler', {
      ecsCluster: cluster,
      ecsService: service,
      scaleAlarm: alarm,
      role,
    });

    const template = Template.fromStack(stack);

    // Lambda with default Env vars
    template.resourcePropertiesCountIs(
      'AWS::Lambda::Function',
      {
        Environment: {
          Variables: Match.objectLike({
            MINIMUM_TASK_COUNT: '1',
            MAXIMUM_TASK_COUNT: '10',
            SCALE_OUT_INCREMENT: '1',
            SCALE_OUT_COOLDOWN: '60',
            SCALE_IN_INCREMENT: '1',
            SCALE_IN_COOLDOWN: '60',
          }),
        },
      },
      1
    );
  });
  test('Autoscaling props provided', () => {
    new EcsIsoServiceAutoscaler(stack, 'TestEcsIsoServiceAutoscaler', {
      ecsCluster: cluster,
      ecsService: service,
      scaleAlarm: alarm,
      role,
      minimumTaskCount: 5,
      maximumTaskCount: 15,
      scaleInIncrement: 2,
      scaleOutIncrement: 2,
      scaleInCooldown: Duration.seconds(120),
      scaleOutCooldown: Duration.seconds(120),
    });

    const template = Template.fromStack(stack);

    // Lambda with default Env vars
    template.resourcePropertiesCountIs(
      'AWS::Lambda::Function',
      {
        Environment: {
          Variables: Match.objectLike({
            MINIMUM_TASK_COUNT: '5',
            MAXIMUM_TASK_COUNT: '15',
            SCALE_OUT_INCREMENT: '2',
            SCALE_OUT_COOLDOWN: '120',
            SCALE_IN_INCREMENT: '2',
            SCALE_IN_COOLDOWN: '120',
          }),
        },
      },
      1
    );
  });
  test('Lambda creates own role if optional role not passed, and role has least privilege', () => {
    const autoScaler = new EcsIsoServiceAutoscaler(
      stack,
      'TestEcsIsoServiceAutoscaler',
      {
        ecsCluster: cluster,
        ecsService: service,
        scaleAlarm: alarm,
      }
    );

    const autoScalerRole = autoScaler.node.findAll().find((x: IConstruct) => {
      return x instanceof CfnRole;
    });
    const serviceId = service.node.findAll().find((x: IConstruct) => {
      return x instanceof CfnService;
    });

    const clusterId = cluster.node.findAll().find((x: IConstruct) => {
      return x instanceof CfnCluster;
    });

    const template = Template.fromStack(stack);

    template.resourcePropertiesCountIs(
      'AWS::IAM::Policy',
      {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'cloudwatch:DescribeAlarms',
              Resource: '*',
            }),
            Match.objectLike({
              Action: ['ecs:DescribeServices', 'ecs:UpdateService'],
              Resource: {
                Ref: stack.getLogicalId(serviceId as CfnElement).toString(),
              },
              Condition: {
                StringEquals: {
                  'ecs:cluster': {
                    'Fn::GetAtt': [
                      stack.getLogicalId(clusterId as CfnElement).toString(),
                      'Arn',
                    ],
                  },
                },
              },
            }),
          ]),
        },
        Roles: [
          {
            Ref: stack.getLogicalId(autoScalerRole as CfnElement).toString(),
          },
        ],
      },
      1
    );
  });
  test('Autoscaler Lambda is accessible as a property', () => {
    const autoScaler = new EcsIsoServiceAutoscaler(
      stack,
      'TestEcsIsoServiceAutoscaler',
      {
        ecsCluster: cluster,
        ecsService: service,
        scaleAlarm: alarm,
      }
    );

    expect(autoScaler).toHaveProperty('ecsScalingManagerFunction');
  });
});

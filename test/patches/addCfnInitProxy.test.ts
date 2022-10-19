/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Aspects, CfnElement, SecretValue, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AutoScalingGroup, Signals } from 'aws-cdk-lib/aws-autoscaling';
import {
  CloudFormationInit,
  InitPackage,
  Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  MachineImage,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { CfnSecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { IConstruct } from 'constructs';
import { addCfnInitProxy, ProxyType } from '../../src/patches/addCfnInitProxy';

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

describe('Adding cfn-init proxy values to EC2 instance', () => {
  test('http proxy with no password needed', () => {
    const vpc = new Vpc(stack, 'TestVpc');
    new Instance(stack, 'TestInstance', {
      machineImage: MachineImage.latestAmazonLinux(),
      instanceType: InstanceType.of(InstanceClass.MEMORY5, InstanceSize.LARGE),
      vpc,
      init: CloudFormationInit.fromElements(InitPackage.yum('python3')),
    });
    Aspects.of(stack).add(
      new addCfnInitProxy({
        proxyHost: 'example.com',
        proxyPort: 8080,
      })
    );
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::EC2::Instance', {
      UserData: {
        'Fn::Base64': {
          'Fn::Join': {
            '1': Match.arrayWith([
              ' --http-proxy http://',
              'example.com:8080',
              ' --http-proxy http://',
              'example.com:8080',
            ]),
          },
        },
      },
    });
  });
  test('https proxy with no password needed', () => {
    const vpc = new Vpc(stack, 'TestVpc');
    new Instance(stack, 'TestInstance', {
      machineImage: MachineImage.latestAmazonLinux(),
      instanceType: InstanceType.of(InstanceClass.MEMORY5, InstanceSize.LARGE),
      vpc,
      init: CloudFormationInit.fromElements(InitPackage.yum('python3')),
    });
    Aspects.of(stack).add(
      new addCfnInitProxy({
        proxyHost: 'example.com',
        proxyPort: 8080,
        proxyType: ProxyType.HTTPS,
      })
    );
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::EC2::Instance', {
      UserData: {
        'Fn::Base64': {
          'Fn::Join': {
            '1': Match.arrayWith([
              ' --https-proxy https://',
              'example.com:8080',
              ' --https-proxy https://',
              'example.com:8080',
            ]),
          },
        },
      },
    });
  });
  test('Proxy with password', () => {
    const vpc = new Vpc(stack, 'TestVpc');
    new Instance(stack, 'TestInstance', {
      machineImage: MachineImage.latestAmazonLinux(),
      instanceType: InstanceType.of(InstanceClass.MEMORY5, InstanceSize.LARGE),
      vpc,
      init: CloudFormationInit.fromElements(InitPackage.yum('python3')),
    });
    const secret = new Secret(stack, 'TestSecret', {
      secretObjectValue: {
        user: SecretValue.unsafePlainText('someUser'),
        password: SecretValue.unsafePlainText('superSecret123'),
      },
    });
    Aspects.of(stack).add(
      new addCfnInitProxy({
        proxyHost: 'example.com',
        proxyPort: 8080,
        proxyCredentials: secret,
      })
    );
    const template = Template.fromStack(stack);
    const secretConstruct = secret.node.findAll().find((x: IConstruct) => {
      return x instanceof CfnSecret;
    });
    template.hasResourceProperties('AWS::EC2::Instance', {
      UserData: {
        'Fn::Base64': {
          'Fn::Join': {
            '1': Match.arrayWith([
              ' --http-proxy http://',
              {
                'Fn::Join': [
                  '',
                  Match.arrayEquals([
                    '{{resolve:secretsmanager:',
                    { Ref: stack.getLogicalId(secretConstruct as CfnElement) },
                    ':SecretString:username::}}:{{resolve:secretsmanager:',
                    { Ref: stack.getLogicalId(secretConstruct as CfnElement) },
                    ':SecretString:password::}}@',
                  ]),
                ],
              },
            ]),
          },
        },
      },
    });
  });
});

describe('Adding cfn-init proxy values to EC2 launch config', () => {
  test('http proxy with no password needed', () => {
    const vpc = new Vpc(stack, 'TestVpc');
    new AutoScalingGroup(stack, 'TestAutoscalingGroup', {
      vpc,
      machineImage: MachineImage.latestAmazonLinux(),
      instanceType: InstanceType.of(InstanceClass.MEMORY5, InstanceSize.LARGE),
      init: CloudFormationInit.fromElements(InitPackage.yum('python3')),
      signals: Signals.waitForAll(),
    });
    Aspects.of(stack).add(
      new addCfnInitProxy({
        proxyHost: 'example.com',
        proxyPort: 8080,
      })
    );
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::AutoScaling::LaunchConfiguration', {
      UserData: {
        'Fn::Base64': {
          'Fn::Join': {
            '1': Match.arrayWith([
              ' --http-proxy http://',
              'example.com:8080',
              ' --http-proxy http://',
              'example.com:8080',
            ]),
          },
        },
      },
    });
  });
});

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { IntegTest } from '@aws-cdk/integ-tests-alpha';
import { App, Aspects, Duration, SecretValue, Stack } from 'aws-cdk-lib';
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
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { AddCfnInitProxy } from '../../../src/patches/addCfnInitProxy';

const app = new App();
const stack = new Stack(app, 'integ-addCfnInitProxy-stack');
const vpc = new Vpc(stack, 'TestVpc');
new Instance(stack, 'TestInstance', {
  machineImage: MachineImage.latestAmazonLinux(),
  instanceType: InstanceType.of(InstanceClass.MEMORY5, InstanceSize.LARGE),
  vpc,
  init: CloudFormationInit.fromElements(InitPackage.yum('python3')),
  initOptions: {
    timeout: Duration.minutes(2),
    ignoreFailures: true, // Ignoring due to fake proxy not being real
  },
});
const secret = new Secret(stack, 'TestSecret', {
  secretObjectValue: {
    user: SecretValue.unsafePlainText('someUser'),
    password: SecretValue.unsafePlainText('superSecret123'),
  },
});
Aspects.of(stack).add(
  new AddCfnInitProxy({
    proxyHost: 'example.com',
    proxyPort: 8080,
    proxyCredentials: secret,
  })
);

new IntegTest(app, 'IntegTest', {
  testCases: [stack],
  regions: ['us-east-1'],
});

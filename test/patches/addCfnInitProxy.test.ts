/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Aspects, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
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
import { addCfnInitProxy } from '../../src/patches/addCfnInitProxy';

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

describe('Adding cfn-init proxy values', () => {
  test('Proxy with no password needed', () => {
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
    console.log(template);
  });
});

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { IntegTest } from '@aws-cdk/integ-tests-alpha';
import { App, Aspects, Stack } from 'aws-cdk-lib';
import {
  Role,
  ServicePrincipal,
  ManagedPolicy,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { AddPermissionBoundary } from '../../../src/patches/addPermissionsBoundary';

const app = new App();
const stack = new Stack(app, 'integ-addPermissionsBoundary-stack', {
  env: {
    region: 'us-east-1',
  },
});
const permissionBoundary = new ManagedPolicy(
  stack,
  'PermissionBoundaryPolicy',
  {
    managedPolicyName: 'TestPermissionBoundary',
    statements: [
      new PolicyStatement({
        actions: ['*'],
        resources: ['*'],
      }),
    ],
  }
);

// role without explicit name should use logicalId
new Role(stack, 'TextractServiceRole', {
  assumedBy: new ServicePrincipal('textract.amazonaws.com'),
});

// role with explicit name should be honored
new Role(stack, 'ExplicitNamedRole', {
  roleName: 'MyExplicitRole',
  assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
});

// role with long name that will be truncated
new Role(
  stack,
  'VeryLongRoleNameThatExceeds64CharactersAndNeedsToBeTruncated',
  {
    assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
  }
);

Aspects.of(stack).add(
  new AddPermissionBoundary({
    permissionsBoundaryPolicyName: permissionBoundary.managedPolicyName!,
    rolePrefix: 'SERVICE-',
    policyPrefix: 'POLICY-',
  })
);

new IntegTest(app, 'IntegTest', {
  testCases: [stack],
  regions: ['us-east-1'],
});

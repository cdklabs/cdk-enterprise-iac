/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, Aspects, Stack, aws_iam as iam } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ManagedPolicies } from '../../src/patches/managedPolicies';
import { AddPermissionBoundary } from '../../src/patches/addPermissionsBoundary';

let app: App;
let stack: Stack;

const appStackName = 'AppStack';

describe('Updating Resource Types', () => {
  const policyPrefix = 'POLICY_PREFIX_';
  beforeEach(() => {
    app = new App();
    stack = new Stack(app, appStackName);
  });

  test('Only ManagedPolicy objects exist', () => {
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    const bucket = new Bucket(stack, 'TestBucket');
    bucket.grantReadWrite(func);

    Aspects.of(app).add(new ManagedPolicies());
    app.synth();

    const appTemplate = Template.fromStack(stack);
    // Extracted stack has IAM resources
    appTemplate.resourceCountIs('AWS::IAM::Policy', 0);
    appTemplate.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
  });
  test('Passes along any overrides to ManagedPolicy', () => {
    const policyName = 'some-policy';
    const policy = new iam.Policy(stack, 'MyPolicy', {
      policyName,
    });
    policy.addStatements(
      new iam.PolicyStatement({
        actions: ['s3:*'],
        resources: ['*'],
      })
    );
    Aspects.of(stack).add(
      new AddPermissionBoundary({
        permissionsBoundaryPolicyName: 'SOME_BOUNDARY',
        policyPrefix,
      })
    );
    Aspects.of(stack).add(new ManagedPolicies())
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: `${policyPrefix}${policyName}`.substring(
        0,
        128 - 1
      ),
    });
  });
});

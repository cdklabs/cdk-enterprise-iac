/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Aspects, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { RemovePublicAccessBlockConfiguration } from '../../src/patches/removePublicAccessBlockConfiguration';

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

describe('Removal of PublicAccessBlockConfiguration', () => {
  test('Removes PublicAccessBlockConfiguration from S3 bucket', () => {
    new Bucket(stack, 'MyBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    Aspects.of(stack).add(new RemovePublicAccessBlockConfiguration());

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: Match.absent(),
    });
  });
});

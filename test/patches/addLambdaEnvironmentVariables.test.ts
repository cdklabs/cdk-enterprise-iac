/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Aspects, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { AddLambdaEnvironmentVariables } from '../../src/patches/addLambdaEnvironmentVariables';

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

describe('Add environment variables to all Lambda functions', () => {
  test('adds environment variable to multiple lambdas', () => {
    new Function(stack, 'TestFunction1', {
      code: Code.fromInline('def handler(event, context)\n    print(event)'),
      runtime: Runtime.PYTHON_3_9,
      handler: 'index.handler',
    });

    new Function(stack, 'TestFunction2', {
      code: Code.fromInline(
        'def handler(event, context)\n    print("something")'
      ),
      runtime: Runtime.PYTHON_3_9,
      handler: 'index.handler',
    });

    Aspects.of(stack).add(
      new AddLambdaEnvironmentVariables({
        myNeatEnvVariable: 'value 1',
      })
    );

    const template = Template.fromStack(stack);

    template.resourcePropertiesCountIs(
      'AWS::Lambda::Function',
      {
        Environment: {
          Variables: Match.objectLike({ myNeatEnvVariable: 'value 1' }),
        },
      },
      2
    );
  });

  test("adds environment variable to multiple lambdas, and doesn't remove existing", () => {
    new Function(stack, 'TestFunction1', {
      code: Code.fromInline('def handler(event, context)\n    print(event)'),
      runtime: Runtime.PYTHON_3_9,
      handler: 'index.handler',
      environment: {
        originalKey: 'originalVar',
      },
    });

    new Function(stack, 'TestFunction2', {
      code: Code.fromInline(
        'def handler(event, context)\n    print("something")'
      ),
      runtime: Runtime.PYTHON_3_9,
      handler: 'index.handler',
    });

    Aspects.of(stack).add(
      new AddLambdaEnvironmentVariables({
        myNeatEnvVariable: 'value 1',
      })
    );

    const template = Template.fromStack(stack);

    template.resourcePropertiesCountIs(
      'AWS::Lambda::Function',
      {
        Environment: {
          Variables: Match.objectLike({ myNeatEnvVariable: 'value 1' }),
        },
      },
      2
    );
    template.resourcePropertiesCountIs(
      'AWS::Lambda::Function',
      {
        Environment: {
          Variables: Match.objectLike({ originalKey: 'originalVar' }),
        },
      },
      1
    );
  });
});

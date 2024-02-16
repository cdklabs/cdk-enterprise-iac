/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, Stack } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnStore } from '../../../src/patches/resource-extractor/cfnStore';
import { ResourceExtractorShareMethod } from '../../../src/patches/resource-extractor/resourceExtractor';

let app: App;
let stack: Stack;
let extractedStack: Stack;

const appStackName = 'AppStack';
const extractedStackName = 'ExtractedStack';

describe('CfnStore', () => {
  const env = {
    account: '111111111111',
    region: 'us-east-2',
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, appStackName, { env });
    extractedStack = new Stack(app, extractedStackName, { env });
  });

  test('Saving stack outputs from API lookup', () => {
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_11,
    });
    const bucket = new Bucket(stack, 'TestBucket');
    bucket.grantReadWrite(func);
    const synthedApp = app.synth();

    const describeStackMock = jest.spyOn(
      CfnStore.prototype as any,
      'describeStack'
    );
    const mockStack = {
      Outputs: [
        {
          ExportName: 'foo',
          OutputValue: 'bar',
        },
      ],
    };
    describeStackMock.mockImplementation(() => mockStack);

    const cfn = new CfnStore({
      extractedStackName: extractedStack.stackName,
      region: 'us-east-2',
      stackArtifacts: synthedApp.stacks,
      valueShareMethod: ResourceExtractorShareMethod.API_LOOKUP,
    });
    expect(describeStackMock).toBeCalled();
    expect(cfn.templates).toHaveProperty('AppStack.Resources');
    expect(cfn.extractedStackExports).toEqual({ foo: 'bar' });
  });
});

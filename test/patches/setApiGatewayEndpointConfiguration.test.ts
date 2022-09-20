/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Aspects, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { EndpointType, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { SetApiGatewayEndpointConfiguration } from '../../src/patches/setApiGatewayEndpointConfiguration';

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

describe('Set Api Gateway endpoint configuration', () => {
  test('Sets API Gateway endpoint to regional when default Edge is selected', () => {
    const api = new RestApi(stack, 'TestRestApi');
    api.root.addMethod('ANY');
    Aspects.of(stack).add(
      new SetApiGatewayEndpointConfiguration({
        endpointType: EndpointType.REGIONAL,
      })
    );

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      EndpointConfiguration: {
        Types: ['REGIONAL'],
      },
      Parameters: {
        endpointConfigurationTypes: 'REGIONAL',
      },
    });
  });

  test('Sets API Gateway endpoint to regional when endpoint type is specfically selected', () => {
    const api = new RestApi(stack, 'TestRestApi', {
      endpointConfiguration: {
        types: [EndpointType.PRIVATE],
      },
    });
    api.root.addMethod('ANY');
    Aspects.of(stack).add(new SetApiGatewayEndpointConfiguration());

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      EndpointConfiguration: {
        Types: ['REGIONAL'],
      },
      Parameters: {
        endpointConfigurationTypes: 'REGIONAL',
      },
    });
  });

  test('Sets API Gateway endpoint to private when using default endpoint type', () => {
    const api = new RestApi(stack, 'TestRestApi');
    api.root.addMethod('ANY');
    Aspects.of(stack).add(
      new SetApiGatewayEndpointConfiguration({
        endpointType: EndpointType.PRIVATE,
      })
    );

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      EndpointConfiguration: {
        Types: ['PRIVATE'],
      },
      Parameters: {
        endpointConfigurationTypes: 'PRIVATE',
      },
    });
  });
});

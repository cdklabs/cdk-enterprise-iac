/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnResource, IAspect } from 'aws-cdk-lib';
import { EndpointType } from 'aws-cdk-lib/aws-apigateway';
import { IConstruct } from 'constructs';

export interface SetApiGatewayEndpointConfigurationProps {
  /**
   * API Gateway endpoint type to override to. Defaults to EndpointType.REGIONAL
   *
   * @default EndpointType.REGIONAL
   */
  readonly endpointType?: EndpointType;
}

/**
 * Override RestApis to use a set endpoint configuration.
 *
 * Some regions don't support EDGE endpoints, and some enterprises require
 * specific endpoint types for RestApis
 */
export class SetApiGatewayEndpointConfiguration implements IAspect {
  private _endpointType: EndpointType;

  constructor(props?: SetApiGatewayEndpointConfigurationProps) {
    this._endpointType = props?.endpointType || EndpointType.REGIONAL;
  }

  public visit(node: IConstruct): void {
    if (node instanceof CfnResource) {
      const cfnResourceNode: CfnResource = node;
      if (cfnResourceNode.cfnResourceType == 'AWS::ApiGateway::RestApi') {
        cfnResourceNode.addPropertyOverride('EndpointConfiguration.Types', [
          this._endpointType.toString(),
        ]);
        cfnResourceNode.addPropertyOverride(
          'Parameters.endpointConfigurationTypes',
          this._endpointType.toString()
        );
      }
    }
  }
}

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnResource, IAspect, Stack } from 'aws-cdk-lib';
import { CfnLaunchConfiguration } from 'aws-cdk-lib/aws-autoscaling';
import { CfnInstance } from 'aws-cdk-lib/aws-ec2';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';

import { IConstruct } from 'constructs';

export enum ProxyType {
  'HTTP',
  'HTTPS',
}

export interface AddCfnInitProxyProps {
  proxyHost: string;
  proxyPort: number;
  proxyType?: ProxyType;
  proxyCredentials?: ISecret;
}
/**
 * Add proxy configuration to Cloudformation helper functions
 *
 * @extends IAspect
 */
export class addCfnInitProxy implements IAspect {
  private readonly proxyHost: string;
  private readonly proxyPort: number;
  private readonly proxyType?: ProxyType;
  private readonly proxyCredentials?: ISecret;
  private readonly initResourceTypes: string[];

  constructor(props: AddCfnInitProxyProps) {
    this.proxyHost = props.proxyHost;
    this.proxyPort = props.proxyPort;
    this.proxyType = props.proxyType || ProxyType.HTTP;
    this.proxyCredentials = props.proxyCredentials || undefined;

    this.initResourceTypes = [
      'AWS::AutoScaling::LaunchConfiguration',
      'AWS::EC2::Instance',
    ];
  }

  public visit(node: IConstruct): void {
    if (
      node instanceof CfnResource &&
      this.initResourceTypes.includes(node.cfnResourceType)
    ) {
      let userData;
      if (node.cfnResourceType == CfnInstance.CFN_RESOURCE_TYPE_NAME) {
        const instanceNode = node as CfnInstance;
        userData = Stack.of(node).resolve(instanceNode.userData);
      } else if (
        node.cfnResourceType == CfnLaunchConfiguration.CFN_RESOURCE_TYPE_NAME
      ) {
        const launchConfigNode = node as CfnLaunchConfiguration;
        userData = Stack.of(node).resolve(launchConfigNode.userData);
      }
      console.log(userData);
      const commandList: string[] = userData['Fn::Base64']['Fn::Join'][1];

      const found = commandList.filter((x) => RegExp('--resource').test(x));
      console.log(found);
      for (let index = 0; index < found.length; index++) {
        const element = found[index];
        commandList.indexOf(element);
      }
      console.log(`need to add ${this.proxyHost}`);
      console.log(`need to add ${this.proxyPort}`);
      console.log(`need to add ${this.proxyType}`);
      console.log(`need to add ${this.proxyCredentials}`);
    }
  }
}

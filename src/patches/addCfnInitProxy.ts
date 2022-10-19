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
  private readonly proxyValue: string[];

  constructor(props: AddCfnInitProxyProps) {
    this.proxyHost = props.proxyHost;
    this.proxyPort = props.proxyPort;
    this.proxyType = props.proxyType || ProxyType.HTTP;
    this.proxyCredentials = props.proxyCredentials || undefined;
    this.proxyValue = this.determineProxyValue();
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

      const commandList: string[] = userData['Fn::Base64']['Fn::Join'][1];

      const resourceIndexes = this.indexOfList('--resource', commandList);

      for (
        let i = 0, j = 0;
        i < resourceIndexes.length;
        i++, j += this.proxyValue.length
      ) {
        const lineIdx = resourceIndexes[i] + j;
        commandList.splice(lineIdx, 0, ...this.proxyValue);
      }
      node.addPropertyOverride('UserData.Fn::Base64.Fn::Join.1', commandList);
    }
  }

  private determineProxyValue(): string[] {
    const result = [];
    if (this.proxyType == ProxyType.HTTP) {
      result.push(' --http-proxy http://');
    } else {
      result.push(' --https-proxy https://');
    }

    if (this.proxyCredentials) {
      result.push(
        `${this.proxyCredentials.secretValueFromJson(
          'username'
        )}:${this.proxyCredentials.secretValueFromJson('password')}@`
      );
    }
    result.push(`${this.proxyHost}:${this.proxyPort}`);

    return result;
  }

  private indexOfList(needle: string, haystack: string[]): number[] {
    const result = [];
    for (let idx = 0; idx < haystack.length; idx++) {
      const command: any = haystack[idx];
      if (command instanceof Object) continue;
      if (command.indexOf(needle) >= 0) {
        result.push(idx);
      }
    }
    return result;
  }
}

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnResource, IAspect, Stack } from 'aws-cdk-lib';
import { CfnLaunchConfiguration } from 'aws-cdk-lib/aws-autoscaling';
import { CfnInstance } from 'aws-cdk-lib/aws-ec2';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';

import { IConstruct } from 'constructs';

/**
 * Whether an http-proxy or https-proxy
 */
export enum ProxyType {
  /**
   * --http-proxy
   */
  'HTTP',
  /**
   * --https-proxy
   */
  'HTTPS',
}

/**
 * Properties for the proxy server to use with cfn helper commands
 */
export interface AddCfnInitProxyProps {
  /**
   * host of your proxy
   * @example example.com
   */
  readonly proxyHost: string;
  /**
   * proxy port
   * @example 8080
   */
  readonly proxyPort: number;
  /**
   * Proxy Type
   * @example ProxyType.HTTPS
   * @default ProxyType.HTTP
   */
  readonly proxyType?: ProxyType;
  /**
   * JSON secret containing `user` and `password` properties to use if your proxy requires credentials
   * `http://user:password@host:port` could contain sensitive data, so using a secret
   * @example
   * const secret = new Secret(stack, 'TestSecret', {
      secretObjectValue: {
        user: SecretValue,
        password: SecretValue,
      },
    });
   */
  readonly proxyCredentials?: ISecret;
}
/**
 * Add proxy configuration to Cloudformation helper functions
 *
 * @extends IAspect
 */
export class AddCfnInitProxy implements IAspect {
  private readonly _proxyHost: string;
  private readonly _proxyPort: number;
  private readonly _proxyType?: ProxyType;
  private readonly _proxyCredentials?: ISecret;
  private readonly _initResourceTypes: string[];
  private readonly _proxyValue: string[];

  constructor(props: AddCfnInitProxyProps) {
    this._proxyHost = props.proxyHost;
    this._proxyPort = props.proxyPort;
    this._proxyType = props.proxyType || ProxyType.HTTP;
    this._proxyCredentials = props.proxyCredentials || undefined;
    this._proxyValue = this.determineProxyValue();
    this._initResourceTypes = [
      'AWS::AutoScaling::LaunchConfiguration',
      'AWS::EC2::Instance',
    ];
  }

  public visit(node: IConstruct): void {
    if (
      node instanceof CfnResource &&
      this._initResourceTypes.includes(node.cfnResourceType)
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
        i++, j += this._proxyValue.length
      ) {
        const lineIdx = resourceIndexes[i] + j;
        commandList.splice(lineIdx, 0, ...this._proxyValue);
      }
      node.addPropertyOverride('UserData.Fn::Base64.Fn::Join', [
        '',
        commandList,
      ]);
    }
  }

  private determineProxyValue(): string[] {
    const result = [];
    if (this._proxyType == ProxyType.HTTP) {
      result.push(' --http-proxy http://');
    } else {
      result.push(' --https-proxy https://');
    }

    if (this._proxyCredentials) {
      result.push(
        `${this._proxyCredentials
          .secretValueFromJson('user')
          .unsafeUnwrap()}:${this._proxyCredentials
          .secretValueFromJson('password')
          .unsafeUnwrap()}@`
      );
    }
    result.push(`${this._proxyHost}:${this._proxyPort}`);

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

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';

import { enterpriseDnsResolver } from '../../../src/constructs/enterpriseDnsResolver/enterpriseDnsResolver';

let stack: Stack;

// beforeEach(() => {
//   stack = new Stack()
// })

describe('Enterprise DNS resolver', () => {
  stack = new Stack();
  const enterpriseDnsIpAddresses = ['1.1.1.1', '2.2.2.2', '3.3.3.3', '4.4.4.4'];
  const vpc = new Vpc(stack, 'TestVpc', { maxAzs: 2 });

  new enterpriseDnsResolver(stack, 'EnterpriseDnsResolver', {
    vpc,
    enterpriseDnsIpAddresses,
  });

  const template = Template.fromStack(stack);

  test('Security group created in the right vpc', () => {
    template.resourcePropertiesCountIs(
      'AWS::EC2::SecurityGroup',
      {
        VpcId: {
          Ref: Match.anyValue(),
        },
      },
      1
    );
  });
  test('Resolver endpoint is created in all vpc subnets', () => {
    template.resourcePropertiesCountIs(
      'AWS::Route53Resolver::ResolverEndpoint',
      {
        IpAddresses: [
          // 4 subnets
          {
            SubnetId: {
              Ref: Match.anyValue(),
            },
          },
          {
            SubnetId: {
              Ref: Match.anyValue(),
            },
          },
          {
            SubnetId: {
              Ref: Match.anyValue(),
            },
          },
          {
            SubnetId: {
              Ref: Match.anyValue(),
            },
          },
        ],
      },
      1
    );
  });

  test('Two system rules are created', () => {
    template.resourceCountIs('AWS::Route53Resolver::ResolverRule', 2);
  });

  test('Enterprise Dns Rule includes all provided dns IPs', () => {
    let targetIpMatch: any[] = [];

    for (let i = 0; i < enterpriseDnsIpAddresses.length; i++) {
      targetIpMatch.push(Match.anyValue());
    }

    template.resourcePropertiesCountIs(
      'AWS::Route53Resolver::ResolverRule',
      {
        DomainName: '.',
        TargetIps: [
          {
            Ip: enterpriseDnsIpAddresses[0],
          },
          {
            Ip: enterpriseDnsIpAddresses[1],
          },
          {
            Ip: enterpriseDnsIpAddresses[2],
          },
          {
            Ip: enterpriseDnsIpAddresses[3],
          },
        ],
        RuleType: 'FORWARD',
      },
      1
    );
  });
});

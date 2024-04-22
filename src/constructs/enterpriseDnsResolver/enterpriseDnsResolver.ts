/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { IVpc, Peer, Port, SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import {
  CfnResolverEndpoint,
  CfnResolverRule,
  CfnResolverRuleAssociation,
} from 'aws-cdk-lib/aws-route53resolver';
import { Construct } from 'constructs';

export interface enterpriseDnsResolverProps {
  /**
   * Vpc or IVpc to associate resolver rules with
   */
  readonly vpc: Vpc | IVpc;
  /**
   * List of IPs for enterprise DNS servers
   */
  readonly enterpriseDnsIpAddresses: string[];
}

export class enterpriseDnsResolver extends Construct {
  private readonly _vpc: Vpc | IVpc;
  private readonly _enterpriseDnsIpAddresses: string[];

  constructor(scope: Construct, id: string, props: enterpriseDnsResolverProps) {
    super(scope, id);

    this._vpc = props.vpc;
    this._enterpriseDnsIpAddresses = props.enterpriseDnsIpAddresses;

    const sg = new SecurityGroup(this, 'resolverEndpointSecurityGroup', {
      vpc: this._vpc,
    });
    sg.addIngressRule(
      Peer.ipv4(this._vpc.vpcCidrBlock),
      Port.tcp(53),
      'tcp port 53 for route53 resolver'
    );
    sg.addIngressRule(
      Peer.ipv4(this._vpc.vpcCidrBlock),
      Port.udp(53),
      'udp port 53 for route53 resolver'
    );

    let ipAddresses: CfnResolverEndpoint.IpAddressRequestProperty[] = [];
    const combinedSubnets = [
      ...this._vpc.publicSubnets,
      ...this._vpc.privateSubnets,
      ...this._vpc.isolatedSubnets,
    ];

    for (let i = 0; i < combinedSubnets.length; i++) {
      const subnet = combinedSubnets[i];
      ipAddresses.push({
        subnetId: subnet.subnetId,
      });
    }

    const resolverEndpoint = new CfnResolverEndpoint(
      this,
      'EnterpriseDnsResolverEndpoint',
      {
        direction: 'OUTBOUND',
        securityGroupIds: [sg.securityGroupId],
        ipAddresses,
      }
    );

    // system rule
    const systemRule = new CfnResolverRule(this, 'AmazonInternalRule', {
      domainName: 'amazon.internal',
      ruleType: 'SYSTEM',
    });

    let targetIps: CfnResolverRule.TargetAddressProperty[] = [];
    for (let i = 0; i < this._enterpriseDnsIpAddresses.length; i++) {
      const ip = this._enterpriseDnsIpAddresses[i];
      targetIps.push({
        ip,
        port: '53',
      });
    }
    // Enterprise DNS rule
    const enterpriseRule = new CfnResolverRule(this, 'EnterpriseDnsRule', {
      domainName: '.',
      resolverEndpointId: resolverEndpoint.attrResolverEndpointId,
      ruleType: 'FORWARD',
      targetIps,
    });

    new CfnResolverRuleAssociation(this, 'SystemRuleAssociation', {
      resolverRuleId: systemRule.attrResolverRuleId,
      vpcId: this._vpc.vpcId,
    });

    new CfnResolverRuleAssociation(this, 'EnterpriseDnsRuleAssociation', {
      resolverRuleId: enterpriseRule.attrResolverRuleId,
      vpcId: this._vpc.vpcId,
    });
  }
}

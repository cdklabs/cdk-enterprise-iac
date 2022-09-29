/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  PopulateWithConfig,
  SplitVpcEvenly,
  SubnetConfig,
  SubnetTag,
} from '../../src/constructs/populateProvidedVpc';

let stack: Stack;
const privateRouteTableId = 'tgw-123456abcdefg';
const localRouteTableId = 'rt-abcdefg123456';
const vpcId = 'vpc-123456abcdefghijklmnop';

beforeEach(() => {
  stack = new Stack();
});

describe('CDKify a provided vpc', () => {
  test('provided manual subnet configuration applied', () => {
    const subnetConfig: SubnetConfig[] = [
      {
        groupName: 'app',
        cidrRange: '172.31.0.0/27',
        availabilityZone: 'a',
        subnetTag: SubnetTag.PUBLIC,
      },
      {
        groupName: 'app',
        cidrRange: '172.31.0.32/27',
        availabilityZone: 'b',
        subnetTag: SubnetTag.PUBLIC,
      },
      {
        groupName: 'db',
        cidrRange: '172.31.0.64/27',
        availabilityZone: 'a',
        subnetTag: SubnetTag.PRIVATE,
      },
      {
        groupName: 'db',
        cidrRange: '172.31.0.96/27',
        availabilityZone: 'b',
        subnetTag: SubnetTag.PRIVATE,
      },
      {
        groupName: 'iso',
        cidrRange: '172.31.0.128/26',
        availabilityZone: 'a',
        subnetTag: SubnetTag.ISOLATED,
      },
      {
        groupName: 'iso',
        cidrRange: '172.31.0.196/26',
        availabilityZone: 'b',
        subnetTag: SubnetTag.ISOLATED,
      },
    ];
    new PopulateWithConfig(stack, 'CDKifyVpc', {
      vpcId,
      privateRouteTableId,
      localRouteTableId,
      subnetConfig,
    });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::EC2::Subnet', 6);

    template.resourcePropertiesCountIs(
      'AWS::EC2::Subnet',
      {
        Tags: Match.arrayWith([
          { Key: 'aws-cdk:subnet-type', Value: 'Public' },
        ]),
      },
      2
    );
    template.resourcePropertiesCountIs(
      'AWS::EC2::Subnet',
      {
        Tags: Match.arrayWith([
          { Key: 'aws-cdk:subnet-type', Value: 'Private' },
        ]),
      },
      2
    );
    template.resourcePropertiesCountIs(
      'AWS::EC2::Subnet',
      {
        Tags: Match.arrayWith([
          { Key: 'aws-cdk:subnet-type', Value: 'Isolated' },
        ]),
      },
      2
    );
  });
  test('split vpc evenly with defaults', () => {
    new SplitVpcEvenly(stack, 'CDKifyVpc', {
      vpcId,
      routeTableId: privateRouteTableId,
      vpcCidr: '172.16.0.0/24',
    });
    const template = Template.fromStack(stack);

    template.resourcePropertiesCountIs(
      'AWS::EC2::Subnet',
      {
        Tags: Match.arrayWith([
          { Key: 'aws-cdk:subnet-type', Value: 'Private' },
        ]),
      },
      3
    );
    template.resourcePropertiesCountIs(
      'AWS::EC2::SubnetRouteTableAssociation',
      {
        RouteTableId: privateRouteTableId,
      },
      3
    );
  });
  test('split vpc evenly larger subnet and set cidrBits', () => {
    new SplitVpcEvenly(stack, 'CDKifyVpc', {
      vpcId,
      routeTableId: privateRouteTableId,
      vpcCidr: '172.16.0.0/16',
      cidrBits: '10',
    });
    const template = Template.fromStack(stack);

    template.resourcePropertiesCountIs(
      'AWS::EC2::Subnet',
      {
        CidrBlock: {
          'Fn::Select': Match.arrayWith([
            { 'Fn::Cidr': ['172.16.0.0/16', 3, '10'] },
          ]),
        },
      },
      3
    );
  });

  test('split vpc evenly reduced AZs', () => {
    new SplitVpcEvenly(stack, 'CDKifyVpc', {
      vpcId,
      routeTableId: privateRouteTableId,
      vpcCidr: '172.16.0.0/16',
      cidrBits: '10',
      numberOfAzs: 2,
    });
    const template = Template.fromStack(stack);

    template.resourcePropertiesCountIs(
      'AWS::EC2::Subnet',
      {
        CidrBlock: {
          'Fn::Select': Match.arrayWith([
            { 'Fn::Cidr': ['172.16.0.0/16', 2, '10'] },
          ]),
        },
      },
      2
    );
  });
  test('split vpc evenly and set subnet tag', () => {
    new SplitVpcEvenly(stack, 'CDKifyVpc', {
      vpcId,
      routeTableId: privateRouteTableId,
      vpcCidr: '172.16.0.0/24',
      subnetTag: SubnetTag.ISOLATED,
    });
    const template = Template.fromStack(stack);

    template.resourcePropertiesCountIs(
      'AWS::EC2::Subnet',
      {
        Tags: Match.arrayWith([
          { Key: 'aws-cdk:subnet-type', Value: 'Isolated' },
        ]),
      },
      3
    );
  });
});

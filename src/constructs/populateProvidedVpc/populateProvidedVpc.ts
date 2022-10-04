/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Fn, Stack, Tags } from 'aws-cdk-lib';
import { CfnSubnet, CfnSubnetRouteTableAssociation } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * The tag value for `aws-cdk:subnet-type` which will be applied to a subnet
 */
export enum SubnetTag {
  /**
   * {"Name": "aws-cdk:subnet-type", "Value": "Private"} tag on a subnet
   */
  PRIVATE = 'Private',
  /**
   * {"Name": "aws-cdk:subnet-type", "Value": "Public"} tag on a subnet
   */
  PUBLIC = 'Public',
  /**
   * {"Name": "aws-cdk:subnet-type", "Value": "Isolated"} tag on a subnet
   */
  ISOLATED = 'Isolated',
}

export interface SubnetConfig {
  /**
   * Logical group name of a subnet
   * @example app
   * @example db
   */
  readonly groupName: string;
  /**
   * Which availability zone the subnet should be in
   *
   */
  readonly availabilityZone: string;
  /**
   * Cidr range of the subnet to create
   */
  readonly cidrRange: string;
  /**
   * What subnet tag to use
   */
  readonly subnetTag: SubnetTag;
}

export interface PopulateWithConfigProps {
  /**
   * ID of the VPC provided that needs to be populated
   */
  readonly vpcId: string;
  /**
   * Route table ID for a provided route table with routes to enterprise network
   *
   * Both SubnetTag.PUBLIC and SubnetTag.PRIVATE will use this property
   */
  readonly privateRouteTableId: string;
  /**
   * Local route table ID, with routes only to local VPC
   */
  readonly localRouteTableId: string;
  /**
   * List of Subnet configs to provision to provision
   */
  readonly subnetConfig: SubnetConfig[];
}

/**
 * Populate a provided VPC with subnets based on a provided configuration
 *
 * @example
 * const mySubnetConfig: SubnetConfig[] = [
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
 * new PopulateWithConfig(this, "vpcPopulater", {
 *   vpcId: 'vpc-abcdefg1234567',
 *   privateRouteTableId: 'rt-abcdefg123456',
 *   localRouteTableId: 'rt-123456abcdefg',
 *   subnetConfig: mySubnetConfig,
 * })
 */
export class PopulateWithConfig extends Construct {
  private readonly _vpcId: string;
  private readonly _privateRouteTableId: string;
  private readonly _localRouteTableId: string;
  private readonly _subnetConfig: SubnetConfig[];

  constructor(scope: Construct, id: string, props: PopulateWithConfigProps) {
    super(scope, id);

    this._vpcId = props.vpcId;
    this._privateRouteTableId = props.privateRouteTableId;
    this._localRouteTableId = props.localRouteTableId;
    this._subnetConfig = props.subnetConfig;

    for (const key in this._subnetConfig) {
      if (Object.prototype.hasOwnProperty.call(this._subnetConfig, key)) {
        const subnet = this._subnetConfig[key];

        const sub = new CfnSubnet(
          this,
          `Subnet${subnet.groupName}-${subnet.availabilityZone}`,
          {
            availabilityZone: `${Stack.of(this).region}${
              subnet.availabilityZone
            }`,
            vpcId: this._vpcId,
            cidrBlock: subnet.cidrRange,
          }
        );
        Tags.of(sub).add('aws-cdk:subnet-type', subnet.subnetTag);
        Tags.of(sub).add(
          'Name',
          `subnet-${subnet.groupName}-${subnet.availabilityZone}`
        );

        new CfnSubnetRouteTableAssociation(
          this,
          `SubnetReAssoc${subnet.groupName}-${subnet.availabilityZone}`,
          {
            routeTableId:
              subnet.subnetTag == 'Isolated'
                ? this._privateRouteTableId
                : this._localRouteTableId,
            subnetId: sub.ref,
          }
        );
      }
    }
  }
}

export interface SplitVpcEvenlyProps {
  /**
   * ID of the existing VPC you're trying to populate
   */
  readonly vpcId: string;
  /**
   * CIDR range of the VPC you're populating
   */
  readonly vpcCidr: string;
  /**
   * Route Table ID that will be attached to each subnet created
   */
  readonly routeTableId: string;
  /**
   * `cidrBits` argument for the [`Fn::Cidr`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-cidr.html) Cloudformation intrinsic function
   *
   * @default '6'
   */
  readonly cidrBits?: string;
  /**
   * Number of AZs to evenly split into
   *
   * @default 3
   */
  readonly numberOfAzs?: number;
  /**
   * @default SubnetTag.PRIVATE
   */
  readonly subnetTag?: SubnetTag;
}
/**
 * Splits a VPC evenly between a provided number of AZs (3 if not defined), and attaches a provided route table to each, and labels
 *
 * @example
 * new SplitVpcEvenly(this, 'evenSplitVpc', {
 *   vpcId: 'vpc-abcdefg123456',
 *   vpcCidr: '172.16.0.0/24',
 *   routeTableId: 'rt-abcdefgh123456',
 * });
 * @example
 * // with more specific properties
 * new SplitVpcEvenly(this, 'evenSplitVpc', {
 *   vpcId: 'vpc-abcdefg123456',
 *   vpcCidr: '172.16.0.0/16',
 *   routeTableId: 'rt-abcdefgh123456',
 *   cidrBits: '10',
 *   numberOfAzs: 4,
 *   subnetTag: SubnetTag.ISOLATED,
 * });
 */
export class SplitVpcEvenly extends Construct {
  private readonly _vpcId: string;
  private readonly _vpcCidr: string;
  private readonly _routeTableId: string;
  private readonly _cidrBits?: string;
  private readonly _numberOfAzs?: number;
  private readonly _subnetTag?: SubnetTag;

  constructor(scope: Construct, id: string, props: SplitVpcEvenlyProps) {
    super(scope, id);

    this._vpcId = props.vpcId;
    this._vpcCidr = props.vpcCidr;
    this._routeTableId = props.routeTableId;
    this._cidrBits = props.cidrBits || '6';
    this._numberOfAzs = props.numberOfAzs || 3;
    this._subnetTag = props.subnetTag || SubnetTag.PRIVATE;

    // Throw error if > 6 AZs
    if (this._numberOfAzs < 2 || this._numberOfAzs > 6) {
      throw new Error('numberOfAzs must be between 2 and 6');
    }

    // based on number of az, create an array of az strings
    const azs: string[] = [];
    for (let i = 0; i < this._numberOfAzs; i++) {
      azs.push(String.fromCharCode(97 + i));
    }

    azs.forEach((val, i) => {
      const sub = new CfnSubnet(this, `TgwSubnet${val}`, {
        availabilityZone: Fn.select(i, Fn.getAzs()),
        vpcId: this._vpcId,
        cidrBlock: Fn.select(
          i,
          Fn.cidr(this._vpcCidr, this._numberOfAzs!, this._cidrBits)
        ),
      });
      Tags.of(sub).add('aws-cdk:subnet-type', this._subnetTag!);
      Tags.of(sub).add('Name', `subnet-${val}`);

      new CfnSubnetRouteTableAssociation(this, `SubnetRtAssoc${val}`, {
        routeTableId: this._routeTableId,
        subnetId: sub.ref,
      });
    });
  }
}

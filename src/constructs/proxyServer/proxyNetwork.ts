import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface ProxyNetworkProps {
  /**
   * Port which the proxy will use
   */
  readonly proxyPort: number;
}

/**
 * Creates a ProxyNetwork construct. This construct will deploy a vpc with
 * (2) availability zones, public and private isolated subnet and creat a
 * security group for the proxy server.
 *
 * @param scope The parent creating construct (usually `this`).
 * @param id The construct's name.
 * @param this A `ProxyNetworkProps` interface.
 */

export class ProxyNetwork extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: ProxyNetworkProps) {
    super(scope, id);

    // Create the proxy VPC
    this.vpc = new ec2.Vpc(this, 'rProxyVPC', {
      cidr: '172.16.0.0/18',
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: 'rProxyPublic',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'rProxyPrivate',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Attach a flowlog to the proxy vpc
    this.vpc.addFlowLog('rProxyVPCFlowLog');

    // Create Security Group for the proxy
    this.securityGroup = new ec2.SecurityGroup(this, 'rProxySecurityGroup', {
      vpc: this.vpc,
      description: 'Proxy Security Group',
    });

    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(props.proxyPort),
      'Allow access on proxy port within proxy VPC '
    );
  }
}

export interface ProxyNetworkSecurityGroupProps {
  /**
   * VPC which the proxy will use
   */
  readonly vpc: ec2.Vpc;
  /**
   * Port which the proxy will use
   */
  readonly proxyPort: number;
}

/**
 * Create a Security Group to attach to the VPC
 *
 * @param scope The parent creating construct (usually `this`).
 * @param id The construct's name.
 * @param this A `ProxyNetworkSecurityGroupProps` interface.
 */

export class ProxyNetworkSecurityGroup extends Construct {
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    props: ProxyNetworkSecurityGroupProps
  ) {
    super(scope, id);

    // Create Security Group for the proxy
    this.securityGroup = new ec2.SecurityGroup(this, 'rProxySecurityGroup', {
      vpc: props.vpc,
      description: 'Proxy Security Group',
    });

    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(props.proxyPort),
      'Allow access on proxy port within proxy VPC '
    );
  }
}

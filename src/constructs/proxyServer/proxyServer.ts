import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as ansiblePB from './createAnsiblePlaybook';
import * as proxyNetwork from './proxyNetwork';
import * as proxyResources from './proxyResources';

export interface ProxyProps {
  /**
   * Name of the bucket to create where the Ansible Playbook will be stored
   */
  readonly proxyPlaybookBucketName: string;
  /**
   * Array of the approved Domain for for proxy server
   *
   * @default ['.amazon.com']
   *
   */
  readonly proxyApprovedDomains?: string[];
  /**
   * Port which the proxy will use
   */
  readonly proxyPort?: number;
  /**
   * Vpc to launch the proxy server, should have public subnets and private
   * isolated subnets
   *
   * @default A Vpc with 2 Az containg a public subnet and private isolated
   * subnet in each AZ will be created
   *
   */
  readonly proxyVPC?: ec2.Vpc;
  /**
   * The security group for the proxy server.
   *
   * @default A security group with TCP allowed on {proxyPort} for all
   * resources within the proxy vpc cidr
   */
  readonly proxySecurityGroup?: ec2.SecurityGroup;
}

/**
 * Creates a Proxy construct. This construct allows you to deploy a proxy server
 * in an Auto Scaling Group fronted by a Networl Loadbalancer
 *
 * @param scope The parent creating construct (usually `this`).
 * @param id The construct's name.
 * @param this A `proxyProps` interface.
 */

export class Proxy extends Construct {
  //public readonly network: proxyNetwork.ProxyNetwork;
  public readonly resources: proxyResources.ProxyResources;
  public readonly proxyUrl: string;
  public readonly proxyArn: string;

  constructor(scope: Construct, id: string, props: ProxyProps) {
    super(scope, id);

    // Default approved domain for proxy
    // Default proxy port
    const { proxyApprovedDomains = ['.amazon.com'], proxyPort = 3128 } = props;

    let proxyVpc: ec2.Vpc;
    let proxySecurityGroup: ec2.SecurityGroup;

    // Create the vpc for the proxy and security group
    if (props.proxyVPC == null && props.proxySecurityGroup == null) {
      const network = new proxyNetwork.ProxyNetwork(scope, 'proxyVPC', {
        proxyPort: props.proxyPort ?? proxyPort,
      });
      proxyVpc = network.vpc;
      proxySecurityGroup = network.securityGroup;
    }
    // Create the security for the given VPC
    else if (props.proxyVPC != null && props.proxySecurityGroup == null) {
      proxySecurityGroup = new proxyNetwork.ProxyNetworkSecurityGroup(
        this,
        'proxySG',
        {
          vpc: props.proxyVPC,
          proxyPort: props.proxyPort ?? proxyPort,
        }
      ).securityGroup;

      proxyVpc = props.proxyVPC;
    }
    // Use the give VPC and Security Group
    else {
      proxyVpc = props.proxyVPC!;
      proxySecurityGroup = props.proxySecurityGroup!;
    }

    // create the ansible playbook and upload to s3
    const ansiblePlaybook = new ansiblePB.AnsiblePlaybook(
      this,
      'ansiblePlaybook',
      {
        bucketName: props.proxyPlaybookBucketName,
        approvedDomains: props.proxyApprovedDomains ?? proxyApprovedDomains,
        proxyPort: props.proxyPort ?? proxyPort,
      }
    );

    // Create the proxy
    this.resources = new proxyResources.ProxyResources(
      scope,
      'proxyResources',
      {
        vpc: proxyVpc,
        proxySG: proxySecurityGroup,
        proxyPort: props.proxyPort ?? proxyPort,
        ansibleBucket: 's3://' + ansiblePlaybook.bucket.bucketName,
        testBucket: ansiblePlaybook.bucket,
      }
    );

    this.proxyUrl = this.resources.proxyUrl;
    this.proxyArn = this.resources.proxyArn;
  }
}

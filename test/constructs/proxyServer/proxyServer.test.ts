import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
//import * as CreteProxyServer from '../lib/crete_proxy_server-stack';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as proxy from '../../../src/constructs/proxyServer/proxyServer';

let stack: cdk.Stack;

beforeEach(() => {
  stack = new cdk.Stack();
});

describe('Create the proxy server', () => {
  test('Create proxy server not providing VPC and SG', () => {
    // Create the proxy Server
    new proxy.Proxy(stack, 'rProxy', {
      proxyPlaybookBucketName: 'testPlaybook',
    });

    // Get the Stacks Cloudfromation template
    const template = Template.fromStack(stack);

    // Validate all the resourse are in the Cloudformation Template
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    template.resourceCountIs('AWS::EC2::Subnet', 4);
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
          { Key: 'aws-cdk:subnet-type', Value: 'Isolated' },
        ]),
      },
      2
    );
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::S3::BucketPolicy', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        { Key: 'aws-cdk:auto-delete-objects', Value: 'true' },
      ]),
    });
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    template.hasResourceProperties(
      'AWS::ElasticLoadBalancingV2::LoadBalancer',
      {
        Scheme: 'internal',
        Type: 'network',
      }
    );
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 1);
    template.resourceCountIs('AWS::IAM::InstanceProfile', 1);
    template.resourceCountIs('AWS::EC2::LaunchTemplate', 1);
    template.resourceCountIs('AWS::Logs::LogGroup', 2);
    template.resourceCountIs('AWS::AutoScaling::AutoScalingGroup', 1);
    template.resourceCountIs('AWS::AutoScaling::ScalingPolicy', 2);
    template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 1);
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });

  // Test for providing VPC but not SG
  test('Create proxy server providing VPC but not SG', () => {
    // Create the VPC the proxy will be placed in
    const customerVpc = new ec2.Vpc(stack, 'customerVpc', {
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

    // Attach a flowlog to the PROXY VPC
    customerVpc.addFlowLog('rProxyVPCFlowLog');

    // Create the proxy server in the given VPC
    new proxy.Proxy(stack, 'rProxy', {
      proxyPlaybookBucketName: 'testPlaybook',
      proxyVPC: customerVpc,
    });

    // Get the stacks Cloudfromation template
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    template.resourceCountIs('AWS::EC2::Subnet', 4);
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
          { Key: 'aws-cdk:subnet-type', Value: 'Isolated' },
        ]),
      },
      2
    );
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::S3::BucketPolicy', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        { Key: 'aws-cdk:auto-delete-objects', Value: 'true' },
      ]),
    });
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    template.hasResourceProperties(
      'AWS::ElasticLoadBalancingV2::LoadBalancer',
      {
        Scheme: 'internal',
        Type: 'network',
      }
    );
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 1);
    template.resourceCountIs('AWS::IAM::InstanceProfile', 1);
    template.resourceCountIs('AWS::EC2::LaunchTemplate', 1);
    template.resourceCountIs('AWS::Logs::LogGroup', 2);
    template.resourceCountIs('AWS::AutoScaling::AutoScalingGroup', 1);
    template.resourceCountIs('AWS::AutoScaling::ScalingPolicy', 2);
    template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 1);
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });

  // Test for providing VPC and SG
  test('Create proxy server providing VPC and SG', () => {
    // Create the VPC the proxy will be placed in
    const customerVpc = new ec2.Vpc(stack, 'customerVpc', {
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

    // Attach a flowlog to the PROXY VPC
    customerVpc.addFlowLog('rProxyVPCFlowLog');

    // Create the Security Group for the Proxy Servers
    const customerSecurityGroup = new ec2.SecurityGroup(
      stack,
      'customerSecurityGroup',
      {
        vpc: customerVpc,
        description: 'Proxy Security Group',
      }
    );

    customerSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(customerVpc.vpcCidrBlock),
      ec2.Port.tcp(3128),
      'Allow access on proxy port within proxy VPC '
    );

    new proxy.Proxy(stack, 'rProxy', {
      proxyPlaybookBucketName: 'testPlaybook',
      proxyVPC: customerVpc,
      proxySecurityGroup: customerSecurityGroup,
    });

    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.resourceCountIs('AWS::EC2::InternetGateway', 1);
    template.resourceCountIs('AWS::EC2::SecurityGroup', 1);
    template.resourceCountIs('AWS::EC2::Subnet', 4);

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
          { Key: 'aws-cdk:subnet-type', Value: 'Isolated' },
        ]),
      },
      2
    );

    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::S3::BucketPolicy', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        { Key: 'aws-cdk:auto-delete-objects', Value: 'true' },
      ]),
    });

    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    template.hasResourceProperties(
      'AWS::ElasticLoadBalancingV2::LoadBalancer',
      {
        Scheme: 'internal',
        Type: 'network',
      }
    );
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 1);
    template.resourceCountIs('AWS::IAM::InstanceProfile', 1);
    template.resourceCountIs('AWS::EC2::LaunchTemplate', 1);
    template.resourceCountIs('AWS::Logs::LogGroup', 2);
    template.resourceCountIs('AWS::AutoScaling::AutoScalingGroup', 1);
    template.resourceCountIs('AWS::AutoScaling::ScalingPolicy', 2);
    template.resourceCountIs('AWS::CloudWatch::Alarm', 2);
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 1);
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
  });
});

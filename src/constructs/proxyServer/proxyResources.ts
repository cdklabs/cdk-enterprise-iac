import * as cdk from 'aws-cdk-lib';
import * as asg from 'aws-cdk-lib/aws-autoscaling';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elb from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface IProxyResourcesProps {
  /**
   * Vpc to deploy the proxy server in
   */
  readonly vpc: ec2.Vpc;
  /**
   * Security group to attach to the proxy server instances
   */
  readonly proxySG: ec2.SecurityGroup;
  /**
   * Port proxy server is accessible on
   */
  readonly proxyPort: number;
  /**
   * Bucket Ansible playbook can be downloaded from for porxy server instances
   */
  readonly ansibleBucket: string;

  readonly testBucket: s3.Bucket;
}

/**
 * Creates a ProxyResources construct. This construct will deploy a auto scaling group
 * and network load balancer to create a proxy server that can be accessed in the
 * private isolated subnets of the vpc it is created in.
 *
 * @param scope The parent creating construct (usually `this`).
 * @param id The construct's name.
 * @param this A `ProxyResourcesProps` interface.
 *
 */

export class ProxyResources extends Construct {
  public readonly proxyUrl: string;
  public readonly proxyArn: string;

  constructor(scope: Construct, id: string, props: IProxyResourcesProps) {
    super(scope, id);

    // Create the proxy role
    const rProxyRole = new iam.Role(this, 'rProxyRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      path: '/',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSSMManagedInstanceCore'
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'CloudWatchAgentServerPolicy'
        ),
      ],
      //inlinePolicies: { proxyPolicy: ProxyPolicy }
    });

    // Create the network load balancer
    const rNlb = new elb.NetworkLoadBalancer(this, 'rNlb', {
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // Create the proxy url string
    this.proxyUrl =
      'http://' + rNlb.loadBalancerDnsName + ':' + props.proxyPort;

    this.proxyArn = rNlb.loadBalancerArn;

    // Create the user data for the launch template
    const userData = ec2.UserData.forLinux();

    userData.addCommands(
      'exec > >(tee -a /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',
      'yum -y install lvm2',
      'yum -y install xfsprogs',
      'echo "Setup volumes"',
      '# Configure logical volumes',
      'vgcreate osvolume /dev/xvdb',
      'lvcreate -l 15%VG -n tmp /dev/osvolume',
      'lvcreate -l 20%VG -n usr_home /dev/osvolume',
      'lvcreate -l  5%VG -n var /dev/osvolume',
      'lvcreate -l 40%VG -n var_log /dev/osvolume',
      'lvcreate -l 10%VG -n var_log_audit /dev/osvolume',
      '# Format logical volumes',
      'mkfs.xfs -f /dev/osvolume/tmp',
      'mkfs.xfs -f /dev/osvolume/usr_home',
      'mkfs.xfs -f /dev/osvolume/var',
      'mkfs.xfs -f /dev/osvolume/var_log',
      'mkfs.xfs -f /dev/osvolume/var_log_audit',

      '# Mount logical volumes',
      'cat << EOF >> /etc/fstab',
      '/dev/osvolume/tmp /tmp xfs defaults,nodev,nosuid,noexec 0 0',
      '/dev/osvolume/usr_home /usr/home xfs defaults,nodev,nosuid 0 0',
      '/dev/osvolume/var /var xfs defaults,nodev,nosuid 0 0',
      '/dev/osvolume/var_log /var/log xfs defaults,nodev,nosuid 0 0',
      '/dev/osvolume/var_log_audit /var/log/audit xfs defaults,nodev,nosuid 0 0',
      'EOF',

      'mount /tmp',
      'mkdir /usr/home',
      'mount /usr/home',
      'rsync -apXs /home/ /usr/home/',
      'rsync -apXs /var/ /tmp/var/',
      'mount /var',
      'mkdir /var/log',
      'mount /var/log',
      'mkdir /var/log/audit',
      'mount /var/log/audit',
      'rsync -apXs /tmp/var/ /var/',
      'rm -rf /tmp/*',
      'exec > >(tee -a /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1',

      'mkdir -p /root/.aws',
      'cat << EOF >> /root/.aws/config',
      '[default]',
      `region = ${cdk.Stack.of(this).region}`, //FXIME
      'EOF',
      'chmod 600 /root/.aws/config',

      '# update and install required software',
      'yum -y update',
      'yum -y install python-pip python-setuptools awscli awslogs',

      '# Enable the Extra Packages for Enterprise Linux (EPEL) repository',
      'amazon-linux-extras install ansible2 -y',

      '# verify ansible install',
      'ansible --version',

      '# If installing on platform other than AL2, can install helper scripts using link below;',
      '## See docs here: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-helper-scripts-reference.html',
      '# easy_install https://s3.amazonaws.com/cloudformation-examples/aws-cfn-bootstrap-py3-latest.tar.gz',

      '# If running from high-side, install cfn-helper scripts and add extra parameters',
      `add_cfn_param=''`,

      '# Start cfn-init',
      `/opt/aws/bin/cfn-init -s ${
        cdk.Stack.of(this).stackId
      } -r proxyAsgLaunchTemplate --region ${
        cdk.Stack.of(this).region
      } --role ${
        rProxyRole.roleName
      } $add_cfn_param || error_exit 'Failed to run cfn-init'`,

      'pip freeze',

      'echo "User data complete"'
    );

    // Create the launch template for the auto scaling group
    const proxyAsgLaunchTemplate = new ec2.LaunchTemplate(
      this,
      'proxyAsgLaunchTemplate',
      {
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.T2,
          ec2.InstanceSize.MICRO
        ),
        machineImage: ec2.MachineImage.latestAmazonLinux({
          generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        }),
        securityGroup: props.proxySG,
        role: rProxyRole,
        blockDevices: [
          {
            deviceName: '/dev/xvda',
            volume: ec2.BlockDeviceVolume.ebs(100, {
              volumeType: ec2.EbsDeviceVolumeType.GP2,
            }),
          },
          {
            deviceName: '/dev/xvdb',
            volume: ec2.BlockDeviceVolume.ebs(250, {
              volumeType: ec2.EbsDeviceVolumeType.GP2,
            }),
          },
        ],
        userData: userData,
      }
    );
    // Create the log group
    const rProxyLogGroup = new logs.LogGroup(this, 'rProxyLogGroup', {
      retention: 7, //Days
    });

    // Create a restart handle for cfn-init
    const handle = new ec2.InitServiceRestartHandle();

    // Create the Auto Scaling Group
    const rProxyAsg = new asg.AutoScalingGroup(this, 'rProxyASG', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      cooldown: cdk.Duration.seconds(120),
      healthCheck: asg.HealthCheck.elb({ grace: cdk.Duration.seconds(300) }), //FIXME will enable health check on the elb for the ASG
      desiredCapacity: 2,
      maxCapacity: 6,
      minCapacity: 2,
      terminationPolicies: [asg.TerminationPolicy.OLDEST_INSTANCE],
      launchTemplate: proxyAsgLaunchTemplate,

      init: ec2.CloudFormationInit.fromElements(
        ec2.InitFile.fromString(
          '/etc/awslogs/awscli.conf',
          ` [plugins] \n cwlogs = cwlogs \n [default] \n region = ${
            cdk.Stack.of(this).region
          }`,
          { mode: '000755', owner: 'root', group: 'root' }
        ),

        ec2.InitFile.fromString(
          '/etc/ansible/ansible.cfg',
          '[defaults] \nlog_path = /var/log/ansible.log',
          { mode: '000755', owner: 'root', group: 'root' }
        ),

        ec2.InitFile.fromString(
          '/etc/awslogs/awslogs.conf',
          `
          state_file = /var/lib/awslogs/agent-state
          #datetime_format = %d/%b/%Y:%H:%M:%S

          [/var/log/ansible/ansible.log]
          file = /var/log/ansible.log
          log_group_name = rProxyLogGrou
          log_stream_name = {instance_id}/ansible.log

          [/var/log/user-data.log]
          file = /var/log/user-data.log
          log_group_name = rProxyLogGroup
          log_stream_name = {instance_id}/user-data.log')`,
          { mode: '000400', owner: 'root', group: 'root' }
        ),

        ec2.InitFile.fromString(
          '/etc/cfn/cfn-hup.conf',
          `
          [main]
          stack= ${cdk.Stack.of(this).stackId}
          region= ${cdk.Stack.of(this).region}
          interval=5`,
          {
            mode: '000400',
            owner: 'root',
            group: 'root',
            serviceRestartHandles: [handle],
          }
        ),

        ec2.InitFile.fromString(
          '/etc/cfn/hooks.d/cfn-auto-reloader.conf',
          `
          [cfn-auto-reloader-hook]
          triggers=post.update
          path=Resources.rProxyLaunchTemplate
          action=/opt/aws/bin/cfn-init -v --stack ${
            cdk.Stack.of(this).stackName
          } --resource rProxyLaunchTemplate --region ${
            cdk.Stack.of(this).region
          }
          runas=root`,
          {
            mode: '000400',
            owner: 'root',
            group: 'root',
            serviceRestartHandles: [handle],
          }
        ),

        ec2.InitService.enable('awslogsd', {
          enabled: true,
          ensureRunning: true,
          serviceRestartHandle: handle,
        }),

        ec2.InitService.enable('cfn-hup', {
          enabled: true,
          ensureRunning: true,
          serviceRestartHandle: handle,
        }),

        ec2.InitCommand.shellCommand(
          `aws s3 cp ${props.ansibleBucket}/s3Deployment/ansible-playbook-proxy/ /opt/aws/ansible-playbook-proxy/ --recursive`
        ),

        ec2.InitCommand.shellCommand(
          `aws s3 cp ${props.ansibleBucket}/s3Deployment/squid-resources/ /opt/aws/ --recursive`
        ),
        ec2.InitCommand.shellCommand(
          `aws s3 cp ${props.ansibleBucket}/s3Deployment/config.sh /opt/aws/config.sh`
        ),
        ec2.InitCommand.shellCommand(`bash /opt/aws/config.sh`),

        ec2.InitCommand.shellCommand(
          `ansible-playbook -vvv ./main.yml --extra-vars '{\"squid\": {\"AWS_REGION\": \"${
            cdk.Stack.of(this).region
          }\", \"squid_resources_path\": \"/etc/squid\", \"squid_config_files_path\": \"/opt/aws/cf_resources\" }, \"squid_cloudwatch\": {\"AWS_REGION\": \"${
            cdk.Stack.of(this).region
          }\", \"sns_topic_arn\": \"\", \"log_group_name\": \"${rProxyLogGroup}\", \"proxy_dimension\": \"${
            cdk.Stack.of(this).stackName
          }\"} }' `,
          {
            cwd: '/opt/aws/ansible-playbook-proxy',
            ignoreErrors: true,
            env: {
              ['PATH']:
                '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/root/bin',
            },
          }
        )
      ),
      //signals: asg.Signals.waitForAll({ timeout: cdk.Duration.minutes(10) }), //FIXME decide which one to use
      signals: asg.Signals.waitForCount(1, {
        timeout: cdk.Duration.minutes(10),
      }),
    });

    props.testBucket.grantReadWrite(rProxyAsg);
    rProxyLogGroup.grant(
      rProxyAsg,
      'logs:CreateLogGroup',
      'logs:CreateLogStream',
      'logs:PutLogEvents',
      'logs:DescribeLogStreams'
    );

    // Create metrics for what the ASG will use to scale in and out
    const rProxyWorkerUtilizationMetric = new cw.Metric({
      namespace: 'AWS/EC2',
      metricName: 'CPUUtilization',
      statistic: 'avg',
      dimensionsMap: {
        ['AutoScalingGroupName']: rProxyAsg.autoScalingGroupName,
      },
    });
    rProxyWorkerUtilizationMetric.attachTo(rProxyAsg);

    rProxyAsg.scaleOnMetric('scaleToCPU', {
      metric: rProxyWorkerUtilizationMetric,
      scalingSteps: [
        { upper: 10, change: -1 },
        { lower: 80, change: +1 },
      ],
      adjustmentType: asg.AdjustmentType.CHANGE_IN_CAPACITY,
    });

    // Create the network loadbalancer target group and HTTPS listner
    const rNlbTargetGrouop = new elb.NetworkTargetGroup(
      this,
      'rNlbTargetGrouop',
      {
        port: props.proxyPort,
        protocol: elb.Protocol.TCP,
        vpc: props.vpc,
        deregistrationDelay: cdk.Duration.seconds(60),
        targets: [rProxyAsg],
      }
    );

    rNlb.addListener('rNlbListnerHTTPS', {
      port: props.proxyPort,
      protocol: elb.Protocol.TCP,
      defaultAction: elb.NetworkListenerAction.forward([rNlbTargetGrouop]),
    });

    // Create the widgets for the metrics
    const cpuUtilization = new cw.GraphWidget({
      width: 16,
      height: 9,
      title: 'CPU Utilization',
      region: cdk.Stack.of(this).region,
      left: [
        new cw.Metric({
          namespace: 'AWS/EC2',
          metricName: 'CPUUtilization',
          statistic: 'avg',
          dimensionsMap: {
            ['AutoScalingGroupName']: rProxyAsg.autoScalingGroupName,
          },
        }),
      ],
    });

    const serverRequests = new cw.GraphWidget({
      width: 8,
      height: 3,
      title: 'Server Requests',
      region: cdk.Stack.of(this).region,
      left: [
        new cw.Metric({
          namespace: 'Proxy',
          metricName: 'server.all.requests',
          statistic: 'avg',
          dimensionsMap: { ['Proxy']: cdk.Stack.of(this).stackName },
        }),
        new cw.Metric({
          namespace: 'Proxy',
          metricName: 'server.all.errors',
          statistic: 'avg',
          dimensionsMap: { ['Proxy']: cdk.Stack.of(this).stackName },
        }),
      ],
    });

    const serverTrafficVolume = new cw.GraphWidget({
      width: 8,
      height: 3,
      title: 'Server Traffic Volume',
      region: cdk.Stack.of(this).region,
      left: [
        new cw.Metric({
          namespace: 'Proxy',
          metricName: 'server.all.kbytes_in',
          statistic: 'avg',
          dimensionsMap: { ['Proxy']: cdk.Stack.of(this).stackName },
        }),
        new cw.Metric({
          namespace: 'Proxy',
          metricName: 'server.all.kbytes_out',
          statistic: 'avg',
          dimensionsMap: { ['Proxy']: cdk.Stack.of(this).stackName },
        }),
      ],
    });

    const clientTrafficVolume = new cw.GraphWidget({
      width: 8,
      height: 3,
      title: 'Client Traffic Volume',
      region: cdk.Stack.of(this).region,
      left: [
        new cw.Metric({
          namespace: 'Proxy',
          metricName: 'client_http.kbytes_in',
          statistic: 'avg',
          dimensionsMap: { ['Proxy']: cdk.Stack.of(this).stackName },
        }),
        new cw.Metric({
          namespace: 'Proxy',
          metricName: 'client_http.kbytes_out',
          statistic: 'avg',
          dimensionsMap: { ['Proxy']: cdk.Stack.of(this).stackName },
        }),
      ],
    });

    const clientRequests = new cw.GraphWidget({
      width: 8,
      height: 4,
      title: 'Client Requests',
      region: cdk.Stack.of(this).region,
      left: [
        new cw.Metric({
          namespace: 'Proxy',
          metricName: 'client_http.requests',
          statistic: 'avg',
          dimensionsMap: { ['Proxy']: cdk.Stack.of(this).stackName },
        }),
        new cw.Metric({
          namespace: 'Proxy',
          metricName: 'client_http.hits',
          statistic: 'avg',
          dimensionsMap: { ['Proxy']: cdk.Stack.of(this).stackName },
        }),
        new cw.Metric({
          namespace: 'Proxy',
          metricName: 'client_http.errors',
          statistic: 'avg',
          dimensionsMap: { ['Proxy']: cdk.Stack.of(this).stackName },
        }),
      ],
    });

    const networkIO = new cw.GraphWidget({
      width: 8,
      height: 4,
      title: 'Network IO',
      region: cdk.Stack.of(this).region,
      left: [
        new cw.Metric({
          namespace: 'AWS/EC2',
          metricName: 'NetworkIn',
          statistic: 'avg',
          dimensionsMap: {
            ['AutoScalingGroupName']: rProxyAsg.autoScalingGroupName,
          },
        }),
        new cw.Metric({
          namespace: 'AWS/EC2',
          metricName: 'NetworkOut',
          statistic: 'avg',
          dimensionsMap: {
            ['AutoScalingGroupName']: rProxyAsg.autoScalingGroupName,
          },
        }),
      ],
    });

    const diskIO = new cw.GraphWidget({
      width: 8,
      height: 4,
      title: 'Disk IO',
      region: cdk.Stack.of(this).region,
      left: [
        new cw.Metric({
          namespace: 'AWS/EC2',
          metricName: 'EBSReadBytes',
          statistic: 'avg',
          dimensionsMap: {
            ['AutoScalingGroupName']: rProxyAsg.autoScalingGroupName,
          },
        }),
        new cw.Metric({
          namespace: 'AWS/EC2',
          metricName: 'EBSWriteBytes',
          statistic: 'avg',
          dimensionsMap: {
            ['AutoScalingGroupName']: rProxyAsg.autoScalingGroupName,
          },
        }),
      ],
    });

    // Create Dashboard for metrics
    new cw.Dashboard(this, 'rProxyDashboard', {
      dashboardName: 'cwdashboard-' + cdk.Stack.of(this).stackName,
      widgets: [
        [
          new cw.Column(cpuUtilization),
          new cw.Column(
            serverRequests,
            serverTrafficVolume,
            clientTrafficVolume,
            clientRequests
          ),
        ],
        [networkIO, diskIO],
      ],
    });
  }
}

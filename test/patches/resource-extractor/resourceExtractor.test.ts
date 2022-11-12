/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import {
  App,
  Aspects,
  CfnElement,
  CfnOutput,
  RemovalPolicy,
  Stack,
} from 'aws-cdk-lib';
import { Match, Template, Annotations } from 'aws-cdk-lib/assertions';
import {
  Instance,
  InstanceClass,
  InstanceSize,
  InstanceType,
  MachineImage,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';

import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';

import { DatabaseInstance, DatabaseInstanceEngine } from 'aws-cdk-lib/aws-rds';
import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { IConstruct } from 'constructs';
import {
  ResourceExtractor,
  ResourceExtractorShareMethod,
} from '../../../src/patches/resource-extractor/resourceExtractor';

let app: App;
let stack: Stack;
let extractedStack: Stack;
let resourceTypesToExtract = [
  'AWS::IAM::Role',
  'AWS::IAM::Policy',
  'AWS::KMS::Key',
  'AWS::KMS::Alias',
  'AWS::IAM::ManagedPolicy',
  'AWS::IAM::InstanceProfile',
];

const appStackName = 'AppStack';
const extractedStackName = 'ExtractedStack';

describe('Annotations for experimental mode', () => {
  beforeEach(() => {
    app = new App();
    stack = new Stack(app, appStackName);
    extractedStack = new Stack(app, extractedStackName);
  });
  test('warning shows for experimental mode', () => {
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    const bucket = new Bucket(stack, 'TestBucket');
    bucket.grantReadWrite(func);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract,
      })
    );
    app.synth({ force: true });
    Annotations.fromStack(extractedStack).hasWarning(
      '/ExtractedStack',
      '❗ ResourceExtractor is in experimental mode. \
      Please be sure to validate synthesized assets prior to deploy. \
      Please open any issues found at https://github.com/cdklabs/cdk-enterprise-iac/issues'
    );
  });
});

describe('Extracting resources from stack', () => {
  beforeEach(() => {
    app = new App();
    stack = new Stack(app, appStackName);
    extractedStack = new Stack(app, extractedStackName);
  });

  test('IAM resources pulled out of app', () => {
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    const bucket = new Bucket(stack, 'TestBucket');
    bucket.grantReadWrite(func);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract,
      })
    );
    app.synth({ force: true });

    const extractedTemplate = Template.fromStack(extractedStack);
    const appTemplate = Template.fromStack(stack);
    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.resourceCountIs('AWS::IAM::Policy', 1);
    // Non-IAM resources present in app stack
    appTemplate.resourceCountIs('AWS::S3::Bucket', 1);
    appTemplate.resourceCountIs('AWS::Lambda::Function', 1);
  });

  test('Separate Role within the stack', () => {
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const testFunc = new Function(stack, 'TestFunction', {
      code: Code.fromInline("print('hello_world')"),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    testFunc.grantInvoke(role);
    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract,
      })
    );
    app.synth({ force: true });

    const extractedTemplate = Template.fromStack(extractedStack);
    const appTemplate = Template.fromStack(stack);

    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    extractedTemplate.resourceCountIs('AWS::IAM::Policy', 1);
    // Non-IAM resources present in app stack
    appTemplate.resourceCountIs('AWS::Lambda::Function', 1);
    appTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Role: {
        'Fn::ImportValue': Match.anyValue(),
        'Fn::GetAtt': Match.absent(),
      },
    });
  });

  test('Only appropriate DependsOn values are removed', () => {
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    const bucket = new Bucket(stack, 'TestBucket');
    bucket.grantReadWrite(func);
    func.node.addDependency(bucket);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract,
      })
    );
    app.synth({ force: true });

    const appTemplate = Template.fromStack(stack);

    const bucketId = bucket.node.findAll().find((x: IConstruct) => {
      return x instanceof CfnBucket;
    });

    appTemplate.hasResource('AWS::Lambda::Function', {
      DependsOn: [stack.getLogicalId(bucketId as CfnElement)],
    });
  });

  test('Security groups work okay', () => {
    resourceTypesToExtract = [
      'AWS::IAM::Role',
      'AWS::IAM::Policy',
      'AWS::KMS::Key',
      'AWS::KMS::Alias',
      'AWS::IAM::ManagedPolicy',
      'AWS::IAM::InstanceProfile',
      'AWS::EC2::SecurityGroup',
      'AWS::EC2::SecurityGroupEgress',
      'AWS::EC2::SecurityGroupIngress',
    ];

    const vpc = new Vpc(stack, 'TestVpc');
    const instance = new Instance(stack, 'TestInstance', {
      machineImage: MachineImage.latestAmazonLinux(),
      instanceType: InstanceType.of(InstanceClass.MEMORY5, InstanceSize.LARGE),
      vpc,
    });
    const key = new Key(stack, 'TestKey');
    key.addAlias('alias/TestKey');
    const db = new DatabaseInstance(stack, 'TestDb', {
      engine: DatabaseInstanceEngine.POSTGRES,
      vpc,
    });
    db.connections.allowDefaultPortFrom(instance.connections);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract,
        additionalTransforms: {
          'AWS::EC2::VPC': '*',
          'AWS::RDS::DBInstance': '*',
        },
      })
    );
    app.synth({ force: true });

    const extractedTemplate = Template.fromStack(extractedStack);
    const appTemplate = Template.fromStack(stack);
    extractedTemplate.resourceCountIs('AWS::EC2::SecurityGroup', 2);
    extractedTemplate.resourceCountIs('AWS::EC2::SecurityGroupIngress', 1);
    appTemplate.resourceCountIs('AWS::EC2::Instance', 1);
    appTemplate.resourceCountIs('AWS::RDS::DBInstance', 1);
  });

  describe('Sharing Methods - CFN_OUTPUT', () => {
    beforeEach(() => {
      app = new App();
      stack = new Stack(app, appStackName);
      extractedStack = new Stack(app, extractedStackName);
    });

    test('Simple case', () => {
      const func = new Function(stack, 'TestLambda', {
        code: Code.fromInline(`def handler(event, context)\n    print(event)`),
        handler: 'index.handler',
        runtime: Runtime.PYTHON_3_9,
      });
      const key = new Key(stack, 'TestKey');
      key.addAlias('alias/TestKey');
      const bucket = new Bucket(stack, 'TestBucket', {
        encryptionKey: key,
      });
      bucket.grantReadWrite(func);

      const synthedApp = app.synth();
      Aspects.of(app).add(
        new ResourceExtractor({
          extractDestinationStack: extractedStack,
          stackArtifacts: synthedApp.stacks,
          valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
          resourceTypesToExtract,
        })
      );
      app.synth({ force: true });

      const extractedTemplate = Template.fromStack(extractedStack);
      const appTemplate = Template.fromStack(stack);
      const roleLogicalId = Object.keys(
        extractedTemplate.findResources('AWS::IAM::Role')
      )[0];

      extractedTemplate.hasOutput(`Export${appStackName}${roleLogicalId}`, {
        Export: {
          Name: `${appStackName}:${roleLogicalId}`,
        },
      });
      appTemplate.hasResourceProperties('AWS::Lambda::Function', {
        Role: {
          'Fn::ImportValue': `${appStackName}:${roleLogicalId}`,
        },
      });
    });

    test('InstanceProfile case', () => {
      const vpc = new Vpc(stack, 'TestVpc');
      const instance = new Instance(stack, 'TestInstance', {
        machineImage: MachineImage.latestAmazonLinux(),
        instanceType: InstanceType.of(
          InstanceClass.MEMORY5,
          InstanceSize.LARGE
        ),
        vpc,
      });
      const key = new Key(stack, 'TestKey');
      key.addAlias('alias/TestKey');
      const bucket = new Bucket(stack, 'TestBucket', {
        encryptionKey: key,
      });
      bucket.grantReadWrite(instance.role);

      const synthedApp = app.synth();
      Aspects.of(app).add(
        new ResourceExtractor({
          extractDestinationStack: extractedStack,
          stackArtifacts: synthedApp.stacks,
          valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
          resourceTypesToExtract,
          additionalTransforms: {
            'AWS::EC2::VPC': '*',
          },
        })
      );
      app.synth({ force: true });

      const extractedTemplate = Template.fromStack(extractedStack);
      const appTemplate = Template.fromStack(stack);
      const instanceProfileLogicalId = Object.keys(
        extractedTemplate.findResources('AWS::IAM::InstanceProfile')
      )[0];

      extractedTemplate.hasOutput(
        `Export${appStackName}${instanceProfileLogicalId}`,
        {
          Export: {
            Name: `${appStackName}:${instanceProfileLogicalId}`,
          },
        }
      );
      appTemplate.hasResourceProperties('AWS::EC2::Instance', {
        IamInstanceProfile: {
          'Fn::ImportValue': `${appStackName}:${instanceProfileLogicalId}`,
        },
      });
    });

    test("Ensure resources are't extracted more than once", () => {
      const func = new Function(stack, 'TestLambda', {
        code: Code.fromInline(`def handler(event, context)\n    print(event)`),
        handler: 'index.handler',
        runtime: Runtime.PYTHON_3_9,
      });
      const bucket = new Bucket(stack, 'TestBucket', {
        autoDeleteObjects: true,
        removalPolicy: RemovalPolicy.DESTROY,
      });
      bucket.grantReadWrite(func);

      const synthedApp = app.synth();
      Aspects.of(app).add(
        new ResourceExtractor({
          extractDestinationStack: extractedStack,
          stackArtifacts: synthedApp.stacks,
          valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
          resourceTypesToExtract,
        })
      );
      app.synth({ force: true });

      const extractedTemplate = Template.fromStack(extractedStack);
      const appTemplate = Template.fromStack(stack);
      // Extracted stack has IAM resources
      extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
      extractedTemplate.resourceCountIs('AWS::IAM::Policy', 1);
      // Non-IAM resources present in app stack
      appTemplate.resourceCountIs('AWS::S3::Bucket', 1);
      appTemplate.resourceCountIs('AWS::Lambda::Function', 2);
      // Custom resources are also using imports
      appTemplate.resourcePropertiesCountIs(
        'AWS::Lambda::Function',
        {
          Code: {
            S3Bucket: {
              'Fn::Sub':
                'cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}',
            },
          },
          Role: {
            'Fn::ImportValue': Match.anyValue(),
          },
        },
        1
      );
    });

    test('Handle when a resource is output', () => {
      const role = new Role(stack, 'ExportedRole', {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      });
      new CfnOutput(stack, 'MyOutputRole', {
        value: role.roleArn,
        exportName: 'myExport',
      });

      const synthedApp = app.synth();
      Aspects.of(app).add(
        new ResourceExtractor({
          extractDestinationStack: extractedStack,
          stackArtifacts: synthedApp.stacks,
          valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
          resourceTypesToExtract,
        })
      );
      app.synth({ force: true });

      const extractedTemplate = Template.fromStack(extractedStack);
      const appTemplate = Template.fromStack(stack);
      // Extracted stack has IAM resources
      extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
      appTemplate.resourceCountIs('AWS::IAM::Role', 0);
    });

    test('multiple stacks with extracted resources trying to export', () => {
      const secondStack = new Stack(app, 'AnotherStack');
      const role = new Role(stack, 'ExportedRole', {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      });

      const bucketRegular = new Bucket(stack, 'TestBucketRegular');
      const funcRegular = new Function(stack, 'TestLambdaRegular', {
        code: Code.fromInline(`def handler(event, context)\n    print(event)`),
        handler: 'index.handler',
        runtime: Runtime.PYTHON_3_9,
      });
      bucketRegular.grantReadWrite(funcRegular);

      const bucket = new Bucket(stack, 'TestBucket');
      const func = new Function(secondStack, 'TestLambda', {
        code: Code.fromInline(`def handler(event, context)\n    print(event)`),
        handler: 'index.handler',
        runtime: Runtime.PYTHON_3_9,
        role,
      });
      bucket.grantReadWrite(func);

      const synthedApp = app.synth();
      Aspects.of(app).add(
        new ResourceExtractor({
          extractDestinationStack: extractedStack,
          stackArtifacts: synthedApp.stacks,
          valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
          resourceTypesToExtract,
        })
      );
      app.synth({ force: true });

      const extractedTemplate = Template.fromStack(extractedStack);
      const appTemplate = Template.fromStack(stack);
      const secondStackTemplate = Template.fromStack(secondStack);
      // Extracted stack has IAM resources
      extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
      appTemplate.resourceCountIs('AWS::IAM::Role', 0);
      secondStackTemplate.resourceCountIs('AWS::IAM::Role', 0);
    });
    test('multiple stacks with valid exports', () => {
      const secondStack = new Stack(app, 'AnotherStack');
      const role = new Role(stack, 'ExportedRole', {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      });

      const vpc = new Vpc(stack, 'TestVpc');

      new Instance(secondStack, 'TestInstance', {
        machineImage: MachineImage.latestAmazonLinux(),
        instanceType: InstanceType.of(
          InstanceClass.MEMORY5,
          InstanceSize.LARGE
        ),
        vpc,
        role,
      });

      const synthedApp = app.synth();
      Aspects.of(app).add(
        new ResourceExtractor({
          extractDestinationStack: extractedStack,
          stackArtifacts: synthedApp.stacks,
          valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
          resourceTypesToExtract,
        })
      );
      app.synth({ force: true });

      const extractedTemplate = Template.fromStack(extractedStack);
      const appTemplate = Template.fromStack(stack);
      const secondStackTemplate = Template.fromStack(secondStack);
      // Extracted stack has IAM resources
      extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
      appTemplate.resourceCountIs('AWS::IAM::Role', 0);
      secondStackTemplate.resourceCountIs('AWS::IAM::Role', 0);
    });
  });
});

describe('Sharing Methods - SSM_PARAMETER', () => {
  const env = {
    account: '111111111111',
    region: 'us-east-2',
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, appStackName, { env });
    extractedStack = new Stack(app, extractedStackName, { env });
  });

  test('ssm parameters are created in ExtractedStack, and used in App stack', () => {
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    const bucket = new Bucket(stack, 'TestBucket');
    bucket.grantReadWrite(func);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.SSM_PARAMETER,
        resourceTypesToExtract,
      })
    );
    app.synth({ force: true });

    const extractedTemplate = Template.fromStack(extractedStack);
    const appTemplate = Template.fromStack(stack);

    const roleLogicalId = Object.keys(
      extractedTemplate.findResources('AWS::IAM::Role')
    )[0];

    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.resourceCountIs('AWS::IAM::Policy', 1);
    extractedTemplate.resourceCountIs('AWS::SSM::Parameter', 1);
    // Non-IAM resources present in app stack
    appTemplate.resourceCountIs('AWS::S3::Bucket', 1);
    appTemplate.resourceCountIs('AWS::Lambda::Function', 1);
    appTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Role: `dummy-value-for-/${appStackName}/${roleLogicalId}`,
    });
  });
});

describe('Sharing Methods - API_LOOKUP', () => {
  const env = {
    account: '111111111111',
    region: 'us-east-2',
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, appStackName, { env });
    extractedStack = new Stack(app, extractedStackName, { env });
  });

  test('values are exported in ExtractedStack, and used in App stack', () => {
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    const bucket = new Bucket(stack, 'TestBucket');
    bucket.grantReadWrite(func);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.API_LOOKUP,
        resourceTypesToExtract,
      })
    );
    app.synth({ force: true });

    const extractedTemplate = Template.fromStack(extractedStack);
    const appTemplate = Template.fromStack(stack);

    const roleLogicalId = Object.keys(
      extractedTemplate.findResources('AWS::IAM::Role')
    )[0];

    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.resourceCountIs('AWS::IAM::Policy', 1);

    // Non-IAM resources present in app stack
    appTemplate.resourceCountIs('AWS::S3::Bucket', 1);
    appTemplate.resourceCountIs('AWS::Lambda::Function', 1);
    appTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Role: `dummy-value-for-${appStackName}:${roleLogicalId}`,
    });
  });
});

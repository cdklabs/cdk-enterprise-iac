/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import {
  App,
  Aspects,
  Aws,
  CfnElement,
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

  test('Allowed top level properties are extracted correctly', () => {
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    role.applyRemovalPolicy(RemovalPolicy.RETAIN);

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

    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.hasResource('AWS::IAM::Role', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
    });
  });

  test('Dynamically build string with exported values', () => {
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const testFunc = new Function(stack, 'TestFunction', {
      code: Code.fromInline("print('hello_world')"),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
      environment: {
        JOINED: `arn:${role.roleName}:foo:${role.roleArn}:bar:${Aws.REGION}`,
      },
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
    // Lambda function has correct environment variable that has been joined
    // using Fn::Join since we need to import values from Outputs
    appTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          JOINED: {
            'Fn::Join': [
              '',
              [
                'arn:',
                {
                  'Fn::ImportValue': Match.anyValue(),
                },
                ':foo:',
                {
                  'Fn::ImportValue': Match.anyValue(),
                },
                ':bar:',
                {
                  Ref: 'AWS::Region',
                },
              ],
            ],
          },
        },
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

  test('Constructs can create resources with the same name', () => {
    const secondStack = new Stack(app, 'Stack2');
    new Bucket(stack, 'TestBucket1', {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new Bucket(secondStack, 'TestBucket2', {
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
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
    const appTemplate2 = Template.fromStack(secondStack);

    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);

    // Templates have synthesized and contain the buckets in the two stacks
    appTemplate.resourceCountIs('AWS::S3::Bucket', 1);
    appTemplate2.resourceCountIs('AWS::S3::Bucket', 1);
  });

  test('Multiple values can be referenced from an Exported Resource', () => {
    // Lambda function references two values from a KMS Key
    const key = new Key(stack, 'TestKey');
    new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
      environment: {
        KEY_ARN: key.keyArn,
        KEY_ID: key.keyId,
      },
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
    const kmsLogicalId = Object.keys(
      extractedTemplate.findResources('AWS::KMS::Key')
    )[0];

    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.resourceCountIs('AWS::KMS::Key', 1);

    // Templates have synthesized and contains the function
    appTemplate.resourceCountIs('AWS::Lambda::Function', 1);

    // Extracted stack has multiple outputs for 1 resource (KMS Key)
    extractedTemplate.hasOutput(`Export${appStackName}${kmsLogicalId}`, {
      Export: {
        Name: `${appStackName}:${kmsLogicalId}`,
      },
    });
    extractedTemplate.hasOutput(`Export${appStackName}${kmsLogicalId}Arn`, {
      Export: {
        Name: `${appStackName}:${kmsLogicalId}:Arn`,
      },
    });
  });
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

    extractedTemplate.hasOutput(`Export${appStackName}${roleLogicalId}Arn`, {
      Export: {
        Name: `${appStackName}:${roleLogicalId}:Arn`,
      },
    });
    appTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Role: {
        'Fn::ImportValue': `${appStackName}:${roleLogicalId}:Arn`,
      },
    });
  });

  test('InstanceProfile case', () => {
    const vpc = new Vpc(stack, 'TestVpc');
    const instance = new Instance(stack, 'TestInstance', {
      machineImage: MachineImage.latestAmazonLinux(),
      instanceType: InstanceType.of(InstanceClass.MEMORY5, InstanceSize.LARGE),
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
            'Fn::Sub': 'cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}',
          },
        },
        Role: {
          'Fn::ImportValue': Match.anyValue(),
        },
      },
      1
    );
  });

  test('Exports work correctly', () => {
    const secondStack = new Stack(app, 'Stack2');
    const role = new Role(stack, 'ExportedRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    new Function(secondStack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
      environment: {
        ROLE: role.roleArn,
      },
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
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    appTemplate.resourceCountIs('AWS::IAM::Role', 0);
    appTemplate.hasOutput('*', {
      Value: {
        'Fn::ImportValue': Match.anyValue(),
      },
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
      Role: `dummy-value-for-/${appStackName}/${roleLogicalId}/Arn`,
    });
  });

  test('Dynamically build string with exported values', () => {
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const testFunc = new Function(stack, 'TestFunction', {
      code: Code.fromInline("print('hello_world')"),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
      environment: {
        JOINED: `arn:${role.roleName}:foo:${role.roleArn}:bar`,
      },
    });
    testFunc.grantInvoke(role);

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

    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    extractedTemplate.resourceCountIs('AWS::IAM::Policy', 1);
    // Non-IAM resources present in app stack
    appTemplate.resourceCountIs('AWS::Lambda::Function', 1);
    // Lambda function has correct environment variable that has been joined
    // using the Fn.Join function, which combines the result of all strings
    appTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          JOINED: Match.stringLikeRegexp(
            'arn:dummy-value-for-(.*?):foo:dummy-value-for-(.*?):bar'
          ),
        },
      },
    });
  });

  test('Exports work correctly', () => {
    const secondStack = new Stack(app, 'Stack2', { env });
    const role = new Role(stack, 'ExportedRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    new Function(secondStack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
      environment: {
        ROLE: role.roleArn,
      },
    });

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
    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    appTemplate.resourceCountIs('AWS::IAM::Role', 0);
    appTemplate.hasOutput('*', {
      Value: Match.stringLikeRegexp('dummy-value-for-*'),
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
      Role: `dummy-value-for-${appStackName}:${roleLogicalId}:Arn`,
    });
  });

  test('Dynamically build string with exported values', () => {
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const testFunc = new Function(stack, 'TestFunction', {
      code: Code.fromInline("print('hello_world')"),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
      environment: {
        JOINED: `arn:${role.roleName}:foo:${role.roleArn}:bar`,
      },
    });
    testFunc.grantInvoke(role);

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

    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    extractedTemplate.resourceCountIs('AWS::IAM::Policy', 1);
    // Non-IAM resources present in app stack
    appTemplate.resourceCountIs('AWS::Lambda::Function', 1);
    // Lambda function has correct environment variable that has been joined
    // using the Fn.Join function, which combines the result of all strings
    appTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          JOINED: Match.stringLikeRegexp(
            'arn:dummy-value-for-(.*?):foo:dummy-value-for-(.*?):bar'
          ),
        },
      },
    });
  });

  test('Exports work correctly', () => {
    const secondStack = new Stack(app, 'Stack2', { env });
    const role = new Role(stack, 'ExportedRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    new Function(secondStack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
      environment: {
        ROLE: role.roleArn,
      },
    });

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
    // Extracted stack has IAM resources
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    appTemplate.resourceCountIs('AWS::IAM::Role', 0);
    appTemplate.hasOutput('*', {
      Value: Match.stringLikeRegexp('dummy-value-for-*'),
    });
  });
});

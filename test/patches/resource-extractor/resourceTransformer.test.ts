/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { App, Aspects, Aws, CfnElement, Duration, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ApiKey, CfnApiKey } from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, CfnTable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { InstanceType, Vpc } from 'aws-cdk-lib/aws-ec2';
import {
  CfnCluster,
  CfnTaskDefinition,
  Cluster,
  Compatibility,
  TaskDefinition,
} from 'aws-cdk-lib/aws-ecs';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CfnFunction, Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import {
  CfnDomain,
  Domain,
  EngineVersion,
} from 'aws-cdk-lib/aws-opensearchservice';
import { DatabaseInstance, DatabaseInstanceEngine } from 'aws-cdk-lib/aws-rds';

import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CfnTopic, Topic } from 'aws-cdk-lib/aws-sns';
import { CfnQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { CfnParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import {
  CfnStateMachine,
  StateMachine,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { IConstruct } from 'constructs';
import {
  ResourceExtractor,
  ResourceExtractorShareMethod,
} from '../../../src/patches/resource-extractor/resourceExtractor';
import { MissingTransformError } from '../../../src/patches/resource-extractor/resourceTransformer';

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

describe('toPartial scenarios', () => {
  beforeEach(() => {
    app = new App();
    stack = new Stack(app, appStackName);
    extractedStack = new Stack(app, extractedStackName);
  });

  test('cloudwatch CfnLogGroup', () => {
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    const logGroup = new LogGroup(stack, 'TestLogGroup');
    logGroup.grantWrite(func);
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
  });

  test('sqs CfnQueue', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const queue = new Queue(stack, 'TestQueue');
    queue.grantConsumeMessages(role);

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

    const queueNode = queue.node.defaultChild as CfnQueue;
    const queueLogicalID = stack.resolve(queueNode.logicalId);

    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':sqs:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  `:${appStackName}-${queueLogicalID}*`,
                ],
              ],
            },
          },
        ],
      },
    });
  });

  test('s3 CfnBucket', () => {
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
    const bucketId = bucket.node.findAll().find((x: IConstruct) => {
      return x instanceof CfnBucket;
    });

    extractedTemplate.resourcePropertiesCountIs(
      'AWS::IAM::Policy',
      {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['s3:GetObject*']),
              Resource: Match.arrayWith([
                // Make sure IAM policy isn't trying to !GetAtt: [BucketLogicalId, Arn]
                Match.not({
                  'Fn::GetAtt': [
                    stack.getLogicalId(bucketId as CfnElement),
                    'Arn',
                  ],
                }),
              ]),
            }),
          ]),
        },
      },
      1
    );
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['s3:GetObject*']),
            Resource: Match.arrayWith([
              // Make sure IAM policy is using a partial generated resource Arn, derived from the logical id
              Match.objectLike({
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    `:s3:::${appStackName.toLowerCase()}-${stack
                      .getLogicalId(bucketId as CfnElement)
                      .toLowerCase()}*`,
                  ],
                ],
              }),
            ]),
          }),
        ]),
      },
    });
  });

  test('ssm CfnParameter', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const parameter = new StringParameter(stack, 'TestParameter', {
      stringValue: 'someTestString',
    });
    parameter.grantRead(role);
    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    app.synth({ force: true });

    const parameterNode = parameter.node.defaultChild as CfnParameter;
    const parameterLogicalID = stack.resolve(parameterNode.logicalId);

    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Resource: Match.objectLike({
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':ssm:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':parameter/',
                  `CFN-${parameterLogicalID}*`,
                ],
              ],
            }),
          },
        ],
      },
    });
  });

  test('dynamodb CfnTable', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const table = new Table(stack, 'TestDdbTable', {
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
    });
    table.grantReadData(role);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    app.synth({ force: true });
    const extractedTemplate = Template.fromStack(extractedStack);
    const tableNode = table.node.defaultChild as CfnTable;
    const tableLogicalID = stack.resolve(tableNode.logicalId);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Resource: Match.arrayWith([
              Match.objectLike({
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    ':dynamodb:',
                    { Ref: 'AWS::Region' },
                    ':',
                    { Ref: 'AWS::AccountId' },
                    `:table/${appStackName}-${tableLogicalID}*`,
                  ],
                ],
              }),
            ]),
          },
        ],
      },
    });
  });

  test('lambda CfnFunction', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const func = new Function(
      stack,
      'TestLambdaWithAVeryVeryVeryVeryAndIMeanVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName',
      {
        code: Code.fromInline(`def handler(event, context)\n    print(event)`),
        handler: 'index.handler',
        runtime: Runtime.PYTHON_3_9,
      }
    );
    func.grantInvoke(role);
    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    app.synth({ force: true });

    const lambdaNode = func.node.defaultChild as CfnFunction;
    const lambdaLogicalID = stack.resolve(lambdaNode.logicalId);

    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Resource: Match.arrayWith([
              Match.objectLike({
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    ':lambda:',
                    { Ref: 'AWS::Region' },
                    ':',
                    { Ref: 'AWS::AccountId' },
                    ':function:' +
                      `${appStackName}-${lambdaLogicalID}`.substring(0, 50) +
                      '*',
                  ],
                ],
              }),
            ]),
          },
        ],
      },
    });
  });

  test('lambda CfnFunction simple', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const func = new Function(stack, 'SimpleFunc', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    func.grantInvoke(role);
    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    app.synth({ force: true });

    const lambdaNode = func.node.defaultChild as CfnFunction;
    const lambdaLogicalID = stack.resolve(lambdaNode.logicalId);

    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Resource: Match.arrayWith([
              Match.objectLike({
                'Fn::Join': [
                  '',
                  [
                    'arn:',
                    { Ref: 'AWS::Partition' },
                    ':lambda:',
                    { Ref: 'AWS::Region' },
                    ':',
                    { Ref: 'AWS::AccountId' },
                    ':function:' +
                      `${appStackName}-${lambdaLogicalID}`.substring(0, 50) +
                      '*',
                  ],
                ],
              }),
            ]),
          },
        ],
      },
    });
  });

  test('sns CfnTopic', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const topic = new Topic(stack, 'TestTopic');
    topic.grantPublish(role);
    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    app.synth({ force: true });

    const topicNode = topic.node.defaultChild as CfnTopic;
    const topicLogicalID = stack.resolve(topicNode.logicalId);

    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':sns:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  `:${appStackName}-${topicLogicalID}*`,
                ],
              ],
            },
          },
        ],
      },
    });
  });

  test('apigw CfnApiKey', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const key = new ApiKey(stack, 'TestKey');
    key.grantReadWrite(role);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    app.synth({ force: true });

    const keyNode = key.node.defaultChild as CfnApiKey;
    const keyLogicalID = stack.resolve(keyNode.logicalId);
    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':apigateway:',
                  { Ref: 'AWS::Region' },
                  '::/apikeys/',
                  `${appStackName.substring(0, 6)}-${keyLogicalID.substring(
                    0,
                    5
                  )}*`,
                ],
              ],
            },
          },
        ],
      },
    });
  });

  test('step functions CfnStateMachine', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const wait = new Wait(stack, 'TestWait', {
      time: WaitTime.duration(Duration.seconds(1)),
    });
    const stateMachine = new StateMachine(stack, 'TestStateMachine', {
      definition: wait,
    });
    stateMachine.grantStartExecution(role);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    app.synth({ force: true });

    const stateMachineNode = stateMachine.node.defaultChild as CfnStateMachine;
    const stateMachineLogicalID = stack.resolve(stateMachineNode.logicalId);
    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':states:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  `:stateMachine:${stateMachineLogicalID}*`,
                ],
              ],
            },
          },
        ],
      },
    });
  });

  test('opensearch CfnDomain', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('es.amazonaws.com'),
    });
    const domain = new Domain(stack, 'TestDomain', {
      version: EngineVersion.OPENSEARCH_1_3,
    });
    const indexName = 'some-index';
    domain.grantIndexReadWrite(indexName, role);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    app.synth({ force: true });

    const domainNode = domain.node.defaultChild as CfnDomain;
    const domainLogicalID = stack.resolve(domainNode.logicalId);
    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 1);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Resource: Match.arrayWith([
              {
                'Fn::Join': [
                  '',
                  [
                    {
                      'Fn::Join': [
                        '',
                        [
                          'arn:',
                          { Ref: 'AWS::Partition' },
                          ':es:',
                          { Ref: 'AWS::Region' },
                          ':',
                          { Ref: 'AWS::AccountId' },
                          `:domain/${domainLogicalID
                            .substring(0, 15)
                            .toLowerCase()}*`,
                        ],
                      ],
                    },
                    `/${indexName}`,
                  ],
                ],
              },
            ]),
          },
        ],
      },
    });
  });
  test('ecs CfnTaskDefinition', () => {
    const role = new Role(stack, 'testRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });
    const task = new TaskDefinition(stack, 'Test-Task', {
      compatibility: Compatibility.EC2,
    });
    task.grantRun(role);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    app.synth({ force: true });

    const taskNode = task.node.defaultChild as CfnTaskDefinition;
    const taskLogicalID = stack.resolve(taskNode.logicalId);
    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 2);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':ecs:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  `:task-definition/${appStackName}${taskLogicalID}*:*`,
                ],
              ],
            },
          }),
        ]),
      },
    });
  });

  test('ecs CfnCluster', () => {
    const cluster = new Cluster(stack, 'TestCluster');
    cluster.addCapacity('TestAsgCapacity', {
      instanceType: new InstanceType('t2.large'),
      desiredCapacity: 2,
    });

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
        additionalTransforms: {
          'AWS::AutoScaling::AutoScalingGroup': '*',
        },
      })
    );
    app.synth({ force: true });

    const clusterNode = cluster.node.defaultChild as CfnCluster;
    const clusterLogicalID = stack.resolve(clusterNode.logicalId);
    const extractedTemplate = Template.fromStack(extractedStack);
    extractedTemplate.resourceCountIs('AWS::IAM::Role', 3);
    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':ecs:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  `:cluster/${appStackName}-${clusterLogicalID}*`,
                ],
              ],
            },
          }),
        ]),
      },
    });
  });

  test('additional transforms', () => {
    const vpc = new Vpc(stack, 'TestVpc');
    const db = new DatabaseInstance(stack, 'TestDb', {
      vpc,
      engine: DatabaseInstanceEngine.POSTGRES,
    });
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_9,
    });
    db.secret?.grantRead(func);

    const synthedApp = app.synth();
    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
        additionalTransforms: {
          'AWS::SecretsManager::SecretTargetAttachment': `arn:${Aws.PARTITION}:secretsmanager:${Aws.REGION}:${Aws.ACCOUNT_ID}:secret:some-expected-value*`,
        },
      })
    );
    app.synth({ force: true });

    const extractedTemplate = Template.fromStack(extractedStack);

    extractedTemplate.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Resource: {
              'Fn::Join': [
                '',
                [
                  'arn:',
                  { Ref: 'AWS::Partition' },
                  ':secretsmanager:',
                  { Ref: 'AWS::Region' },
                  ':',
                  { Ref: 'AWS::AccountId' },
                  ':secret:some-expected-value*',
                ],
              ],
            },
          }),
        ]),
      },
    });
  });

  test('unknown transform error', () => {
    const userPool = new UserPool(stack, 'TestUserPool');
    const role = new Role(stack, 'TestRole', {
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
    });
    userPool.grant(role, 'cognito-idp:AdminCreateUser');

    const synthedApp = app.synth();

    Aspects.of(app).add(
      new ResourceExtractor({
        extractDestinationStack: extractedStack,
        stackArtifacts: synthedApp.stacks,
        valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
        resourceTypesToExtract: ['AWS::IAM::Role', 'AWS::IAM::Policy'],
      })
    );
    expect(() => {
      app.synth({ force: true });
    }).toThrowError(MissingTransformError);
  });
});

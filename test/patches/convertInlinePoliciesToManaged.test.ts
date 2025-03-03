/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import {
  App,
  Aspects,
  Stack,
  aws_iam as iam,
  aws_ecr as ecr,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { AddPermissionBoundary } from '../../src/patches/addPermissionsBoundary';
import { ConvertInlinePoliciesToManaged } from '../../src/patches/convertInlinePoliciesToManaged';
import {
  ResourceExtractor,
  ResourceExtractorShareMethod,
} from '../../src/patches/resource-extractor/resourceExtractor';

let app: App;
let stack: Stack;

const appStackName = 'AppStack';

describe('Updating Resource Types', () => {
  const policyPrefix = 'POLICY_PREFIX_';
  beforeEach(() => {
    app = new App();
    stack = new Stack(app, appStackName);
  });

  test('Only ManagedPolicy objects exist', () => {
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_11,
    });
    const bucket = new Bucket(stack, 'TestBucket');
    bucket.grantReadWrite(func);

    Aspects.of(app).add(new ConvertInlinePoliciesToManaged());
    app.synth();

    const appTemplate = Template.fromStack(stack);
    appTemplate.resourceCountIs('AWS::IAM::Policy', 0);
    appTemplate.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
  });

  test('Inline Direct in Role', () => {
    new ecr.Repository(stack, 'Repo', {
      autoDeleteImages: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    Aspects.of(app).add(new ConvertInlinePoliciesToManaged());
    app.synth();

    const appTemplate = Template.fromStack(stack);
    console.log(appTemplate);
    let roles = appTemplate.findResources('AWS::IAM::Role');
    for (const k in roles) {
      const role = roles[k];
      console.log(role);
    }
    expect(false).toBe(true);
  });

  test('Passes along any overrides to ManagedPolicy', () => {
    const policyName = 'some-policy';
    const policy = new iam.Policy(stack, 'MyPolicy', {
      policyName,
    });
    policy.addStatements(
      new iam.PolicyStatement({
        actions: ['s3:*'],
        resources: ['*'],
      })
    );
    Aspects.of(stack).add(
      new AddPermissionBoundary({
        permissionsBoundaryPolicyName: 'SOME_BOUNDARY',
        policyPrefix,
      })
    );
    Aspects.of(stack).add(new ConvertInlinePoliciesToManaged());
    const template = Template.fromStack(stack);
    let polices = template.findResources('AWS::IAM::ManagedPolicy');
    console.log(`polices: ${polices}`);
    const names: string[] = [];
    let i = 0;
    for (const templatePolicy of Object.keys(polices)) {
      const tmpPolicy = polices[templatePolicy].Properties
        .ManagedPolicyName as string;
      names[i] = tmpPolicy;
      i++;
    }
    expect(names.length).toBe(1);
    expect(names[0].startsWith(policyPrefix)).toBe(true);
    const uniqness_length = 8;
    expect(names[0].length).toBe(
      policyPrefix.length + policyName.length + uniqness_length
    );
  });

  test('Function dependencies on policy are maintained', () => {
    const fn = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_11,
    });
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:*'],
        resources: ['*'],
      })
    );

    Aspects.of(app).add(new ConvertInlinePoliciesToManaged());
    app.synth();
    const template = Template.fromStack(stack);
    let functions = template.findResources('AWS::Lambda::Function');
    let i = 0;
    for (const name of Object.keys(functions)) {
      const deps = functions[name].DependsOn;
      expect(deps.length).toBe(2);
      i++;
    }
    expect(i).toBeGreaterThan(0);
  });

  test('ManagedPolicy works with resource extractor', () => {
    const extractedStack = new Stack(app, 'TestExtractedStack');
    const resourceTypesToExtract = [
      'AWS::IAM::Role',
      'AWS::IAM::Policy',
      'AWS::IAM::ManagedPolicy',
    ];
    const func = new Function(stack, 'TestLambda', {
      code: Code.fromInline(`def handler(event, context)\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_11,
    });
    const bucket = new Bucket(stack, 'TestBucket');
    bucket.grantReadWrite(func);
    Aspects.of(stack).add(new ConvertInlinePoliciesToManaged());
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
    extractedTemplate.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
    // Non-IAM resources present in app stack
    appTemplate.resourceCountIs('AWS::S3::Bucket', 1);
    appTemplate.resourceCountIs('AWS::Lambda::Function', 1);
  });
});

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import {
  App,
  Aspects,
  NestedStack,
  NestedStackProps,
  Stack,
  aws_iam as iam,
} from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { AddPermissionBoundary } from '../../src/patches/addPermissionsBoundary';
import { ConvertInlinePoliciesToManaged } from '../../src/patches/convertInlinePoliciesToManaged';
import {
  ResourceExtractor,
  ResourceExtractorShareMethod,
} from '../../src/patches/resource-extractor/resourceExtractor';

let app: App;
let stack: Stack;

const appStackName = 'AppStack';

class TestNestedStack extends NestedStack {
  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props);

    const func = new Function(this, 'NestedLambda', {
      code: Code.fromInline(`def handler(event, context):\n    print(event)`),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_11,
    });

    const bucket = new Bucket(this, 'NestedBucket');
    bucket.grantReadWrite(func);
  }
}

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

describe('Nested Stacks', () => {
  beforeEach(() => {
    app = new App();
    stack = new Stack(app, appStackName);
  });
  test('Aspect applied to root', () => {
    const nestedStack = new TestNestedStack(stack, 'NestedStack');

    Aspects.of(app).add(new ConvertInlinePoliciesToManaged());
    app.synth();

    const nestedTemplate = Template.fromStack(nestedStack);
    nestedTemplate.resourceCountIs('AWS::IAM::Policy', 0);
    nestedTemplate.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
  });

  test('Aspect applied to nested stack', () => {
    const nestedStack = new TestNestedStack(stack, 'NestedStack');

    Aspects.of(nestedStack).add(new ConvertInlinePoliciesToManaged());
    app.synth();

    const nestedTemplate = Template.fromStack(nestedStack);
    nestedTemplate.resourceCountIs('AWS::IAM::Policy', 0);
    nestedTemplate.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
  });

  test('Maintains dependencies', () => {
    const nestedStack = new TestNestedStack(stack, 'NestedStack');

    Aspects.of(app).add(new ConvertInlinePoliciesToManaged());
    app.synth();

    const nestedTemplate = Template.fromStack(nestedStack);
    const functions = nestedTemplate.findResources('AWS::Lambda::Function');

    for (const funcName of Object.keys(functions)) {
      const deps = functions[funcName].DependsOn;
      expect(deps).toBeDefined();
      expect(deps.length).toBeGreaterThanOrEqual(1);

      // verify at least one dependency is a ManagedPolicy
      const managedPolicies = nestedTemplate.findResources(
        'AWS::IAM::ManagedPolicy'
      );
      const managedPolicyIds = Object.keys(managedPolicies);
      const hasManagedPolicyDep = deps.some((dep: string) =>
        managedPolicyIds.includes(dep)
      );
      expect(hasManagedPolicyDep).toBe(true);
    }
  });

  test('Cross-stack references', () => {
    const nestedStack1 = new TestNestedStack(stack, 'NestedStack1');
    const nestedStack2 = new TestNestedStack(stack, 'NestedStack2');

    Aspects.of(app).add(new ConvertInlinePoliciesToManaged());
    app.synth();

    const nested1Template = Template.fromStack(nestedStack1);
    const nested2Template = Template.fromStack(nestedStack2);

    // both nested stacks should have managed policies
    nested1Template.resourceCountIs('AWS::IAM::Policy', 0);
    nested1Template.resourceCountIs('AWS::IAM::ManagedPolicy', 1);

    nested2Template.resourceCountIs('AWS::IAM::Policy', 0);
    nested2Template.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
  });

  test('Deeply nested stacks', () => {
    class DeepNestedStack extends NestedStack {
      constructor(scope: Construct, id: string) {
        super(scope, id);

        const role = new iam.Role(this, 'TestRole', {
          assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });

        const policy = new iam.Policy(this, 'TestPolicy', {
          statements: [
            new iam.PolicyStatement({
              actions: ['s3:*'],
              resources: ['*'],
            }),
          ],
        });

        policy.attachToRole(role);
      }
    }

    const level1 = new NestedStack(stack, 'Level1');
    const level2 = new DeepNestedStack(level1, 'Level2');

    Aspects.of(app).add(new ConvertInlinePoliciesToManaged());
    app.synth();

    const level2Template = Template.fromStack(level2);
    level2Template.resourceCountIs('AWS::IAM::Policy', 0);
    level2Template.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
  });

  test('Fn::GetAtt references are preserved', () => {
    class NestedWithReferences extends NestedStack {
      public readonly roleArn: string;

      constructor(scope: Construct, id: string) {
        super(scope, id);

        const role = new iam.Role(this, 'Role', {
          assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        });

        role.addToPolicy(
          new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: ['*'],
          })
        );

        this.roleArn = role.roleArn;
      }
    }

    const nestedStack = new NestedWithReferences(stack, 'NestedStack');

    // create a Lambda in parent stack that references nested stack role
    new Function(stack, 'ParentLambda', {
      code: Code.fromInline(
        `def handler(event, context):\n    print("${nestedStack.roleArn}")`
      ),
      handler: 'index.handler',
      runtime: Runtime.PYTHON_3_11,
    });

    Aspects.of(app).add(new ConvertInlinePoliciesToManaged());

    // this should not throw the "Fn::GetAtt references undefined resource" error
    expect(() => app.synth()).not.toThrow();

    const nestedTemplate = Template.fromStack(nestedStack);
    nestedTemplate.resourceCountIs('AWS::IAM::ManagedPolicy', 1);
  });
});

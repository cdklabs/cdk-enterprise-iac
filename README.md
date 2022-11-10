<!--
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
-->

# CDK Enterprise IaC

Utilities for using CDK within enterprise constraints

## Install

Typescript

```zsh
npm install @cdklabs/cdk-enterprise-iac
```

Python

```zsh
pip install cdklabs.cdk-enterprise-iac
```

## Usage

There are many tools available, all detailed in [`API.md`](./API.md).

A few examples of these tools below

### Resource extraction

:warning: Resource extraction is in an experimental phase. Test and validate before using in production. Please open any issues found [here](https://github.com/cdklabs/cdk-enterprise-iac/)

In many enterprises, there are separate teams with different IAM permissions than developers deploying CDK applications.

For example there might be a networking team with permissions to deploy `AWS::EC2::SecurityGroup` and `AWS::EC2::EIP`, or a security team with permissions to deploy `AWS::IAM::Role` and `AWS::IAM::Policy`, but the developers deploying the CDK don't have those permissions

When a developer doesn't have permissions to deploy necessary resources in their CDK application, writing good code becomes difficult to manage when a cdk deploy will quickly error due to not being able to deploy something like an `AWS::IAM::Role` which is foundational to any project deployed into AWS.

Using the `ResourceExtractor` Aspect, developers can write their CDK code as though they had sufficient IAM permissions, but extract those resources into a separate stack for an external team to deploy on their behalf.

Take the following example stack

```ts
import { App, Aspects, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';

const app = new App();
const appStack = new Stack(app, 'MyAppStack');

const func = new Function(appStack, 'TestLambda', {
  code: Code.fromAsset(path.join(__dirname, 'lambda-handler')),
  handler: 'index.handler',
  runtime: Runtime.PYTHON_3_9,
});
const bucket = new Bucket(appStack, 'TestBucket', {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});
bucket.grantReadWrite(func);

app.synth()
```

The synthesized Cloudformation would include _all_ AWS resources required, including resources a developer might not have permissions to deploy

The above example would include the following snippet in the synthesized Cloudformation

```yaml
TestLambdaServiceRoleC28C2D9C:
  Type: 'AWS::IAM::Role'
  Properties:
    AssumeRolePolicyDocument:
      Statement:
        - Action: 'sts:AssumeRole'
          Effect: Allow
          Principal:
            Service: lambda.amazonaws.com
      Version: 2012-10-17
    # excluding remaining properties
  TestLambda2F70C45E:
    Type: 'AWS::Lambda::Function'
    Properties:
      Role: !GetAtt
        - TestLambdaServiceRoleC28C2D9C
        - Arn
      # excluding remaining properties
```

While including `bucket.grantReadWrite(func)` in the CDK application ensures an IAM role with least privilege IAM policies for the application, the creation of IAM resources such as Roles and Policies may be restricted to a security team, resulting in the synthesized Cloudformation template not being deployable by a developer.

Using the `ResourceExtractor`, we can pull out an arbitrary list of Cloudformation resources that a developer _doesn't_ have permissions to provision, and create a separate stack that can be sent to a security team.

```ts
import { App, Aspects, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
// Import ResourceExtractor
import { ResourceExtractor } from '@cdklabs/cdk-enterprise-iac';

const app = new App();
const appStack = new Stack(app, 'MyAppStack');
// Set up a destination stack to extract resources to
const extractedStack = new Stack(app, 'ExtractedStack');

const func = new Function(appStack, 'TestLambda', {
  code: Code.fromAsset(path.join(__dirname, 'lambda-handler')),
  handler: 'index.handler',
  runtime: Runtime.PYTHON_3_9,
});
const bucket = new Bucket(appStack, 'TestBucket', {
  autoDeleteObjects: true,
  removalPolicy: RemovalPolicy.DESTROY,
});
bucket.grantReadWrite(func);

// Capture the output of app.synth()
const synthedApp = app.synth();
// Apply the ResourceExtractor Aspect
Aspects.of(app).add(
  new ResourceExtractor({
    // synthesized stacks to examine
    stackArtifacts: synthedApp.stacks,
    // Array of Cloudformation resources to extract
    resourceTypesToExtract: [
      'AWS::IAM::Role',
      'AWS::IAM::Policy',
      'AWS::IAM::ManagedPolicy',
      'AWS::IAM::InstanceProfile',
    ],
    // Destination stack for extracted resources
    extractDestinationStack: extractedStack,
  })
);
// Resynthing since ResourceExtractor has modified the app
app.synth({ force: true });
```

In the example above, _all_ resources are created in the `appStack`, and an empty `extractedStack` is also created.

We apply the `ResourceExtractor` Aspect, specifying the Cloudformation resource types the developer is unable to deploy due to insufficient IAM permissions.

Now when we list stacks in the CDK project, we can see an added stack

```zsh
$ cdk ls
MyAppStack
ExtractedStack
```

Taking a look at these synthesized stacks, in the `ExtractedStack` we'll find:

```yaml
Resources:
  TestLambdaServiceRoleC28C2D9C:
    Type: 'AWS::IAM::Role'
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Action: 'sts:AssumeRole'
            Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
        Version: 2012-10-17
      # excluding remaining properties
Outputs:
  ExportAppStackTestLambdaServiceRoleC28C2D9C:
    Value:
      'Fn::GetAtt':
        - TestLambdaServiceRoleC28C2D9C
        - Arn
    Export:
      Name: 'AppStack:TestLambdaServiceRoleC28C2D9C'  # Exported name
```

And inside the synthesized `MyAppStack` template:

```yaml
Resources:
  TestLambda2F70C45E:
    Type: 'AWS::Lambda::Function'
    Properties:
      Role: !ImportValue 'AppStack:TestLambdaServiceRoleC28C2D9C'  # Using ImportValue instrinsic function to use pre-created IAM role
      # excluding remaining properties
```

In this scenario, a developer is able to provide an external security team with sufficient IAM privileges to deploy the `ExtractedStack`.

Once deployed, a developer can run `cdk deploy MyAppStack` without errors due to insufficient IAM privileges


#### Value Sharing methods

When resources are extracted from a stack, there must be a method to reference the resources that have been extracted.

There are three methods (see `ResourceExtractorShareMethod` enum)

- `CFN_OUTPUT`
- `SSM_PARAMETER`
- `API_LOOKUP`

##### `CFN_OUTPUT`

The default sharing method is `CFN_OUTPUT`, which uses Cloudformation Export/Import to Export values in the extracted stack (see [Outputs](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/outputs-section-structure.html)), and use the [Fn::ImportValue](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-importvalue.html) intrinsic function to reference those values.

This works fine, but some teams may prefer a looser coupling between the extracted stack deployed by an external team and the rest of the CDK infrastructure.

##### `SSM_PARAMETER`

In this method, the extracted stack generates Parameters in AWS Systems Manager Parameter Store, and modifies the CDK application to look up the generated parameter using [`aws_ssm.StringParameter.valueFromLookup()`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ssm.StringParameter.html#static-valuewbrfromwbrlookupscope-parametername) at synthesis time.

Example on using this method:

```ts
import { ResourceExtractor, ResourceExtractorShareMethod } from '@cdklabs/cdk-enterprise-iac';

Aspects.of(app).add(
  new ResourceExtractor({
    stackArtifacts: synthedApp.stacks,
    resourceTypesToExtract: [
      'AWS::IAM::Role',
      'AWS::IAM::Policy',
      'AWS::IAM::ManagedPolicy',
      'AWS::IAM::InstanceProfile',
    ],
    extractDestinationStack: extractedStack,
    valueShareMethod: ResourceExtractorShareMethod.SSM_PARAMETER,  // Specify SSM_PARAMETER Method
  });
);
```

##### `API_LOOKUP`

The `API_LOOKUP` sharing method is a work in progress, and not yet supported

#### Resource Partials

Some resources that get extracted might reference resources that aren't yet created.

In our example CDK application we include the line

```ts
bucket.grantReadWrite(func);
```

This creates an `AWS::IAM::Policy` that includes the necessary Actions scoped down to the S3 bucket.

When the `AWS::IAM::Policy` is extracted, it's unable to use `Ref` or `Fn::GetAtt` to reference the S3 bucket since the S3 bucket wasn't extracted.

In this case we substitute the reference with a "partial ARN" that makes a best effort to scope the resources in the IAM policy statement to the ARN of the yet-to-be created S3 bucket.

There are multiple resource types supported out of the box (found in [`createDefaultTransforms`](src/patches/resource-extractor/resourceTransformer.ts)). In the event you have a resource not yet supported, you'll receive a `MissingTransformError`. In this case you can either open an [issue](https://github.com/cdklabs/cdk-enterprise-iac/issues) with the resource in question, or you can include the `additionalTransforms` property.

Consider the following:

```ts
const vpc = new Vpc(stack, 'TestVpc');
const db = new DatabaseInstance(stack, 'TestDb', {
  vpc,
  engine: DatabaseInstanceEngine.POSTGRES,
})
const func = new Function(stack, 'TestLambda', {
  code: Code.fromAsset(path.join(__dirname, 'lambda-handler')),
  handler: 'index.handler',
  runtime: Runtime.PYTHON_3_9,
});
db.secret?.grantRead(func)

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
  });
);
app.synth({ force: true });
```

In this case, there is a `AWS::SecretsManager::SecretTargetAttachment` generated to complete the final link between a Secrets Manager secret and the associated database by adding the database connection information to the secret JSON, which returns the ARN of the generated secret.

In the context of extracting the IAM policy, we want to tell the `ResourceExtractor` how to handle the resource section of the IAM policy statement so that it is scoped down sufficiently.

In this case rather than using a `Ref: LogicalIdForTheSecretTargetAttachment` we construct the ARN we want to use.

### Adding permissions boundaries to all generated IAM roles

Example for `AddPermissionBoundary` in Typescript project.

```ts
import * as cdk from 'aws-cdk-lib';
import { MyStack } from '../lib/my-project-stack';
import { Aspects } from 'aws-cdk-lib';
import { AddPermissionBoundary } from '@cdklabs/cdk-enterprise-iac';

const app = new cdk.App();
new MyStack(app, 'MyStack');

Aspects.of(app).add(
  new AddPermissionBoundary({
    permissionsBoundaryPolicyName: 'MyPermissionBoundaryName',
    instanceProfilePrefix: 'MY_PREFIX_', // optional, Defaults to ''
    policyPrefix: 'MY_POLICY_PREFIX_', // optional, Defaults to ''
    rolePrefix: 'MY_ROLE_PREFIX_', // optional, Defaults to ''
  })
);
```

Example for `AddPermissionBoundary` in Python project.

```python
import aws_cdk as cdk
from cdklabs.cdk_enterprise_iac import AddPermissionBoundary
from test_py.test_py_stack import TestPyStack


app = cdk.App()
TestPyStack(app, "TestPyStack")

cdk.Aspects.of(app).add(AddPermissionBoundary(
    permissions_boundary_policy_name="MyPermissionBoundaryName",
    instance_profile_prefix="MY_PREFIX_",  # optional, Defaults to ""
    policy_prefix="MY_POLICY_PREFIX_",  # optional, Defaults to ""
    role_prefix="MY_ROLE_PREFIX_"  # optional, Defaults to ""
))

app.synth()
```

Details in [API.md](API.md)

## Generated API.md

---

Generated API.md below:
<details>
    <summary>Expand to view API docs</summary>

# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### EcsIsoServiceAutoscaler <a name="EcsIsoServiceAutoscaler" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler"></a>

Creates a EcsIsoServiceAutoscaler construct.

This construct allows you to scale an ECS service in an ISO
region where classic ECS Autoscaling may not be available.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.Initializer"></a>

```typescript
import { EcsIsoServiceAutoscaler } from '@cdklabs/cdk-enterprise-iac'

new EcsIsoServiceAutoscaler(scope: Construct, id: string, props: EcsIsoServiceAutoscalerProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps">EcsIsoServiceAutoscalerProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps">EcsIsoServiceAutoscalerProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.isConstruct"></a>

```typescript
import { EcsIsoServiceAutoscaler } from '@cdklabs/cdk-enterprise-iac'

EcsIsoServiceAutoscaler.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.property.ecsScalingManagerFunction">ecsScalingManagerFunction</a></code> | <code>aws-cdk-lib.aws_lambda.Function</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `ecsScalingManagerFunction`<sup>Required</sup> <a name="ecsScalingManagerFunction" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.property.ecsScalingManagerFunction"></a>

```typescript
public readonly ecsScalingManagerFunction: Function;
```

- *Type:* aws-cdk-lib.aws_lambda.Function

---


### PopulateWithConfig <a name="PopulateWithConfig" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfig"></a>

Populate a provided VPC with subnets based on a provided configuration.

*Example*

```typescript
const mySubnetConfig: SubnetConfig[] = [
   {
     groupName: 'app',
     cidrRange: '172.31.0.0/27',
     availabilityZone: 'a',
     subnetType: subnetType.PUBLIC,
   },
   {
     groupName: 'app',
     cidrRange: '172.31.0.32/27',
     availabilityZone: 'b',
     subnetType: subnetType.PUBLIC,
   },
   {
     groupName: 'db',
     cidrRange: '172.31.0.64/27',
     availabilityZone: 'a',
     subnetType: subnetType.PRIVATE_WITH_EGRESS,
   },
   {
     groupName: 'db',
     cidrRange: '172.31.0.96/27',
     availabilityZone: 'b',
     subnetType: subnetType.PRIVATE_WITH_EGRESS,
   },
   {
     groupName: 'iso',
     cidrRange: '172.31.0.128/26',
     availabilityZone: 'a',
     subnetType: subnetType.PRIVATE_ISOLATED,
   },
   {
     groupName: 'iso',
     cidrRange: '172.31.0.196/26',
     availabilityZone: 'b',
     subnetType: subnetType.PRIVATE_ISOLATED,
   },
 ];
new PopulateWithConfig(this, "vpcPopulater", {
  vpcId: 'vpc-abcdefg1234567',
  privateRouteTableId: 'rt-abcdefg123456',
  localRouteTableId: 'rt-123456abcdefg',
  subnetConfig: mySubnetConfig,
})
```


#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfig.Initializer"></a>

```typescript
import { PopulateWithConfig } from '@cdklabs/cdk-enterprise-iac'

new PopulateWithConfig(scope: Construct, id: string, props: PopulateWithConfigProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfig.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfig.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfig.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps">PopulateWithConfigProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfig.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfig.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfig.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps">PopulateWithConfigProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfig.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfig.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfig.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfig.isConstruct"></a>

```typescript
import { PopulateWithConfig } from '@cdklabs/cdk-enterprise-iac'

PopulateWithConfig.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfig.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfig.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfig.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---


### SplitVpcEvenly <a name="SplitVpcEvenly" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenly"></a>

Splits a VPC evenly between a provided number of AZs (3 if not defined), and attaches a provided route table to each, and labels.

*Example*

```typescript
// with more specific properties
new SplitVpcEvenly(this, 'evenSplitVpc', {
  vpcId: 'vpc-abcdefg123456',
  vpcCidr: '172.16.0.0/16',
  routeTableId: 'rt-abcdefgh123456',
  cidrBits: '10',
  numberOfAzs: 4,
  subnetType: subnetType.PRIVATE_ISOLATED,
});
```


#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.Initializer"></a>

```typescript
import { SplitVpcEvenly } from '@cdklabs/cdk-enterprise-iac'

new SplitVpcEvenly(scope: Construct, id: string, props: SplitVpcEvenlyProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps">SplitVpcEvenlyProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps">SplitVpcEvenlyProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.isConstruct"></a>

```typescript
import { SplitVpcEvenly } from '@cdklabs/cdk-enterprise-iac'

SplitVpcEvenly.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenly.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---


## Structs <a name="Structs" id="Structs"></a>

### AddCfnInitProxyProps <a name="AddCfnInitProxyProps" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps"></a>

Properties for the proxy server to use with cfn helper commands.

#### Initializer <a name="Initializer" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps.Initializer"></a>

```typescript
import { AddCfnInitProxyProps } from '@cdklabs/cdk-enterprise-iac'

const addCfnInitProxyProps: AddCfnInitProxyProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps.property.proxyHost">proxyHost</a></code> | <code>string</code> | host of your proxy. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps.property.proxyPort">proxyPort</a></code> | <code>number</code> | proxy port. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps.property.proxyCredentials">proxyCredentials</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | JSON secret containing `user` and `password` properties to use if your proxy requires credentials `http://user:password@host:port` could contain sensitive data, so using a Secret. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps.property.proxyType">proxyType</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.ProxyType">ProxyType</a></code> | Proxy Type. |

---

##### `proxyHost`<sup>Required</sup> <a name="proxyHost" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps.property.proxyHost"></a>

```typescript
public readonly proxyHost: string;
```

- *Type:* string

host of your proxy.

---

*Example*

```typescript
example.com
```


##### `proxyPort`<sup>Required</sup> <a name="proxyPort" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps.property.proxyPort"></a>

```typescript
public readonly proxyPort: number;
```

- *Type:* number

proxy port.

---

*Example*

```typescript
8080
```


##### `proxyCredentials`<sup>Optional</sup> <a name="proxyCredentials" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps.property.proxyCredentials"></a>

```typescript
public readonly proxyCredentials: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

JSON secret containing `user` and `password` properties to use if your proxy requires credentials `http://user:password@host:port` could contain sensitive data, so using a Secret.

Note that while the `user` and `password` won't be visible in the cloudformation template
they **will** be in plain text inside your `UserData`

---

*Example*

```typescript
const secret = new Secret(stack, 'TestSecret', {
 secretObjectValue: {
   user: SecretValue,
   password: SecretValue,
 },
});
```


##### `proxyType`<sup>Optional</sup> <a name="proxyType" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps.property.proxyType"></a>

```typescript
public readonly proxyType: ProxyType;
```

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.ProxyType">ProxyType</a>
- *Default:* ProxyType.HTTP

Proxy Type.

---

*Example*

```typescript
ProxyType.HTTPS
```


### AddPermissionBoundaryProps <a name="AddPermissionBoundaryProps" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps"></a>

Properties to pass to the AddPermissionBoundary.

#### Initializer <a name="Initializer" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps.Initializer"></a>

```typescript
import { AddPermissionBoundaryProps } from '@cdklabs/cdk-enterprise-iac'

const addPermissionBoundaryProps: AddPermissionBoundaryProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps.property.permissionsBoundaryPolicyName">permissionsBoundaryPolicyName</a></code> | <code>string</code> | Name of Permissions Boundary Policy to add to all IAM roles. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps.property.instanceProfilePrefix">instanceProfilePrefix</a></code> | <code>string</code> | A prefix to prepend to the name of the IAM InstanceProfiles (Default: ''). |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps.property.policyPrefix">policyPrefix</a></code> | <code>string</code> | A prefix to prepend to the name of the IAM Policies and ManagedPolicies (Default: ''). |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps.property.rolePrefix">rolePrefix</a></code> | <code>string</code> | A prefix to prepend to the name of IAM Roles (Default: ''). |

---

##### `permissionsBoundaryPolicyName`<sup>Required</sup> <a name="permissionsBoundaryPolicyName" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps.property.permissionsBoundaryPolicyName"></a>

```typescript
public readonly permissionsBoundaryPolicyName: string;
```

- *Type:* string

Name of Permissions Boundary Policy to add to all IAM roles.

---

##### `instanceProfilePrefix`<sup>Optional</sup> <a name="instanceProfilePrefix" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps.property.instanceProfilePrefix"></a>

```typescript
public readonly instanceProfilePrefix: string;
```

- *Type:* string

A prefix to prepend to the name of the IAM InstanceProfiles (Default: '').

---

##### `policyPrefix`<sup>Optional</sup> <a name="policyPrefix" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps.property.policyPrefix"></a>

```typescript
public readonly policyPrefix: string;
```

- *Type:* string

A prefix to prepend to the name of the IAM Policies and ManagedPolicies (Default: '').

---

##### `rolePrefix`<sup>Optional</sup> <a name="rolePrefix" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps.property.rolePrefix"></a>

```typescript
public readonly rolePrefix: string;
```

- *Type:* string

A prefix to prepend to the name of IAM Roles (Default: '').

---

### EcsIsoServiceAutoscalerProps <a name="EcsIsoServiceAutoscalerProps" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.Initializer"></a>

```typescript
import { EcsIsoServiceAutoscalerProps } from '@cdklabs/cdk-enterprise-iac'

const ecsIsoServiceAutoscalerProps: EcsIsoServiceAutoscalerProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.ecsCluster">ecsCluster</a></code> | <code>aws-cdk-lib.aws_ecs.Cluster</code> | The cluster the service you wish to scale resides in. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.ecsService">ecsService</a></code> | <code>aws-cdk-lib.aws_ecs.IService</code> | The ECS service you wish to scale. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleAlarm">scaleAlarm</a></code> | <code>aws-cdk-lib.aws_cloudwatch.Alarm</code> | The Cloudwatch Alarm that will cause scaling actions to be invoked, whether it's in or not in alarm will determine scale up and down actions. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.maximumTaskCount">maximumTaskCount</a></code> | <code>number</code> | The maximum number of tasks that the service will scale out to. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.minimumTaskCount">minimumTaskCount</a></code> | <code>number</code> | The minimum number of tasks the service will have. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.role">role</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | Optional IAM role to attach to the created lambda to adjust the desired count on the ECS Service. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleInCooldown">scaleInCooldown</a></code> | <code>aws-cdk-lib.Duration</code> | How long will the application wait before performing another scale in action. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleInIncrement">scaleInIncrement</a></code> | <code>number</code> | The number of tasks that will scale in on scale in alarm status. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleOutCooldown">scaleOutCooldown</a></code> | <code>aws-cdk-lib.Duration</code> | How long will a the application wait before performing another scale out action. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleOutIncrement">scaleOutIncrement</a></code> | <code>number</code> | The number of tasks that will scale out on scale out alarm status. |

---

##### `ecsCluster`<sup>Required</sup> <a name="ecsCluster" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.ecsCluster"></a>

```typescript
public readonly ecsCluster: Cluster;
```

- *Type:* aws-cdk-lib.aws_ecs.Cluster

The cluster the service you wish to scale resides in.

---

##### `ecsService`<sup>Required</sup> <a name="ecsService" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.ecsService"></a>

```typescript
public readonly ecsService: IService;
```

- *Type:* aws-cdk-lib.aws_ecs.IService

The ECS service you wish to scale.

---

##### `scaleAlarm`<sup>Required</sup> <a name="scaleAlarm" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleAlarm"></a>

```typescript
public readonly scaleAlarm: Alarm;
```

- *Type:* aws-cdk-lib.aws_cloudwatch.Alarm

The Cloudwatch Alarm that will cause scaling actions to be invoked, whether it's in or not in alarm will determine scale up and down actions.

---

##### `maximumTaskCount`<sup>Optional</sup> <a name="maximumTaskCount" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.maximumTaskCount"></a>

```typescript
public readonly maximumTaskCount: number;
```

- *Type:* number
- *Default:* 10

The maximum number of tasks that the service will scale out to.

Note: This does not provide any protection from scaling out above the maximum allowed in your account, set this variable and manage account quotas appropriately.

---

##### `minimumTaskCount`<sup>Optional</sup> <a name="minimumTaskCount" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.minimumTaskCount"></a>

```typescript
public readonly minimumTaskCount: number;
```

- *Type:* number
- *Default:* 1

The minimum number of tasks the service will have.

---

##### `role`<sup>Optional</sup> <a name="role" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.role"></a>

```typescript
public readonly role: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* A role is created for you with least privilege IAM policy

Optional IAM role to attach to the created lambda to adjust the desired count on the ECS Service.

Ensure this role has appropriate privileges. Example IAM policy statements:
```json
{
  "PolicyDocument": {
    "Statement": [
      {
        "Action": "cloudwatch:DescribeAlarms",
        "Effect": "Allow",
        "Resource": "arn:${Partition}:cloudwatch:${Region}:${Account}:alarm:${AlarmName}"
      },
      {
        "Action": [
          "ecs:DescribeServices",
          "ecs:UpdateService"
        ],
        "Condition": {
          "StringEquals": {
            "ecs:cluster": "arn:${Partition}:ecs:${Region}:${Account}:cluster/${ClusterName}"
          }
        },
        "Effect": "Allow",
        "Resource": "arn:${Partition}:ecs:${Region}:${Account}:service/${ClusterName}/${ServiceName}"
      }
    ],
    "Version": "2012-10-17"
  }
}
```

---

##### `scaleInCooldown`<sup>Optional</sup> <a name="scaleInCooldown" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleInCooldown"></a>

```typescript
public readonly scaleInCooldown: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* 60 seconds

How long will the application wait before performing another scale in action.

---

##### `scaleInIncrement`<sup>Optional</sup> <a name="scaleInIncrement" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleInIncrement"></a>

```typescript
public readonly scaleInIncrement: number;
```

- *Type:* number
- *Default:* 1

The number of tasks that will scale in on scale in alarm status.

---

##### `scaleOutCooldown`<sup>Optional</sup> <a name="scaleOutCooldown" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleOutCooldown"></a>

```typescript
public readonly scaleOutCooldown: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* 60 seconds

How long will a the application wait before performing another scale out action.

---

##### `scaleOutIncrement`<sup>Optional</sup> <a name="scaleOutIncrement" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleOutIncrement"></a>

```typescript
public readonly scaleOutIncrement: number;
```

- *Type:* number
- *Default:* 1

The number of tasks that will scale out on scale out alarm status.

---

### PopulateWithConfigProps <a name="PopulateWithConfigProps" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps.Initializer"></a>

```typescript
import { PopulateWithConfigProps } from '@cdklabs/cdk-enterprise-iac'

const populateWithConfigProps: PopulateWithConfigProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps.property.localRouteTableId">localRouteTableId</a></code> | <code>string</code> | Local route table ID, with routes only to local VPC. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps.property.privateRouteTableId">privateRouteTableId</a></code> | <code>string</code> | Route table ID for a provided route table with routes to enterprise network. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps.property.subnetConfig">subnetConfig</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.SubnetConfig">SubnetConfig</a>[]</code> | List of Subnet configs to provision to provision. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps.property.vpcId">vpcId</a></code> | <code>string</code> | ID of the VPC provided that needs to be populated. |

---

##### `localRouteTableId`<sup>Required</sup> <a name="localRouteTableId" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps.property.localRouteTableId"></a>

```typescript
public readonly localRouteTableId: string;
```

- *Type:* string

Local route table ID, with routes only to local VPC.

---

##### `privateRouteTableId`<sup>Required</sup> <a name="privateRouteTableId" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps.property.privateRouteTableId"></a>

```typescript
public readonly privateRouteTableId: string;
```

- *Type:* string

Route table ID for a provided route table with routes to enterprise network.

Both subnetType.PUBLIC and subnetType.PRIVATE_WITH_EGRESS will use this property

---

##### `subnetConfig`<sup>Required</sup> <a name="subnetConfig" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps.property.subnetConfig"></a>

```typescript
public readonly subnetConfig: SubnetConfig[];
```

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.SubnetConfig">SubnetConfig</a>[]

List of Subnet configs to provision to provision.

---

##### `vpcId`<sup>Required</sup> <a name="vpcId" id="@cdklabs/cdk-enterprise-iac.PopulateWithConfigProps.property.vpcId"></a>

```typescript
public readonly vpcId: string;
```

- *Type:* string

ID of the VPC provided that needs to be populated.

---

### RemoveTagsProps <a name="RemoveTagsProps" id="@cdklabs/cdk-enterprise-iac.RemoveTagsProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-enterprise-iac.RemoveTagsProps.Initializer"></a>

```typescript
import { RemoveTagsProps } from '@cdklabs/cdk-enterprise-iac'

const removeTagsProps: RemoveTagsProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.RemoveTagsProps.property.cloudformationResource">cloudformationResource</a></code> | <code>string</code> | Name of Cloudformation resource Type (e.g. 'AWS::Lambda::Function'). |
| <code><a href="#@cdklabs/cdk-enterprise-iac.RemoveTagsProps.property.tagPropertyName">tagPropertyName</a></code> | <code>string</code> | Name of the tag property to remove from the resource. |

---

##### `cloudformationResource`<sup>Required</sup> <a name="cloudformationResource" id="@cdklabs/cdk-enterprise-iac.RemoveTagsProps.property.cloudformationResource"></a>

```typescript
public readonly cloudformationResource: string;
```

- *Type:* string

Name of Cloudformation resource Type (e.g. 'AWS::Lambda::Function').

---

##### `tagPropertyName`<sup>Optional</sup> <a name="tagPropertyName" id="@cdklabs/cdk-enterprise-iac.RemoveTagsProps.property.tagPropertyName"></a>

```typescript
public readonly tagPropertyName: string;
```

- *Type:* string
- *Default:* Tags

Name of the tag property to remove from the resource.

---

### ResourceExtractorProps <a name="ResourceExtractorProps" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.Initializer"></a>

```typescript
import { ResourceExtractorProps } from '@cdklabs/cdk-enterprise-iac'

const resourceExtractorProps: ResourceExtractorProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.extractDestinationStack">extractDestinationStack</a></code> | <code>aws-cdk-lib.Stack</code> | Stack to move found extracted resources into. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.resourceTypesToExtract">resourceTypesToExtract</a></code> | <code>string[]</code> | List of resource types to extract, ex: `AWS::IAM::Role`. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.stackArtifacts">stackArtifacts</a></code> | <code>aws-cdk-lib.cx_api.CloudFormationStackArtifact[]</code> | Synthed stack artifacts from your CDK app. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.additionalTransforms">additionalTransforms</a></code> | <code>{[ key: string ]: string}</code> | Additional resource transformations. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.valueShareMethod">valueShareMethod</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorShareMethod">ResourceExtractorShareMethod</a></code> | The sharing method to use when passing exported resources from the "Extracted Stack" into the original stack(s). |

---

##### `extractDestinationStack`<sup>Required</sup> <a name="extractDestinationStack" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.extractDestinationStack"></a>

```typescript
public readonly extractDestinationStack: Stack;
```

- *Type:* aws-cdk-lib.Stack

Stack to move found extracted resources into.

---

##### `resourceTypesToExtract`<sup>Required</sup> <a name="resourceTypesToExtract" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.resourceTypesToExtract"></a>

```typescript
public readonly resourceTypesToExtract: string[];
```

- *Type:* string[]

List of resource types to extract, ex: `AWS::IAM::Role`.

---

##### `stackArtifacts`<sup>Required</sup> <a name="stackArtifacts" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.stackArtifacts"></a>

```typescript
public readonly stackArtifacts: CloudFormationStackArtifact[];
```

- *Type:* aws-cdk-lib.cx_api.CloudFormationStackArtifact[]

Synthed stack artifacts from your CDK app.

---

##### `additionalTransforms`<sup>Optional</sup> <a name="additionalTransforms" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.additionalTransforms"></a>

```typescript
public readonly additionalTransforms: {[ key: string ]: string};
```

- *Type:* {[ key: string ]: string}

Additional resource transformations.

---

##### `valueShareMethod`<sup>Optional</sup> <a name="valueShareMethod" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorProps.property.valueShareMethod"></a>

```typescript
public readonly valueShareMethod: ResourceExtractorShareMethod;
```

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorShareMethod">ResourceExtractorShareMethod</a>

The sharing method to use when passing exported resources from the "Extracted Stack" into the original stack(s).

---

### SetApiGatewayEndpointConfigurationProps <a name="SetApiGatewayEndpointConfigurationProps" id="@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfigurationProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfigurationProps.Initializer"></a>

```typescript
import { SetApiGatewayEndpointConfigurationProps } from '@cdklabs/cdk-enterprise-iac'

const setApiGatewayEndpointConfigurationProps: SetApiGatewayEndpointConfigurationProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfigurationProps.property.endpointType">endpointType</a></code> | <code>aws-cdk-lib.aws_apigateway.EndpointType</code> | API Gateway endpoint type to override to. |

---

##### `endpointType`<sup>Optional</sup> <a name="endpointType" id="@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfigurationProps.property.endpointType"></a>

```typescript
public readonly endpointType: EndpointType;
```

- *Type:* aws-cdk-lib.aws_apigateway.EndpointType
- *Default:* EndpointType.REGIONAL

API Gateway endpoint type to override to.

Defaults to EndpointType.REGIONAL

---

### SplitVpcEvenlyProps <a name="SplitVpcEvenlyProps" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.Initializer"></a>

```typescript
import { SplitVpcEvenlyProps } from '@cdklabs/cdk-enterprise-iac'

const splitVpcEvenlyProps: SplitVpcEvenlyProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.routeTableId">routeTableId</a></code> | <code>string</code> | Route Table ID that will be attached to each subnet created. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.vpcCidr">vpcCidr</a></code> | <code>string</code> | CIDR range of the VPC you're populating. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.vpcId">vpcId</a></code> | <code>string</code> | ID of the existing VPC you're trying to populate. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.cidrBits">cidrBits</a></code> | <code>string</code> | `cidrBits` argument for the [`Fn::Cidr`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-cidr.html) Cloudformation intrinsic function. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.numberOfAzs">numberOfAzs</a></code> | <code>number</code> | Number of AZs to evenly split into. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.subnetType">subnetType</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetType</code> | *No description.* |

---

##### `routeTableId`<sup>Required</sup> <a name="routeTableId" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.routeTableId"></a>

```typescript
public readonly routeTableId: string;
```

- *Type:* string

Route Table ID that will be attached to each subnet created.

---

##### `vpcCidr`<sup>Required</sup> <a name="vpcCidr" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.vpcCidr"></a>

```typescript
public readonly vpcCidr: string;
```

- *Type:* string

CIDR range of the VPC you're populating.

---

##### `vpcId`<sup>Required</sup> <a name="vpcId" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.vpcId"></a>

```typescript
public readonly vpcId: string;
```

- *Type:* string

ID of the existing VPC you're trying to populate.

---

##### `cidrBits`<sup>Optional</sup> <a name="cidrBits" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.cidrBits"></a>

```typescript
public readonly cidrBits: string;
```

- *Type:* string
- *Default:* '6'

`cidrBits` argument for the [`Fn::Cidr`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/intrinsic-function-reference-cidr.html) Cloudformation intrinsic function.

---

##### `numberOfAzs`<sup>Optional</sup> <a name="numberOfAzs" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.numberOfAzs"></a>

```typescript
public readonly numberOfAzs: number;
```

- *Type:* number
- *Default:* 3

Number of AZs to evenly split into.

---

##### `subnetType`<sup>Optional</sup> <a name="subnetType" id="@cdklabs/cdk-enterprise-iac.SplitVpcEvenlyProps.property.subnetType"></a>

```typescript
public readonly subnetType: SubnetType;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetType
- *Default:* subnetType.PRIVATE

---

### SubnetConfig <a name="SubnetConfig" id="@cdklabs/cdk-enterprise-iac.SubnetConfig"></a>

#### Initializer <a name="Initializer" id="@cdklabs/cdk-enterprise-iac.SubnetConfig.Initializer"></a>

```typescript
import { SubnetConfig } from '@cdklabs/cdk-enterprise-iac'

const subnetConfig: SubnetConfig = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SubnetConfig.property.availabilityZone">availabilityZone</a></code> | <code>string</code> | Which availability zone the subnet should be in. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SubnetConfig.property.cidrRange">cidrRange</a></code> | <code>string</code> | Cidr range of the subnet to create. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SubnetConfig.property.groupName">groupName</a></code> | <code>string</code> | Logical group name of a subnet. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SubnetConfig.property.subnetType">subnetType</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetType</code> | What [SubnetType](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SubnetType.html) to use. |

---

##### `availabilityZone`<sup>Required</sup> <a name="availabilityZone" id="@cdklabs/cdk-enterprise-iac.SubnetConfig.property.availabilityZone"></a>

```typescript
public readonly availabilityZone: string;
```

- *Type:* string

Which availability zone the subnet should be in.

---

##### `cidrRange`<sup>Required</sup> <a name="cidrRange" id="@cdklabs/cdk-enterprise-iac.SubnetConfig.property.cidrRange"></a>

```typescript
public readonly cidrRange: string;
```

- *Type:* string

Cidr range of the subnet to create.

---

##### `groupName`<sup>Required</sup> <a name="groupName" id="@cdklabs/cdk-enterprise-iac.SubnetConfig.property.groupName"></a>

```typescript
public readonly groupName: string;
```

- *Type:* string

Logical group name of a subnet.

---

*Example*

```typescript
db
```


##### `subnetType`<sup>Required</sup> <a name="subnetType" id="@cdklabs/cdk-enterprise-iac.SubnetConfig.property.subnetType"></a>

```typescript
public readonly subnetType: SubnetType;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetType

What [SubnetType](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SubnetType.html) to use.

This will govern the `aws-cdk:subnet-type` tag on the subnet

SubnetType | `aws-cdk:subnet-type` tag value
--- | ---
`PRIVATE_ISOLATED` | 'Isolated'
`PRIVATE_WITH_EGRESS` | 'Private'
`PUBLIC` | 'Public'

---

## Classes <a name="Classes" id="Classes"></a>

### AddCfnInitProxy <a name="AddCfnInitProxy" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxy"></a>

- *Implements:* aws-cdk-lib.IAspect

Add proxy configuration to Cloudformation helper functions.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxy.Initializer"></a>

```typescript
import { AddCfnInitProxy } from '@cdklabs/cdk-enterprise-iac'

new AddCfnInitProxy(props: AddCfnInitProxyProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddCfnInitProxy.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps">AddCfnInitProxyProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxy.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.AddCfnInitProxyProps">AddCfnInitProxyProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddCfnInitProxy.visit">visit</a></code> | All aspects can visit an IConstruct. |

---

##### `visit` <a name="visit" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxy.visit"></a>

```typescript
public visit(node: IConstruct): void
```

All aspects can visit an IConstruct.

###### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.AddCfnInitProxy.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

---




### AddLambdaEnvironmentVariables <a name="AddLambdaEnvironmentVariables" id="@cdklabs/cdk-enterprise-iac.AddLambdaEnvironmentVariables"></a>

- *Implements:* aws-cdk-lib.IAspect

Add one or more environment variables to _all_ lambda functions within a scope.

#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.AddLambdaEnvironmentVariables.Initializer"></a>

```typescript
import { AddLambdaEnvironmentVariables } from '@cdklabs/cdk-enterprise-iac'

new AddLambdaEnvironmentVariables(props: {[ key: string ]: string})
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddLambdaEnvironmentVariables.Initializer.parameter.props">props</a></code> | <code>{[ key: string ]: string}</code> | : string} props - Key Value pair(s) for environment variables to add to all lambda functions. |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-enterprise-iac.AddLambdaEnvironmentVariables.Initializer.parameter.props"></a>

- *Type:* {[ key: string ]: string}

: string} props - Key Value pair(s) for environment variables to add to all lambda functions.

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddLambdaEnvironmentVariables.visit">visit</a></code> | All aspects can visit an IConstruct. |

---

##### `visit` <a name="visit" id="@cdklabs/cdk-enterprise-iac.AddLambdaEnvironmentVariables.visit"></a>

```typescript
public visit(node: IConstruct): void
```

All aspects can visit an IConstruct.

###### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.AddLambdaEnvironmentVariables.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

---




### AddPermissionBoundary <a name="AddPermissionBoundary" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary"></a>

- *Implements:* aws-cdk-lib.IAspect

A patch for Adding Permissions Boundaries to all IAM roles.

Additional options for adding prefixes to IAM role, policy and instance profile names

Can account for non commercial partitions (e.g. aws-gov, aws-cn)

#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.Initializer"></a>

```typescript
import { AddPermissionBoundary } from '@cdklabs/cdk-enterprise-iac'

new AddPermissionBoundary(props: AddPermissionBoundaryProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps">AddPermissionBoundaryProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.AddPermissionBoundaryProps">AddPermissionBoundaryProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.checkAndOverride">checkAndOverride</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.visit">visit</a></code> | All aspects can visit an IConstruct. |

---

##### `checkAndOverride` <a name="checkAndOverride" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.checkAndOverride"></a>

```typescript
public checkAndOverride(node: CfnResource, prefix: string, length: number, cfnProp: string, cdkProp?: string): void
```

###### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.checkAndOverride.parameter.node"></a>

- *Type:* aws-cdk-lib.CfnResource

---

###### `prefix`<sup>Required</sup> <a name="prefix" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.checkAndOverride.parameter.prefix"></a>

- *Type:* string

---

###### `length`<sup>Required</sup> <a name="length" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.checkAndOverride.parameter.length"></a>

- *Type:* number

---

###### `cfnProp`<sup>Required</sup> <a name="cfnProp" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.checkAndOverride.parameter.cfnProp"></a>

- *Type:* string

---

###### `cdkProp`<sup>Optional</sup> <a name="cdkProp" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.checkAndOverride.parameter.cdkProp"></a>

- *Type:* string

---

##### `visit` <a name="visit" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.visit"></a>

```typescript
public visit(node: IConstruct): void
```

All aspects can visit an IConstruct.

###### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.AddPermissionBoundary.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

---




### ConvertInlinePoliciesToManaged <a name="ConvertInlinePoliciesToManaged" id="@cdklabs/cdk-enterprise-iac.ConvertInlinePoliciesToManaged"></a>

- *Implements:* aws-cdk-lib.IAspect

Patch for turning all Policies into ConvertInlinePoliciesToManaged.

Some customers have policies in place that make it impossible to create standard policies. Instead,
they must use managed policies.

Note that order matters with this aspect. Specifically, it should generally be added first.
This is because other aspects may add overrides that would be lost if applied before
this aspect since the original aspect is removed and replaced.

*Example*

```typescript
// Replace all AWS::IAM::Policies with AWS::IAM::ConvertInlinePoliciesToManaged
Aspects.of(stack).add(new ConvertInlinePoliciesToManaged())
```


#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.ConvertInlinePoliciesToManaged.Initializer"></a>

```typescript
import { ConvertInlinePoliciesToManaged } from '@cdklabs/cdk-enterprise-iac'

new ConvertInlinePoliciesToManaged()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ConvertInlinePoliciesToManaged.visit">visit</a></code> | All aspects can visit an IConstruct. |

---

##### `visit` <a name="visit" id="@cdklabs/cdk-enterprise-iac.ConvertInlinePoliciesToManaged.visit"></a>

```typescript
public visit(node: IConstruct): void
```

All aspects can visit an IConstruct.

###### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.ConvertInlinePoliciesToManaged.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

---




### RemovePublicAccessBlockConfiguration <a name="RemovePublicAccessBlockConfiguration" id="@cdklabs/cdk-enterprise-iac.RemovePublicAccessBlockConfiguration"></a>

- *Implements:* aws-cdk-lib.IAspect

Looks for S3 Buckets, and removes the `PublicAccessBlockConfiguration` property.

For use in regions where Cloudformation doesn't support this property

#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.RemovePublicAccessBlockConfiguration.Initializer"></a>

```typescript
import { RemovePublicAccessBlockConfiguration } from '@cdklabs/cdk-enterprise-iac'

new RemovePublicAccessBlockConfiguration()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.RemovePublicAccessBlockConfiguration.visit">visit</a></code> | All aspects can visit an IConstruct. |

---

##### `visit` <a name="visit" id="@cdklabs/cdk-enterprise-iac.RemovePublicAccessBlockConfiguration.visit"></a>

```typescript
public visit(node: IConstruct): void
```

All aspects can visit an IConstruct.

###### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.RemovePublicAccessBlockConfiguration.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

---




### RemoveTags <a name="RemoveTags" id="@cdklabs/cdk-enterprise-iac.RemoveTags"></a>

- *Implements:* aws-cdk-lib.IAspect

Patch for removing tags from a specific Cloudformation Resource.

In some regions, the 'Tags' property isn't supported in Cloudformation. This patch makes it easy to remove

*Example*

```typescript
// Remove tags on a resource
Aspects.of(stack).add(new RemoveTags({
  cloudformationResource: 'AWS::ECS::Cluster',
}));
// Remove tags without the standard 'Tags' name
Aspects.of(stack).add(new RemoveTags({
  cloudformationResource: 'AWS::Backup::BackupPlan',
   tagPropertyName: 'BackupPlanTags',
}));
```


#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.RemoveTags.Initializer"></a>

```typescript
import { RemoveTags } from '@cdklabs/cdk-enterprise-iac'

new RemoveTags(props: RemoveTagsProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.RemoveTags.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.RemoveTagsProps">RemoveTagsProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-enterprise-iac.RemoveTags.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.RemoveTagsProps">RemoveTagsProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.RemoveTags.visit">visit</a></code> | All aspects can visit an IConstruct. |

---

##### `visit` <a name="visit" id="@cdklabs/cdk-enterprise-iac.RemoveTags.visit"></a>

```typescript
public visit(node: IConstruct): void
```

All aspects can visit an IConstruct.

###### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.RemoveTags.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

---




### ResourceExtractor <a name="ResourceExtractor" id="@cdklabs/cdk-enterprise-iac.ResourceExtractor"></a>

- *Implements:* aws-cdk-lib.IAspect

This Aspect takes a CDK application, all synthesized CloudFormationStackArtifact, a value share method, and a list of Cloudformation resources that should be pulled out of the main CDK application, which should be synthesized to a cloudformation template that an external team (e.g. security team) to deploy, and adjusting the CDK application to reference pre-created resources already pulled out.

*Example*

```typescript
 const app = App()
 const stack = new Stack(app, 'MyStack');
 extractedStack = new Stack(app, 'ExtractedStack');
 const synthedApp = app.synth();
 Aspects.of(app).add(new ResourceExtractor({
   extractDestinationStack: extractedStack,
   stackArtifacts: synthedApp.stacks,
   valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
   resourceTypesToExtract: [
     'AWS::IAM::Role',
     'AWS::IAM::Policy',
     'AWS::IAM::ManagedPolicy',
     'AWS::IAM::InstanceProfile',
   ],
 });
 app.synth({ force: true });
```


#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.ResourceExtractor.Initializer"></a>

```typescript
import { ResourceExtractor } from '@cdklabs/cdk-enterprise-iac'

new ResourceExtractor(props: ResourceExtractorProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractor.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorProps">ResourceExtractorProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="@cdklabs/cdk-enterprise-iac.ResourceExtractor.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorProps">ResourceExtractorProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractor.visit">visit</a></code> | Entrypoint. |

---

##### `visit` <a name="visit" id="@cdklabs/cdk-enterprise-iac.ResourceExtractor.visit"></a>

```typescript
public visit(node: IConstruct): void
```

Entrypoint.

###### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.ResourceExtractor.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

---




### SetApiGatewayEndpointConfiguration <a name="SetApiGatewayEndpointConfiguration" id="@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfiguration"></a>

- *Implements:* aws-cdk-lib.IAspect

Override RestApis to use a set endpoint configuration.

Some regions don't support EDGE endpoints, and some enterprises require
specific endpoint types for RestApis

#### Initializers <a name="Initializers" id="@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfiguration.Initializer"></a>

```typescript
import { SetApiGatewayEndpointConfiguration } from '@cdklabs/cdk-enterprise-iac'

new SetApiGatewayEndpointConfiguration(props?: SetApiGatewayEndpointConfigurationProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfiguration.Initializer.parameter.props">props</a></code> | <code><a href="#@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfigurationProps">SetApiGatewayEndpointConfigurationProps</a></code> | *No description.* |

---

##### `props`<sup>Optional</sup> <a name="props" id="@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfiguration.Initializer.parameter.props"></a>

- *Type:* <a href="#@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfigurationProps">SetApiGatewayEndpointConfigurationProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfiguration.visit">visit</a></code> | All aspects can visit an IConstruct. |

---

##### `visit` <a name="visit" id="@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfiguration.visit"></a>

```typescript
public visit(node: IConstruct): void
```

All aspects can visit an IConstruct.

###### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.SetApiGatewayEndpointConfiguration.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

---





## Enums <a name="Enums" id="Enums"></a>

### ProxyType <a name="ProxyType" id="@cdklabs/cdk-enterprise-iac.ProxyType"></a>

Whether an http-proxy or https-proxy.

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ProxyType.HTTP">HTTP</a></code> | --http-proxy. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ProxyType.HTTPS">HTTPS</a></code> | --https-proxy. |

---

##### `HTTP` <a name="HTTP" id="@cdklabs/cdk-enterprise-iac.ProxyType.HTTP"></a>

-http-proxy.

---


##### `HTTPS` <a name="HTTPS" id="@cdklabs/cdk-enterprise-iac.ProxyType.HTTPS"></a>

-https-proxy.

---


### ResourceExtractorShareMethod <a name="ResourceExtractorShareMethod" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorShareMethod"></a>

The available value sharing methods to pass values from the extracted stack onto the original stack(s).

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorShareMethod.CFN_OUTPUT">CFN_OUTPUT</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorShareMethod.SSM_PARAMETER">SSM_PARAMETER</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceExtractorShareMethod.API_LOOKUP">API_LOOKUP</a></code> | *No description.* |

---

##### `CFN_OUTPUT` <a name="CFN_OUTPUT" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorShareMethod.CFN_OUTPUT"></a>

---


##### `SSM_PARAMETER` <a name="SSM_PARAMETER" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorShareMethod.SSM_PARAMETER"></a>

---


##### `API_LOOKUP` <a name="API_LOOKUP" id="@cdklabs/cdk-enterprise-iac.ResourceExtractorShareMethod.API_LOOKUP"></a>

---


### ResourceTransform <a name="ResourceTransform" id="@cdklabs/cdk-enterprise-iac.ResourceTransform"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceTransform.STACK_NAME">STACK_NAME</a></code> | *No description.* |
| <code><a href="#@cdklabs/cdk-enterprise-iac.ResourceTransform.LOGICAL_ID">LOGICAL_ID</a></code> | *No description.* |

---

##### `STACK_NAME` <a name="STACK_NAME" id="@cdklabs/cdk-enterprise-iac.ResourceTransform.STACK_NAME"></a>

---


##### `LOGICAL_ID` <a name="LOGICAL_ID" id="@cdklabs/cdk-enterprise-iac.ResourceTransform.LOGICAL_ID"></a>

---

</details>

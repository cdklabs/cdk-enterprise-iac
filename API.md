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

---

##### `node`<sup>Required</sup> <a name="node" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscaler.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---


## Structs <a name="Structs" id="Structs"></a>

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
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.role">role</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | The IAM role that allows the created lambda to adjust the desired count on the ECS Service . |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleAlarm">scaleAlarm</a></code> | <code>aws-cdk-lib.aws_cloudwatch.Alarm</code> | The Cloudwatch Alarm that will cause scaling actions to be invoked, whether it's in or not in alarm will determine scale up and down actions. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.maximumTaskCount">maximumTaskCount</a></code> | <code>number</code> | The maximum number of tasks that the service will scale out to. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.minimumTaskCount">minimumTaskCount</a></code> | <code>number</code> | The minimum number of tasks the service will have. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleInCooldowwn">scaleInCooldowwn</a></code> | <code>aws-cdk-lib.Duration</code> | How long will the application wait before performing another scale in action. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleInIncrement">scaleInIncrement</a></code> | <code>number</code> | The number of tasks that will scale out on scal out alarm status. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleOutCooldown">scaleOutCooldown</a></code> | <code>aws-cdk-lib.Duration</code> | How long will a the application wait before performing another scale out action. |
| <code><a href="#@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleOutIncrement">scaleOutIncrement</a></code> | <code>number</code> | The number of tasks that will scale out on scal out alarm status. |

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

##### `role`<sup>Required</sup> <a name="role" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.role"></a>

```typescript
public readonly role: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole

The IAM role that allows the created lambda to adjust the desired count on the ECS Service .

TODO: Make optional and add function for auto generation

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

##### `scaleInCooldowwn`<sup>Optional</sup> <a name="scaleInCooldowwn" id="@cdklabs/cdk-enterprise-iac.EcsIsoServiceAutoscalerProps.property.scaleInCooldowwn"></a>

```typescript
public readonly scaleInCooldowwn: Duration;
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

The number of tasks that will scale out on scal out alarm status.

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

The number of tasks that will scale out on scal out alarm status.

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

## Classes <a name="Classes" id="Classes"></a>

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






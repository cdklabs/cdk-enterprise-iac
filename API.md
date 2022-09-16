# API Reference <a name="API Reference" id="api-reference"></a>


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






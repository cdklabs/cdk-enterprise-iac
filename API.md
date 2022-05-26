# API Reference <a name="API Reference" id="api-reference"></a>


## Structs <a name="Structs" id="Structs"></a>

### AddPermissionBoundaryProps <a name="AddPermissionBoundaryProps" id="cdk-enterprise-utils.AddPermissionBoundaryProps"></a>

#### Initializer <a name="Initializer" id="cdk-enterprise-utils.AddPermissionBoundaryProps.Initializer"></a>

```typescript
import { AddPermissionBoundaryProps } from 'cdk-enterprise-utils'

const addPermissionBoundaryProps: AddPermissionBoundaryProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-enterprise-utils.AddPermissionBoundaryProps.property.account">account</a></code> | <code>string</code> | Name of Account. |
| <code><a href="#cdk-enterprise-utils.AddPermissionBoundaryProps.property.permissionsBoundaryPolicyName">permissionsBoundaryPolicyName</a></code> | <code>string</code> | Name of Permissions Boundary to add to all IAM roles. |
| <code><a href="#cdk-enterprise-utils.AddPermissionBoundaryProps.property.instanceProfilePrefix">instanceProfilePrefix</a></code> | <code>string</code> | The prefix appended to the name of the IAM InstanceProfiles (Default: ''). |
| <code><a href="#cdk-enterprise-utils.AddPermissionBoundaryProps.property.partition">partition</a></code> | <code>string</code> | Name of Partition (Default: 'aws'). |
| <code><a href="#cdk-enterprise-utils.AddPermissionBoundaryProps.property.policyPrefix">policyPrefix</a></code> | <code>string</code> | The prefix appended to the name of the IAM Policies and ManagedPolicies (Default: ''). |
| <code><a href="#cdk-enterprise-utils.AddPermissionBoundaryProps.property.rolePrefix">rolePrefix</a></code> | <code>string</code> | The prefix appended to the name of IAM Roles (Default: ''). |

---

##### `account`<sup>Required</sup> <a name="account" id="cdk-enterprise-utils.AddPermissionBoundaryProps.property.account"></a>

```typescript
public readonly account: string;
```

- *Type:* string

Name of Account.

---

##### `permissionsBoundaryPolicyName`<sup>Required</sup> <a name="permissionsBoundaryPolicyName" id="cdk-enterprise-utils.AddPermissionBoundaryProps.property.permissionsBoundaryPolicyName"></a>

```typescript
public readonly permissionsBoundaryPolicyName: string;
```

- *Type:* string

Name of Permissions Boundary to add to all IAM roles.

---

##### `instanceProfilePrefix`<sup>Optional</sup> <a name="instanceProfilePrefix" id="cdk-enterprise-utils.AddPermissionBoundaryProps.property.instanceProfilePrefix"></a>

```typescript
public readonly instanceProfilePrefix: string;
```

- *Type:* string

The prefix appended to the name of the IAM InstanceProfiles (Default: '').

---

##### `partition`<sup>Optional</sup> <a name="partition" id="cdk-enterprise-utils.AddPermissionBoundaryProps.property.partition"></a>

```typescript
public readonly partition: string;
```

- *Type:* string

Name of Partition (Default: 'aws').

---

##### `policyPrefix`<sup>Optional</sup> <a name="policyPrefix" id="cdk-enterprise-utils.AddPermissionBoundaryProps.property.policyPrefix"></a>

```typescript
public readonly policyPrefix: string;
```

- *Type:* string

The prefix appended to the name of the IAM Policies and ManagedPolicies (Default: '').

---

##### `rolePrefix`<sup>Optional</sup> <a name="rolePrefix" id="cdk-enterprise-utils.AddPermissionBoundaryProps.property.rolePrefix"></a>

```typescript
public readonly rolePrefix: string;
```

- *Type:* string

The prefix appended to the name of IAM Roles (Default: '').

---

## Classes <a name="Classes" id="Classes"></a>

### AddPermissionBoundary <a name="AddPermissionBoundary" id="cdk-enterprise-utils.AddPermissionBoundary"></a>

- *Implements:* aws-cdk-lib.IAspect

#### Initializers <a name="Initializers" id="cdk-enterprise-utils.AddPermissionBoundary.Initializer"></a>

```typescript
import { AddPermissionBoundary } from 'cdk-enterprise-utils'

new AddPermissionBoundary(props: AddPermissionBoundaryProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-enterprise-utils.AddPermissionBoundary.Initializer.parameter.props">props</a></code> | <code><a href="#cdk-enterprise-utils.AddPermissionBoundaryProps">AddPermissionBoundaryProps</a></code> | *No description.* |

---

##### `props`<sup>Required</sup> <a name="props" id="cdk-enterprise-utils.AddPermissionBoundary.Initializer.parameter.props"></a>

- *Type:* <a href="#cdk-enterprise-utils.AddPermissionBoundaryProps">AddPermissionBoundaryProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-enterprise-utils.AddPermissionBoundary.checkAndOverride">checkAndOverride</a></code> | *No description.* |
| <code><a href="#cdk-enterprise-utils.AddPermissionBoundary.visit">visit</a></code> | All aspects can visit an IConstruct. |

---

##### `checkAndOverride` <a name="checkAndOverride" id="cdk-enterprise-utils.AddPermissionBoundary.checkAndOverride"></a>

```typescript
public checkAndOverride(node: CfnResource, prefix: string, length: number, cfnProp: string, cdkProp?: string): void
```

###### `node`<sup>Required</sup> <a name="node" id="cdk-enterprise-utils.AddPermissionBoundary.checkAndOverride.parameter.node"></a>

- *Type:* aws-cdk-lib.CfnResource

---

###### `prefix`<sup>Required</sup> <a name="prefix" id="cdk-enterprise-utils.AddPermissionBoundary.checkAndOverride.parameter.prefix"></a>

- *Type:* string

---

###### `length`<sup>Required</sup> <a name="length" id="cdk-enterprise-utils.AddPermissionBoundary.checkAndOverride.parameter.length"></a>

- *Type:* number

---

###### `cfnProp`<sup>Required</sup> <a name="cfnProp" id="cdk-enterprise-utils.AddPermissionBoundary.checkAndOverride.parameter.cfnProp"></a>

- *Type:* string

---

###### `cdkProp`<sup>Optional</sup> <a name="cdkProp" id="cdk-enterprise-utils.AddPermissionBoundary.checkAndOverride.parameter.cdkProp"></a>

- *Type:* string

---

##### `visit` <a name="visit" id="cdk-enterprise-utils.AddPermissionBoundary.visit"></a>

```typescript
public visit(node: IConstruct): void
```

All aspects can visit an IConstruct.

###### `node`<sup>Required</sup> <a name="node" id="cdk-enterprise-utils.AddPermissionBoundary.visit.parameter.node"></a>

- *Type:* constructs.IConstruct

---






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

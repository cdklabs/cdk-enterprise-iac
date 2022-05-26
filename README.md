<!--
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
-->

# CDK Enterprise utils

Utilites for using CDK within enterprise constraints

## Install

Typescript

```zsh
npm install cdk-enterprise-utils
```

Python

```zsh
pip install cdk-enterprise-utils
```

## Usage

Example for `AddPermissionBoundary` in Python project.

```python
import aws_cdk as cdk
from cdk_enterprise_utils import AddPermissionBoundary

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

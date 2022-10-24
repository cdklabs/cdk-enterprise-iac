#!/bin/bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

echo "============================================================================================="
echo "Copying API.md to the end of README.md"
echo "============================================================================================="
echo "First removing existing API.md from README.md"
sed -i.bak '/Generated API.md below:/,$d' README.md
echo "============================================================================================="
echo "Adding back in divider text"
echo 'Generated API.md below:' >> README.md
echo '<details>' >> README.md
echo '    <summary>Expand to view API docs</summary>' >> README.md
echo '' >> README.md
echo "============================================================================================="
echo "Appending API.md to the end of README.md"
cat API.md >> README.md

echo '</details>' >> README.md
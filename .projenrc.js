/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
const { awscdk } = require('projen');
const { GitlabConfiguration } = require('projen/lib/gitlab');
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Taylor Ondrey',
  authorAddress: 'ondreyt@amazon.com',
  cdkVersion: '2.37.1',
  defaultReleaseBranch: 'main',
  name: 'cdk-enterprise-utils',
  repositoryUrl: 'https://github.com/cdklabs/cdk-enterprise-utils.git',
  devDeps: ['eslint-plugin-security'],
  gitignore: ['.vscode/'],
  eslintOptions: { prettier: true },
  autoApproveOptions: {
    allowedUsernames: ['cdklabs-automation'],
    secret: 'GITHUB_TOKEN',
  },
  autoApproveUpgrades: true,
  depsUpgradeOptions: {
    ignoreProjen: false,
    workflowOptions: {
      labels: ['auto-approve'],
      secret: 'PROJEN_GITHUB_TOKEN',
      container: {
        image: 'jsii/superchain:1-buster-slim-node14',
      },
    },
  },
  publishToPypi: {
    distName: 'cdk-enterprise-utils',
    module: 'cdk_enterprise_utils',
  },
  publishToNuget: {
    packageId: 'Cdklabs.CdkEnterpriseUtils',
    dotNetNamespace: 'Cdklabs.CdkEnterpriseUtils',
  },
  publishToMaven: {
    mavenGroupId: 'io.github.cdklabs',
    javaPackage: 'io.github.cdklabs.cdkenterpriseutils',
    mavenArtifactId: 'cdkenterpriseutils',
    mavenEndpoint: 'https://s01.oss.sonatype.org',
  },
  publishToGo: {
    moduleName: 'github.com/cdklabs/cdk-enterprise-utils',
  },
  release: true,
});
project.package.addField('prettier', {
  singleQuote: true,
  semi: true,
  trailingComma: 'es5',
});
project.eslint.addRules({
  'prettier/prettier': [
    'error',
    { singleQuote: true, semi: true, trailingComma: 'es5' },
  ],
});
project.eslint.addExtends('plugin:security/recommended');
project.synth();

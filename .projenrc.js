/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
const { awscdk } = require('projen');
const { GitlabConfiguration } = require('projen/lib/gitlab');
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Taylor Ondrey',
  authorAddress: 'ondreyt@amazon.com',
  cdkVersion: '2.33.0',
  defaultReleaseBranch: 'main',
  name: 'cdk-enterprise-utils',
  repositoryUrl:
    'git@ssh.gitlab.aws.dev:wwps-natsec/cdk/cdk-enterprise-utils.git',
  devDeps: ['eslint-plugin-security'],
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
    distName: 'cdk-nag',
    module: 'cdk_nag',
  },
  publishToNuget: {
    packageId: 'Cdklabs.CdkNag',
    dotNetNamespace: 'Cdklabs.CdkNag',
  },
  publishToMaven: {
    mavenGroupId: 'io.github.cdklabs',
    javaPackage: 'io.github.cdklabs.cdknag',
    mavenArtifactId: 'cdknag',
    mavenEndpoint: 'https://s01.oss.sonatype.org',
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

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { awscdk, JsonFile } from 'projen';
import { NpmAccess } from 'projen/lib/javascript';

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Taylor Ondrey',
  authorAddress: 'ondreyt@amazon.com',
  projenrcTs: true,
  cdkVersion: '2.41.0',
  defaultReleaseBranch: 'main',
  name: '@cdklabs/cdk-enterprise-iac',
  repositoryUrl: 'https://github.com/cdklabs/cdk-enterprise-iac.git',
  devDeps: [
    'eslint-plugin-security',
    '@aws-cdk/integ-tests-alpha@2.41.0-alpha.0',
    '@aws-cdk/integ-runner@^2',
    'natural-compare-lite',
  ],
  deps: ['aws-sdk@^2.1230.0'],
  bundledDeps: ['aws-sdk'],
  gitignore: [
    '.vscode/',
    '*.d.ts',
    '*.generated.ts',
    '*.js',
    '*.js.map',
    '!**/*.integ.snapshot/**/asset.*/*.js',
    '!**/*.integ.snapshot/**/asset.*/*.d.ts',
    '!**/*.integ.snapshot/**/asset.*/**',
    '*.bak',
  ],
  eslintOptions: { prettier: true, dirs: ['src', 'projenrc'] },
  autoApproveOptions: {
    allowedUsernames: ['cdklabs-automation'],
    secret: 'GITHUB_TOKEN',
  },
  autoApproveUpgrades: true,
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-approve'],
      container: {
        image: 'jsii/superchain:1-buster-slim-node14',
      },
    },
  },
  npmAccess: NpmAccess.PUBLIC,
  publishToPypi: {
    distName: 'cdklabs.cdk-enterprise-iac',
    module: 'cdklabs.cdk_enterprise_iac',
  },
  publishToNuget: {
    packageId: 'Cdklabs.CdkEnterpriseIac',
    dotNetNamespace: 'Cdklabs.CdkEnterpriseIac',
  },
  publishToMaven: {
    mavenGroupId: 'io.github.cdklabs',
    javaPackage: 'io.github.cdklabs.cdkenterpriseiac',
    mavenArtifactId: 'cdkenterpriseiac',
    mavenEndpoint: 'https://s01.oss.sonatype.org',
  },
  release: true,
});

project.package.addField('prettier', {
  singleQuote: true,
  semi: true,
  trailingComma: 'es5',
});
project.eslint?.addRules({
  'prettier/prettier': [
    'error',
    { singleQuote: true, semi: true, trailingComma: 'es5' },
  ],
});
project.eslint?.addExtends('plugin:security/recommended');

new JsonFile(project, 'test/integ/tsconfig.json', {
  obj: {
    extends: '../../tsconfig.dev.json',
    include: ['./**/integ.*.ts'],
  },
});
project.setScript(
  'integ',
  'npx tsc -p test/integ && npx integ-runner --update-on-failed'
);
project.synth();

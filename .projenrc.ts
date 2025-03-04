/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import {
  CdklabsConstructLibrary,
  JsiiLanguage,
} from 'cdklabs-projen-project-types';
import { DependencyType, JsonFile } from 'projen';
import { NodePackageManager } from 'projen/lib/javascript';

const project = new CdklabsConstructLibrary({
  setNodeEngineVersion: false,
  stability: 'experimental',
  private: false,
  author: 'Taylor Ondrey',
  authorAddress: 'ondreyt@amazon.com',
  projenrcTs: true,
  cdkVersion: '2.103.1',
  rosettaOptions: {
    strict: false,
  },
  defaultReleaseBranch: 'main',
  name: '@cdklabs/cdk-enterprise-iac',
  repositoryUrl: 'https://github.com/cdklabs/cdk-enterprise-iac.git',
  devDeps: ['eslint-plugin-security', 'natural-compare-lite'],
  deps: ['aws-sdk@2.1692.0'], // no need for this to be updated
  jsiiVersion: '5.5.x',
  typescriptVersion: '5.5.x',
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
  jsiiTargetLanguages: [
    JsiiLanguage.PYTHON,
    JsiiLanguage.DOTNET,
    JsiiLanguage.JAVA,
  ],
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
  packageManager: NodePackageManager.YARN_CLASSIC,
  versionrcOptions: {
    preset: 'conventionalcommits',
  },
});

project.addFields({
  packageManager: 'yarn@1.22.19+sha1.4ba7fc5c6e704fce2066ecbfb0b0d8976fe62447',
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
project.eslint?.addExtends('plugin:security/recommended-legacy');

project.deps.addDependency(
  '@aws-cdk/integ-tests-alpha@2.103.1-alpha.0',
  DependencyType.TEST
);
new JsonFile(project, 'test/integ/tsconfig.json', {
  obj: {
    extends: '../../tsconfig.dev.json',
    include: ['./**/integ.*.ts'],
  },
});
project.synth();

const { awscdk } = require('projen');
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Taylor Ondrey',
  authorAddress: 'ondreyt@amazon.com',
  cdkVersion: '2.25.0',
  defaultReleaseBranch: 'main',
  name: 'cdk-enterprise-utils',
  repositoryUrl: 'git@ssh.gitlab.aws.dev:wwps-natsec/cdk/cdk-enterprise-utils.git',

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});
project.synth();
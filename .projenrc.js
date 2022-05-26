const { awscdk } = require('projen');
const { GitlabConfiguration } = require('projen/lib/gitlab');
const project = new awscdk.AwsCdkConstructLibrary({
  author: 'Taylor Ondrey',
  authorAddress: 'ondreyt@amazon.com',
  cdkVersion: '2.25.0',
  defaultReleaseBranch: 'main',
  name: 'cdk-enterprise-utils',
  repositoryUrl: 'git@ssh.gitlab.aws.dev:wwps-natsec/cdk/cdk-enterprise-utils.git',
  publishToPypi: {
    distName: 'cdk-enterprise-utils',
    module: 'cdk_enterprise_utils',
  },
  release: true,
});
const gitlabMain = new GitlabConfiguration(project, {
  stages: ['build', 'deploy', 'pre-release', 'release'],
  default: {
    image: 'jsii/superchain:1-buster-slim',
  },
  jobs: {
    build: {
      stage: 'build',
      rules: [{when: 'on_success'}],
      script: [
        'yarn install --check-files --frozen-lockfile',
        'npx projen',
        // Anti-tamper check
        'git diff --exit-code',
        'git config --global user.email gilab-runner@gitlab.com',
        'git config --global user.name "Auto-bump"',
        // compile and test
        'npm version --no-git-tag-version ${CI_COMMIT_TAG#v}',
        'npx projen test',
        'npx jsii --silence-warnings=reserved-word --no-fix-peer-dependencies',
        'npx jsii-docgen',
        'npx jsii-pacmak',
        'zip -r cdknode.zip dist/js',
        // 'zip -r cdkjava.zip dist/java',
        'zip -r cdkpython.zip dist/python',
        // 'zip -r cdkdotnet.zip dist/dotnet',
      ],
      artifacts: {
        paths: [
          'cdknode.zip',
          // 'cdkjava.zip',
          'cdkpython.zip',
          // 'cdkdotnet.zip',
          'dist/',
        ]
      }
    },
    upload_pypi: {
      stage: 'deploy',
      image: 'node:latest',
      rules: [
        {
          if: '$CI_COMMIT_TAG =~ /^v\\d+(\\.\\d+){2}$/',
          when: 'on_success'
        },
        {when: 'never'},
      ],
      dependencies:['build'],
      script: [
        'pip install twine',
        'TWINE_PASSWORD=${CI_JOB_TOKEN} TWINE_USERNAME=gitlab-ci-token python -m twine upload --repository-url ${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/pypi dist/python/*',

      ]
    },
    upload_artifacts: {
      stage: 'pre-release',
      image: 'curlimages/curl:latest',
      rules: [
        {
          if: '$CI_COMMIT_TAG =~ /^v\\d+(\\.\\d+){2}$/',
          when: 'on_success',
        },
        {when: 'never'},
      ],
      dependencies: ['build'],
      script: [
        'curl --header "JOB-TOKEN: $CI_JOB_TOKEN" --upload-file cdkpython.zip "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/generic/cdk-enterprise-utils/${CI_COMMIT_TAG#v}/python.zip"',
        'curl --header "JOB-TOKEN: $CI_JOB_TOKEN" --upload-file API.md "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/generic/cdk-enterprise-utils/${CI_COMMIT_TAG#v}/API.md"',
        'curl --header "JOB-TOKEN: $CI_JOB_TOKEN" --upload-file README.md "${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/generic/cdk-enterprise-utils/${CI_COMMIT_TAG#v}/README.md"',
      ]
    },
    release: {
      stage: 'release',
      image: 'registry.gitlab.com/gitlab-org/release-cli:latest',
      rules: [
        {
          if: '$CI_COMMIT_TAG =~ /^v\\d+(\\.\\d+){2}$/',
          when: 'on_success',
        },
        {when: 'never'},
      ],
      dependencies: ['build', 'upload_artifacts'],
      script: ['echo \'running release_job for ${CI_COMMIT_TAG}\''],
      release: {
        name: 'cdk-enterprise-utils ${CI_COMMIT_TAG}',
        description: './CHANGELOG.md',
        tagName: '$CI_COMMIT_TAG',
        ref: '$CI_COMMIT_TAG',
        assets: {
          links: [
            {
              name: 'cdk-enterprise-utils-${CI_COMMIT_TAG}-python',
              url: '${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/generic/cdk-enterprise-utils/${CI_COMMIT_TAG#v}/python.zip',
              link_type: 'package'
            },
            {
              name: 'README',
              url: '${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/generic/cdk-enterprise-utils/${CI_COMMIT_TAG#v}/README.md',
              link_type: 'runbook'
            },
            {
              name: 'API',
              url: '${CI_API_V4_URL}/projects/${CI_PROJECT_ID}/packages/generic/cdk-enterprise-utils/${CI_COMMIT_TAG#v}/API.md',
              link_type: 'runbook'
            },
          ]
        }
      }
    }
  }
});
project.synth();
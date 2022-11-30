/* eslint-disable import/no-extraneous-dependencies */
//import { IntegTest } from '@aws-cdk/integ-tests-alpha';
import * as cdk from 'aws-cdk-lib';
import * as proxy from './proxyServer';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'MyStack');

new proxy.Proxy(stack, 'Cdk-proxyServer-Lib', {
  proxyPlaybookBucketName: 'proxyServerIntegTestBucket',
});
/*
const integ = new IntegTest(app, 'Integ', {
  testCases: [stack],
});

integ.assertions.awsApiCall(
  'elbv2',
  'aws elbv2 describe-target-health --target-group-arn ' + proxyServer.proxyArn
);
*/

import * as cdk from 'aws-cdk-lib';
import * as proxy from '../../../src/constructs/proxyServer/proxyServer';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'MyStack');

new proxy.Proxy(stack, 'Cdk-proxyServer-Lib', {
  proxyPlaybookBucketName: 'proxyServerIntegTestBucket',
});

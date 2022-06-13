import { Aspects, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { RemoveTags } from '../../src/patches/removeTags';

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});


describe('Remove Tags from resources', () => {
  test('Can remove from "Tags" resource', () => {
    new Vpc(stack, 'testVpc');

    Aspects.of(stack).add(new RemoveTags({
      cloudformationResource: 'AWS::EC2::EIP',
    }));

    const template = Template.fromStack(stack);
    console.log(template);
    template.hasResourceProperties('AWS::EC2::EIP', {
      Tags: Match.absent(),
    });
  });
});
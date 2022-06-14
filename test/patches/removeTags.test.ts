import { Aspects, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CfnBackupPlan } from 'aws-cdk-lib/aws-backup';
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
    template.hasResourceProperties('AWS::EC2::EIP', {
      Tags: Match.absent(),
    });
  });

  test('Remove tags with different name than "Tags"', () => {

    new CfnBackupPlan(stack, 'TestBackupplan', {
      backupPlan: {
        backupPlanName: 'testBackupPlan',
        backupPlanRule: [{
          ruleName: 'SomeRule',
          targetBackupVault: 'SomeBackupVault',
        }],
      },
      backupPlanTags: {
        SomeKey: 'SomeValue',
      },
    });
    Aspects.of(stack).add(new RemoveTags({
      cloudformationResource: 'AWS::Backup::BackupPlan',
      tagPropertyName: 'BackupPlanTags',
    }));

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Backup::BackupPlan', {
      BackupPlanTags: Match.absent(),
    });
  });
});
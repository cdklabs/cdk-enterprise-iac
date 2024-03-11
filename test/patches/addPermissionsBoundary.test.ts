/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Aspects, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import {
  CfnInstanceProfile,
  ManagedPolicy,
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { AddPermissionBoundary } from '../../src/patches/addPermissionsBoundary';

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

describe('Permissions Boundary patch', () => {
  const pbName = 'test-pb';

  describe('Roles', () => {
    test('Provided Permission Boundary name is added', () => {
      new Role(stack, 'testRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      });
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
        })
      );
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Role', {
        PermissionsBoundary: {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition',
              },
              ':iam::',
              {
                Ref: 'AWS::AccountId',
              },
              `:policy/${pbName}`,
            ],
          ],
        },
      });
    });
    test('Role Prefix is prepended and does not exceed max length', () => {
      const roleName =
        'my-awesome-role-that-has-quite-a-long-name-seriously-it-is-so-long-it-exceeds-64-characters';
      const rolePrefix = 'MY_PREFIX';
      new Role(stack, 'testRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
        roleName,
      });
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          rolePrefix,
        })
      );
      const template = Template.fromStack(stack);
      let roles = template.findResources('AWS::IAM::Role',
      );
      const names: string[] = [];
      let i = 0;
      for (const templateRole of Object.keys(roles)) {
        const role = roles[templateRole].Properties.RoleName as string
        names[i] = role
        i++
      }
      expect(names.length).toBe(1);
      expect(names[0].startsWith(rolePrefix)).toBe(true);
      expect(names[0].length).toBe(64);
    });
    test('Role Prefix is prepended and is unique', () => {
      let firstRoleName =
        'my-awesome-role-that-has-quite-a-long-name-seriously-it-is-so-long-it-exceeds-64-characters-1';
      let secondRoleName =
        'my-awesome-role-that-has-quite-a-long-name-seriously-it-is-so-long-it-exceeds-64-characters-2';
      const rolePrefix = 'MY_PREFIX';
      new Role(stack, 'testFirstRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
        roleName: firstRoleName,
      });
      new Role(stack, 'testSecondRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
        roleName: secondRoleName,
      });
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          rolePrefix,
        })
      );
      const template = Template.fromStack(stack);
      let roles = template.findResources('AWS::IAM::Role',
      );
      const names: { [index: string]: boolean } = {};
      for (const roleName of Object.keys(roles)) {
        const role = roles[roleName].Properties.RoleName as string
        expect(role.startsWith(rolePrefix)).toBe(true)
        if (names[role])
          throw new Error('Duplicate role name found')
        names[role] = true
      }
    });
    test('Roles without RoleName are handled', () => {
      new Bucket(stack, 'TestBucket', {
        autoDeleteObjects: true, // creates custom resource with role that has no RoleName
        removalPolicy: RemovalPolicy.DESTROY,
      });
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          rolePrefix: 'Bananas_',
        })
      );
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Role', {
        PermissionsBoundary: {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition',
              },
              ':iam::',
              {
                Ref: 'AWS::AccountId',
              },
              `:policy/${pbName}`,
            ],
          ],
        },
      });
    });
    test('Roles with spaces in id are supported', () => {
      const idWithSpaces: string = 'A Role With Spaces In name';
      new Role(stack, idWithSpaces, {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      });
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          rolePrefix: 'Bananas_',
        })
      );
      const template = Template.fromStack(stack);
      let roles = template.findResources('AWS::IAM::Role',
      );
      const names: string[] = [];
      let i = 0;
      for (const templateRole of Object.keys(roles)) {
        const role = roles[templateRole].Properties.RoleName as string
        names[i] = role
        i++
      }
      expect(names[0].indexOf(' ')).toBe(-1)
      expect(names[0].startsWith('Bananas_')).toBe(true)
    });
    test('Role name is not altered if it already complies with naming convention', () => {
      const rolePrefix = 'Cust_';
      const roleName = `${rolePrefix}MyRole`;
      new Role(stack, 'Role', {
        roleName,
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      });

      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          rolePrefix,
        })
      );
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: roleName,
      });
    });
  });
  describe('Policies', () => {
    const policyPrefix = 'POLICY_PREFIX_';
    test('Managed Policy prefix is added and does not exceed limit', () => {
      const managedPolicyName =
        'policy-shmolicy-which-is-very-super-wow-thats-long-very-super-wow-thats-long-very-super-wow-thats-long-very-super-wow-thats-long';
      const policy = new ManagedPolicy(stack, 'MyManagedPolicy', {
        managedPolicyName,
      });
      policy.addStatements(
        new PolicyStatement({
          actions: ['s3:*'],
          resources: ['*'],
        })
      );
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          policyPrefix,
        })
      );
      const template = Template.fromStack(stack);
      let polices = template.findResources('AWS::IAM::ManagedPolicy',
      );
      const names: string[] = [];
      let i = 0;
      for (const templatePolicy of Object.keys(polices)) {
        const policy = polices[templatePolicy].Properties.ManagedPolicyName as string
        names[i] = policy
        i++
      }
      expect(names.length).toBe(1)
      expect(names[0].startsWith(policyPrefix)).toBe(true)
      expect(names[0].length).toBe(128)
    });
    test('Managed Policy name is not altered if it already complies with naming convention', () => {
      const managedPolicyName = `${policyPrefix}MyPolicy`;
      const policy = new ManagedPolicy(stack, 'MyManagedPolicy', {
        managedPolicyName,
      });
      policy.addStatements(
        new PolicyStatement({
          actions: ['s3:*'],
          resources: ['*'],
        })
      );

      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          policyPrefix,
        })
      );
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
        ManagedPolicyName: `${policyPrefix}MyPolicy`,
      });
    });
    test('Inline Policy prefix is added and does not exceed limit', () => {
      const policyName =
        'policy-shmolicy-which-is-very-super-wow-thats-long-very-super-wow-thats-long-very-super-wow-thats-long-very-super-wow-thats-long';
      const role = new Role(stack, 'TestRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      });
      const policy = new Policy(stack, 'TestInlinePolicy', {
        policyName,
        roles: [role],
      });
      policy.addStatements(
        new PolicyStatement({
          actions: ['s3:*'],
          resources: ['*'],
        })
      );
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          policyPrefix,
        })
      );
      const template = Template.fromStack(stack);
      let polices = template.findResources('AWS::IAM::Policy',
      );
      const names: string[] = [];
      let i = 0;
      for (const templatePolicy of Object.keys(polices)) {
        const policy = polices[templatePolicy].Properties.PolicyName as string
        names[i] = policy
        i++
      }
      expect(names.length).toBe(1)
      expect(names[0].startsWith(policyPrefix)).toBe(true)
      expect(names[0].length).toBe(128)
    });

    test('Instance Profile prefix is added and does not exceed limit', () => {
      const instanceProfileName =
        'instance-profile-which-is-very-super-wow-thats-long-very-super-wow-thats-long-very-super-wow-thats-long-very-super-wow-thats-long';
      const instanceProfilePrefix = 'POLICY_PREFIX_';
      const role = new Role(stack, 'TestRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      });
      new CfnInstanceProfile(stack, 'TestInstanceProfile', {
        instanceProfileName,
        roles: [role.roleName],
      });
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          instanceProfilePrefix,
        })
      );
      const template = Template.fromStack(stack);
      let profiles = template.findResources('AWS::IAM::InstanceProfile',
      );
      const names: string[] = [];
      let i = 0;
      for (const templateInstanceProfile of Object.keys(profiles)) {
        const profile = profiles[templateInstanceProfile].Properties.InstanceProfileName as string
        names[i] = profile
        i++
      }
      expect(names.length).toBe(1)
      expect(names[0].startsWith(instanceProfilePrefix)).toBe(true)
      expect(names[0].length).toBe(128)
    });
    test('Instance Profile works fine when no prefix needed', () => {
      const role = new Role(stack, 'TestRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      });
      new CfnInstanceProfile(stack, 'TestInstanceProfile', {
        roles: [role.roleName],
      });
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
        })
      );
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::IAM::InstanceProfile', 1);
    });
    test('Instance Profile name added when none provided', () => {
      const instanceProfilePrefix = 'INSTANCE_PROFILE_PREFIX_';
      const role = new Role(stack, 'TestRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      });
      new CfnInstanceProfile(stack, 'TestInstanceProfile', {
        roles: [role.roleName],
      });
      Aspects.of(stack).add(
        new AddPermissionBoundary({
          permissionsBoundaryPolicyName: pbName,
          instanceProfilePrefix,
        })
      );
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::InstanceProfile', {
        InstanceProfileName: Match.stringLikeRegexp(
          `${instanceProfilePrefix}*`
        ),
      });
    });
  });
});

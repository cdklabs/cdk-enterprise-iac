/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { JsonPatch, Project } from 'projen';

export interface WorkflowDockerPatchOptions {
  /**
   * The workflow to patch.
   */
  workflow: 'build' | 'release';
  /**
   * Name of the workflow.
   * @default - same as `workflow`
   */
  workflowName?: string;
  /**
   * Name of job that gathers the docker group id
   * @default - get-docker-group
   */
  dockerGroupJobName?: string;
}

export class WorkflowDockerPatch {
  public constructor(project: Project, options: WorkflowDockerPatchOptions) {
    const {
      workflow,
      workflowName = options.workflow,
      dockerGroupJobName = 'get-docker-group',
    } = options;
    const jobPath = `/jobs/${workflowName}`;

    const workflowFile = project.tryFindObjectFile(
      `.github/workflows/${workflow}.yml`
    );
    if (!workflowFile) {
      return;
    }

    const patches = [
      JsonPatch.add(`/jobs/${dockerGroupJobName}`, {
        'runs-on': 'ubuntu-latest',
        outputs: {
          dockerId: '${{ steps.get_docker_id.outputs.id }}',
        },
        steps: [
          {
            name: 'Get docker id',
            id: 'get_docker_id',
            run: 'echo "id=$(cut -d: -f3 < <(getent group docker))" >> $GITHUB_OUTPUT',
          },
        ],
      }),
      JsonPatch.add(
        jobPath + '/container/options',
        `--group-add \${{ needs.${dockerGroupJobName}.outputs.dockerId }}`
      ),
      JsonPatch.add(jobPath + '/needs', dockerGroupJobName),
    ];
    workflowFile.patch(...patches);
  }
}

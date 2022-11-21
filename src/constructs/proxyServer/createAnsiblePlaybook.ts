/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable security/detect-object-injection */
/* eslint-disable security/detect-non-literal-fs-filename */
//import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
//import * as util from 'util';
//import * as stream from 'stream'

/*
 * Updates the contents of a file and writes them to a new file
 *
 * Inputs: currentStr - string to update
 *         newStr - string to replace currentStr
 *         currentFilepath: file where currentStr is located
 *         newFilepath: file where newStr will be written
 */
function updateFile(
  currentStr: string,
  newStr: string,
  currentFilepath: string,
  newFilepath: string
) {
  let fs = require('fs');
  fs.readFile(
    path.join(__dirname, currentFilepath),
    'utf8',
    (err: Error, data: any) => {
      if (err) {
        return console.log(err);
      }

      let result = data.replaceAll(currentStr, newStr);

      fs.writeFile(
        path.join(__dirname, newFilepath),
        result,
        'utf8',
        (err: Error) => {
          if (err) {
            return console.log(err);
          }
        }
      );
    }
  );
}

/*
 * Creates a file with the contents of a string array containing approved domain for the proxy
 *
 * Inputs: approvedDomains - array of approved domains as strings
 *         filepath - file to write the approvedDomains to
 */
async function updateApprovedDomains(
  approvedDomains: string[],
  filepath: string
) {
  const fs = require('fs');
  const writeStream = fs.createWriteStream(filepath);
  //const writeStream = fs.createWriteStream(filepath);
  //const pathName = writeStream.path;

  // Remove any whitespace before or after the domain
  // write each value of the array on the file breaking line
  approvedDomains
    .map((value) => value.trim())
    .forEach((value) => writeStream.write(`${value}\n`));

  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  // close the stream
  writeStream.end();
}

export interface AnsiblePlaybookProps {
  /*
   * Name of the bucket to create where the Ansible Playbook will be stored
   */
  bucketName: string;
  /*
   * Array of the approved Domain for for proxy server
   */
  approvedDomains: string[];
  /*
   * Port which the proxy will use
   */
  proxyPort: number;
}

/**
 * Creates a AnsiblePlaybook construct. This construct updates the files need for the
 * proxy server and uploads them to an s3 bucket
 *
 * @param scope The parent creating construct (usually `this`).
 * @param id The construct's name.
 * @param this A `AnsiblePlaybookProps` interface.
 */

export class AnsiblePlaybook extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: AnsiblePlaybookProps) {
    super(scope, id);

    // Indexes for the 'replacements' array
    const CURRENT_STR = 0;
    const NEW_STR = 1;
    const CURRENT_FILEPATH = 2;
    const NEW_FILEPATH = 3;

    // Array of strings  to update and files to populate based on props and stack region
    let replacements = [
      [
        'REPLACE_PORT',
        `${props.proxyPort}`,
        '../../../resources/constructs/proxyServer/ansibleResources/s3Deployment/ansible-playbook-proxy/roles/ansible-role-squid/templates/REPLACE_ME_squid.conf',
        '../../../resources/constructs/proxyServer/ansibleResources/s3Deployment/ansible-playbook-proxy/roles/ansible-role-squid/templates/squid.conf',
      ],
      [
        'REPLACE_PORT',
        `${props.proxyPort}`,
        '../../../resources/constructs/proxyServer/ansibleResources/s3Deployment/squid-resources/cf_resources/REPLACE_ME_squid.conf',
        '../../../resources/constructs/proxyServer/ansibleResources/s3Deployment/squid-resources/cf_resources/squid.conf',
      ],
    ];

    // Loop through 'replacements' array and update all strings
    for (let index in replacements) {
      updateFile(
        replacements[index][CURRENT_STR],
        replacements[index][NEW_STR],
        replacements[index][CURRENT_FILEPATH],
        replacements[index][NEW_FILEPATH]
      );
    }

    // Update the approved domain list for the proxy
    void updateApprovedDomains(
      props.approvedDomains,
      'resources/constructs/proxyServer/ansibleResources/s3Deployment/squid-resources/cf_resources/approved-domains.conf'
    );

    // Create Bucket for s3 Deployment assest
    this.bucket = new s3.Bucket(this, props.bucketName, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Upload the proxy files to S3 bucket
    new s3Deploy.BucketDeployment(this, 'DeployPlaybook', {
      sources: [
        s3Deploy.Source.asset(
          path.join(
            __dirname,
            '../../../resources/constructs/proxyServer/ansibleResources/s3Deployment'
          )
        ),
      ],
      destinationBucket: this.bucket,
      destinationKeyPrefix: 's3Deployment',
    });
  }
}

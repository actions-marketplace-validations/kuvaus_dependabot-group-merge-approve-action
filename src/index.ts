
import * as core from '@actions/core';
import { Octokit } from "@octokit/rest";

const token = process.env.GITHUB_TOKEN;
const octokit = new Octokit({ auth: token }); 
    
interface Options {
    prefix:            string;
    require_green:     string;
    combined_pr_name:  string;
    ignore:            string;
}
    
async function parse_options() {

    
    
    const options: Options = {
        prefix:            core.getInput('prefix')           || 'dependabot',
        require_green:     core.getInput('require_green')    || 'true',
        combined_pr_name:  core.getInput('combined_pr_name') || 'combined',
        ignore:            core.getInput('ignore')           || 'nocombine',
    };
    
    console.log(options);
    return options;
}    

async function get_pull_requests() {
  let response = await octokit.request('GET /repos/{owner}/{repo}/pulls', {
    owner: 'owner',
    repo: 'repo'
  });
  return response.data;
}

async function create_combined_branch(options: Options, base_sha: string) {
  await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
    owner: 'owner',
    repo: 'repo',
    ref: 'refs/heads/'+options.combined_pr_name,
    sha: base_sha
  });
}

async function merge_into_combined_branch(options: Options, branch: string) {
  try {
    await octokit.request('POST /repos/{owner}/{repo}/merges', {
      owner: 'owner',
      repo: 'repo',
      base: options.combined_pr_name,
      head: branch,
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function create_combined_pull_request(options: Options, combined_prs: string[], base_branch: string) {
  const combined_prs_string = combined_prs.join('\n');
  let body = 'This pull request contains the following pull requests:\n' + combined_prs_string;

  await octokit.request('POST /repos/{owner}/{repo}/pulls', {
    owner: 'owner',
    repo: 'repo',
    title: 'Combined pull request',
    head: options.combined_pr_name,
    base: base_branch,
    body: body
  });
}

async function main() {
    
  const options = await parse_options();
  const pulls = await get_pull_requests();
  const base_sha = pulls[0].base.sha;
  await create_combined_branch(options, base_sha);

  let combined_prs = [];
  for (const pull of pulls) {
    const branch = pull.head.ref;
    const merge_success = await merge_into_combined_branch(options, branch);
    if (merge_success) combined_prs.push(branch);
  }

  const base_branch = pulls[0].base.ref;
  await create_combined_pull_request(options, combined_prs, base_branch);
}

if (require.main === module) {
    main();
}

// module exports for jest tests
module.exports = {
  parse_options,
  main
};

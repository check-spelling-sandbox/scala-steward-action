import process from 'process'
import fs from 'fs'
import * as core from '@actions/core'
import fetch from 'node-fetch'
import * as github from './github'
import {HealthCheck} from './healthcheck'
import * as workspace from './workspace'
import * as coursier from './coursier'
import {type Logger} from './logger'
import {Input} from './input'
import {type HttpClient} from './http'
import * as mill from './mill'
import {type Files} from './files'

/**
 * Runs the action main code. In order it will do the following:
 * - Check connection with Maven Central
 * - Install Coursier
 * - Recover user inputs
 * - Get authenticated user data from provided Github Token
 * - Prepare Scala Steward's workspace
 * - Run Scala Steward using Coursier.
 */
async function run(): Promise<void> {
  try {
    const logger: Logger = core
    const httpClient: HttpClient = {run: async url => fetch(url)}
    const files: Files = fs
    const inputs = Input.from(core, files, logger).all()
    const healthCheck: HealthCheck = HealthCheck.from(logger, httpClient)

    await healthCheck.mavenCentral()

    await coursier.selfInstall()
    await coursier.install('scalafmt')
    await coursier.install('scalafix')
    await mill.install()

    const user = await github.getAuthUser(inputs.github.token)

    const workspaceDir = await workspace.prepare(inputs.steward.repos, inputs.github.token, inputs.github.app?.key)
    await workspace.restoreWorkspaceCache(workspaceDir)

    if (process.env.RUNNER_DEBUG) {
      core.debug('Debug mode activated for Scala Steward')
      core.exportVariable('LOG_LEVEL', 'TRACE')
      core.exportVariable('ROOT_LOG_LEVEL', 'TRACE')
    }

    await coursier.launch('scala-steward', inputs.steward.version, [
      arg('--workspace', `${workspaceDir}/workspace`),
      arg('--repos-file', `${workspaceDir}/repos.md`),
      arg('--git-ask-pass', `${workspaceDir}/askpass.sh`),
      arg('--git-author-email', inputs.commits.author.email || user.email()),
      arg('--git-author-name', inputs.commits.author.name || user.name()),
      arg('--vcs-login', `${user.login()}"`),
      arg('--env-var', '"SBT_OPTS=-Xmx2048m -Xss8m -XX:MaxMetaspaceSize=512m"'),
      arg('--process-timeout', inputs.steward.timeout),
      arg('--vcs-api-host', inputs.github.apiUrl),
      arg('--ignore-opts-files', inputs.steward.ignoreOptsFiles),
      arg('--sign-commits', inputs.commits.sign.enabled),
      arg('--git-author-signing-key', inputs.commits.sign.key),
      arg('--cache-ttl', inputs.steward.cacheTtl),
      arg('--scalafix-migrations', inputs.migrations.scalafix),
      arg('--artifact-migrations', inputs.migrations.artifacts),
      arg('--repo-config', inputs.steward.defaultConfiguration),
      arg('--github-app-id', inputs.github.app?.id),
      arg('--github-app-key-file', inputs.github.app ? `${workspaceDir}/app.pem` : undefined),
      '--do-not-fork',
      '--disable-sandbox',
      inputs.steward.extraArgs ? inputs.steward.extraArgs.split(' ') : [],
    ]).finally(() => {
      workspace.saveWorkspaceCache(workspaceDir).catch((error: unknown) => {
        core.setFailed(` ✕ ${(error as Error).message}`)
      })
    })
  } catch (error: unknown) {
    core.setFailed(` ✕ ${(error as Error).message}`)
  }
}

/**
 * Creates an optional argument depending on an input's value.
 *
 * @param name Name of the arg being added.
 * @param value The argument's value, empty string, false booleans or undefined will be skipped.
 * @returns the argument to add if it should be added; otherwise returns `[]`.
 */
function arg(name: string, value: string | boolean | undefined) {
  switch (typeof value) {
    case 'string': { return (value === '') ? [] : [name, value] }
    case 'boolean': { return value ? [name] : [] }
    default: { return [] }
  }
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void run()

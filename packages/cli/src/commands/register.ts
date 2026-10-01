import { Command } from 'commander'
import chalk from 'chalk'
import path from 'node:path'
import { hubFetch } from '../lib/api.js'
import { withSpinner } from '../lib/withSpinner.js'

export const registerCommand = new Command('register')
  .description('Register an existing repo as a hub project (writes .apphub.md if missing)')
  .argument('<path>', 'Path to the repo (anywhere on disk)')
  .option('-n, --name <name>', 'Project name (default: folder name)')
  .option('-d, --description <text>', 'One-line description')
  .action(async (repoPath: string, options: { name?: string; description?: string }) => {
    const project = await withSpinner('Registering project...', () =>
      hubFetch('/api/projects/register', {
        method: 'POST',
        body: JSON.stringify({
          path: path.resolve(repoPath),
          name: options.name,
          description: options.description,
        }),
      }),
    )

    console.log(chalk.green(`  Registered ${project.name} (${project.slug})`))
    console.log(chalk.dim(`  ${project.path} — ${project.location}`))
    if (project.createdMarker) {
      console.log(chalk.dim(`  Wrote .apphub.md — commit it in that repo, and fill in "context"`))
    }
  })

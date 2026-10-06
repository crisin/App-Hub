import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'
import { withSpinner } from '../lib/withSpinner.js'
import { PROJECT_STATUSES } from '@apphub/shared'

export const statusCommand = new Command('status')
  .description("Show a project, or set its status / repository URL")
  .argument('<slug>', 'Project slug')
  .option('--set <status>', `Set status (${PROJECT_STATUSES.join(', ')})`)
  .option('--repo <url>', 'Set the repository URL ("" = use the git remote origin)')
  .action(async (slug: string, options: { set?: string; repo?: string }) => {
    if (options.repo !== undefined) {
      const result = await withSpinner('Updating repository...', () =>
        hubFetch(`/api/projects/${slug}`, {
          method: 'PATCH',
          body: JSON.stringify({ repo: options.repo }),
        }),
      )
      console.log(chalk.green(`  ${slug} → ${result.repo || '(no repository)'}`))
    } else if (options.set) {
      if (!PROJECT_STATUSES.includes(options.set as any)) {
        console.log(chalk.red(`Invalid status. Valid: ${PROJECT_STATUSES.join(', ')}`))
        return
      }

      await withSpinner('Updating status...', () =>
        hubFetch(`/api/projects/${slug}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: options.set }),
        }),
      )

      console.log(chalk.green(`  ${slug} → ${options.set}`))
    } else {
      const project = await withSpinner('Loading project...', () =>
        hubFetch(`/api/projects/${slug}`),
      )
      console.log(`\n  ${chalk.bold(project.name)}`)
      console.log(`  Status:   ${project.status}`)
      console.log(`  Template: ${project.template}`)
      console.log(`  Repo:     ${project.repo || chalk.dim('—')}`)
      console.log(`  Items:    ${project.itemSummary?.total ?? 0}`)
      console.log(`  Path:     ${chalk.dim(project.path)}`)
      console.log()
    }
  })

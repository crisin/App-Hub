import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'
import { withSpinner } from '../lib/withSpinner.js'
import { PROJECT_STATUSES } from '@apphub/shared'

export const statusCommand = new Command('status')
  .description("Get or set a project's status")
  .argument('<slug>', 'Project slug')
  .option('--set <status>', `Set status (${PROJECT_STATUSES.join(', ')})`)
  .action(async (slug: string, options: { set?: string }) => {
    if (options.set) {
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
      console.log(`  Items:    ${project.itemSummary?.total ?? 0}`)
      console.log(`  Path:     ${chalk.dim(project.path)}`)
      console.log()
    }
  })

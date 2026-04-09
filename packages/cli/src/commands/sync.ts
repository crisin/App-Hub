import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'
import { withSpinner } from '../lib/withSpinner.js'

export const syncCommand = new Command('sync')
  .description('Sync all projects from disk to the hub database')
  .action(async () => {
    const result = await withSpinner('Syncing projects...', () =>
      hubFetch('/api/sync', { method: 'POST' }),
    )

    console.log(chalk.green(`  Synced ${result.synced} project(s)`))
    for (const p of result.projects) {
      console.log(`  ${chalk.dim(p.status.padEnd(10))} ${p.name}`)
    }
  })

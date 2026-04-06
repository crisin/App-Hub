import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { hubFetch } from '../lib/api.js'

export const syncCommand = new Command('sync')
  .description('Sync all projects from disk to the hub database')
  .action(async () => {
    const spinner = ora('Syncing projects...').start()

    try {
      const result = await hubFetch('/api/sync', { method: 'POST' })
      spinner.succeed(chalk.green(`Synced ${result.synced} project(s)`))

      for (const p of result.projects) {
        console.log(`  ${chalk.dim(p.status.padEnd(10))} ${p.name}`)
      }
    } catch (err: any) {
      spinner.fail(chalk.red(err.message))
    }
  })

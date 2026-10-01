import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'
import { withSpinner } from '../lib/withSpinner.js'

export const syncCommand = new Command('sync')
  .description('Re-index projects and board files from disk (run after git pull)')
  .action(async () => {
    const result = await withSpinner('Syncing projects...', () =>
      hubFetch('/api/sync', { method: 'POST' }),
    )

    console.log(chalk.green(`  Synced ${result.synced} project(s)`))
    if (result.board) {
      const b = result.board
      console.log(
        chalk.dim(`  Board files: ${b.imported} imported, ${b.persisted} rewritten, ${b.removed} removed, ${b.exported} exported`),
      )
    }
    for (const p of result.projects) {
      console.log(`  ${chalk.dim(p.status.padEnd(10))} ${p.name}`)
    }
  })

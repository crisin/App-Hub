import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'

export const listCommand = new Command('list')
  .alias('ls')
  .description('List all projects')
  .option('-s, --status <status>', 'Filter by status (idea, active, paused, completed, archived)')
  .action(async (options: { status?: string }) => {
    let projects = await hubFetch('/api/projects?sync=true')

    if (options.status) {
      projects = projects.filter((p: any) => p.status === options.status)
    }

    if (projects.length === 0) {
      console.log(chalk.dim('No projects found.'))
      return
    }

    const statusColors: Record<string, (s: string) => string> = {
      idea: chalk.blue,
      active: chalk.green,
      paused: chalk.yellow,
      completed: chalk.magenta,
      archived: chalk.dim,
    }

    console.log(chalk.bold(`\n  Projects (${projects.length})\n`))

    for (const p of projects) {
      const colorFn = statusColors[p.status] ?? chalk.white
      const tasks = `${p.taskSummary?.done ?? 0}/${p.taskSummary?.total ?? 0}`
      console.log(
        `  ${colorFn(`[${p.status}]`.padEnd(12))} ${chalk.bold(p.name.padEnd(25))} ${chalk.dim(tasks + ' tasks')}  ${chalk.dim(p.template)}`,
      )
    }
    console.log()
  })

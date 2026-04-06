import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'

export const boardCommand = new Command('board').description('Manage the hub kanban board')

boardCommand
  .command('list')
  .alias('ls')
  .description('List all board issues')
  .option('-l, --lane <lane>', 'Filter by lane (backlog, todo, in_progress, claude, done)')
  .action(async (options: { lane?: string }) => {
    const lanes = await hubFetch('/api/board')

    const laneOrder = ['backlog', 'todo', 'in_progress', 'claude', 'done']
    const laneLabels: Record<string, string> = {
      backlog: 'Backlog',
      todo: 'Todo',
      in_progress: 'In Progress',
      claude: 'Claude',
      done: 'Done',
    }

    const priorityColors: Record<string, (s: string) => string> = {
      low: chalk.blue,
      medium: chalk.yellow,
      high: chalk.red,
      critical: chalk.bgRed.white,
    }

    const lanesToShow = options.lane ? [options.lane] : laneOrder

    for (const lane of lanesToShow) {
      const issues = lanes[lane] ?? []
      if (issues.length === 0 && options.lane) {
        console.log(chalk.dim(`  No issues in ${laneLabels[lane]}.`))
        continue
      }
      if (issues.length === 0) continue

      console.log(chalk.bold(`\n  ${laneLabels[lane]} (${issues.length})`))
      for (const issue of issues) {
        const pColor = priorityColors[issue.priority] ?? chalk.dim
        const labels = issue.labels.length ? chalk.dim(` [${issue.labels.join(', ')}]`) : ''
        const assigned = issue.assigned_to ? chalk.magenta(` <- ${issue.assigned_to}`) : ''
        console.log(
          `    ${chalk.dim(issue.id)} ${issue.title} ${pColor(issue.priority)}${labels}${assigned}`,
        )
      }
    }
    console.log()
  })

boardCommand
  .command('add <title>')
  .description('Add an issue to the board')
  .option('-l, --lane <lane>', 'Target lane', 'backlog')
  .option('--priority <priority>', 'Priority (low, medium, high, critical)', 'medium')
  .option('--labels <labels>', 'Comma-separated labels')
  .option('-d, --description <desc>', 'Issue description')
  .action(
    async (
      title: string,
      options: { lane: string; priority: string; labels?: string; description?: string },
    ) => {
      const issue = await hubFetch('/api/board', {
        method: 'POST',
        body: JSON.stringify({
          title,
          lane: options.lane,
          priority: options.priority,
          labels:
            options.labels
              ?.split(',')
              .map((l) => l.trim())
              .filter(Boolean) ?? [],
          description: options.description ?? '',
        }),
      })

      console.log(chalk.green(`  + ${issue.title}`))
      console.log(
        chalk.dim(`    id: ${issue.id}  lane: ${issue.lane}  priority: ${issue.priority}`),
      )
    },
  )

boardCommand
  .command('move <id> <lane>')
  .description('Move an issue to a lane (backlog, todo, in_progress, claude, done)')
  .action(async (id: string, lane: string) => {
    const valid = ['backlog', 'todo', 'in_progress', 'claude', 'done']
    if (!valid.includes(lane)) {
      console.error(chalk.red(`  Invalid lane: ${lane}. Must be one of: ${valid.join(', ')}`))
      process.exit(1)
    }

    await hubFetch(`/api/board/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ lane }),
    })

    console.log(chalk.green(`  Moved ${id} -> ${lane}`))
  })

boardCommand
  .command('delete <id>')
  .alias('rm')
  .description('Delete an issue')
  .action(async (id: string) => {
    await hubFetch(`/api/board/${id}`, { method: 'DELETE' })
    console.log(chalk.green(`  Deleted ${id}`))
  })

// Claude subcommands
const claudeCmd = boardCommand.command('claude').description('Claude Code integration')

claudeCmd
  .command('list')
  .alias('ls')
  .description('List unclaimed issues in the Claude lane')
  .action(async () => {
    const issues = await hubFetch('/api/board/claude')

    if (issues.length === 0) {
      console.log(chalk.dim('  No unclaimed issues in Claude lane.'))
      return
    }

    console.log(chalk.bold.magenta(`\n  Claude Lane (${issues.length} unclaimed)\n`))
    for (const issue of issues) {
      const labels = issue.labels.length ? chalk.dim(` [${issue.labels.join(', ')}]`) : ''
      console.log(
        `    ${chalk.dim(issue.id)} ${issue.title} ${chalk.yellow(issue.priority)}${labels}`,
      )
      if (issue.description) {
        console.log(chalk.dim(`      ${issue.description.slice(0, 100)}`))
      }
    }
    console.log()
  })

claudeCmd
  .command('claim <id>')
  .description('Claim an issue from the Claude lane')
  .option('--agent <agent_id>', 'Agent identifier', 'claude-code')
  .action(async (id: string, options: { agent: string }) => {
    const issue = await hubFetch('/api/board/claude/claim', {
      method: 'POST',
      body: JSON.stringify({ id, agent_id: options.agent }),
    })

    console.log(chalk.green(`  Claimed: ${issue.title}`))
    console.log(chalk.dim(`    Moved to In Progress, assigned to ${issue.assigned_to}`))
    if (issue.description) {
      console.log(chalk.dim(`\n    ${issue.description}`))
    }
  })

claudeCmd
  .command('complete <id>')
  .alias('done')
  .description('Mark a claimed issue as done')
  .action(async (id: string) => {
    await hubFetch('/api/board/claude/complete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    })

    console.log(chalk.green(`  Completed: ${id} -> Done`))
  })

claudeCmd
  .command('run')
  .description('Run the Claude runner (picks up and works on Claude lane issues)')
  .option('--loop [interval]', 'Keep polling (default 60s)')
  .option('--dry-run', 'Show what would run without executing')
  .action(async (options: { loop?: string | boolean; dryRun?: boolean }) => {
    const { execSync } = await import('node:child_process')
    const { resolve } = await import('node:path')

    // Find the runner script relative to the CLI package
    const scriptPath = resolve(process.cwd(), 'scripts', 'claude-runner.sh')

    const args: string[] = []
    if (options.loop !== undefined) {
      args.push('--loop')
      if (typeof options.loop === 'string') args.push(options.loop)
    }
    if (options.dryRun) args.push('--dry-run')

    console.log(chalk.magenta(`  Starting claude-runner...`))
    console.log(chalk.dim(`  Script: ${scriptPath}`))
    console.log()

    try {
      execSync(`"${scriptPath}" ${args.join(' ')}`, {
        stdio: 'inherit',
        cwd: resolve(process.cwd()),
      })
    } catch (err: any) {
      if (err.status !== 1) {
        console.error(chalk.red(`  Runner exited with code ${err.status}`))
      }
    }
  })

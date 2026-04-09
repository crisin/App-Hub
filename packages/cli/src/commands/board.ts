import { Command } from 'commander'
import chalk from 'chalk'
import { fileURLToPath } from 'node:url'
import { hubFetch } from '../lib/api.js'
import { withSpinner } from '../lib/withSpinner.js'
import { ITEM_STAGES, ITEM_STAGE_LABELS } from '@apphub/shared'

export const boardCommand = new Command('board').description('Manage the hub kanban board')

boardCommand
  .command('list')
  .alias('ls')
  .description('List all board items')
  .option('-s, --stage <stage>', `Filter by stage (${ITEM_STAGES.join(', ')})`)
  .action(async (options: { stage?: string }) => {
    const stages = await withSpinner('Loading board...', () => hubFetch('/api/board'))

    const priorityColors: Record<string, (s: string) => string> = {
      low: chalk.blue,
      medium: chalk.yellow,
      high: chalk.red,
      critical: chalk.bgRed.white,
    }

    const stagesToShow = options.stage ? [options.stage] : ITEM_STAGES

    for (const stage of stagesToShow) {
      const items = stages[stage] ?? []
      if (items.length === 0 && options.stage) {
        console.log(chalk.dim(`  No items in ${ITEM_STAGE_LABELS[stage as keyof typeof ITEM_STAGE_LABELS] ?? stage}.`))
        continue
      }
      if (items.length === 0) continue

      console.log(chalk.bold(`\n  ${ITEM_STAGE_LABELS[stage as keyof typeof ITEM_STAGE_LABELS] ?? stage} (${items.length})`))
      for (const item of items) {
        const pColor = priorityColors[item.priority] ?? chalk.dim
        const labels = item.labels?.length ? chalk.dim(` [${item.labels.join(', ')}]`) : ''
        const assigned = item.assigned_to ? chalk.magenta(` <- ${item.assigned_to}`) : ''
        console.log(
          `    ${chalk.dim(item.id)} ${item.title} ${pColor(item.priority)}${labels}${assigned}`,
        )
      }
    }
    console.log()
  })

boardCommand
  .command('add <title>')
  .description('Add an item to the board')
  .option('-s, --stage <stage>', 'Target stage', ITEM_STAGES[0])
  .option('--priority <priority>', 'Priority (low, medium, high, critical)', 'medium')
  .option('--labels <labels>', 'Comma-separated labels')
  .option('-d, --description <desc>', 'Item description')
  .action(
    async (
      title: string,
      options: { stage: string; priority: string; labels?: string; description?: string },
    ) => {
      const item = await withSpinner('Adding item...', () =>
        hubFetch('/api/board', {
          method: 'POST',
          body: JSON.stringify({
            title,
            stage: options.stage,
            priority: options.priority,
            labels:
              options.labels
                ?.split(',')
                .map((l) => l.trim())
                .filter(Boolean) ?? [],
            description: options.description ?? '',
          }),
        }),
      )

      console.log(chalk.green(`  + ${item.title}`))
      console.log(
        chalk.dim(`    id: ${item.id}  stage: ${item.stage}  priority: ${item.priority}`),
      )
    },
  )

boardCommand
  .command('move <id> <stage>')
  .description(`Move an item to a stage (${ITEM_STAGES.join(', ')})`)
  .action(async (id: string, stage: string) => {
    if (!ITEM_STAGES.includes(stage as any)) {
      console.error(chalk.red(`  Invalid stage: ${stage}. Must be one of: ${ITEM_STAGES.join(', ')}`))
      process.exit(1)
    }

    await withSpinner(`Moving to ${stage}...`, () =>
      hubFetch(`/api/board/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      }),
    )

    console.log(chalk.green(`  Moved ${id} -> ${stage}`))
  })

boardCommand
  .command('delete <id>')
  .alias('rm')
  .description('Delete an item')
  .action(async (id: string) => {
    await withSpinner('Deleting...', () =>
      hubFetch(`/api/board/${id}`, { method: 'DELETE' }),
    )
    console.log(chalk.green(`  Deleted ${id}`))
  })

// Claude subcommands
const claudeCmd = boardCommand.command('claude').description('Claude Code integration')

claudeCmd
  .command('list')
  .alias('ls')
  .description('List unclaimed items in the Claude stage')
  .action(async () => {
    const items = await withSpinner('Loading Claude items...', () =>
      hubFetch('/api/board/claude'),
    )

    if (items.length === 0) {
      console.log(chalk.dim('  No unclaimed items in Claude stage.'))
      return
    }

    console.log(chalk.bold.magenta(`\n  Claude Stage (${items.length} unclaimed)\n`))
    for (const item of items) {
      const labels = item.labels?.length ? chalk.dim(` [${item.labels.join(', ')}]`) : ''
      console.log(
        `    ${chalk.dim(item.id)} ${item.title} ${chalk.yellow(item.priority)}${labels}`,
      )
      if (item.description) {
        console.log(chalk.dim(`      ${item.description.slice(0, 100)}`))
      }
    }
    console.log()
  })

claudeCmd
  .command('claim <id>')
  .description('Claim an item from the Claude stage')
  .option('--agent <agent_id>', 'Agent identifier', 'claude-code')
  .action(async (id: string, options: { agent: string }) => {
    const item = await withSpinner('Claiming item...', () =>
      hubFetch('/api/board/claude/claim', {
        method: 'POST',
        body: JSON.stringify({ id, agent_id: options.agent }),
      }),
    )

    console.log(chalk.green(`  Claimed: ${item.title}`))
    console.log(chalk.dim(`    Moved to build stage, assigned to ${item.assigned_to}`))
    if (item.description) {
      console.log(chalk.dim(`\n    ${item.description}`))
    }
  })

claudeCmd
  .command('complete <id>')
  .alias('done')
  .description('Mark a claimed item as done')
  .action(async (id: string) => {
    await withSpinner('Completing item...', () =>
      hubFetch('/api/board/claude/complete', {
        method: 'POST',
        body: JSON.stringify({ id }),
      }),
    )

    console.log(chalk.green(`  Completed: ${id} -> Done`))
  })

claudeCmd
  .command('run')
  .description('Run the Claude runner (picks up and works on Claude stage items)')
  .option('--loop [interval]', 'Keep polling (default 60s)')
  .option('--dry-run', 'Show what would run without executing')
  .action(async (options: { loop?: string | boolean; dryRun?: boolean }) => {
    const { execSync } = await import('node:child_process')
    const { resolve, dirname } = await import('node:path')

    // Resolve relative to the CLI package, not process.cwd()
    const cliDir = dirname(fileURLToPath(import.meta.url))
    const scriptPath = resolve(cliDir, '..', '..', '..', '..', 'scripts', 'claude-runner.sh')

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
        cwd: resolve(cliDir, '..', '..', '..', '..'),
      })
    } catch (err: any) {
      if (err.status !== 1) {
        console.error(chalk.red(`  Runner exited with code ${err.status}`))
      }
    }
  })

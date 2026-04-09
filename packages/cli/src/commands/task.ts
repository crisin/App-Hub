import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'
import { withSpinner } from '../lib/withSpinner.js'

export const taskCommand = new Command('task').description('Manage tasks for a project')

taskCommand
  .command('add <title>')
  .description('Add a task to a project')
  .requiredOption('-p, --project <slug>', 'Project slug')
  .option('--priority <priority>', 'Item priority (low, medium, high, critical)', 'medium')
  .option('--stage <stage>', 'Item stage (idea, plan, build, claude, review, done)', 'idea')
  .action(async (title: string, options: { project: string; priority: string; stage: string }) => {
    const item = await withSpinner('Adding item...', () =>
      hubFetch(`/api/projects/${options.project}/items`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          priority: options.priority,
          stage: options.stage,
          item_type: 'task',
        }),
      }),
    )

    console.log(chalk.green(`  + ${item.title}`))
    console.log(chalk.dim(`    id: ${item.id}  stage: ${item.stage}  priority: ${item.priority}`))
  })

taskCommand
  .command('list')
  .description('List tasks for a project')
  .requiredOption('-p, --project <slug>', 'Project slug')
  .action(async (options: { project: string }) => {
    const stages = await withSpinner('Loading items...', () =>
      hubFetch(`/api/projects/${options.project}/items`),
    )

    const stageIcons: Record<string, string> = {
      idea: '💡',
      plan: '📋',
      build: '🔨',
      claude: '🤖',
      review: '👀',
      done: '✅',
    }

    let hasItems = false
    for (const [stage, items] of Object.entries(stages) as [string, any[]][]) {
      if (items.length === 0) continue
      hasItems = true
      console.log(chalk.bold(`\n  ${stageIcons[stage] ?? '  '} ${stage.toUpperCase()}`))
      for (const item of items) {
        console.log(`    ${item.title} ${chalk.dim(`[${item.priority}]`)}`)
      }
    }

    if (!hasItems) {
      console.log(chalk.dim('  No items.'))
    }
  })

taskCommand
  .command('done <itemId>')
  .description('Mark an item as done')
  .requiredOption('-p, --project <slug>', 'Project slug')
  .action(async (itemId: string, _options: { project: string }) => {
    await withSpinner('Updating item...', () =>
      hubFetch(`/api/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: 'done' }),
      }),
    )

    console.log(chalk.green(`  Item ${itemId} marked as done.`))
  })

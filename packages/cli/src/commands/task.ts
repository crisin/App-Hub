import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'

export const taskCommand = new Command('task').description('Manage tasks for a project')

taskCommand
  .command('add <title>')
  .description('Add a task to a project')
  .requiredOption('-p, --project <slug>', 'Project slug')
  .option('--priority <priority>', 'Task priority (low, medium, high, critical)', 'medium')
  .action(async (title: string, options: { project: string; priority: string }) => {
    const task = await hubFetch(`/api/projects/${options.project}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ title, priority: options.priority }),
    })

    console.log(chalk.green(`  + ${task.title}`))
    console.log(chalk.dim(`    id: ${task.id}  priority: ${task.priority}`))
  })

taskCommand
  .command('list')
  .description('List tasks for a project')
  .requiredOption('-p, --project <slug>', 'Project slug')
  .action(async (options: { project: string }) => {
    const tasks = await hubFetch(`/api/projects/${options.project}/tasks`)

    if (tasks.length === 0) {
      console.log(chalk.dim('  No tasks.'))
      return
    }

    const statusIcons: Record<string, string> = {
      todo: '  ',
      in_progress: '  ',
      done: '  ',
      blocked: '  ',
    }

    for (const t of tasks) {
      const icon = statusIcons[t.status] ?? '  '
      console.log(`${icon} ${t.title} ${chalk.dim(`[${t.priority}]`)}`)
    }
  })

taskCommand
  .command('done <taskId>')
  .description('Mark a task as done')
  .requiredOption('-p, --project <slug>', 'Project slug')
  .action(async (taskId: string, options: { project: string }) => {
    await hubFetch(`/api/projects/${options.project}/tasks`, {
      method: 'PATCH',
      body: JSON.stringify({ id: taskId, status: 'done' }),
    })

    console.log(chalk.green(`  Task ${taskId} marked as done.`))
  })

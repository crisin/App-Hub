import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'
import { withSpinner } from '../lib/withSpinner.js'

export const newCommand = new Command('new')
  .description('Create a new project from a template')
  .argument('<name>', 'Project name')
  .option('-t, --template <template>', 'Template slug to use')
  .action(async (name: string, options: { template?: string }) => {
    if (!options.template) {
      // List available templates
      const templates = await withSpinner('Loading templates...', () =>
        hubFetch('/api/templates'),
      )
      if (templates.length === 0) {
        console.log(chalk.yellow('No templates found. Add templates to the templates/ directory.'))
        return
      }
      console.log(chalk.bold('\nAvailable templates:'))
      for (const t of templates) {
        console.log(`  ${chalk.cyan(t.slug)} — ${t.description || t.name}`)
      }
      console.log(`\nUsage: ${chalk.dim('apphub new "My App" --template <slug>')}`)
      return
    }

    const result = await withSpinner(
      `Creating project "${name}" from template "${options.template}"...`,
      () =>
        hubFetch('/api/projects', {
          method: 'POST',
          body: JSON.stringify({ name, template: options.template }),
        }),
    )

    console.log(`  ${chalk.dim('Slug:')}  ${result.slug}`)
    console.log(`  ${chalk.dim('Path:')}  ${result.path}`)
    console.log(`\n  ${chalk.dim('cd')} ${result.path}`)
  })

import { Command } from 'commander'
import chalk from 'chalk'
import { hubFetch } from '../lib/api.js'
import { withSpinner } from '../lib/withSpinner.js'

interface AgentInfo {
  slug: string
  name: string
  description: string
  provider: string
  model: string
}

interface ProviderStatus {
  name: string
  available: boolean
  models: string[]
}

export const agentCommand = new Command('agent').description(
  'Run and inspect AI agents (local or cloud)',
)

agentCommand
  .command('list')
  .description('List registered agents and provider status')
  .action(async () => {
    const data = await withSpinner('Loading agents...', () =>
      hubFetch<{ agents: AgentInfo[]; providers: ProviderStatus[] }>('/api/agents'),
    )

    console.log(chalk.bold('\n  Providers'))
    for (const p of data.providers) {
      const dot = p.available ? chalk.green('●') : chalk.red('○')
      const models = p.models.length > 0 ? chalk.dim(` (${p.models.length} models)`) : ''
      console.log(`  ${dot} ${p.name}${models}`)
    }

    console.log(chalk.bold('\n  Agents'))
    if (data.agents.length === 0) {
      console.log(chalk.dim('  No agents found — add markdown files to agents/'))
      return
    }
    for (const a of data.agents) {
      console.log(
        `  ${chalk.cyan(a.slug.padEnd(12))} ${chalk.dim(`${a.provider}/${a.model}`)}\n` +
          `  ${''.padEnd(12)} ${a.description}`,
      )
    }
  })

agentCommand
  .command('run <slug> <prompt...>')
  .description('Run an agent on a prompt')
  .action(async (slug: string, promptWords: string[]) => {
    const prompt = promptWords.join(' ')
    const result = await withSpinner(`Running ${slug}...`, () =>
      hubFetch<{ text: string; model: string; durationMs: number }>(
        `/api/agents/${encodeURIComponent(slug)}/run`,
        { method: 'POST', body: JSON.stringify({ prompt }) },
      ),
    )

    console.log(
      chalk.dim(`\n  ${result.model} · ${Math.round(result.durationMs / 1000)}s\n`),
    )
    console.log(result.text)
  })

agentCommand
  .command('critique <itemId>')
  .description('Run the debate workflow (critic vs. advocate + judge) on a board item')
  .option('-r, --rounds <n>', 'debate rounds (1-3)', '1')
  .action(async (itemId: string, opts: { rounds: string }) => {
    const rounds = Math.min(Math.max(parseInt(opts.rounds, 10) || 1, 1), 3)
    const result = await withSpinner(
      `Debating item ${itemId} (${rounds} round(s), this can take a few minutes)...`,
      () =>
        hubFetch<{ verdict: string; reportPath: string; totalDurationMs: number }>(
          `/api/board/${encodeURIComponent(itemId)}/critique`,
          { method: 'POST', body: JSON.stringify({ rounds }) },
        ),
    )

    console.log(chalk.bold('\n  Verdict\n'))
    console.log(result.verdict)
    console.log(chalk.dim(`\n  Full report: ${result.reportPath}`))
    console.log(chalk.dim(`  Duration: ${Math.round(result.totalDurationMs / 1000)}s`))
  })

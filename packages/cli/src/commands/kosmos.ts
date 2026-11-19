import { Command } from 'commander'
import chalk from 'chalk'
import path from 'node:path'
import { hubFetch } from '../lib/api.js'

interface KosmosStatus {
  location: { path: string | null; source: 'env' | 'local' | 'none'; exists: boolean; layout: string | null }
  stats: { projects: number; pages: number; topics: number; blocks: number; edges: number } | null
}

export const kosmosCommand = new Command('kosmos')
  .description('Show or set where the kosmos vault lives on this machine (it feeds the Map page)')
  .argument('[path]', 'Path to the kosmos vault, or to a clone of its werkstatt repo')
  .option('--unset', 'Forget the path')
  .action(async (kosmosPath: string | undefined, options: { unset?: boolean }) => {
    const status: KosmosStatus =
      kosmosPath || options.unset
        ? await hubFetch('/api/kosmos', {
            method: 'PUT',
            body: JSON.stringify({ path: options.unset ? '' : path.resolve(kosmosPath!) }),
          })
        : await hubFetch('/api/kosmos')

    const { location, stats } = status
    if (!location.path) {
      console.log(chalk.dim('  No kosmos path set. Set one with: apphub kosmos <path>'))
      return
    }
    const origin = location.source === 'env' ? 'APPHUB_KOSMOS_DIR' : 'apphub.local.json'
    console.log(`  ${location.path} ${chalk.dim(`(${origin})`)}`)
    if (!location.exists || !stats) {
      console.log(chalk.yellow('  That folder does not exist on this machine.'))
      return
    }
    console.log(
      chalk.dim(
        `  ${location.layout} — ${stats.projects} projects, ${stats.pages} pages, ${stats.topics} topics, ` +
          `${stats.blocks} building blocks, ${stats.edges} edges`,
      ),
    )
  })

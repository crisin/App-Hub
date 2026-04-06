#!/usr/bin/env node
import { Command } from 'commander'
import { newCommand } from './commands/new.js'
import { listCommand } from './commands/list.js'
import { statusCommand } from './commands/status.js'
import { taskCommand } from './commands/task.js'
import { syncCommand } from './commands/sync.js'
import { boardCommand } from './commands/board.js'

const program = new Command()

program
  .name('apphub')
  .description('App Hub CLI — manage and scaffold app projects')
  .version('0.1.0')

program.addCommand(newCommand)
program.addCommand(listCommand)
program.addCommand(statusCommand)
program.addCommand(taskCommand)
program.addCommand(syncCommand)
program.addCommand(boardCommand)

program.parse()

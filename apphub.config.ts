import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
  /** Root directory of the App Hub monorepo */
  root: __dirname,

  /** Where spawned projects live */
  projectsDir: path.join(__dirname, 'projects'),

  /** Where project templates are stored */
  templatesDir: path.join(__dirname, 'templates'),

  /** SQLite database path */
  dbPath: path.join(__dirname, 'packages', 'hub', 'data', 'apphub.db'),

  /** Hub dev server */
  hub: {
    port: 5174,
    host: 'localhost',
  },

  /** Dev API for spawned projects */
  devApi: {
    /** Base path for the dev API (served by the hub) */
    basePath: '/api/dev',
  },
}

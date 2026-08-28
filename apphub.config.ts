import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * App Hub configuration.
 * Reads from environment variables with sensible defaults.
 * In production (adapter-node), env vars prefixed with APPHUB_ are available.
 */
export default {
  /** Root directory of the App Hub monorepo */
  root: __dirname,

  /** Where spawned projects live */
  projectsDir: process.env.APPHUB_PROJECTS_DIR
    ? path.resolve(__dirname, process.env.APPHUB_PROJECTS_DIR)
    : path.join(__dirname, 'projects'),

  /** Where project templates are stored */
  templatesDir: process.env.APPHUB_TEMPLATES_DIR
    ? path.resolve(__dirname, process.env.APPHUB_TEMPLATES_DIR)
    : path.join(__dirname, 'templates'),

  /** SQLite database path */
  dbPath: process.env.APPHUB_DB_PATH
    ? path.resolve(__dirname, process.env.APPHUB_DB_PATH)
    : path.join(__dirname, 'packages', 'hub', 'data', 'apphub.db'),

  /** Log directory for persistent task output */
  logDir: process.env.APPHUB_LOG_DIR
    ? path.resolve(__dirname, process.env.APPHUB_LOG_DIR)
    : path.join(__dirname, 'logs'),

  /** Hub server settings */
  hub: {
    port: Number(process.env.APPHUB_PORT ?? process.env.PORT ?? 5174),
    host: process.env.APPHUB_HOST ?? 'localhost',
  },

  /** Dev API for spawned projects */
  devApi: {
    basePath: '/api/dev',
  },

  /** Self-modification settings (Phase 3) */
  selfModify: process.env.APPHUB_SELF_MODIFY === 'true',
}

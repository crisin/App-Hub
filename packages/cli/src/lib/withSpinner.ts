import ora from 'ora'

export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>,
): Promise<T> {
  const spinner = ora(message).start()
  try {
    const result = await fn()
    spinner.succeed()
    return result
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : 'Unknown error')
    process.exit(1)
  }
}

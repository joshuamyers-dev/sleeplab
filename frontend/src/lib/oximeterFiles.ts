/**
 * Filter a File list to compatible oximeter files (.bin, .dat, or extensionless) and sort by name.
 *
 * Skips hidden files (leading dot) and files with unrecognised extensions.
 * Used when the user selects files via the native file input rather than a directory picker.
 */
export function collectOximeterFilesFromInput(files: File[]): File[] {
  return files
    .filter((file) => {
      const lowerName = file.name.toLowerCase()
      const lastSegment = lowerName.split(/[\\/]/).pop() ?? lowerName
      if (!lastSegment || lastSegment.startsWith('.')) {
        return false
      }
      const hasExtension = lastSegment.includes('.') && !lastSegment.startsWith('.')
      return !hasExtension || lowerName.endsWith('.bin') || lowerName.endsWith('.dat')
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

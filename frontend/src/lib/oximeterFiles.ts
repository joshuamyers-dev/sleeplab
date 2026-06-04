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

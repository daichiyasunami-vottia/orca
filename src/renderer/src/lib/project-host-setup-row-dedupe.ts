import type { ExecutionHostId } from '../../../shared/execution-host'
import type { ExecutionHostRegistryEntry } from '../../../shared/execution-host-registry'
import {
  getProjectSetupCheckoutKey,
  type ProjectSectionSetup
} from '../../../shared/project-section-grouping'
import type {
  ProjectHostSetupSelection,
  ReadyProjectHostSetupOption
} from './project-host-setup-options'

/** Legacy rows (e.g. linked worktrees added as projects) collapse per host; imported or cloned checkouts stay apart like their sidebar headers. */
export function getSetupPickerCheckoutKey(setup: ProjectSectionSetup): string {
  return setup.setupMethod === 'legacy-repo'
    ? JSON.stringify([setup.projectId, setup.hostId])
    : getProjectSetupCheckoutKey(setup)
}

/** Keeps the first ready setup per picker checkout, the same one creation canonicalizes to. */
export function keepFirstSetupPerCheckout<T extends ProjectSectionSetup>(
  setups: readonly T[]
): T[] {
  const seenCheckouts = new Set<string>()
  return setups.filter((setup) => {
    const key = getSetupPickerCheckoutKey(setup)
    if (seenCheckouts.has(key)) {
      return false
    }
    seenCheckouts.add(key)
    return true
  })
}

/** Collapses ready setup rows to one per checkout on a merged machine. */
export function dedupeReadySetupRows(
  options: readonly ReadyProjectHostSetupOption[],
  hostById: ReadonlyMap<ExecutionHostId, ExecutionHostRegistryEntry>
): ReadyProjectHostSetupOption[] {
  return collapseMergedHostCheckouts(options, hostById)
}

// SSH and managed server may report the same machine/checkout; keep the picker’s current route. Distinct paths remain separate checkouts.
function collapseMergedHostCheckouts(
  options: readonly ReadyProjectHostSetupOption[],
  hostById: ReadonlyMap<ExecutionHostId, ExecutionHostRegistryEntry>
): ReadyProjectHostSetupOption[] {
  const findShown = (option: ReadyProjectHostSetupOption): ReadyProjectHostSetupOption | null => {
    const mergedIntoHostId = hostById.get(option.hostId)?.mergedIntoHostId
    return mergedIntoHostId
      ? (options.find((other) => other.hostId === mergedIntoHostId && other.path === option.path) ??
          null)
      : null
  }
  const aliasesByShown = new Map<ReadyProjectHostSetupOption, ProjectHostSetupSelection[]>()
  for (const option of options) {
    const shown = findShown(option)
    if (shown) {
      const aliases = aliasesByShown.get(shown) ?? []
      aliases.push({ id: option.id, hostId: option.hostId })
      aliasesByShown.set(shown, aliases)
    }
  }
  return options
    .filter((option) => !findShown(option))
    .map((option) => {
      const aliasSetups = aliasesByShown.get(option)
      return aliasSetups ? { ...option, aliasSetups } : option
    })
}

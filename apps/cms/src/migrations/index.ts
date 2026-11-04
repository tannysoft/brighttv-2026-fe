import * as migration_20261103_185128_initial from './20261103_185128_initial'
import * as migration_20261104_000000_search_indexes from './20261104_000000_search_indexes'

export const migrations = [
  {
    up: migration_20261103_185128_initial.up,
    down: migration_20261103_185128_initial.down,
    name: '20261103_185128_initial',
  },
  {
    up: migration_20261104_000000_search_indexes.up,
    down: migration_20261104_000000_search_indexes.down,
    name: '20261104_000000_search_indexes',
  },
]

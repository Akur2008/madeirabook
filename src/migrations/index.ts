import * as migration_20260930_234119_init_schema from './20260930_234119_init_schema';
import * as migration_20260930_235859_align_with_express from './20260930_235859_align_with_express';
import * as migration_20261002_100305 from './20261002_100305';
import * as migration_20261002_101629 from './20261002_101629';

export const migrations = [
  {
    up: migration_20260930_234119_init_schema.up,
    down: migration_20260930_234119_init_schema.down,
    name: '20260930_234119_init_schema',
  },
  {
    up: migration_20260930_235859_align_with_express.up,
    down: migration_20260930_235859_align_with_express.down,
    name: '20260930_235859_align_with_express',
  },
  {
    up: migration_20261002_100305.up,
    down: migration_20261002_100305.down,
    name: '20261002_100305',
  },
  {
    up: migration_20261002_101629.up,
    down: migration_20261002_101629.down,
    name: '20261002_101629'
  },
];

import * as migration_20260930_234119_init_schema from './20260930_234119_init_schema';
import * as migration_20260930_235859_align_with_express from './20260930_235859_align_with_express';
import * as migration_20261002_100305 from './20261002_100305';
import * as migration_20261002_101629 from './20261002_101629';
import * as migration_20261002_161241 from './20261002_161241';
import * as migration_20261003_235303 from './20261003_235303';
import * as migration_20261005_170045 from './20261005_170045';

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
    name: '20261002_101629',
  },
  {
    up: migration_20261002_161241.up,
    down: migration_20261002_161241.down,
    name: '20261002_161241',
  },
  {
    up: migration_20261003_235303.up,
    down: migration_20261003_235303.down,
    name: '20261003_235303',
  },
  {
    up: migration_20261005_170045.up,
    down: migration_20261005_170045.down,
    name: '20261005_170045'
  },
];

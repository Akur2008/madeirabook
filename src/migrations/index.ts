import * as migration_20260930_234119_init_schema from './20260930_234119_init_schema';

export const migrations = [
  {
    up: migration_20260930_234119_init_schema.up,
    down: migration_20260930_234119_init_schema.down,
    name: '20260930_234119_init_schema'
  },
];

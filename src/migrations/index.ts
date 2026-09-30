import * as migration_20260930_223929_add_bookings_collection from './20260930_223929_add_bookings_collection';

export const migrations = [
  {
    up: migration_20260930_223929_add_bookings_collection.up,
    down: migration_20260930_223929_add_bookings_collection.down,
    name: '20260930_223929_add_bookings_collection'
  },
];

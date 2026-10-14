#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8c97fbd5c89cb49f2ecd3b5bd05a417d67148ffca54bce90cd725b05ad675c14/contract';
import startContract from '../../snapshots/8c97fbd5c89cb49f2ecd3b5bd05a417d67148ffca54bce90cd725b05ad675c14/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ca694c7a427e4d1feaea0abcdd1dc57fd06db74bd6c47a0fe2c5813ac6b79c89/contract';
import endContract from '../../snapshots/ca694c7a427e4d1feaea0abcdd1dc57fd06db74bd6c47a0fe2c5813ac6b79c89/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Node',
        foreignKey: {
          name: 'Node_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

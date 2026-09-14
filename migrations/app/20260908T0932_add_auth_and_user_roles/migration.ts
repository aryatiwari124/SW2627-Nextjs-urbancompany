#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0517c73e9769467493cb2e13ebc26b0de880a78deac76d485eb344bebe44032b/contract';
import endContract from '../../snapshots/0517c73e9769467493cb2e13ebc26b0de880a78deac76d485eb344bebe44032b/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/72e1bb15b783e2bfb6a04a12da62398a2872aa7dbafc0f48c89492c8a03a1bf7/contract';
import startContract from '../../snapshots/72e1bb15b783e2bfb6a04a12da62398a2872aa7dbafc0f48c89492c8a03a1bf7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, placeholder } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'professional',
        column: col('userId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('role', 'text', {
          notNull: true,
          default: lit('CUSTOMER'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('password', 'text', {
          notNull: true,
          default: lit('default_password_hash'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),

      this.addCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_role_check_3fbf5939',
        expression: "\"role\" IN ('CUSTOMER', 'PROFESSIONAL')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'professional',
        index: 'professional_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'professional',
        foreignKey: {
          name: 'professional_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

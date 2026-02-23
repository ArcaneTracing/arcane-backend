# Database Migrations

This folder contains TypeORM migrations for database schema changes, indexes, and constraints.

## Migration Files

### 1. `1737129600000-AddCheckConstraints.ts`
Adds CHECK constraints for data integrity:
- **Annotation mutually exclusive constraint**: Ensures `Annotation` links to either `QueuedTrace` OR `QueuedConversation`, not both
- **ScoreResult reference validation**: Ensures `ScoreResult` has at least one reference (`datasetRowId` OR `experimentResultId`)
- **Role ID consistency**: Ensures valid `organisationId`/`projectId` combinations

### 2. `1737129700000-AddForeignKeyIndexes.ts`
Adds indexes on all foreign key columns to improve query performance:
- Indexes on all foreign key relationships across all entities
- Improves JOIN performance and filtered queries

### 3. `1737129800000-AddCompositeIndexes.ts`
Adds composite indexes for common query patterns:
- `Evaluation`: `(project_id, evaluation_type, evaluation_scope)`
- `ExperimentResult`: `(experiment_id, status)`
- `ScoreResult`: `(evaluation_id, score_id)`
- `Role`: `(organisation_id, project_id)`
- `AnnotationQueue`: `(project_id, type)`
- `Prompt`: `(project_id, name)`

## Usage

### Run Migrations

```bash
# Run all pending migrations
npm run migration:run

# Show migration status
npm run migration:show

# Revert the last migration
npm run migration:revert
```

### Create New Migrations

```bash
# Generate migration from entity changes (auto-detects changes)
npm run migration:generate migrations/YourMigrationName

# Create empty migration file
npm run migration:create migrations/YourMigrationName
```

## Migration Naming Convention

Migrations are named with a timestamp prefix followed by a descriptive name:
- Format: `{timestamp}-{DescriptiveName}.ts`
- Example: `1737129600000-AddCheckConstraints.ts`

The timestamp ensures migrations run in the correct order.

## Important Notes

1. **Never edit existing migrations** - If you need to change a migration, create a new one
2. **Test migrations** - Always test migrations in a development environment first
3. **Backup database** - Always backup your database before running migrations in production
4. **Review SQL** - Review the generated SQL before running migrations
5. **Migration order** - Migrations run in timestamp order, ensure dependencies are correct

## Migration Status

TypeORM tracks migration status in a `migrations` table in your database. This table is automatically created when you run your first migration.

## Troubleshooting

### Migration fails
- Check database connection settings in `data-source.ts`
- Verify `DATABASE_URL` environment variable is set
- Check database user has necessary permissions
- Review error messages for specific constraint violations

### Need to reset migrations
```bash
# Drop migrations table (WARNING: This will lose migration history)
# Then recreate migrations from scratch
```

### Migration conflicts
- Ensure all team members have the latest migrations
- Never commit migrations that have been run in production
- Coordinate migration deployments in team environments

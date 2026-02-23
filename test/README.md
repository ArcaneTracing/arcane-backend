# Test Directory Structure

This directory contains all test files organized to mirror the source code structure in `src/`.

## Directory Structure

```
test/
├── README.md                    # This file
├── jest-e2e.json               # E2E test configuration
├── app.e2e-spec.ts             # E2E tests for the application
│
├── projects/                    # Projects module tests
│   ├── services/
│   │   └── projects.service.spec.ts
│   └── controllers/
│       └── projects.controller.spec.ts
│
├── datasets/                    # Datasets module tests
│   ├── services/
│   │   └── datasets.service.spec.ts
│   ├── controllers/
│   │   └── datasets.controller.spec.ts
│   └── utils/
│       └── file-parser.util.spec.ts
│
├── datasources/                # Datasources module tests
│   ├── services/
│   │   └── datasources.service.spec.ts
│   └── controllers/
│       └── datasources.controller.spec.ts
│
├── traces/                      # Traces module tests
│   ├── services/
│   │   └── traces.service.spec.ts
│   └── controllers/
│       └── traces.controller.spec.ts
│
├── users/                       # Users module tests
│   ├── services/
│   │   └── users.service.spec.ts
│   └── controllers/
│       └── users.controller.spec.ts
│
├── health/                      # Health module tests
│   ├── services/
│   │   └── health.service.spec.ts
│   └── controllers/
│       └── health.controller.spec.ts
│
├── rbac/                        # RBAC module tests
│   ├── services/
│   ├── controllers/
│   └── guards/
│
├── evaluations/                 # Evaluations module tests
│   ├── services/
│   ├── controllers/
│   └── utils/
│
├── annotation-queue/            # Annotation queue module tests
│   ├── services/
│   ├── controllers/
│   └── validators/
│
├── organisations/               # Organisations module tests
│   ├── services/
│   └── controllers/
│
├── auth/                        # Auth module tests
│   └── services/
│
├── experiments/                 # Experiments module tests
│   ├── services/
│   └── controllers/
│
├── prompts/                     # Prompts module tests
│   ├── services/
│   └── controllers/
│
├── scores/                      # Scores module tests
│   ├── services/
│   └── controllers/
│
├── entities/                    # Entities module tests
│   ├── services/
│   └── controllers/
│
├── model-configuration/         # Model configuration module tests
│   ├── services/
│   └── controllers/
│
├── conversation-configuration/  # Conversation configuration module tests
│   ├── services/
│   └── controllers/
│
├── conversations/               # Conversations module tests
│   ├── services/
│   └── controllers/
│
└── common/                      # Common/shared tests
    ├── utils/
    │   └── api.utils.spec.ts
    ├── filters/
    │   └── global.exception.filter.spec.ts
    └── pipes/
        └── custom-validation.pipe.spec.ts
```

## Naming Conventions

- **Service Tests**: `{service-name}.service.spec.ts`
- **Controller Tests**: `{controller-name}.controller.spec.ts`
- **Utility Tests**: `{utility-name}.util.spec.ts`
- **Guard Tests**: `{guard-name}.guard.spec.ts`
- **Validator Tests**: `{validator-name}.validator.spec.ts`
- **Mapper Tests**: `{mapper-name}.mapper.spec.ts`

## Import Paths

When writing tests, use relative paths from the test file location:

```typescript
// From test/projects/services/projects.service.spec.ts
import { ProjectsService } from '../../../src/projects/services/projects.service';
import { Project } from '../../../src/projects/entities/project.entity';
```

### Import Path Guidelines

- **From `test/MODULE/services/` or `test/MODULE/controllers/`**: Use `../../../src/`
- **From `test/MODULE/utils/` or `test/MODULE/guards/`**: Use `../../../src/`
- **From `test/common/utils/` or `test/common/filters/`**: Use `../../src/`
- **From `test/app.e2e-spec.ts`**: Use `../src/`

**Note**: The Jest `moduleNameMapper` in `package.json` supports `src/` imports, but relative paths are more explicit and work consistently across all test environments.

## Running Tests

```bash
# Run all tests
npm test

# Run tests for a specific module
npm test -- projects

# Run tests for a specific file
npm test -- projects/services/projects.service.spec.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Test Organization Guidelines

1. **Mirror Source Structure**: Keep test directory structure matching `src/` structure
2. **One Test File Per Source File**: Each `.ts` file should have a corresponding `.spec.ts` file
3. **Group Related Tests**: Keep tests for the same module together
4. **Use Descriptive Names**: Test file names should clearly indicate what they test

## Adding New Tests

When adding a new test file:

1. Create the appropriate directory structure if it doesn't exist
2. Place the test file in the matching location to the source file
3. Use the naming convention: `{filename}.spec.ts`
4. Update this README if adding a new module

## Example Test File Location

**Source File**: `src/projects/services/project-management.service.ts`  
**Test File**: `test/projects/services/project-management.service.spec.ts`

**Source File**: `src/rbac/guards/org-permission.guard.ts`  
**Test File**: `test/rbac/guards/org-permission.guard.spec.ts`

**Source File**: `src/common/utils/api.utils.ts`  
**Test File**: `test/common/utils/api.utils.spec.ts`

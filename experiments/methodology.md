# CI/CD Experiment Methodology

## Goal

The goal of the experiment is to compare three GitHub Actions
CI/CD pipeline configuration approaches while keeping the executed
application workload equivalent.

The evaluated variants are:

1. Baseline workflow
   - CI logic is defined directly inside the workflow file.

2. Composite Actions workflow
   - Repeated backend and frontend CI logic is extracted into
     local composite actions.

3. Reusable Workflow
   - CI logic is extracted into a reusable workflow invoked
     through `workflow_call`.

The purpose of the experiment is to evaluate whether the configuration
and reuse mechanism affects execution efficiency, resource usage,
reliability, and maintainability.

## Experimental workload

All variants execute the same application revision and equivalent CI
operations.

### Backend

- Checkout repository
- Setup Node.js 22
- Restore npm cache
- Install dependencies using `npm ci`
- Start PostgreSQL 16 service
- Initialize the test database
- Execute backend automated tests

### Frontend

- Checkout repository
- Setup Node.js 22
- Restore npm cache
- Install dependencies using `npm ci`
- Execute ESLint
- Execute Vitest tests
- Build the production frontend
- Upload the frontend build artifact

Backend and frontend jobs execute in parallel.

## Controlled variables

The following variables must remain identical for all measured variants:

- application source revision
- Git commit SHA
- Node.js version
- PostgreSQL version
- GitHub-hosted runner type
- dependency lock files
- test suite
- lint configuration
- frontend build configuration
- artifact generation
- cache configuration
- backend and frontend job topology

No application or pipeline workload changes are allowed after the
experimental revision is frozen.

## Cache state

The experiment uses the npm caching configuration provided through
`actions/setup-node`.

Before measured runs begin, each pipeline variant is executed once as
a warm-up run.

Warm-up runs are not included in the statistical analysis.

All measured runs therefore execute after the dependency cache has
already had an opportunity to be populated.

## Repetitions

Each pipeline variant is executed 30 times.

This produces:

- 30 Baseline runs
- 30 Composite runs
- 30 Reusable Workflow runs
- 90 measured workflow runs in total

Warm-up runs are excluded.

## Execution order

Runs are executed sequentially rather than simultaneously to reduce
interference between experiments.

The variant order is rotated between rounds:

Round 1:
Baseline -> Composite -> Reusable

Round 2:
Composite -> Reusable -> Baseline

Round 3:
Reusable -> Baseline -> Composite

The sequence is then repeated.

With 30 rounds, each variant appears equally often in the first,
second, and third position.

## Primary performance metric

The primary performance metric is CI workload duration.

It is calculated as:

earliest start time of backend/frontend job
to
latest completion time of backend/frontend job

This measures the time required to complete the actual parallel CI
workload while excluding the initial runner queue delay and the
metrics collection job.

## Secondary performance metrics

The following metrics are also collected:

- end-to-end workflow duration
- initial runner queue delay
- backend job duration
- frontend job duration
- backend dependency installation duration
- backend test duration
- frontend dependency installation duration
- frontend lint duration
- frontend test duration
- frontend build duration

## Resource usage

Runner usage is calculated as the sum of individual GitHub Actions job
execution durations.

Both workload runner time and total pipeline runner time are recorded.

## Reliability

For every workflow run the following data is recorded:

- workflow conclusion
- job conclusions
- failed step, if any

A failed measured run is not silently discarded.

Application, test, or pipeline failures count toward pipeline
reliability.

Failures caused by an identified external GitHub infrastructure
incident may be marked as infrastructure failures and excluded from
performance statistics. The exclusion and reason must still be
recorded.

A replacement run may then be appended to retain the required number
of valid performance measurements.

GitHub's "Re-run jobs" functionality is not used for measurements.
Each measurement is created using a new workflow dispatch.

## Statistical analysis

For execution-time metrics the following statistics are calculated:

- mean
- median
- minimum
- maximum
- standard deviation
- 95th percentile

The full distribution of measured values is retained rather than
reporting only averages.

## Maintainability evaluation

Pipeline maintainability is evaluated separately from runtime
performance.

Configuration scope:

Baseline:
`.github/workflows/ci-baseline.yml`

Composite:
`.github/workflows/ci-composite.yml`
`.github/actions/backend-ci/action.yml`
`.github/actions/frontend-ci/action.yml`

Reusable Workflow:
`.github/workflows/ci-reusable.yml`
`.github/workflows/reusable-pipeline.yml`

Metrics include:

- total YAML lines of code
- duplicated configuration
- number of files involved
- number of configuration locations that must be changed
- lines changed for equivalent maintenance operations

Representative maintenance operations will include changes such as:

- changing the Node.js version
- adding an additional CI validation step

These maintenance experiments are performed after runtime measurements
are complete.

## Hypotheses

H1:
The reuse mechanism will not produce a large difference in execution
time because all variants execute an equivalent computational
workload.

H2:
Reusable configuration mechanisms will reduce duplication and change
propagation effort compared with a fully inline baseline configuration.

H3:
Composite Actions and Reusable Workflows may introduce small
orchestration overheads, but these overheads are expected to be small
relative to dependency installation, testing, and build execution.
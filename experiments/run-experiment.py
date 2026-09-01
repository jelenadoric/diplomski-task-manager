#!/usr/bin/env python3

import argparse
import csv
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
import tempfile


VARIANTS = {
    "baseline": "ci-baseline.yml",
    "composite": "ci-composite.yml",
    "reusable": "ci-reusable.yml",
}

ROTATIONS = [
    ["baseline", "composite", "reusable"],
    ["composite", "reusable", "baseline"],
    ["reusable", "baseline", "composite"],
]

CSV_FIELDS = [
    "is_warmup",
    "round",
    "order_position",
    "variant",
    "workflow_file",
    "run_id",
    "run_attempt",
    "run_url",
    "sha",
    "conclusion",
    "metrics_artifact_found",
    "created_at",
    "workload_started_at",
    "workload_completed_at",
    "workflow_completed_at",
    "queue_delay_sec",
    "workload_duration_sec",
    "end_to_end_duration_sec",
    "backend_job_duration_sec",
    "frontend_job_duration_sec",
    "workload_runner_time_sec",
    "total_runner_time_sec",
    "backend_install_sec",
    "backend_test_sec",
    "frontend_install_sec",
    "frontend_lint_sec",
    "frontend_test_sec",
    "frontend_build_sec",
    "backend_conclusion",
    "frontend_conclusion",
    "metrics_conclusion",
    "failed_step",
]


def run_command(args, check=True):
    result = subprocess.run(
        args,
        capture_output=True,
        text=True,
    )

    if check and result.returncode != 0:
        raise RuntimeError(
            f"Command failed:\n"
            f"{' '.join(args)}\n\n"
            f"stdout:\n{result.stdout}\n\n"
            f"stderr:\n{result.stderr}"
        )

    return result


def gh(*args):
    return run_command(
        ["gh", *args]
    ).stdout.strip()


def gh_json(*args):
    output = gh(*args)

    if not output:
        return None

    return json.loads(output)


def git(*args):
    return run_command(
        ["git", *args]
    ).stdout.strip()


def parse_time(value):
    if not value:
        return None

    return datetime.fromisoformat(
        value.replace("Z", "+00:00")
    )


def duration_seconds(start, end):
    start_time = parse_time(start)
    end_time = parse_time(end)

    if not start_time or not end_time:
        return None

    return round(
        (
            end_time - start_time
        ).total_seconds(),
        3,
    )


def get_repository():
    data = gh_json(
        "repo",
        "view",
        "--json",
        "nameWithOwner",
    )

    return data["nameWithOwner"]


def get_frozen_sha(ref):
    return git(
        "rev-parse",
        f"{ref}^{{}}",
    )


def list_workflow_runs(
    workflow_file,
    sha,
):
    data = gh_json(
        "run",
        "list",
        "--workflow",
        workflow_file,
        "--commit",
        sha,
        "--event",
        "workflow_dispatch",
        "--limit",
        "20",
        "--json",
        (
            "databaseId,"
            "createdAt,"
            "headSha,"
            "status,"
            "conclusion,"
            "url"
        ),
    )

    return data or []


def dispatch_workflow(
    workflow_file,
    ref,
    sha,
):
    existing_runs = list_workflow_runs(
        workflow_file,
        sha,
    )

    existing_ids = {
        run["databaseId"]
        for run in existing_runs
    }

    print(
        f"Dispatching {workflow_file} "
        f"on {ref}..."
    )

    result = run_command([
        "gh",
        "workflow",
        "run",
        workflow_file,
        "--ref",
        ref,
    ])

    output = (
        result.stdout
        + "\n"
        + result.stderr
    )

    match = re.search(
        r"/actions/runs/(\d+)",
        output,
    )

    if match:
        return int(match.group(1))

    print(
        "Run ID not returned directly. "
        "Waiting for the new run..."
    )

    for _ in range(30):
        time.sleep(2)

        runs = list_workflow_runs(
            workflow_file,
            sha,
        )

        new_runs = [
            run
            for run in runs
            if (
                run["databaseId"]
                not in existing_ids
                and run["headSha"] == sha
            )
        ]

        if new_runs:
            new_runs.sort(
                key=lambda run:
                    run["createdAt"],
                reverse=True,
            )

            return new_runs[0][
                "databaseId"
            ]

    raise RuntimeError(
        "Could not find dispatched workflow run."
    )


def get_run(repository, run_id):
    return gh_json(
        "api",
        (
            f"repos/{repository}/"
            f"actions/runs/{run_id}"
        ),
    )


def get_jobs(repository, run_id):
    data = gh_json(
        "api",
        (
            f"repos/{repository}/"
            f"actions/runs/{run_id}/"
            "jobs?per_page=100"
        ),
    )

    return data["jobs"]

def to_float(value):
    if value is None or value == "":
        return None

    return float(value)


def metric_value(metrics, key):
    if not metrics:
        return None

    return to_float(
        metrics.get(key)
    )


def download_metrics_artifact(
    repository,
    run_id,
    variant,
):
    expected_name = (
        f"{variant}-metrics-{run_id}"
    )

    artifact = None

    # Artifact can take a short moment to become
    # available after the workflow finishes.
    for _ in range(10):
        data = gh_json(
            "api",
            (
                f"repos/{repository}/"
                f"actions/runs/{run_id}/"
                "artifacts?per_page=100"
            ),
        )

        artifacts = (
            data.get("artifacts", [])
            if data
            else []
        )

        artifact = next(
            (
                item
                for item in artifacts
                if item["name"]
                == expected_name
            ),
            None,
        )

        if artifact:
            break

        time.sleep(2)

    if not artifact:
        return None

    with tempfile.TemporaryDirectory() as temp_dir:
        run_command([
            "gh",
            "run",
            "download",
            str(run_id),
            "--repo",
            repository,
            "--name",
            expected_name,
            "--dir",
            temp_dir,
        ])

        json_files = list(
            Path(temp_dir).rglob(
                "*.json"
            )
        )

        if len(json_files) != 1:
            raise RuntimeError(
                "Expected exactly one JSON "
                f"file in artifact "
                f"{expected_name}, found "
                f"{len(json_files)}."
            )

        return json.loads(
            json_files[0].read_text(
                encoding="utf-8"
            )
        )

def wait_for_completion(
    repository,
    run_id,
    poll_seconds,
):
    previous_status = None

    while True:
        run = get_run(
            repository,
            run_id,
        )

        status = run["status"]

        if status != previous_status:
            print(
                f"Run {run_id}: {status}"
            )

            previous_status = status

        if status == "completed":
            print(
                f"Run {run_id}: "
                f"{run['conclusion']}"
            )

            return run

        time.sleep(poll_seconds)


def find_job(jobs, suffix):
    for job in jobs:
        if job["name"].endswith(suffix):
            return job

    return None


def job_duration(job):
    if not job:
        return None

    return duration_seconds(
        job.get("started_at"),
        job.get("completed_at"),
    )


def step_duration(
    job,
    step_name,
):
    if not job:
        return None

    for step in job.get("steps", []):
        if step["name"] != step_name:
            continue

        if (
            step.get("conclusion")
            == "skipped"
        ):
            return None

        return duration_seconds(
            step.get("started_at"),
            step.get("completed_at"),
        )

    return None


def find_failed_step(jobs):
    for job in jobs:
        for step in job.get(
            "steps",
            [],
        ):
            if (
                step.get("conclusion")
                == "failure"
            ):
                return (
                    f"{job['name']} :: "
                    f"{step['name']}"
                )

    return ""


def min_time(values):
    parsed = [
        parse_time(value)
        for value in values
        if value
    ]

    if not parsed:
        return None

    return min(parsed)


def max_time(values):
    parsed = [
        parse_time(value)
        for value in values
        if value
    ]

    if not parsed:
        return None

    return max(parsed)


def iso(value):
    if value is None:
        return ""

    return (
        value
        .astimezone(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )


def seconds_between(start, end):
    if not start or not end:
        return None

    return round(
        (end - start).total_seconds(),
        3,
    )


def build_result(
    run,
    jobs,
    metrics,
    variant,
    workflow_file,
    round_number,
    order_position,
    is_warmup,
):
    backend_job = find_job(
        jobs,
        "backend-ci",
    )

    frontend_job = find_job(
        jobs,
        "frontend-ci",
    )

    metrics_job = find_job(
        jobs,
        "collect-metrics",
    )

    workload_jobs = [
        job
        for job in [
            backend_job,
            frontend_job,
        ]
        if job
    ]

    workload_start = min_time([
        job.get("started_at")
        for job in workload_jobs
    ])

    workload_end = max_time([
        job.get("completed_at")
        for job in workload_jobs
    ])

    workflow_end = max_time([
        job.get("completed_at")
        for job in jobs
    ])

    created_at = parse_time(
        run["created_at"]
    )

    backend_duration = job_duration(
        backend_job
    )

    frontend_duration = job_duration(
        frontend_job
    )

    workload_runner_time = sum(
        value
        for value in [
            backend_duration,
            frontend_duration,
        ]
        if value is not None
    )

    all_job_durations = [
        job_duration(job)
        for job in jobs
    ]

    total_runner_time = sum(
        value
        for value in all_job_durations
        if value is not None
    )

    return {
        "is_warmup":
            str(is_warmup).lower(),

        "round":
            round_number,

        "order_position":
            order_position,

        "variant":
            variant,

        "workflow_file":
            workflow_file,

        "run_id":
            run["id"],

        "run_attempt":
            run.get(
                "run_attempt",
                1,
            ),

        "run_url":
            run["html_url"],

        "sha":
            run["head_sha"],

        "conclusion":
            run["conclusion"],

        "created_at":
            run["created_at"],
        
        "metrics_artifact_found":
            str(metrics is not None).lower(),

        "workload_started_at":
            iso(workload_start),

        "workload_completed_at":
            iso(workload_end),

        "workflow_completed_at":
            iso(workflow_end),

        "queue_delay_sec":
            seconds_between(
                created_at,
                workload_start,
            ),

        "workload_duration_sec":
            seconds_between(
                workload_start,
                workload_end,
            ),

        "end_to_end_duration_sec":
            seconds_between(
                created_at,
                workflow_end,
            ),

        "backend_job_duration_sec":
            backend_duration,

        "frontend_job_duration_sec":
            frontend_duration,

        "workload_runner_time_sec":
            round(
                workload_runner_time,
                3,
            ),

        "total_runner_time_sec":
            round(
                total_runner_time,
                3,
            ),

        "backend_install_sec":
            metric_value(
                metrics,
                "backend_install_duration_sec",
            ),

        "backend_test_sec":
            metric_value(
                metrics,
                "backend_test_duration_sec",
            ),

        "frontend_install_sec":
            metric_value(
                metrics,
                "frontend_install_duration_sec",
            ),

        "frontend_lint_sec":
            metric_value(
                metrics,
                "frontend_lint_duration_sec",
            ),

        "frontend_test_sec":
            metric_value(
                metrics,
                "frontend_test_duration_sec",
            ),

        "frontend_build_sec":
            metric_value(
                metrics,
                "frontend_build_duration_sec",
            ),

        "backend_conclusion":
            (
                backend_job["conclusion"]
                if backend_job
                else ""
            ),

        "frontend_conclusion":
            (
                frontend_job["conclusion"]
                if frontend_job
                else ""
            ),

        "metrics_conclusion":
            (
                metrics_job["conclusion"]
                if metrics_job
                else ""
            ),

        "failed_step":
            find_failed_step(jobs),
    }


def append_csv(csv_path, result):
    file_exists = csv_path.exists()

    with csv_path.open(
        "a",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=CSV_FIELDS,
        )

        if not file_exists:
            writer.writeheader()

        writer.writerow(result)


def save_raw(
    raw_dir,
    result,
    run,
    jobs,
    metrics,
):
    filename = (
        f"{result['variant']}"
        f"-round-{result['round']}"
        f"-position-{result['order_position']}"
        f"-run-{result['run_id']}.json"
    )

    path = raw_dir / filename

    with path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            {
                "result": result,
                "run": run,
                "jobs": jobs,
                "metrics": metrics,
            },
            file,
            indent=2,
        )


def load_completed_keys(csv_path):
    if not csv_path.exists():
        return set()

    completed = set()

    with csv_path.open(
        newline="",
        encoding="utf-8",
    ) as file:
        reader = csv.DictReader(file)

        for row in reader:
            completed.add((
                row["is_warmup"],
                int(row["round"]),
                row["variant"],
            ))

    return completed


def save_active_run(
    state_path,
    state,
):
    with state_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            state,
            file,
            indent=2,
        )


def collect_active_run(
    repository,
    state,
    results_dir,
    csv_path,
    raw_dir,
    state_path,
    poll_seconds,
):
    run_id = state["run_id"]

    run = wait_for_completion(
        repository,
        run_id,
        poll_seconds,
    )

    jobs = get_jobs(
        repository,
        run_id,
    )

    metrics = download_metrics_artifact(
        repository,
        run_id,
        state["variant"],
    )
    if (
        run["conclusion"] == "success"
        and metrics is None
    ):
        raise RuntimeError(
            "Successful workflow run has "
            "no metrics artifact: "
            f"{run_id}"
        )

    result = build_result(
        run=run,
        jobs=jobs,
        metrics=metrics,
        variant=state["variant"],
        workflow_file=state[
            "workflow_file"
        ],
        round_number=state["round"],
        order_position=state[
            "order_position"
        ],
        is_warmup=state[
            "is_warmup"
        ],
    )

    append_csv(
        csv_path,
        result,
    )

    save_raw(
        raw_dir,
        result,
        run,
        jobs,
        metrics,
    )

    state_path.unlink(
        missing_ok=True
    )

    print(
        f"Saved {result['variant']} "
        f"run {run_id}: "
        f"{result['conclusion']}"
    )

    print(
        "Workload duration: "
        f"{result['workload_duration_sec']} s"
    )

    print()

    return result


def execute_run(
    repository,
    ref,
    sha,
    variant,
    round_number,
    order_position,
    is_warmup,
    results_dir,
    csv_path,
    raw_dir,
    state_path,
    poll_seconds,
):
    workflow_file = VARIANTS[
        variant
    ]

    run_id = dispatch_workflow(
        workflow_file,
        ref,
        sha,
    )

    state = {
        "variant":
            variant,

        "workflow_file":
            workflow_file,

        "round":
            round_number,

        "order_position":
            order_position,

        "is_warmup":
            is_warmup,

        "run_id":
            run_id,
    }

    save_active_run(
        state_path,
        state,
    )

    return collect_active_run(
        repository,
        state,
        results_dir,
        csv_path,
        raw_dir,
        state_path,
        poll_seconds,
    )


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--rounds",
        type=int,
        default=1,
    )

    parser.add_argument(
        "--ref",
        default="experiment-v2",
    )

    parser.add_argument(
        "--results-dir",
        default=(
            "experiments/results"
        ),
    )

    parser.add_argument(
        "--skip-warmup",
        action="store_true",
    )

    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=10,
    )

    args = parser.parse_args()

    if args.rounds < 1:
        raise ValueError(
            "rounds must be at least 1"
        )

    results_dir = Path(
        args.results_dir
    )

    raw_dir = (
        results_dir / "raw"
    )

    results_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    raw_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    csv_path = (
        results_dir / "runs.csv"
    )

    state_path = (
        results_dir / "active_run.json"
    )

    print("Checking GitHub authentication...")

    auth_result = run_command(
        [
            "gh",
            "auth",
            "status",
        ],
        check=False,
    )

    if auth_result.returncode != 0:
        print(
            auth_result.stderr
        )

        print(
            "Authenticate first with "
            "`gh auth login`."
        )

        sys.exit(1)

    repository = get_repository()
    sha = get_frozen_sha(args.ref)

    print(
        f"Repository: {repository}"
    )

    print(
        f"Experiment ref: {args.ref}"
    )

    print(
        f"Frozen SHA: {sha}"
    )

    print()

    if state_path.exists():
        print(
            "Recovering unfinished "
            "previous run..."
        )

        with state_path.open(
            encoding="utf-8",
        ) as file:
            state = json.load(file)

        collect_active_run(
            repository,
            state,
            results_dir,
            csv_path,
            raw_dir,
            state_path,
            args.poll_seconds,
        )

    completed = load_completed_keys(
        csv_path
    )

    if not args.skip_warmup:
        print("=== WARM-UP ===")
        print()

        for position, variant in enumerate(
            [
                "baseline",
                "composite",
                "reusable",
            ],
            start=1,
        ):
            key = (
                "true",
                0,
                variant,
            )

            if key in completed:
                print(
                    f"Skipping completed "
                    f"warm-up: {variant}"
                )
                continue

            execute_run(
                repository=repository,
                ref=args.ref,
                sha=sha,
                variant=variant,
                round_number=0,
                order_position=position,
                is_warmup=True,
                results_dir=results_dir,
                csv_path=csv_path,
                raw_dir=raw_dir,
                state_path=state_path,
                poll_seconds=args.poll_seconds,
            )

            completed.add(key)

    for round_number in range(
        1,
        args.rounds + 1,
    ):
        order = ROTATIONS[
            (round_number - 1) % 3
        ]

        print(
            f"=== ROUND {round_number} ==="
        )

        print(
            " -> ".join(order)
        )

        print()

        for position, variant in enumerate(
            order,
            start=1,
        ):
            key = (
                "false",
                round_number,
                variant,
            )

            if key in completed:
                print(
                    f"Skipping completed "
                    f"run: round "
                    f"{round_number}, "
                    f"{variant}"
                )
                continue

            result = execute_run(
                repository=repository,
                ref=args.ref,
                sha=sha,
                variant=variant,
                round_number=round_number,
                order_position=position,
                is_warmup=False,
                results_dir=results_dir,
                csv_path=csv_path,
                raw_dir=raw_dir,
                state_path=state_path,
                poll_seconds=args.poll_seconds,
            )

            if result["sha"] != sha:
                raise RuntimeError(
                    "Workflow ran on an "
                    "unexpected SHA. "
                    f"Expected {sha}, "
                    f"received "
                    f"{result['sha']}."
                )

            completed.add(key)

    print(
        "Experiment execution complete."
    )

    print(
        f"Results: {csv_path}"
    )

    print(
        f"Raw data: {raw_dir}"
    )


if __name__ == "__main__":
    main()
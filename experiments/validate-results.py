#!/usr/bin/env python3

import argparse
import csv
import sys
from collections import Counter
from pathlib import Path


VARIANTS = [
    "baseline",
    "composite",
    "reusable",
]

VARIANT_CODES = {
    "baseline": "B",
    "composite": "C",
    "reusable": "R",
}

REQUIRED_DATASET_FIELDS = [
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

REQUIRED_SUCCESS_FIELDS = [
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
]


def load_schedule(schedule_path):
    required_fields = {
        "round",
        "permutation",
        "position_1",
        "position_2",
        "position_3",
    }

    if not schedule_path.exists():
        raise FileNotFoundError(
            f"Schedule file not found: {schedule_path}"
        )

    with schedule_path.open(
        newline="",
        encoding="utf-8",
    ) as file:
        reader = csv.DictReader(file)

        if not reader.fieldnames:
            raise ValueError(
                "Schedule file has no header."
            )

        missing_fields = (
            required_fields
            - set(reader.fieldnames)
        )

        if missing_fields:
            raise ValueError(
                "Schedule is missing fields: "
                + ", ".join(
                    sorted(missing_fields)
                )
            )

        schedule = []

        for row in reader:
            try:
                round_number = int(
                    row["round"]
                )
            except ValueError as exc:
                raise ValueError(
                    "Schedule contains an invalid "
                    f"round value: {row['round']}"
                ) from exc

            order = [
                row["position_1"].strip(),
                row["position_2"].strip(),
                row["position_3"].strip(),
            ]

            if (
                len(set(order)) != 3
                or set(order) != set(VARIANTS)
            ):
                raise ValueError(
                    "Invalid variant order "
                    f"in round {round_number}: "
                    f"{order}"
                )

            permutation = (
                row["permutation"]
                .strip()
                .upper()
            )

            expected_permutation = "".join(
                VARIANT_CODES[variant]
                for variant in order
            )

            if permutation != expected_permutation:
                raise ValueError(
                    "Permutation label does not "
                    "match variant order in round "
                    f"{round_number}: expected "
                    f"{expected_permutation}, got "
                    f"{permutation}."
                )

            schedule.append({
                "round": round_number,
                "permutation": permutation,
                "order": order,
            })

    if not schedule:
        raise ValueError(
            "Schedule is empty."
        )

    round_numbers = [
        item["round"]
        for item in schedule
    ]

    expected_rounds = list(
        range(1, len(schedule) + 1)
    )

    if round_numbers != expected_rounds:
        raise ValueError(
            "Schedule rounds must be "
            "sequential starting at 1."
        )

    return schedule


def load_dataset(csv_path):
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Dataset file not found: {csv_path}"
        )

    with csv_path.open(
        newline="",
        encoding="utf-8",
    ) as file:
        reader = csv.DictReader(file)

        if not reader.fieldnames:
            raise ValueError(
                "Dataset has no header."
            )

        missing_fields = (
            set(REQUIRED_DATASET_FIELDS)
            - set(reader.fieldnames)
        )

        if missing_fields:
            raise ValueError(
                "Dataset is missing fields: "
                + ", ".join(
                    sorted(missing_fields)
                )
            )

        return list(reader)


def parse_int(row, field, errors):
    value = row.get(field, "")

    try:
        return int(value)
    except ValueError:
        errors.append(
            f"Run {row.get('run_id', '?')}: "
            f"invalid integer value for "
            f"{field}: {value}"
        )
        return None


def parse_float(row, field, errors):
    value = row.get(field, "")

    if value == "":
        errors.append(
            f"Run {row.get('run_id', '?')}: "
            f"missing {field}"
        )
        return None

    try:
        parsed = float(value)
    except ValueError:
        errors.append(
            f"Run {row.get('run_id', '?')}: "
            f"invalid numeric value for "
            f"{field}: {value}"
        )
        return None

    if parsed < 0:
        errors.append(
            f"Run {row.get('run_id', '?')}: "
            f"negative value for {field}: "
            f"{value}"
        )

    return parsed


def validate_success_metrics(row, errors):
    if row.get("metrics_artifact_found") != "true":
        errors.append(
            f"Run {row['run_id']}: "
            "successful run has no "
            "metrics artifact"
        )

    values = {}

    for field in REQUIRED_SUCCESS_FIELDS:
        values[field] = parse_float(
            row,
            field,
            errors,
        )

    workload = values.get(
        "workload_duration_sec"
    )
    backend = values.get(
        "backend_job_duration_sec"
    )
    frontend = values.get(
        "frontend_job_duration_sec"
    )
    end_to_end = values.get(
        "end_to_end_duration_sec"
    )
    workload_runner = values.get(
        "workload_runner_time_sec"
    )
    total_runner = values.get(
        "total_runner_time_sec"
    )

    if (
        workload is not None
        and backend is not None
        and workload < backend
    ):
        errors.append(
            f"Run {row['run_id']}: "
            "workload duration is shorter "
            "than backend job duration"
        )

    if (
        workload is not None
        and frontend is not None
        and workload < frontend
    ):
        errors.append(
            f"Run {row['run_id']}: "
            "workload duration is shorter "
            "than frontend job duration"
        )

    if (
        end_to_end is not None
        and workload is not None
        and end_to_end < workload
    ):
        errors.append(
            f"Run {row['run_id']}: "
            "end-to-end duration is shorter "
            "than workload duration"
        )

    if (
        total_runner is not None
        and workload_runner is not None
        and total_runner < workload_runner
    ):
        errors.append(
            f"Run {row['run_id']}: "
            "total runner time is shorter "
            "than workload runner time"
        )


def validate_physical_files(
    rows,
    results_dir,
    errors,
):
    raw_dir = results_dir / "raw"
    metrics_dir = results_dir / "metrics"

    if not raw_dir.exists():
        errors.append(
            f"Missing raw directory: {raw_dir}"
        )

    if not metrics_dir.exists():
        errors.append(
            f"Missing metrics directory: {metrics_dir}"
        )

    for row in rows:
        round_number = row["round"]
        position = row["order_position"]
        variant = row["variant"]
        run_id = row["run_id"]

        raw_path = raw_dir / (
            f"{variant}-round-{round_number}"
            f"-position-{position}"
            f"-run-{run_id}.json"
        )

        if not raw_path.exists():
            errors.append(
                f"Run {run_id}: missing raw file "
                f"{raw_path.name}"
            )

        if row["conclusion"] == "success":
            metrics_path = metrics_dir / (
                f"{variant}-run-{run_id}.json"
            )

            if not metrics_path.exists():
                errors.append(
                    f"Run {run_id}: missing metrics "
                    f"file {metrics_path.name}"
                )


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Validate an experimental GitHub "
            "Actions dataset against a fixed "
            "schedule."
        )
    )

    parser.add_argument(
        "csv_path",
        help="Path to runs.csv",
    )

    parser.add_argument(
        "--schedule",
        required=True,
        help=(
            "Path to the fixed experimental "
            "schedule CSV"
        ),
    )

    parser.add_argument(
        "--expected-sha",
        required=True,
        help="Frozen source revision SHA",
    )

    parser.add_argument(
        "--expect-warmup",
        action="store_true",
        help=(
            "Require exactly one warm-up run "
            "for each variant"
        ),
    )

    parser.add_argument(
        "--check-artifact-files",
        action="store_true",
        help=(
            "Also verify physical raw and "
            "metrics JSON files"
        ),
    )

    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    schedule_path = Path(args.schedule)

    try:
        schedule = load_schedule(
            schedule_path
        )
        rows = load_dataset(
            csv_path
        )
    except (
        FileNotFoundError,
        ValueError,
    ) as exc:
        print(f"VALIDATION FAILED\n\n- {exc}")
        sys.exit(1)

    errors = []

    expected_measured_count = (
        len(schedule) * len(VARIANTS)
    )

    expected_total_count = (
        expected_measured_count
        + (len(VARIANTS) if args.expect_warmup else 0)
    )

    if len(rows) != expected_total_count:
        errors.append(
            "Unexpected number of rows: "
            f"expected {expected_total_count}, "
            f"found {len(rows)}"
        )

    seen_entries = set()
    seen_run_ids = set()

    for row in rows:
        variant = row["variant"]
        run_id = row["run_id"]

        if variant not in VARIANTS:
            errors.append(
                f"Run {run_id}: unknown variant "
                f"{variant}"
            )

        if row["sha"] != args.expected_sha:
            errors.append(
                f"Run {run_id}: unexpected SHA "
                f"{row['sha']}"
            )

        if run_id in seen_run_ids:
            errors.append(
                f"Duplicate GitHub run_id: {run_id}"
            )
        seen_run_ids.add(run_id)

        key = (
            row["is_warmup"],
            row["round"],
            variant,
        )

        if key in seen_entries:
            errors.append(
                f"Duplicate dataset entry: {key}"
            )
        seen_entries.add(key)

        if row["is_warmup"] not in {
            "true",
            "false",
        }:
            errors.append(
                f"Run {run_id}: invalid "
                f"is_warmup value "
                f"{row['is_warmup']}"
            )

        parse_int(
            row,
            "round",
            errors,
        )
        parse_int(
            row,
            "order_position",
            errors,
        )

        if row["conclusion"] == "success":
            validate_success_metrics(
                row,
                errors,
            )

    measured_rows = [
        row
        for row in rows
        if row["is_warmup"] == "false"
    ]

    if len(measured_rows) != expected_measured_count:
        errors.append(
            "Unexpected number of measured runs: "
            f"expected {expected_measured_count}, "
            f"found {len(measured_rows)}"
        )

    counts = Counter(
        row["variant"]
        for row in measured_rows
    )

    for variant in VARIANTS:
        if counts[variant] != len(schedule):
            errors.append(
                f"{variant}: expected "
                f"{len(schedule)} measured runs, "
                f"found {counts[variant]}"
            )

    schedule_by_round = {
        item["round"]: item
        for item in schedule
    }

    for round_number, schedule_entry in (
        schedule_by_round.items()
    ):
        round_rows = [
            row
            for row in measured_rows
            if row["round"] == str(round_number)
        ]

        if len(round_rows) != len(VARIANTS):
            errors.append(
                f"Round {round_number}: expected "
                f"3 measured runs, found "
                f"{len(round_rows)}"
            )
            continue

        positions = []

        for row in round_rows:
            try:
                positions.append(
                    int(row["order_position"])
                )
            except ValueError:
                pass

        if sorted(positions) != [1, 2, 3]:
            errors.append(
                f"Round {round_number}: invalid "
                f"order positions {positions}"
            )
            continue

        round_rows.sort(
            key=lambda row: int(
                row["order_position"]
            )
        )

        actual_order = [
            row["variant"]
            for row in round_rows
        ]

        expected_order = schedule_entry[
            "order"
        ]

        if actual_order != expected_order:
            errors.append(
                f"Round {round_number}: expected "
                f"order {expected_order}, found "
                f"{actual_order}"
            )

    measured_round_values = set()

    for row in measured_rows:
        try:
            measured_round_values.add(
                int(row["round"])
            )
        except ValueError:
            continue

    unexpected_rounds = (
        measured_round_values
        - set(schedule_by_round)
    )

    if unexpected_rounds:
        errors.append(
            "Measured dataset contains "
            "unexpected rounds: "
            + ", ".join(
                str(value)
                for value in sorted(
                    unexpected_rounds
                )
            )
        )

    warmup_rows = [
        row
        for row in rows
        if row["is_warmup"] == "true"
    ]

    if args.expect_warmup:
        if len(warmup_rows) != len(VARIANTS):
            errors.append(
                "Expected exactly 3 warm-up "
                f"runs, found {len(warmup_rows)}"
            )
        else:
            warmup_rows.sort(
                key=lambda row: int(
                    row["order_position"]
                )
            )

            actual_warmup_order = [
                row["variant"]
                for row in warmup_rows
            ]

            if actual_warmup_order != VARIANTS:
                errors.append(
                    "Warm-up order must be "
                    f"{VARIANTS}, found "
                    f"{actual_warmup_order}"
                )

        for row in warmup_rows:
            if row["round"] != "0":
                errors.append(
                    f"Warm-up run {row['run_id']} "
                    f"has round {row['round']}"
                )

    elif warmup_rows:
        errors.append(
            "Warm-up rows found although "
            "--expect-warmup was not set."
        )

    if args.check_artifact_files:
        validate_physical_files(
            rows,
            csv_path.parent,
            errors,
        )

    successful = sum(
        1
        for row in measured_rows
        if row["conclusion"] == "success"
    )

    failed = (
        len(measured_rows)
        - successful
    )

    permutation_counts = Counter(
        item["permutation"]
        for item in schedule
    )

    print(f"Dataset: {csv_path}")
    print(f"Schedule: {schedule_path}")
    print(f"Rows: {len(rows)}")
    print(
        f"Measured runs: {len(measured_rows)}"
    )
    print(
        f"Successful measured runs: "
        f"{successful}"
    )
    print(
        f"Failed measured runs: {failed}"
    )
    print()

    for variant in VARIANTS:
        variant_rows = [
            row
            for row in measured_rows
            if row["variant"] == variant
        ]

        successes = sum(
            1
            for row in variant_rows
            if row["conclusion"] == "success"
        )

        print(
            f"{variant}: {successes}/"
            f"{len(variant_rows)} success"
        )

    print()
    print("Schedule permutations:")

    for permutation in sorted(
        permutation_counts
    ):
        print(
            f"{permutation}: "
            f"{permutation_counts[permutation]}"
        )

    print()

    if errors:
        print("VALIDATION FAILED")
        print()

        for error in errors:
            print(f"- {error}")

        sys.exit(1)

    print("VALIDATION PASSED")


if __name__ == "__main__":
    main()

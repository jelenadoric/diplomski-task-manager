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

ROTATIONS = [
    ["baseline", "composite", "reusable"],
    ["composite", "reusable", "baseline"],
    ["reusable", "baseline", "composite"],
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


def parse_float(
    row,
    field,
    errors,
):
    value = row.get(field, "")

    if value == "":
        errors.append(
            f"Run {row['run_id']}: "
            f"missing {field}"
        )
        return None

    try:
        return float(value)
    except ValueError:
        errors.append(
            f"Run {row['run_id']}: "
            f"invalid numeric value for "
            f"{field}: {value}"
        )
        return None


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "csv_path",
    )

    parser.add_argument(
        "--rounds",
        type=int,
        required=True,
    )

    parser.add_argument(
        "--expected-sha",
        required=True,
    )

    parser.add_argument(
        "--expect-warmup",
        action="store_true",
    )

    args = parser.parse_args()

    csv_path = Path(
        args.csv_path
    )

    if not csv_path.exists():
        print(
            f"File does not exist: "
            f"{csv_path}"
        )
        sys.exit(1)

    with csv_path.open(
        newline="",
        encoding="utf-8",
    ) as file:
        rows = list(
            csv.DictReader(file)
        )

    errors = []

    expected_count = (
        args.rounds * 3
    )

    if args.expect_warmup:
        expected_count += 3

    if len(rows) != expected_count:
        errors.append(
            "Unexpected number of rows: "
            f"expected {expected_count}, "
            f"found {len(rows)}"
        )

    seen = set()

    for row in rows:
        variant = row["variant"]

        if variant not in VARIANTS:
            errors.append(
                f"Unknown variant: {variant}"
            )

        if row["sha"] != args.expected_sha:
            errors.append(
                f"Run {row['run_id']}: "
                f"unexpected SHA "
                f"{row['sha']}"
            )

        key = (
            row["is_warmup"],
            row["round"],
            variant,
        )

        if key in seen:
            errors.append(
                f"Duplicate dataset entry: "
                f"{key}"
            )

        seen.add(key)

        if row["conclusion"] == "success":
            if (
                row.get(
                    "metrics_artifact_found"
                )
                != "true"
            ):
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
                    "workload duration is "
                    "shorter than backend job"
                )

            if (
                workload is not None
                and frontend is not None
                and workload < frontend
            ):
                errors.append(
                    f"Run {row['run_id']}: "
                    "workload duration is "
                    "shorter than frontend job"
                )

            if (
                end_to_end is not None
                and workload is not None
                and end_to_end < workload
            ):
                errors.append(
                    f"Run {row['run_id']}: "
                    "end-to-end duration is "
                    "shorter than workload"
                )

            if (
                total_runner is not None
                and workload_runner is not None
                and total_runner
                < workload_runner
            ):
                errors.append(
                    f"Run {row['run_id']}: "
                    "total runner time is "
                    "shorter than workload "
                    "runner time"
                )

    measured_rows = [
        row
        for row in rows
        if row["is_warmup"] == "false"
    ]

    counts = Counter(
        row["variant"]
        for row in measured_rows
    )

    for variant in VARIANTS:
        if counts[variant] != args.rounds:
            errors.append(
                f"{variant}: expected "
                f"{args.rounds} measured runs, "
                f"found {counts[variant]}"
            )

    for round_number in range(
        1,
        args.rounds + 1,
    ):
        round_rows = [
            row
            for row in measured_rows
            if int(row["round"])
            == round_number
        ]

        round_rows.sort(
            key=lambda row:
                int(
                    row["order_position"]
                )
        )

        actual_order = [
            row["variant"]
            for row in round_rows
        ]

        expected_order = ROTATIONS[
            (round_number - 1) % 3
        ]

        if actual_order != expected_order:
            errors.append(
                f"Round {round_number}: "
                f"expected order "
                f"{expected_order}, "
                f"found {actual_order}"
            )

    warmup_rows = [
        row
        for row in rows
        if row["is_warmup"] == "true"
    ]

    if args.expect_warmup:
        if len(warmup_rows) != 3:
            errors.append(
                "Expected exactly 3 "
                f"warm-up runs, found "
                f"{len(warmup_rows)}"
            )

        warmup_variants = {
            row["variant"]
            for row in warmup_rows
        }

        if warmup_variants != set(
            VARIANTS
        ):
            errors.append(
                "Warm-up variants are "
                "incomplete or duplicated."
            )

        for row in warmup_rows:
            if row["round"] != "0":
                errors.append(
                    f"Warm-up run "
                    f"{row['run_id']} has "
                    f"round {row['round']}"
                )

    elif warmup_rows:
        errors.append(
            "Warm-up rows found although "
            "--expect-warmup was not set."
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

    print(
        f"Rows: {len(rows)}"
    )

    print(
        f"Measured runs: "
        f"{len(measured_rows)}"
    )

    print(
        f"Successful measured runs: "
        f"{successful}"
    )

    print(
        f"Failed measured runs: "
        f"{failed}"
    )

    print()

    for variant in VARIANTS:
        variant_rows = [
            row
            for row in measured_rows
            if row["variant"]
            == variant
        ]

        successes = sum(
            1
            for row in variant_rows
            if row["conclusion"]
            == "success"
        )

        print(
            f"{variant}: "
            f"{successes}/"
            f"{len(variant_rows)} success"
        )

    print()

    if errors:
        print(
            "VALIDATION FAILED"
        )
        print()

        for error in errors:
            print(
                f"- {error}"
            )

        sys.exit(1)

    print(
        "VALIDATION PASSED"
    )


if __name__ == "__main__":
    main()
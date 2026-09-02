#!/usr/bin/env python3

import argparse
import csv
import math
import statistics
from collections import defaultdict
from pathlib import Path


VARIANTS = [
    "baseline",
    "composite",
    "reusable",
]

METRICS = [
    "workload_duration_sec",
    "end_to_end_duration_sec",
    "queue_delay_sec",
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


def percentile(values, percentile_value):
    if not values:
        return None

    sorted_values = sorted(values)

    if len(sorted_values) == 1:
        return sorted_values[0]

    position = (
        len(sorted_values) - 1
    ) * percentile_value

    lower = math.floor(position)
    upper = math.ceil(position)

    if lower == upper:
        return sorted_values[lower]

    fraction = position - lower

    return (
        sorted_values[lower]
        + (
            sorted_values[upper]
            - sorted_values[lower]
        )
        * fraction
    )


def calculate_stats(values):
    return {
        "count": len(values),
        "mean": statistics.mean(values),
        "median": statistics.median(values),
        "min": min(values),
        "max": max(values),
        "std": (
            statistics.stdev(values)
            if len(values) > 1
            else 0
        ),
        "p95": percentile(
            values,
            0.95,
        ),
    }


def format_number(value):
    return f"{value:.2f}"


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "csv_path",
    )

    parser.add_argument(
        "--output",
        default=(
            "experiments/results/"
            "summary.csv"
        ),
    )

    args = parser.parse_args()

    csv_path = Path(
        args.csv_path
    )

    output_path = Path(
        args.output
    )

    with csv_path.open(
        newline="",
        encoding="utf-8",
    ) as file:
        rows = list(
            csv.DictReader(file)
        )

    measured_rows = [
        row
        for row in rows
        if row["is_warmup"] == "false"
    ]

    successful_rows = [
        row
        for row in measured_rows
        if row["conclusion"] == "success"
    ]

    print(
        f"Measured runs: "
        f"{len(measured_rows)}"
    )

    print(
        f"Successful runs: "
        f"{len(successful_rows)}"
    )

    print(
        f"Failed runs: "
        f"{len(measured_rows) - len(successful_rows)}"
    )

    print()

    by_variant = defaultdict(list)

    for row in measured_rows:
        by_variant[
            row["variant"]
        ].append(row)

    print("=== RELIABILITY ===")
    print()

    for variant in VARIANTS:
        variant_rows = by_variant[
            variant
        ]

        successful = sum(
            1
            for row in variant_rows
            if row["conclusion"]
            == "success"
        )

        total = len(
            variant_rows
        )

        reliability = (
            successful / total * 100
            if total
            else 0
        )

        print(
            f"{variant:10} "
            f"{successful}/{total} "
            f"({reliability:.2f}%)"
        )

    print()

    summary_rows = []

    for metric in METRICS:
        print(
            f"=== {metric} ==="
        )

        metric_stats = {}

        for variant in VARIANTS:
            values = [
                float(row[metric])
                for row in by_variant[
                    variant
                ]
                if (
                    row["conclusion"]
                    == "success"
                    and row.get(
                        metric,
                        "",
                    )
                    != ""
                )
            ]

            stats = calculate_stats(
                values
            )

            metric_stats[
                variant
            ] = stats

            print(
                f"{variant:10} "
                f"mean={stats['mean']:.2f}  "
                f"median={stats['median']:.2f}  "
                f"min={stats['min']:.2f}  "
                f"max={stats['max']:.2f}  "
                f"std={stats['std']:.2f}  "
                f"p95={stats['p95']:.2f}"
            )

            summary_rows.append({
                "metric":
                    metric,

                "variant":
                    variant,

                "count":
                    stats["count"],

                "mean":
                    format_number(
                        stats["mean"]
                    ),

                "median":
                    format_number(
                        stats["median"]
                    ),

                "min":
                    format_number(
                        stats["min"]
                    ),

                "max":
                    format_number(
                        stats["max"]
                    ),

                "std":
                    format_number(
                        stats["std"]
                    ),

                "p95":
                    format_number(
                        stats["p95"]
                    ),
            })

        baseline_mean = (
            metric_stats[
                "baseline"
            ]["mean"]
        )

        print()

        print(
            "Mean difference "
            "relative to baseline:"
        )

        for variant in [
            "composite",
            "reusable",
        ]:
            variant_mean = (
                metric_stats[
                    variant
                ]["mean"]
            )

            absolute = (
                variant_mean
                - baseline_mean
            )

            percentage = (
                absolute
                / baseline_mean
                * 100
                if baseline_mean
                else 0
            )

            print(
                f"{variant:10} "
                f"{absolute:+.2f} s "
                f"({percentage:+.2f}%)"
            )

        print()

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with output_path.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "metric",
                "variant",
                "count",
                "mean",
                "median",
                "min",
                "max",
                "std",
                "p95",
            ],
        )

        writer.writeheader()
        writer.writerows(
            summary_rows
        )

    print(
        f"Summary saved to "
        f"{output_path}"
    )


if __name__ == "__main__":
    main()
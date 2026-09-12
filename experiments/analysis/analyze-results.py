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


def percentile(values, p):
    if not values:
        return None

    values = sorted(values)

    if len(values) == 1:
        return values[0]

    position = (len(values) - 1) * p
    lower = math.floor(position)
    upper = math.ceil(position)

    if lower == upper:
        return values[lower]

    fraction = position - lower
    return values[lower] + (values[upper] - values[lower]) * fraction


def calculate_stats(values):
    if not values:
        return None

    return {
        "count": len(values),
        "mean": statistics.mean(values),
        "median": statistics.median(values),
        "min": min(values),
        "max": max(values),
        "std": statistics.stdev(values) if len(values) > 1 else 0.0,
        "p95": percentile(values, 0.95),
    }


def default_output(csv_path):
    return csv_path.parent / "analysis" / "summary.csv"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--output")
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    output_path = Path(args.output) if args.output else default_output(csv_path)

    with csv_path.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))

    measured_rows = [
        row for row in rows
        if row.get("is_warmup", "").lower() == "false"
    ]

    successful_rows = [
        row for row in measured_rows
        if row.get("conclusion") == "success"
    ]

    print(f"Measured runs: {len(measured_rows)}")
    print(f"Successful runs: {len(successful_rows)}")
    print(f"Failed runs: {len(measured_rows) - len(successful_rows)}")
    print()

    by_variant = defaultdict(list)
    for row in measured_rows:
        by_variant[row["variant"]].append(row)

    print("=== RELIABILITY ===")
    print()

    for variant in VARIANTS:
        variant_rows = by_variant[variant]
        successful = sum(
            1 for row in variant_rows
            if row.get("conclusion") == "success"
        )
        total = len(variant_rows)
        rate = successful / total * 100 if total else 0.0
        print(f"{variant:10} {successful}/{total} ({rate:.2f}%)")

    print()

    summary_rows = []

    for metric in METRICS:
        print(f"=== {metric} ===")

        for variant in VARIANTS:
            values = []

            for row in by_variant[variant]:
                if row.get("conclusion") != "success":
                    continue

                value = row.get(metric, "")
                if value == "":
                    continue

                values.append(float(value))

            stats = calculate_stats(values)

            if stats is None:
                print(f"{variant:10} no valid values")
                continue

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
                "metric": metric,
                "variant": variant,
                "count": stats["count"],
                "mean": f"{stats['mean']:.6f}",
                "median": f"{stats['median']:.6f}",
                "min": f"{stats['min']:.6f}",
                "max": f"{stats['max']:.6f}",
                "std": f"{stats['std']:.6f}",
                "p95": f"{stats['p95']:.6f}",
            })

        print()

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as file:
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
        writer.writerows(summary_rows)

    print(f"Summary saved to {output_path}")


if __name__ == "__main__":
    main()

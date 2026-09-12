#!/usr/bin/env python3

import argparse
import csv
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt


VARIANTS = ["baseline", "composite", "reusable"]
LABELS = {
    "baseline": "Baseline",
    "composite": "Composite",
    "reusable": "Reusable",
}


def load_rows(csv_path):
    with csv_path.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))

    return [
        row for row in rows
        if row.get("is_warmup", "").lower() == "false"
        and row.get("conclusion") == "success"
    ]


def values_by_variant(rows, metric):
    return {
        variant: [
            float(row[metric])
            for row in rows
            if row["variant"] == variant and row.get(metric, "") != ""
        ]
        for variant in VARIANTS
    }


def save_workload_boxplot(rows, output_dir):
    data = values_by_variant(rows, "workload_duration_sec")
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.boxplot(
        [data[variant] for variant in VARIANTS],
        tick_labels=[LABELS[variant] for variant in VARIANTS],
    )
    ax.set_ylabel("Workload duration (s)")
    ax.set_title("CI workload duration by pipeline variant")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(output_dir / "workload-duration-boxplot.png", dpi=200)
    plt.close(fig)


def save_round_plot(rows, output_dir):
    by_variant = defaultdict(list)

    for row in rows:
        by_variant[row["variant"]].append(
            (int(row["round"]), float(row["workload_duration_sec"]))
        )

    fig, ax = plt.subplots(figsize=(10, 5))

    for variant in VARIANTS:
        values = sorted(by_variant[variant])
        ax.plot(
            [item[0] for item in values],
            [item[1] for item in values],
            marker="o",
            markersize=3,
            label=LABELS[variant],
        )

    ax.set_xlabel("Experimental round")
    ax.set_ylabel("Workload duration (s)")
    ax.set_title("CI workload duration across experimental rounds")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(output_dir / "workload-duration-by-round.png", dpi=200)
    plt.close(fig)


def save_paired_difference_plot(rows, output_dir):
    rounds = defaultdict(dict)

    for row in rows:
        rounds[int(row["round"])][row["variant"]] = float(
            row["workload_duration_sec"]
        )

    complete_rounds = [
        number for number in sorted(rounds)
        if set(rounds[number]) == set(VARIANTS)
    ]

    composite_difference = [
        rounds[number]["composite"] - rounds[number]["baseline"]
        for number in complete_rounds
    ]
    reusable_difference = [
        rounds[number]["reusable"] - rounds[number]["baseline"]
        for number in complete_rounds
    ]

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.axhline(0, linewidth=1)
    ax.plot(
        complete_rounds,
        composite_difference,
        marker="o",
        markersize=3,
        label="Composite − Baseline",
    )
    ax.plot(
        complete_rounds,
        reusable_difference,
        marker="o",
        markersize=3,
        label="Reusable − Baseline",
    )
    ax.set_xlabel("Experimental round")
    ax.set_ylabel("Paired workload difference (s)")
    ax.set_title("Paired workload differences relative to Baseline")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(output_dir / "paired-workload-differences.png", dpi=200)
    plt.close(fig)


def save_runner_boxplot(rows, output_dir):
    data = values_by_variant(rows, "workload_runner_time_sec")
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.boxplot(
        [data[variant] for variant in VARIANTS],
        tick_labels=[LABELS[variant] for variant in VARIANTS],
    )
    ax.set_ylabel("Runner time (s)")
    ax.set_title("CI workload runner usage by pipeline variant")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(output_dir / "runner-time-boxplot.png", dpi=200)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--output-dir")
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    output_dir = (
        Path(args.output_dir)
        if args.output_dir
        else csv_path.parent / "analysis" / "figures"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    rows = load_rows(csv_path)
    save_workload_boxplot(rows, output_dir)
    save_round_plot(rows, output_dir)
    save_paired_difference_plot(rows, output_dir)
    save_runner_boxplot(rows, output_dir)

    print(f"Generated figures in {output_dir}")


if __name__ == "__main__":
    main()

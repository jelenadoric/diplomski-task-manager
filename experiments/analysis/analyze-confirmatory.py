#!/usr/bin/env python3

import argparse
import csv
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy.stats import friedmanchisquare


PRIMARY_METRIC = "workload_duration_sec"
VARIANTS = ["baseline", "composite", "reusable"]

PRIMARY_COMPARISONS = [
    ("B-C", "baseline", "composite"),
    ("B-R", "baseline", "reusable"),
]

SECONDARY_COMPARISONS = [
    ("C-R", "composite", "reusable"),
]


def default_analysis_dir(csv_path):
    return csv_path.parent / "analysis"


def load_complete_rounds(csv_path):
    with csv_path.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))

    measured = [
        row for row in rows
        if row.get("is_warmup", "").lower() == "false"
    ]

    rounds = defaultdict(dict)

    for row in measured:
        if row.get("conclusion") != "success":
            continue

        value = row.get(PRIMARY_METRIC, "")
        if value == "":
            continue

        rounds[int(row["round"])][row["variant"]] = float(value)

    complete = {
        round_number: variants
        for round_number, variants in rounds.items()
        if set(variants) == set(VARIANTS)
    }

    return complete


def bootstrap_mean_ci(differences, iterations, rng):
    n = len(differences)
    sample_indices = rng.integers(0, n, size=(iterations, n))
    means = differences[sample_indices].mean(axis=1)
    low, high = np.quantile(means, [0.025, 0.975])
    return float(low), float(high)


def permutation_p_value(differences, iterations, rng):
    observed = abs(float(np.mean(differences)))
    n = len(differences)
    remaining = iterations
    extreme = 0
    batch_size = 10000

    while remaining > 0:
        current = min(batch_size, remaining)
        signs = rng.choice(np.array([-1.0, 1.0]), size=(current, n))
        statistics = np.abs((signs * differences).mean(axis=1))
        extreme += int(np.count_nonzero(statistics >= observed))
        remaining -= current

    return (extreme + 1) / (iterations + 1)


def comparison_result(label, first, second, rounds, iterations, rng):
    round_numbers = sorted(rounds)
    differences = np.array(
        [rounds[number][first] - rounds[number][second] for number in round_numbers],
        dtype=float,
    )

    mean_difference = float(np.mean(differences))
    median_difference = float(np.median(differences))
    std_difference = float(np.std(differences, ddof=1)) if len(differences) > 1 else 0.0

    ci_low, ci_high = bootstrap_mean_ci(differences, iterations, rng)
    p_value = permutation_p_value(differences, iterations, rng)
    cohens_dz = mean_difference / std_difference if std_difference else 0.0

    return {
        "metric": PRIMARY_METRIC,
        "comparison": label,
        "first_variant": first,
        "second_variant": second,
        "difference_definition": "first_minus_second",
        "n_pairs": len(differences),
        "mean_difference_sec": mean_difference,
        "median_difference_sec": median_difference,
        "bootstrap_ci_low_sec": ci_low,
        "bootstrap_ci_high_sec": ci_high,
        "permutation_p_value": p_value,
        "cohens_dz": cohens_dz,
    }


def holm_adjust(p_values):
    indexed = sorted(enumerate(p_values), key=lambda item: item[1])
    adjusted = [None] * len(p_values)
    running_max = 0.0
    m = len(p_values)

    for rank, (original_index, p_value) in enumerate(indexed):
        multiplier = m - rank
        candidate = min(1.0, multiplier * p_value)
        running_max = max(running_max, candidate)
        adjusted[original_index] = running_max

    return adjusted


def write_csv(path, rows, fieldnames):
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def formatted_comparison_row(result, include_holm=False, holm_value=None):
    row = {
        "metric": result["metric"],
        "comparison": result["comparison"],
        "first_variant": result["first_variant"],
        "second_variant": result["second_variant"],
        "difference_definition": result["difference_definition"],
        "n_pairs": result["n_pairs"],
        "mean_difference_sec": f"{result['mean_difference_sec']:.6f}",
        "median_difference_sec": f"{result['median_difference_sec']:.6f}",
        "bootstrap_ci_low_sec": f"{result['bootstrap_ci_low_sec']:.6f}",
        "bootstrap_ci_high_sec": f"{result['bootstrap_ci_high_sec']:.6f}",
        "permutation_p_value": f"{result['permutation_p_value']:.8f}",
        "cohens_dz": f"{result['cohens_dz']:.6f}",
    }

    if include_holm:
        row["holm_adjusted_p_value"] = f"{holm_value:.8f}"

    return row


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--output-dir")
    parser.add_argument("--iterations", type=int, default=100000)
    parser.add_argument("--seed", type=int, default=20260912)
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    output_dir = Path(args.output_dir) if args.output_dir else default_analysis_dir(csv_path)

    rounds = load_complete_rounds(csv_path)

    if not rounds:
        raise RuntimeError("No complete successful paired rounds found.")

    print(f"Complete successful paired rounds: {len(rounds)}")
    print(f"Primary metric: {PRIMARY_METRIC}")
    print()

    rng = np.random.default_rng(args.seed)

    primary_results = [
        comparison_result(label, first, second, rounds, args.iterations, rng)
        for label, first, second in PRIMARY_COMPARISONS
    ]

    adjusted = holm_adjust([result["permutation_p_value"] for result in primary_results])

    primary_rows = [
        formatted_comparison_row(result, include_holm=True, holm_value=adjusted[index])
        for index, result in enumerate(primary_results)
    ]

    secondary_results = [
        comparison_result(label, first, second, rounds, args.iterations, rng)
        for label, first, second in SECONDARY_COMPARISONS
    ]

    secondary_rows = [
        formatted_comparison_row(result)
        for result in secondary_results
    ]

    round_numbers = sorted(rounds)
    baseline = [rounds[number]["baseline"] for number in round_numbers]
    composite = [rounds[number]["composite"] for number in round_numbers]
    reusable = [rounds[number]["reusable"] for number in round_numbers]

    friedman = friedmanchisquare(baseline, composite, reusable)
    omnibus_rows = [{
        "metric": PRIMARY_METRIC,
        "test": "friedman",
        "n_rounds": len(round_numbers),
        "statistic": f"{float(friedman.statistic):.6f}",
        "p_value": f"{float(friedman.pvalue):.8f}",
        "role": "supplementary_omnibus_not_gatekeeping",
    }]

    comparison_fields = [
        "metric",
        "comparison",
        "first_variant",
        "second_variant",
        "difference_definition",
        "n_pairs",
        "mean_difference_sec",
        "median_difference_sec",
        "bootstrap_ci_low_sec",
        "bootstrap_ci_high_sec",
        "permutation_p_value",
        "cohens_dz",
    ]

    write_csv(
        output_dir / "primary-comparisons.csv",
        primary_rows,
        comparison_fields + ["holm_adjusted_p_value"],
    )

    write_csv(
        output_dir / "secondary-comparisons.csv",
        secondary_rows,
        comparison_fields,
    )

    write_csv(
        output_dir / "omnibus.csv",
        omnibus_rows,
        ["metric", "test", "n_rounds", "statistic", "p_value", "role"],
    )

    print("=== PRIMARY COMPARISONS ===")
    for row in primary_rows:
        print(
            f"{row['comparison']}: mean={float(row['mean_difference_sec']):+.2f} s, "
            f"CI=[{float(row['bootstrap_ci_low_sec']):+.2f}, "
            f"{float(row['bootstrap_ci_high_sec']):+.2f}], "
            f"p={float(row['permutation_p_value']):.5f}, "
            f"Holm p={float(row['holm_adjusted_p_value']):.5f}, "
            f"dz={float(row['cohens_dz']):+.3f}"
        )

    print()
    print("=== SUPPLEMENTARY OMNIBUS ===")
    print(
        f"Friedman: statistic={friedman.statistic:.4f}, "
        f"p={friedman.pvalue:.5f}"
    )

    print()
    print("=== SECONDARY COMPARISON ===")
    for row in secondary_rows:
        print(
            f"{row['comparison']}: mean={float(row['mean_difference_sec']):+.2f} s, "
            f"CI=[{float(row['bootstrap_ci_low_sec']):+.2f}, "
            f"{float(row['bootstrap_ci_high_sec']):+.2f}], "
            f"p={float(row['permutation_p_value']):.5f}, "
            f"dz={float(row['cohens_dz']):+.3f}"
        )

    print()
    print("Difference is always first variant minus second variant.")
    print("Friedman is supplementary and does not gate B-C or B-R.")
    print("C-R is secondary and is not included in Holm correction.")
    print(f"Results saved to {output_dir}")


if __name__ == "__main__":
    main()

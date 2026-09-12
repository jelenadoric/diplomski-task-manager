#!/usr/bin/env python3

import argparse
import csv
import random
import statistics
from collections import defaultdict
from math import comb
from pathlib import Path


PRIMARY_METRIC = "workload_duration_sec"

COMPARISONS = [
    ("composite", "baseline"),
    ("reusable", "baseline"),
    ("reusable", "composite"),
]


def percentile(values, p):
    values = sorted(values)

    if len(values) == 1:
        return values[0]

    position = (len(values) - 1) * p
    lower = int(position)
    upper = min(lower + 1, len(values) - 1)
    fraction = position - lower

    return values[lower] + (values[upper] - values[lower]) * fraction


def bootstrap_mean_ci(differences, iterations, rng):
    n = len(differences)
    means = []

    for _ in range(iterations):
        sample = [differences[rng.randrange(n)] for _ in range(n)]
        means.append(statistics.mean(sample))

    return percentile(means, 0.025), percentile(means, 0.975)


def permutation_p_value(differences, iterations, rng):
    observed = abs(statistics.mean(differences))
    extreme = 0

    for _ in range(iterations):
        permuted = [
            value if rng.random() < 0.5 else -value
            for value in differences
        ]
        statistic = abs(statistics.mean(permuted))
        if statistic >= observed:
            extreme += 1

    return (extreme + 1) / (iterations + 1)


def exact_sign_test(faster, slower):
    n = faster + slower

    if n == 0:
        return 1.0

    observed = max(faster, slower)
    tail = sum(comb(n, k) for k in range(observed, n + 1)) / (2 ** n)
    return min(1.0, 2 * tail)


def default_output(csv_path):
    return csv_path.parent / "analysis" / "paired-results.csv"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path")
    parser.add_argument("--output")
    parser.add_argument("--iterations", type=int, default=100000)
    parser.add_argument("--seed", type=int, default=20260901)
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    output_path = Path(args.output) if args.output else default_output(csv_path)

    with csv_path.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))

    measured = [
        row for row in rows
        if row.get("is_warmup", "").lower() == "false"
        and row.get("conclusion") == "success"
    ]

    rounds = defaultdict(dict)
    for row in measured:
        rounds[int(row["round"])][row["variant"]] = row

    complete_rounds = {
        number: variants
        for number, variants in rounds.items()
        if set(variants) == {"baseline", "composite", "reusable"}
    }

    print(f"Complete paired rounds: {len(complete_rounds)}")
    print(f"Primary metric: {PRIMARY_METRIC}")
    print()

    rng = random.Random(args.seed)
    result_rows = []

    for first, second in COMPARISONS:
        differences = []

        for round_number in sorted(complete_rounds):
            first_value = float(complete_rounds[round_number][first][PRIMARY_METRIC])
            second_value = float(complete_rounds[round_number][second][PRIMARY_METRIC])
            differences.append(first_value - second_value)

        mean_difference = statistics.mean(differences)
        median_difference = statistics.median(differences)
        std_difference = statistics.stdev(differences) if len(differences) > 1 else 0.0
        ci_low, ci_high = bootstrap_mean_ci(differences, args.iterations, rng)
        permutation_p = permutation_p_value(differences, args.iterations, rng)
        cohens_dz = mean_difference / std_difference if std_difference else 0.0

        faster = sum(1 for value in differences if value < 0)
        equal = sum(1 for value in differences if value == 0)
        slower = sum(1 for value in differences if value > 0)
        sign_p = exact_sign_test(faster, slower)

        result_rows.append({
            "metric": PRIMARY_METRIC,
            "comparison": f"{first}-{second}",
            "first_variant": first,
            "second_variant": second,
            "difference_definition": "first_minus_second",
            "n_pairs": len(differences),
            "mean_difference_sec": f"{mean_difference:.6f}",
            "median_difference_sec": f"{median_difference:.6f}",
            "bootstrap_ci_low_sec": f"{ci_low:.6f}",
            "bootstrap_ci_high_sec": f"{ci_high:.6f}",
            "permutation_p_value": f"{permutation_p:.8f}",
            "cohens_dz": f"{cohens_dz:.6f}",
            "faster": faster,
            "equal": equal,
            "slower": slower,
            "sign_test_p_value": f"{sign_p:.8f}",
        })

        print(f"{first} vs {second}")
        print(f"  mean difference: {mean_difference:+.2f} s")
        print(f"  95% bootstrap CI: [{ci_low:+.2f}, {ci_high:+.2f}] s")
        print(f"  permutation p-value: {permutation_p:.5f}")
        print(f"  Cohen's dz: {cohens_dz:+.3f}")
        print(f"  faster/equal/slower: {faster}/{equal}/{slower}")
        print(f"  sign-test p-value: {sign_p:.5f}")
        print()

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(result_rows[0].keys()))
        writer.writeheader()
        writer.writerows(result_rows)

    print("Negative difference means the first variant was faster.")
    print(f"Pilot paired results saved to {output_path}")


if __name__ == "__main__":
    main()

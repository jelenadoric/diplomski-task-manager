#!/usr/bin/env python3

import argparse
import csv
import random
import statistics
from collections import defaultdict
from pathlib import Path
from math import comb


PRIMARY_METRIC = "workload_duration_sec"

COMPARISONS = [
    ("composite", "baseline"),
    ("reusable", "baseline"),
    ("reusable", "composite"),
]

def exact_sign_test(
    faster,
    slower,
):
    n = faster + slower

    if n == 0:
        return 1.0

    observed = max(
        faster,
        slower,
    )

    tail = sum(
        comb(n, k)
        for k in range(
            observed,
            n + 1,
        )
    ) / (2 ** n)

    return min(
        1.0,
        2 * tail,
    )


def percentile(values, p):
    values = sorted(values)

    if len(values) == 1:
        return values[0]

    position = (
        len(values) - 1
    ) * p

    lower = int(position)
    upper = min(
        lower + 1,
        len(values) - 1,
    )

    fraction = (
        position - lower
    )

    return (
        values[lower]
        + (
            values[upper]
            - values[lower]
        )
        * fraction
    )


def bootstrap_mean_ci(
    differences,
    iterations,
    rng,
):
    means = []

    n = len(differences)

    for _ in range(iterations):
        sample = [
            differences[
                rng.randrange(n)
            ]
            for _ in range(n)
        ]

        means.append(
            statistics.mean(sample)
        )

    return (
        percentile(means, 0.025),
        percentile(means, 0.975),
    )


def permutation_p_value(
    differences,
    iterations,
    rng,
):
    observed = abs(
        statistics.mean(
            differences
        )
    )

    extreme = 0

    for _ in range(iterations):
        permuted = [
            value
            if rng.random() < 0.5
            else -value
            for value in differences
        ]

        statistic = abs(
            statistics.mean(
                permuted
            )
        )

        if statistic >= observed:
            extreme += 1

    return (
        extreme + 1
    ) / (
        iterations + 1
    )


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "csv_path",
    )

    parser.add_argument(
        "--iterations",
        type=int,
        default=100000,
    )

    args = parser.parse_args()

    csv_path = Path(
        args.csv_path
    )

    with csv_path.open(
        newline="",
        encoding="utf-8",
    ) as file:
        rows = list(
            csv.DictReader(file)
        )

    measured = [
        row
        for row in rows
        if (
            row["is_warmup"] == "false"
            and row["conclusion"]
            == "success"
        )
    ]

    rounds = defaultdict(dict)

    for row in measured:
        round_number = int(
            row["round"]
        )

        rounds[round_number][
            row["variant"]
        ] = row

    incomplete = [
        round_number
        for round_number, variants
        in rounds.items()
        if set(variants.keys()) != {
            "baseline",
            "composite",
            "reusable",
        }
    ]

    if incomplete:
        raise RuntimeError(
            f"Incomplete rounds: "
            f"{incomplete}"
        )

    print(
        f"Complete paired rounds: "
        f"{len(rounds)}"
    )

    print()
    print(
        "=== PRIMARY METRIC ==="
    )
    print(
        PRIMARY_METRIC
    )
    print()

    rng = random.Random(
        20260901
    )

    for first, second in COMPARISONS:
        differences = []

        for round_number in sorted(
            rounds.keys()
        ):
            first_value = float(
                rounds[
                    round_number
                ][first][PRIMARY_METRIC]
            )

            second_value = float(
                rounds[
                    round_number
                ][second][PRIMARY_METRIC]
            )

            differences.append(
                first_value
                - second_value
            )

        mean_difference = (
            statistics.mean(
                differences
            )
        )

        median_difference = (
            statistics.median(
                differences
            )
        )

        std_difference = (
            statistics.stdev(
                differences
            )
        )

        ci_low, ci_high = (
            bootstrap_mean_ci(
                differences,
                args.iterations,
                rng,
            )
        )

        p_value = (
            permutation_p_value(
                differences,
                args.iterations,
                rng,
            )
        )

        cohens_dz = (
            mean_difference
            / std_difference
            if std_difference
            else 0
        )

        faster = sum(
            1
            for value in differences
            if value < 0
        )

        equal = sum(
            1
            for value in differences
            if value == 0
        )

        slower = sum(
            1
            for value in differences
            if value > 0
        )

        sign_p_value = exact_sign_test(
            faster,
            slower,
        )

        print(
            f"  exact sign-test p-value: "
            f"{sign_p_value:.5f}"
        )

        print(
            f"{first} vs {second}"
        )

        print(
            f"  mean paired difference: "
            f"{mean_difference:+.2f} s"
        )

        print(
            f"  median paired difference: "
            f"{median_difference:+.2f} s"
        )

        print(
            f"  95% bootstrap CI: "
            f"[{ci_low:+.2f}, "
            f"{ci_high:+.2f}] s"
        )

        print(
            f"  permutation p-value: "
            f"{p_value:.5f}"
        )

        print(
            f"  Cohen's dz: "
            f"{cohens_dz:+.3f}"
        )

        print(
            f"  faster/equal/slower: "
            f"{faster}/"
            f"{equal}/"
            f"{slower}"
        )

        print()

    print(
        "Negative difference means "
        "the first variant was faster."
    )

    print()
    print(
        "=== ORDER EFFECT ==="
    )
    print()

    by_position = defaultdict(
        list
    )

    for row in measured:
        key = (
            row["variant"],
            int(
                row[
                    "order_position"
                ]
            ),
        )

        by_position[key].append(
            float(
                row[
                    PRIMARY_METRIC
                ]
            )
        )

    for variant in [
        "baseline",
        "composite",
        "reusable",
    ]:
        print(variant)

        for position in [
            1,
            2,
            3,
        ]:
            values = (
                by_position[
                    (
                        variant,
                        position,
                    )
                ]
            )

            print(
                f"  position {position}: "
                f"n={len(values)}, "
                f"mean="
                f"{statistics.mean(values):.2f}, "
                f"median="
                f"{statistics.median(values):.2f}"
            )

        print()

    print(
        "=== HIGHEST WORKLOAD "
        "DURATIONS ==="
    )
    print()

    highest = sorted(
        measured,
        key=lambda row:
            float(
                row[
                    PRIMARY_METRIC
                ]
            ),
        reverse=True,
    )[:10]

    for row in highest:
        print(
            f"round={row['round']:>2} "
            f"variant="
            f"{row['variant']:<10} "
            f"position="
            f"{row['order_position']} "
            f"duration="
            f"{float(row[PRIMARY_METRIC]):.0f}s"
        )


if __name__ == "__main__":
    main()


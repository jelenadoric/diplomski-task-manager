import argparse
import csv
import subprocess
from collections import Counter
from pathlib import Path


VARIANTS = {
    "baseline": [
        ".github/workflows/ci-baseline.yml",
    ],
    "composite": [
        ".github/workflows/ci-composite.yml",
        ".github/actions/backend-ci/action.yml",
        ".github/actions/frontend-ci/action.yml",
    ],
    "reusable": [
        ".github/workflows/ci-reusable.yml",
        ".github/workflows/reusable-pipeline.yml",
    ],
}


def read_file_from_git(ref, path):
    result = subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"Cannot read {path} from {ref}:\n{result.stderr}"
        )

    return result.stdout


def relevant_yaml_lines(text):
    """
    Physical YAML LOC:
    - excludes blank lines
    - excludes full-line comments

    Lines are otherwise kept, including YAML structural lines.
    """
    result = []

    for line in text.splitlines():
        stripped = line.strip()

        if not stripped:
            continue

        if stripped.startswith("#"):
            continue

        result.append(stripped)

    return result


def calculate_variant(ref, variant, files):
    all_lines = []
    file_loc = {}

    for path in files:
        text = read_file_from_git(ref, path)
        lines = relevant_yaml_lines(text)

        file_loc[path] = len(lines)
        all_lines.extend(lines)

    counts = Counter(all_lines)

    # If the same normalized YAML line appears n times,
    # the first occurrence is original and n-1 are duplicates.
    duplicate_loc = sum(
        count - 1
        for count in counts.values()
        if count > 1
    )

    duplicated_patterns = sum(
        1
        for count in counts.values()
        if count > 1
    )

    yaml_loc = len(all_lines)

    duplication_ratio = (
        (duplicate_loc / yaml_loc) * 100
        if yaml_loc
        else 0.0
    )

    return {
        "variant": variant,
        "files": len(files),
        "yaml_loc": yaml_loc,
        "duplicate_loc": duplicate_loc,
        "duplicated_patterns": duplicated_patterns,
        "duplication_ratio_pct": duplication_ratio,
        "file_loc": file_loc,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Analyze static maintainability metrics of CI variants."
    )

    parser.add_argument(
        "--ref",
        default="main-6p-ci-v1",
        help="Git ref containing the frozen CI configuration.",
    )

    parser.add_argument(
        "--output-dir",
        default="experiments/results/maintainability",
    )

    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    results = []

    print(f"Frozen configuration: {args.ref}")
    print()

    for variant, files in VARIANTS.items():
        result = calculate_variant(args.ref, variant, files)
        results.append(result)

        print(f"=== {variant.upper()} ===")

        for path, loc in result["file_loc"].items():
            print(f"{path}: {loc} YAML LOC")

        print(f"Files: {result['files']}")
        print(f"Total YAML LOC: {result['yaml_loc']}")
        print(f"Duplicate LOC: {result['duplicate_loc']}")
        print(
            f"Duplicated line patterns: "
            f"{result['duplicated_patterns']}"
        )
        print(
            f"Duplication ratio: "
            f"{result['duplication_ratio_pct']:.2f}%"
        )
        print()

    output_file = output_dir / "static-metrics.csv"

    with output_file.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "variant",
                "files",
                "yaml_loc",
                "duplicate_loc",
                "duplicated_patterns",
                "duplication_ratio_pct",
            ],
        )

        writer.writeheader()

        for result in results:
            writer.writerow(
                {
                    "variant": result["variant"],
                    "files": result["files"],
                    "yaml_loc": result["yaml_loc"],
                    "duplicate_loc": result["duplicate_loc"],
                    "duplicated_patterns":
                        result["duplicated_patterns"],
                    "duplication_ratio_pct":
                        f"{result['duplication_ratio_pct']:.2f}",
                }
            )

    print(f"Results saved to {output_file}")


if __name__ == "__main__":
    main()
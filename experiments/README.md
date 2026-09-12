# Eksperimentalna infrastruktura

Ovaj direktorij sadrži skripte, konfiguracije, rasporede i rezultate eksperimentalne usporedbe triju načina organizacije GitHub Actions CI konfiguracije:

- **Baseline (B)**
- **Composite Actions (C)**
- **Reusable Workflow (R)**

Eksperimentalna infrastruktura razdvaja postojeći pilot eksperiment od glavnog potvrđujućeg eksperimenta.

## Struktura

```text
experiments/
├── README.md
├── configs/
│   ├── pilot-3p.yaml
│   └── main-6p-ci.yaml
├── schedules/
│   ├── pilot-3p-observed.csv
│   └── main-6p-ci.csv
├── run-experiment.py
├── validate-results.py
├── analysis/
│   ├── analyze-results.py
│   ├── analyze-pilot.py
│   ├── analyze-confirmatory.py
│   └── generate-plots.py
└── results/
    ├── pilot-3p/
    │   ├── runs.csv
    │   ├── raw/
    │   ├── metrics/
    │   └── analysis/
    │       ├── summary.csv
    │       ├── paired-results.csv
    │       └── figures/
    └── main-6p-ci/
        ├── runs.csv
        ├── raw/
        ├── metrics/
        └── analysis/
            ├── summary.csv
            ├── primary-comparisons.csv
            ├── omnibus.csv
            ├── secondary-comparisons.csv
            └── figures/
```

## Preduvjeti

Za izvođenje eksperimenta potrebni su:

- Python 3
- Git
- GitHub CLI (`gh`)
- autentificiran GitHub CLI
- pristup repozitoriju i GitHub Actions radnim tokovima

Za analizu su dodatno potrebni paketi:

```powershell
py -m pip install numpy scipy matplotlib
```

Provjera GitHub CLI autentifikacije:

```powershell
gh auth status
```

## Zamrznuta revizija

Pilot i glavni CI eksperiment koriste istu zamrznutu reviziju aplikacije i CI radnog opterećenja:

```text
ref: experiment-v2
SHA: a693c3be73089c158f0cb556b9358606c895662a
```

Prije pokretanja glavnog eksperimenta revizija se može provjeriti naredbom:

```powershell
git rev-parse experiment-v2^{}
```

Dobivena vrijednost mora odgovarati navedenom SHA-u.

## Pilot 3P

Postojeći skup mjerenja tretira se kao pilot eksperiment. Koristi tri opažene kružne permutacije:

- B-C-R
- C-R-B
- R-B-C

Svaka se pojavljuje deset puta, ukupno 30 rundi i 90 mjerenih izvođenja. Uz njih postoje po jedno warm-up izvođenje za svaku varijantu.

Postojeći pilot rezultati nisu mijenjani i nalaze se u:

```text
experiments/results/pilot-3p/runs.csv
```

Raspored opažen u pilotu zapisan je u:

```text
experiments/schedules/pilot-3p-observed.csv
```

### Validacija pilota

```powershell
py experiments/validate-results.py experiments/results/pilot-3p/runs.csv --schedule experiments/schedules/pilot-3p-observed.csv --expected-sha a693c3be73089c158f0cb556b9358606c895662a --expect-warmup
```

### Deskriptivna analiza pilota

```powershell
py experiments/analysis/analyze-results.py experiments/results/pilot-3p/runs.csv
```

### Uparena eksploratorna analiza pilota

```powershell
py experiments/analysis/analyze-pilot.py experiments/results/pilot-3p/runs.csv
```

### Grafovi pilota

```powershell
py experiments/analysis/generate-plots.py experiments/results/pilot-3p/runs.csv
```

## Glavni 6P-CI eksperiment

Glavni potvrđujući eksperiment koristi svih šest mogućih permutacija triju varijanti:

- B-C-R
- B-R-C
- C-B-R
- C-R-B
- R-B-C
- R-C-B

Svaka permutacija unaprijed je određena pet puta, što daje 30 rundi i 90 mjerenih izvođenja.

Raspored se nalazi u:

```text
experiments/schedules/main-6p-ci.csv
```

`run-experiment.py` ne generira raspored tijekom izvođenja. Skripta čita unaprijed spremljeni raspored i izvršava varijante redom zadanim u toj datoteci.

### Pokretanje glavnog eksperimenta

Iz korijena repozitorija:

```powershell
py experiments/run-experiment.py --schedule experiments/schedules/main-6p-ci.csv --ref experiment-v2 --results-dir experiments/results/main-6p-ci
```

Skripta prije mjerenih rundi izvodi po jedan warm-up za svaku varijantu, osim ako je zadan `--skip-warmup`.

Ako se izvođenje prekine nakon što je GitHub Actions run već pokrenut, stanje aktivnog izvođenja čuva se u `active_run.json`. Pri ponovnom pokretanju skripta pokušava dovršiti prikupljanje tog izvođenja i preskače već evidentirane kombinacije runde i varijante.

## Podaci jednog eksperimenta

### `runs.csv`

Glavni tablični skup podataka. Jedan red predstavlja jedno GitHub Actions izvođenje. Sadrži identifikatore izvođenja, varijantu, rundu, poziciju u rasporedu, SHA, zaključak i izvedbene metrike.

### `raw/`

Sadrži detaljnije sirove JSON podatke dohvaćene za pojedina GitHub Actions izvođenja.

### `metrics/`

Sadrži JSON artefakte vlastite instrumentacije unutarnjih CI faza. Ti podaci koriste se kako bi se iste unutarnje faze mjerile na usporediv način u svim trima konfiguracijskim varijantama.

## Validacija glavnog skupa

Nakon završetka glavnog eksperimenta:

```powershell
py experiments/validate-results.py experiments/results/main-6p-ci/runs.csv --schedule experiments/schedules/main-6p-ci.csv --expected-sha a693c3be73089c158f0cb556b9358606c895662a --expect-warmup --check-artifact-files
```

Validator provjerava, među ostalim:

- očekivani broj zapisa
- jedinstvenost GitHub `run_id` vrijednosti
- očekivani SHA
- jednu pojavu svake varijante u svakoj rundi
- točan redoslijed prema unaprijed definiranom rasporedu
- prisutnost potrebnih metrika kod uspješnih izvođenja
- warm-up izvođenja
- fizičku prisutnost `raw` i `metrics` JSON datoteka kada je zadan `--check-artifact-files`

## Analiza glavnog 6P-CI eksperimenta

### Deskriptivna analiza

```powershell
py experiments/analysis/analyze-results.py experiments/results/main-6p-ci/runs.csv
```

Rezultat:

```text
experiments/results/main-6p-ci/analysis/summary.csv
```

### Potvrđujuća analiza

```powershell
py experiments/analysis/analyze-confirmatory.py experiments/results/main-6p-ci/runs.csv
```

Primarna metrika je:

```text
workload_duration_sec
```

Primarne usporedbe:

- B-C
- B-R

Za njih se računaju:

- upareni permutacijski test
- bootstrap 95 % interval pouzdanosti razlike
- Cohenov d_z
- Holmova korekcija p-vrijednosti primarnih usporedbi

Friedmanov test koristi se kao dopunski omnibus test i ne uvjetuje izvođenje ni tumačenje primarnih B-C i B-R usporedbi.

Usporedba C-R je sekundarna i ne ulazi u Holmovu korekciju.

Rezultati se spremaju u:

```text
experiments/results/main-6p-ci/analysis/primary-comparisons.csv
experiments/results/main-6p-ci/analysis/omnibus.csv
experiments/results/main-6p-ci/analysis/secondary-comparisons.csv
```

### Grafovi

```powershell
py experiments/analysis/generate-plots.py experiments/results/main-6p-ci/runs.csv
```

Grafovi se spremaju u:

```text
experiments/results/main-6p-ci/analysis/figures/
```

## Konfiguracijske datoteke

`configs/pilot-3p.yaml` i `configs/main-6p-ci.yaml` opisuju identitet eksperimenta, zamrznutu reviziju, raspored, odredišni direktorij rezultata i plan analize. Raspored izvođenja ostaje zasebno zapisan u CSV datotekama kako bi bio lako provjerljiv i neovisan o programskoj logici izvođača.

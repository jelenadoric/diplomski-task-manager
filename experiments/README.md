# Eksperimentalna infrastruktura

Ovaj direktorij sadrži skripte, konfiguracije, rasporede i rezultate eksperimentalne usporedbe triju načina organizacije GitHub Actions CI konfiguracije:

- **Baseline (B)**
- **Composite Actions (C)**
- **Reusable Workflow (R)**

Eksperimentalna infrastruktura razdvaja postojeći pilot eksperiment od glavnog potvrđujućeg eksperimenta te uključuje zasebnu analizu održavanja konfiguracije.

## Struktura

```text
experiments/
├── README.md
├── methodology.md
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
│   ├── analyze-maintainability.py
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
    ├── main-6p-ci/
    │   ├── runs.csv
    │   ├── raw/
    │   ├── metrics/
    │   └── analysis/
    │       ├── summary.csv
    │       ├── primary-comparisons.csv
    │       ├── omnibus.csv
    │       ├── secondary-comparisons.csv
    │       └── figures/
    └── maintainability/
        ├── change-scenarios.csv
        ├── static-metrics.csv
        └── summary.csv
```

## Preduvjeti

Za izvođenje eksperimenta potrebni su:

- Python 3
- Git
- GitHub CLI (`gh`)
- autentificiran GitHub CLI
- pristup repozitoriju i GitHub Actions radnim tokovima

Za analizu su dodatno potrebni Python paketi:

```powershell
py -m pip install numpy scipy matplotlib
```

Provjera GitHub CLI autentifikacije:

```powershell
gh auth status
```

## Zamrznute revizije

Pilot i glavni eksperiment koriste zasebne zamrznute revizije.

### Pilot 3P

Pilot 3P izveden je nad revizijom:

```text
ref: experiment-v2
SHA: a693c3be73089c158f0cb556b9358606c895662a
```

Revizija se može provjeriti naredbom:

```powershell
git rev-list -n 1 experiment-v2
```

Pilot rezultati nisu ponovno mjereni niti mijenjani nakon stvaranja nove revizije za glavni eksperiment.

### Glavni 6P-CI

Prije glavnog eksperimenta CI radno opterećenje usklađeno je između sva tri pristupa. Posebno je verzija Node.js-a izjednačena na Node.js 20 kako razlika u verziji runtimea ne bi predstavljala dodatnu eksperimentalnu varijablu.

Glavni eksperiment izveden je nad revizijom:

```text
ref: main-6p-ci-v1
SHA: 185a06c38179a8efaeece6a3409bdb11192c1819
```

Revizija se može provjeriti naredbom:

```powershell
git rev-list -n 1 main-6p-ci-v1
```

Dobivena vrijednost mora odgovarati navedenom SHA-u.

## Pilot 3P

Postojeći skup mjerenja tretira se kao pilot eksperiment.

Pilot koristi tri kružne permutacije:

- B-C-R
- C-R-B
- R-B-C

Svaka se pojavljuje deset puta, što daje ukupno:

```text
3 permutacije × 10 ponavljanja = 30 rundi
30 rundi × 3 varijante = 90 mjerenih izvođenja
```

Uz mjerenja postoje i tri warm-up izvođenja, po jedno za svaku varijantu.

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

Validirani pilot skup sadrži:

```text
93 ukupna zapisa
90 mjerenih izvođenja
90 uspješnih mjerenih izvođenja
30 Baseline izvođenja
30 Composite izvođenja
30 Reusable izvođenja
```

### Deskriptivna analiza pilota

```powershell
py experiments/analysis/analyze-results.py experiments/results/pilot-3p/runs.csv
```

### Uparena eksploratorna analiza pilota

```powershell
py experiments/analysis/analyze-pilot.py experiments/results/pilot-3p/runs.csv
```

Pilot analiza tretira se kao eksploratorna i odvojena je od potvrđujuće analize glavnog eksperimenta.

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

Svaka permutacija unaprijed je određena pet puta.

Time se dobiva:

```text
6 permutacija × 5 ponavljanja = 30 rundi
30 rundi × 3 varijante = 90 mjerenih izvođenja
```

Uz mjerenja se izvode i tri warm-up izvođenja, po jedno za svaku varijantu.

Raspored glavnog eksperimenta nalazi se u:

```text
experiments/schedules/main-6p-ci.csv
```

`run-experiment.py` ne generira redoslijed izvođenja tijekom eksperimenta. Skripta čita unaprijed spremljeni raspored i izvršava varijante redom zadanim u CSV datoteci.

Time je plan eksperimenta odvojen od programske logike izvođača i može se reproducirati bez izmjene skripte.

### Pokretanje glavnog eksperimenta

Iz korijena repozitorija:

```powershell
py experiments/run-experiment.py --schedule experiments/schedules/main-6p-ci.csv --ref main-6p-ci-v1 --results-dir experiments/results/main-6p-ci
```

Skripta prije mjerenih rundi izvodi po jedan warm-up za svaku varijantu, osim ako je eksplicitno zadan `--skip-warmup`.

Ako se izvođenje prekine nakon što je GitHub Actions run već pokrenut, stanje aktivnog izvođenja čuva se u `active_run.json`.

Pri ponovnom pokretanju skripta pokušava dovršiti prikupljanje aktivnog izvođenja i preskače već evidentirane kombinacije runde i varijante.

## Podaci eksperimenta

### `runs.csv`

Glavni tablični skup podataka.

Jedan red predstavlja jedno GitHub Actions izvođenje i sadrži podatke kao što su:

- varijanta
- runda
- pozicija u rasporedu
- GitHub run ID
- Git SHA
- status izvođenja
- vrijeme čekanja
- trajanje radnog opterećenja
- trajanje backend posla
- trajanje frontend posla
- vrijeme korištenja runnera
- trajanja pojedinih unutarnjih CI faza

### `raw/`

Sadrži detaljne sirove JSON podatke prikupljene za pojedina GitHub Actions izvođenja.

### `metrics/`

Sadrži JSON podatke dobivene vlastitom instrumentacijom unutarnjih CI faza.

Vlastita instrumentacija koristi se kako bi se iste faze mjerile na usporediv način u svim trima konfiguracijskim varijantama.

## Validacija glavnog skupa

Nakon završetka glavnog eksperimenta koristi se:

```powershell
py experiments/validate-results.py experiments/results/main-6p-ci/runs.csv --schedule experiments/schedules/main-6p-ci.csv --expected-sha 185a06c38179a8efaeece6a3409bdb11192c1819 --expect-warmup --check-artifact-files
```

Validator provjerava, među ostalim:

- očekivani broj zapisa
- očekivani broj mjerenih izvođenja
- jedinstvenost GitHub `run_id` vrijednosti
- očekivani Git SHA
- prisutnost sve tri varijante u svakoj rundi
- točan redoslijed prema unaprijed definiranom rasporedu
- uspješnost mjerenih izvođenja
- prisutnost potrebnih metrika
- warm-up izvođenja
- fizičku prisutnost `raw` JSON datoteka
- fizičku prisutnost `metrics` JSON datoteka

Glavni 6P-CI skup nakon validacije sadrži:

```text
93 ukupna zapisa
90 mjerenih izvođenja
90 uspješnih mjerenih izvođenja
30 Baseline izvođenja
30 Composite izvođenja
30 Reusable izvođenja
```

Svaka od šest permutacija pojavljuje se točno pet puta.

## Analiza glavnog 6P-CI eksperimenta

### Deskriptivna analiza

Pokretanje:

```powershell
py experiments/analysis/analyze-results.py experiments/results/main-6p-ci/runs.csv
```

Rezultat se sprema u:

```text
experiments/results/main-6p-ci/analysis/summary.csv
```

Za primarnu metriku `workload_duration_sec` dobivene su sljedeće deskriptivne vrijednosti:

| Varijanta | Srednja vrijednost | Medijan | Minimum | Maksimum | Standardna devijacija | P95 |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | 57.20 s | 53.50 s | 47.00 s | 91.00 s | 10.51 s | 78.30 s |
| Composite | 55.90 s | 54.00 s | 47.00 s | 81.00 s | 8.65 s | 71.05 s |
| Reusable | 54.10 s | 53.00 s | 47.00 s | 82.00 s | 7.38 s | 67.80 s |

### Primarna metrika

Primarna izvedbena metrika je:

```text
workload_duration_sec
```

Ona predstavlja trajanje usporedivog CI radnog opterećenja i ne uključuje vrijeme čekanja na dodjelu GitHub-hosted runnera.

Vrijeme čekanja bilježi se zasebno kroz `queue_delay_sec`.

Tijekom glavnog eksperimenta jedno Reusable izvođenje imalo je izrazito dugo čekanje na dodjelu runnera. Budući da se queue delay ne uključuje u primarnu metriku `workload_duration_sec`, taj infrastrukturni događaj ne određuje primarnu usporedbu izvedbe.

### Potvrđujuća analiza

Pokretanje:

```powershell
py experiments/analysis/analyze-confirmatory.py experiments/results/main-6p-ci/runs.csv
```

Analiza koristi 30 potpunih uspješnih uparenih rundi.

Primarne usporedbe su:

- Baseline – Composite (B-C)
- Baseline – Reusable (B-R)

Za primarne usporedbe računaju se:

- upareni permutacijski test
- bootstrap 95 % interval pouzdanosti razlike
- Cohenov `d_z`
- Holmova korekcija p-vrijednosti

Holmova korekcija primjenjuje se samo na dvije unaprijed definirane primarne usporedbe B-C i B-R.

Friedmanov test koristi se kao dopunski omnibus test i ne uvjetuje izvođenje niti interpretaciju primarnih usporedbi.

Usporedba Composite – Reusable (C-R) tretira se kao sekundarna i ne uključuje se u Holmovu korekciju.

Rezultati se spremaju u:

```text
experiments/results/main-6p-ci/analysis/primary-comparisons.csv
experiments/results/main-6p-ci/analysis/omnibus.csv
experiments/results/main-6p-ci/analysis/secondary-comparisons.csv
```

### Rezultati primarnih usporedbi

Za B-C dobiveno je:

```text
mean difference = +1.30 s
95 % CI = [-2.37, +5.63]
p = 0.58376
Holm-adjusted p = 0.58376
Cohen dz = +0.115
```

Za B-R dobiveno je:

```text
mean difference = +3.10 s
95 % CI = [-1.63, +7.97]
p = 0.23458
Holm-adjusted p = 0.46916
Cohen dz = +0.227
```

Razlika je definirana kao prva varijanta minus druga varijanta. Pozitivna vrijednost zato znači da je prva navedena varijanta u prosjeku trajala dulje.

Na razini značajnosti `α = 0.05` nijedna primarna usporedba nije statistički značajna nakon Holmove korekcije.

Rezultat se ne tumači kao dokaz jednakosti pristupa, nego kao izostanak statistički značajne razlike u promatranoj primarnoj metrici u provedenom eksperimentu.

### Friedmanov test

Dopunski omnibus rezultat:

```text
statistic = 0.1261
p = 0.93888
```

Friedmanov test ne pokazuje statistički značajnu ukupnu razliku između triju varijanti.

### Sekundarna usporedba C-R

Za Composite – Reusable dobiveno je:

```text
mean difference = +1.80 s
95 % CI = [-1.87, +5.53]
p = 0.36835
Cohen dz = +0.170
```

Ni sekundarna usporedba nije statistički značajna na razini `α = 0.05`.

### Grafovi

Pokretanje:

```powershell
py experiments/analysis/generate-plots.py experiments/results/main-6p-ci/runs.csv
```

Grafovi se spremaju u:

```text
experiments/results/main-6p-ci/analysis/figures/
```

Generirane su datoteke:

```text
paired-workload-differences.png
runner-time-boxplot.png
workload-duration-boxplot.png
workload-duration-by-round.png
```

## Analiza održavanja

Uz mjerenje izvedbe provedena je i analiza održavanja CI konfiguracije.

Analiza obuhvaća:

- statičke metrike konfiguracije
- kontrolirani scenarij promjene M1
- kontrolirani scenarij promjene M2
- funkcionalnu provjeru svake izmjene

Statičke metrike računaju se nad zamrznutom revizijom:

```text
main-6p-ci-v1
```

### Statičke metrike

Pokretanje:

```powershell
py experiments/analysis/analyze-maintainability.py
```

Skripta analizira konfiguracijske datoteke pojedine varijante i računa:

- broj datoteka
- YAML LOC
- tekstualno duplicirane YAML retke
- broj različitih dupliciranih obrazaca redaka
- udio tekstualne dupliciranosti

YAML LOC definiran je kao broj nepraznih YAML redaka koji nisu puni komentari.

Kod analize tekstualne dupliciranosti zanemaruje se početno uvlačenje retka. Ako se identičan normalizirani YAML redak pojavljuje više puta, prva pojava smatra se izvornom, a svaka dodatna pojava dupliciranim retkom.

Ova metrika predstavlja tekstualnu dupliciranost YAML konfiguracije, a ne potpunu semantičku dupliciranost CI logike.

Dobiveni rezultati:

| Varijanta | Datoteke | YAML LOC | Duplicate LOC | Duplicirani obrasci | Udio dupliciranosti |
|---|---:|---:|---:|---:|---:|
| Baseline | 1 | 160 | 43 | 19 | 26.88 % |
| Composite | 3 | 215 | 67 | 22 | 31.16 % |
| Reusable | 2 | 166 | 45 | 21 | 27.11 % |

Rezultati se spremaju u:

```text
experiments/results/maintainability/static-metrics.csv
```

### Kontrolirani scenariji promjene

Provedena su dva međusobno neovisna scenarija promjene.

Oba scenarija polaze od iste zamrznute revizije `main-6p-ci-v1`.

#### M1 – promjena verzije Node.js-a

```text
Node.js 20 → 22
```

#### M2 – promjena verzije PostgreSQL-a

```text
PostgreSQL 16 → 17
```

Za svaki scenarij i svaku varijantu bilježeni su:

- broj izmijenjenih datoteka
- broj neovisnih mjesta promjene
- broj dodanih redaka
- broj obrisanih redaka
- ukupni diff LOC
- rezultat funkcionalne provjere

Jedno mjesto promjene predstavlja jednu neovisnu lokaciju u CI konfiguraciji na kojoj je potrebno promijeniti ciljanu vrijednost.

`diff LOC` definiran je kao:

```text
broj dodanih redaka + broj obrisanih redaka
```

### Rezultati M1 i M2

| Scenarij | Varijanta | Izmijenjene datoteke | Mjesta promjene | Dodano | Obrisano | Diff LOC | Provjera |
|---|---|---:|---:|---:|---:|---:|---|
| M1 | Baseline | 1 | 2 | 2 | 2 | 4 | PASS |
| M1 | Composite | 2 | 2 | 2 | 2 | 4 | PASS |
| M1 | Reusable | 1 | 2 | 2 | 2 | 4 | PASS |
| M2 | Baseline | 1 | 1 | 1 | 1 | 2 | PASS |
| M2 | Composite | 1 | 1 | 1 | 1 | 2 | PASS |
| M2 | Reusable | 1 | 1 | 1 | 1 | 2 | PASS |

Svaki scenarij i svaka varijanta funkcionalno su provjereni zasebnim GitHub Actions izvođenjem.

Rezultati se spremaju u:

```text
experiments/results/maintainability/change-scenarios.csv
experiments/results/maintainability/summary.csv
```

## Konfiguracijske datoteke

`configs/pilot-3p.yaml` i `configs/main-6p-ci.yaml` opisuju identitet eksperimenta, zamrznutu reviziju, raspored, odredišni direktorij rezultata i plan analize.

Rasporedi izvođenja zasebno su zapisani u CSV datotekama kako bi eksperimentalni plan bio lako provjerljiv i neovisan o programskoj logici izvođača.

## Reprodukcija analize

### Pilot

Validacija:

```powershell
py experiments/validate-results.py experiments/results/pilot-3p/runs.csv --schedule experiments/schedules/pilot-3p-observed.csv --expected-sha a693c3be73089c158f0cb556b9358606c895662a --expect-warmup
```

Analiza:

```powershell
py experiments/analysis/analyze-results.py experiments/results/pilot-3p/runs.csv
py experiments/analysis/analyze-pilot.py experiments/results/pilot-3p/runs.csv
py experiments/analysis/generate-plots.py experiments/results/pilot-3p/runs.csv
```

### Glavni 6P-CI eksperiment

Validacija:

```powershell
py experiments/validate-results.py experiments/results/main-6p-ci/runs.csv --schedule experiments/schedules/main-6p-ci.csv --expected-sha 185a06c38179a8efaeece6a3409bdb11192c1819 --expect-warmup --check-artifact-files
```

Analiza:

```powershell
py experiments/analysis/analyze-results.py experiments/results/main-6p-ci/runs.csv
py experiments/analysis/analyze-confirmatory.py experiments/results/main-6p-ci/runs.csv
py experiments/analysis/generate-plots.py experiments/results/main-6p-ci/runs.csv
```

### Održavanje

```powershell
py experiments/analysis/analyze-maintainability.py
```
# Coding agent comparison

Use identical starting files and acceptance cases. On a Git checkout, record the
commit and use separate checkouts; otherwise keep explicit snapshot copies.
Keep evaluation acceptance cases independent from the implementer's editable tests.

## Configuration

* Date:
* Agent product / version:
* Exact model / effort setting:
* Rules and skills actually loaded:
* Starting snapshot / dependency lockfiles:
* Environment change being evaluated:

## Representative tasks

| Task | Observable acceptance and failure cases | Allowed scope |
| --- | --- | --- |
| Small feature | | |
| Bug regression | | |
| API contract change | | |
| Unfamiliar-code diagnosis | | |

## Results

| Task / configuration | First-pass acceptance | Regressions | Human repair minutes | Elapsed time | Cost (if available) | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## Decision

* Repeated failure patterns:
* Improvement supported by these results:
* Remaining uncertainty / next comparison:

Change one factor at a time: environment first with model fixed, then model with
environment fixed. Repeat tasks when results are inconsistent. A small sample
informs this workflow; it does not establish a universal model ranking.

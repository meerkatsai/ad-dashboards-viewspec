# View Spec — on-demand living charts

The contract for **on-demand generated charts**: a user asks ("spend allocation across
placements"), the router produces the DSL `query_task`, and **code derives everything else** —
the chart's navigable space, its representation, and its interactions. The LLM doesn't decide
how to show data; the rules do. If the first view isn't what the user meant, the chart itself is
the correction: pivot the dim, swap the fact, re-grain, drill — one click, no re-prompt.
Generated charts join the same **pin/unpin lifecycle** as the prebuilt library.

Companions: [ad-dashboards-prebuilt](https://github.com/meerkatsai/ad-dashboards-prebuilt)
(the standing library; pinning a generated chart writes its card-definition there) ·
[ad-platform-dashboards-aligned](https://github.com/meerkatsai/ad-platform-dashboards-aligned)
(UI components + DSL-aligned card schemas).

## The three-part contract (`schema/view-spec-v1.schema.json`)

| Part | What | Who authors it |
| --- | --- | --- |
| `query` | The DSL `query_task` currently backing the view | Router (from the prompt); then rewritten by interactions |
| `envelope` | The **navigable space**: facts (canonical metric keys), dims with drill edges, grains, gold/bronze source | **Code** (`generator/derive.py` from catalog + `rules/drill-graph.json`) |
| `view` | Current presentation: intent, representation, x/y/series, sort, compare | **Rules** (`rules/representation-rules.json`, first match wins) |

## The living-chart loop

```
prompt ─router→ query_task ─derive→ view_spec ─execute query→ rows ─render→ chart
                                        ▲                                    │
                                        └──── interaction (drill/pivot/…) ───┘
```

Every gesture is a **deterministic query rewrite** (`rules/interactions.json`), validated
against the envelope before execution — clicking outside the declared dims/facts/grains is
rejected, and widening beyond the envelope is a *new prompt*, not an interaction. No LLM ever
runs at interaction time. Drills compose as a breadcrumb of `where` predicates (the undo trail).

Worked example (in `examples/`, generated + validated):
`placement-spend` — "spend allocation across placements" → composition intent → **vertical bars
with share chips** (placement is low-cardinality; there is no pie in this system) → user clicks
*Top of Search* → `placement-drill-products` — `where placement eq …` + dim swap →
**ranked horizontal bars** of products by spend/ROAS, limit 10. Same executor both times.

## Representation rules (`rules/representation-rules.json`)

Ordered, first match wins — the same data shape always gets the same chart:

| Shape / intent | Chart |
| --- | --- |
| cohort intent (cohort dim × age grain) | cohort matrix (values printed, sequential ramp) |
| flow intent, ≥2 stage dims | Sankey (additive fact only) |
| composition, 2 dims, additive fact | Marimekko |
| facts, no dims, no time | KPI (delta context always on) |
| fact × time | line (+compare) |
| fact × low-cardinality dim | vertical bars (+share when composition) |
| fact × high-cardinality dim | ranked horizontal bars, limit 10 |
| fact × two dims | heatmap |
| anything else | table |

Hard constraints baked in (the do's/don'ts as machine-readable `constraints`): **no pie/donut/
area**, same-shape-same-chart, every number carries a delta, precision caps (money 0 dp, rates
2 dp), status color on deltas only (invert-aware), max 2 facts per chart (tables exempt),
non-additive facts (ROAS, reach, ratios) never stack/never size a Marimekko/never blend across
platforms, provisional days labeled.

## Regenerating / CI

```bash
python3 generator/derive.py --examples   # rebuild examples/ (deterministic)
python3 generator/derive.py --check      # fail on drift, schema violations, or a broken containment guard
```

`generator/derive.py` is also the reference implementation of `derive()` (query → envelope →
view) and `apply()` (interaction → new spec) — the dev ports these two functions; the schemas
and rules files are the spec they port against.

#!/usr/bin/env python3
"""View-spec derivation — CODE builds the spec, the LLM barely thinks.

derive(query, platform, intent) -> view_spec:
  envelope: facts looked up from the catalog (canonical metric keys), dims from the query's
            dimensions closed over rules/drill-graph.json edges, grains fixed by the gold
            day-grain rollup rule, source per the grain rule.
  view:     rules/representation-rules.json evaluated against the shape — first match wins.
apply(spec, interaction) -> new view_spec, per rules/interactions.json, CONTAINED to the
            envelope (raises on anything outside it).

Ambiguity policy: no questions, ever. Missing intent defaults from shape (temporal -> trend,
categorical -> comparison, none -> kpi); a wrong first view costs the user one click.

  python3 generator/derive.py --examples   # regenerate examples/ (deterministic)
  python3 generator/derive.py --check      # CI: regenerate + verify no drift + validate
"""
import copy, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
GRAINS = ["date", "week", "month"]
BRONZE_GRAINS = {"keyword", "search_term", "placement", "advertised_asin", "fsn", "product",
                 "sku", "creative", "ad", "match_type"}
NON_ADDITIVE = {"roas", "roi", "direct_roi", "indirect_roi", "acos", "ctr", "cvr", "cpc",
                "avg_cpc", "cpm", "cpi", "aov", "reach", "frequency", "conv_rate",
                "cost_per_conv", "cost_per_purchase", "conv_value_per_cost", "mer", "spend_share"}


def load(rel):
    return json.loads((ROOT / rel).read_text())


def catalog_facts(platform, keys):
    """Canonical fact defs for the requested metric keys, from the aligned catalog."""
    cat = load("generator/catalog.json")
    known = {}
    for report in cat.get(platform, {}).get("reports", []):
        for m in report["metrics"]:
            known.setdefault(m["key"], m)
    facts = []
    for k in keys:
        m = known.get(k, {"key": k, "label": k, "unit": "num"})
        facts.append({"key": k, "label": m["label"], "unit": m["unit"],
                      **({"invert": True} if m.get("invert") else {}),
                      "additive": k not in NON_ADDITIVE})
    return facts


def envelope_for(query, platform):
    graph = load("rules/drill-graph.json")["dims"].get(platform, {})
    task = query["task"]
    qdims = [d for d in task.get("dimensions", []) if d not in GRAINS]
    # empty-envelope guard: a dimension-less query seeds from the entity's natural children
    # (account/campaign -> campaign, store -> channel) so breakout/drill always has somewhere to go
    seed = qdims or {"account": ["campaign"], "campaign": ["campaign"], "store": ["channel"]}.get(task["entity"], [])
    # closure: seed dims + everything reachable over drill edges
    keys, frontier = [], list(seed)
    while frontier:
        k = frontier.pop(0)
        if k in keys or k not in graph:
            continue
        keys.append(k)
        frontier += graph[k].get("drill_to", [])
    dims = [{"key": k, "label": graph[k]["label"], "kind": graph[k]["kind"],
             "cardinality": graph[k]["cardinality"], "drill_to": graph[k]["drill_to"]}
            for k in keys]
    grain_keys = set(qdims) | {task["entity"]}
    return {"platform": platform, "entity": task["entity"],
            "facts": catalog_facts(platform, task["metrics"]),
            "dims": dims, "grains": GRAINS,
            "source": "bronze" if grain_keys & BRONZE_GRAINS else "gold"}


def default_intent(query, envelope):
    task = query["task"]
    temporal = any(d in GRAINS for d in task.get("dimensions", []))
    categorical = [d for d in task.get("dimensions", []) if d not in GRAINS]
    if not categorical and not temporal:
        return "kpi"
    if temporal and not categorical:
        return "trend"
    return "comparison"


def choose_view(query, envelope, intent):
    task = query["task"]
    facts = envelope["facts"]
    primary = task.get("sort", {}).get("metric") or facts[0]["key"]
    grain = next((d for d in task.get("dimensions", []) if d in GRAINS), None)
    cats = [d for d in envelope["dims"] if d["key"] in task.get("dimensions", [])]
    view = {"intent": intent}
    if intent == "cohort":
        view.update(representation="cohort_matrix", x=cats[0]["key"] if cats else "first_order_month",
                    series="month", y=[primary])
    elif intent == "flow" and len(cats) >= 2:
        view.update(representation="sankey", x=cats[0]["key"], series=cats[1]["key"], y=[primary])
    elif intent == "composition" and len(cats) == 2 and all(f["additive"] for f in facts if f["key"] == primary):
        view.update(representation="marimekko", x=cats[0]["key"], series=cats[1]["key"], y=[primary])
    elif intent == "kpi" or (not cats and not grain):
        view.update(representation="kpi", y=[f["key"] for f in facts][:4] or [primary], compare=True)
    elif grain and not cats:
        view.update(representation="line", x=grain, y=[primary], compare=True)
    elif grain and len(cats) == 1 and cats[0]["cardinality"] == "low":
        view.update(representation="line", x=grain, series=cats[0]["key"], y=[primary])
    elif len(cats) == 1 and cats[0]["cardinality"] == "low":
        view.update(representation="bars_v", x=cats[0]["key"], y=[primary])
        if intent == "composition" and next(f["additive"] for f in facts if f["key"] == primary):
            view["share"] = True
    elif len(cats) == 1:
        inv = any(f["key"] == primary and f.get("invert") for f in facts)
        view.update(representation="bars_h", x=cats[0]["key"], y=[primary],
                    sort={"by": primary, "direction": "asc" if inv else "desc"}, limit=10)
    elif len(cats) == 2:
        view.update(representation="heatmap", x=cats[0]["key"], series=cats[1]["key"], y=[primary])
    else:
        view.update(representation="table", y=[f["key"] for f in facts],
                    sort={"by": primary, "direction": "desc"}, limit=10)
    return view


def derive(query, platform, intent=None, title=None):
    env = envelope_for(query, platform)
    intent = intent or default_intent(query, env)
    spec = {"version": "1.0", "query": query, "envelope": env,
            "view": choose_view(query, env, intent), "pin": {"pinnable": True}}
    if title:
        spec = {"version": "1.0", "title": title, **{k: v for k, v in spec.items() if k != "version"}}
    return spec


def apply(spec, interaction):
    """Deterministic interaction -> new spec, contained to the envelope."""
    env = spec["envelope"]
    dim_keys = {d["key"] for d in env["dims"]}
    fact_keys = {f["key"] for f in env["facts"]}
    new = copy.deepcopy(spec)
    task = new["query"]["task"]
    t = interaction["type"]
    if t == "drill":
        # single-dim mark: {on_dim, value}; 2-dim mark (heatmap cell / marimekko block): filters[]
        filters = interaction.get("filters") or [{"dim": interaction["on_dim"], "value": interaction["value"]}]
        dst = interaction["to"]
        for f in filters:
            if f["dim"] not in dim_keys:
                raise ValueError(f"dim {f['dim']} is outside the envelope")
        if not any(dst in d["drill_to"] for d in env["dims"] if d["key"] in {f["dim"] for f in filters}):
            raise ValueError(f"drill ->{dst} is outside the envelope's drill graph")
        for f in filters:
            task.setdefault("where", []).append({"dimension": f["dim"], "operator": "eq", "value": f["value"]})
        task["dimensions"] = [d for d in task.get("dimensions", []) if d in GRAINS] + [dst]
    elif t == "pivot_dim":
        if interaction["to"] not in dim_keys:
            raise ValueError("pivot target dim outside envelope")
        task["dimensions"] = [d for d in task.get("dimensions", []) if d in GRAINS] + [interaction["to"]]
    elif t == "pivot_fact":
        if interaction["to"] not in fact_keys:
            raise ValueError("pivot target fact outside envelope")
        if interaction["to"] not in task["metrics"]:
            task["metrics"].append(interaction["to"])
        if "sort" in task:
            task["sort"]["metric"] = interaction["to"]
    elif t == "regrain":
        if interaction["to"] not in GRAINS:
            raise ValueError("unknown grain")
        task["dimensions"] = [interaction["to"] if d in GRAINS else d for d in task.get("dimensions", [interaction["to"]])]
    elif t == "rerange":
        task["time_range"] = interaction["date_range"]
    elif t == "toggle_compare":
        if "comparison" in task:
            task.pop("comparison")
        else:
            task["comparison"] = {"metric": task["metrics"][0], "baseline": "previous_period"}
    else:
        raise ValueError(f"unhandled interaction {t}")
    new["view"] = choose_view(new["query"], env, new["view"]["intent"])
    return new


# ── examples: the worked scenario + the three "popular" shapes ───────────────

def build_examples():
    tr30 = {"type": "relative", "value": 30, "unit": "day"}
    # 1. "spend allocation across placements" (amazon)
    q1 = {"version": "1.0", "task_type": "query",
          "task": {"entity": "campaign", "metrics": ["spend", "roas"],
                   "dimensions": ["placement"], "time_range": tr30}}
    spec1 = derive(q1, "amazon", intent="composition", title="Spend allocation across placements")
    # 2. the drill: click 'Placement Top' -> products within it
    spec2 = apply(spec1, {"type": "drill", "on_dim": "placement",
                          "value": "Placement Top", "to": "advertised_asin"})
    spec2["title"] = "Products within Top of Search — spend & ROAS"
    # 3. cohort: repeat purchase by first-order month (shopify)
    q3 = {"version": "1.0", "task_type": "query",
          "task": {"entity": "store", "metrics": ["orders"],
                   "dimensions": ["first_order_month", "month"],
                   "time_range": {"type": "relative", "value": 6, "unit": "month"}}}
    spec3 = derive(q3, "shopify", intent="cohort", title="Repeat orders by first-order cohort")
    # 4. sankey: funnel flow (meta, stage dims)
    q4 = {"version": "1.0", "task_type": "query",
          "task": {"entity": "account", "metrics": ["purchases"],
                   "dimensions": ["funnel_stage"], "time_range": tr30}}
    spec4 = derive(q4, "shopify", intent="flow", title="Funnel flow — sessions to purchase")
    spec4["view"] = {"intent": "flow", "representation": "sankey", "x": "funnel_stage",
                     "series": "funnel_stage", "y": ["purchases"]}
    # 5. marimekko: spend share, campaign x placement (flipkart)
    q5 = {"version": "1.0", "task_type": "query",
          "task": {"entity": "campaign", "metrics": ["spend"],
                   "dimensions": ["placement", "match_type"], "time_range": tr30}}
    spec5 = derive(q5, "flipkart", intent="composition", title="Spend share — placement × match type")
    return {"placement-spend.spec.json": spec1,
            "placement-drill-products.spec.json": spec2,
            "cohort-repeat-orders.spec.json": spec3,
            "sankey-funnel.spec.json": spec4,
            "marimekko-spend-share.spec.json": spec5}


def validate(files):
    try:
        import jsonschema
        from referencing import Registry, Resource
    except ImportError:
        print("jsonschema not installed — skipping validation (CI must not skip)")
        return
    vs = load("schema/view-spec-v1.schema.json")
    qa = load("schema/dsl/query_and_act-v1.schema.json")
    reg = Registry().with_resources([(s["$id"], Resource.from_contents(s)) for s in (vs, qa)])
    v = jsonschema.Draft202012Validator(vs, registry=reg)
    bad = 0
    for name, spec in files.items():
        for err in list(v.iter_errors(spec))[:1]:
            bad += 1
            print(f"INVALID {name}: {err.json_path} {err.message[:120]}")
    # containment must reject an out-of-envelope drill
    try:
        apply(files["placement-spend.spec.json"], {"type": "drill", "on_dim": "placement",
                                                    "value": "x", "to": "creative"})
        bad += 1
        print("CONTAINMENT FAILED: out-of-envelope drill was accepted")
    except ValueError:
        pass
    if bad:
        sys.exit(f"{bad} failure(s)")
    print(f"validated {len(files)} specs + containment guard: all pass")


def main():
    check = "--check" in sys.argv
    files = build_examples()
    stale = 0
    outdir = ROOT / "examples"
    outdir.mkdir(exist_ok=True)
    for name, spec in files.items():
        content = json.dumps(spec, indent=1, ensure_ascii=False) + "\n"
        path = outdir / name
        if (path.read_text() if path.exists() else None) != content:
            stale += 1
            if not check:
                path.write_text(content)
    validate(files)
    if check and stale:
        sys.exit(f"{stale} example(s) stale — run generator/derive.py --examples")
    print(f"{len(files)} example specs; {stale} {'stale' if check else 'written'}")


if __name__ == "__main__":
    main()

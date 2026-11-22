"""Write the fixed map and Quick find queries for performance checks (REWRITE_PLAN.md, "Performance recipe").

    python tests/make_perf_map.py

Seeded, so it always writes the same files: tests/fixtures/perf-map.json
(10 suns, 12 planets each, 8 moons each, plus a 2-sun team map) and
tests/fixtures/perf-queries.json (five queries chosen from the map).
"""

import json
import random
from pathlib import Path

SEED = 2026
FIXTURES = Path(__file__).resolve().parent / "fixtures"
WORDS = ("alpha bravo cobalt delta ember falcon granite harbor indigo jasper kestrel lumen meridian nimbus onyx "
         "pioneer quartz raven summit tundra umber vertex willow xenon yarrow zephyr atlas beacon cinder drift "
         "echo fjord glacier horizon island juniper keystone lantern mosaic nectar orbit prism quill relay sierra").split()
TAGS = ("daily", "docs", "ops", "build", "review", "lab", "metrics", "team")


def name(rng, words=2):
    return " ".join(rng.choice(WORDS).title() for _ in range(words))


def slug(text):
    return text.lower().replace(" ", "-")


def destination(rng, label, host):
    item = {"name": label, "url": f"https://{host}.example.test/{slug(label)}"}
    if rng.random() < 0.3:
        item["tags"] = sorted(set(rng.sample(TAGS, rng.randint(1, 2))))
    if rng.random() < 0.15:
        item["note"] = f"Check {rng.choice(WORDS)} before the {rng.choice(WORDS)} review"
    return item


def make_sun(rng, index, planets, moons, prefix=""):
    sun_name = f"{prefix}{name(rng)} {index + 1}"
    links = []
    for p in range(planets):
        planet = destination(rng, f"{name(rng)} {p + 1}", slug(sun_name))
        planet["moons"] = [destination(rng, f"{name(rng, 1)} {m + 1}", slug(sun_name)) for m in range(moons)]
        links.append(planet)
    return {"id": slug(sun_name), "name": sun_name, "description": f"Generated sun {index + 1}",
            "color": f"#{rng.randrange(0x404040, 0xffffff):06x}", "links": links}


def main():
    rng = random.Random(SEED)
    personal = {"groups": [make_sun(rng, s, 12, 8) for s in range(10)]}
    team = {"groups": [make_sun(rng, s, 6, 2, prefix="Team ") for s in range(2)]}
    planets = [planet for sun in personal["groups"] for planet in sun["links"]]
    first = planets[17]["name"].split()[0].lower()
    two = " ".join(planets[45]["name"].lower().split()[:2])
    word = next(w for w in planets[80]["name"].lower().split() if len(w) >= 5)
    typo = word[0] + word[2] + word[1] + word[3:]  # a swapped pair of letters
    queries = [first, two, typo, "#" + TAGS[0], "zzzz nothing matches"]
    FIXTURES.mkdir(parents=True, exist_ok=True)
    (FIXTURES / "perf-map.json").write_text(json.dumps({"seed": SEED, "personal": personal, "team": team}, indent=1) + "\n")
    (FIXTURES / "perf-queries.json").write_text(json.dumps({"seed": SEED, "queries": queries}, indent=2) + "\n")
    moons = sum(len(p["moons"]) for p in planets)
    print(f"wrote perf-map.json ({len(personal['groups'])} suns, {len(planets)} planets, {moons} moons, "
          f"{len(team['groups'])} team suns) and perf-queries.json {queries}")


if __name__ == "__main__":
    main()

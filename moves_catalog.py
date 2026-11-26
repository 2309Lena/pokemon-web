import functools
import json
import os

_MOVES_JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "species_moves.json")
if os.path.exists(_MOVES_JSON_PATH):
    with open(_MOVES_JSON_PATH, "r", encoding="utf-8") as _f:
        CANON_SPECIES_MOVES = json.load(_f)
else:
    CANON_SPECIES_MOVES = {}

# Comprehensive canonical move pools across all 18 Pokemon types.
# Each entry: (name, base_power, accuracy, crit_bonus)
TYPE_MOVE_POOLS = {
    "normal": [
        ("Quick Attack", 48, 100, 0.08),
        ("Slash", 70, 100, 0.16),
        ("Body Slam", 85, 100, 0.08),
        ("Hyper Fang", 80, 95, 0.10),
        ("Extreme Speed", 85, 100, 0.12),
        ("Double-Edge", 110, 92, 0.08),
        ("Hyper Beam", 125, 88, 0.08),
        ("Giga Impact", 125, 88, 0.10),
    ],
    "fire": [
        ("Ember", 48, 100, 0.06),
        ("Flame Charge", 60, 100, 0.08),
        ("Flame Wheel", 68, 100, 0.08),
        ("Fire Fang", 72, 95, 0.10),
        ("Lava Plume", 82, 100, 0.08),
        ("Blaze Kick", 88, 95, 0.18),
        ("Flamethrower", 92, 100, 0.08),
        ("Heat Wave", 98, 92, 0.08),
        ("Fire Blast", 112, 88, 0.08),
        ("Flare Blitz", 118, 92, 0.10),
    ],
    "water": [
        ("Water Gun", 48, 100, 0.06),
        ("Aqua Jet", 58, 100, 0.10),
        ("Water Pulse", 68, 100, 0.08),
        ("Bubble Beam", 72, 100, 0.08),
        ("Razor Shell", 78, 95, 0.12),
        ("Waterfall", 84, 100, 0.08),
        ("Scald", 86, 100, 0.08),
        ("Surf", 92, 100, 0.08),
        ("Aqua Tail", 95, 92, 0.08),
        ("Hydro Pump", 112, 88, 0.08),
    ],
    "grass": [
        ("Vine Whip", 50, 100, 0.06),
        ("Magical Leaf", 64, 100, 0.08),
        ("Razor Leaf", 68, 95, 0.16),
        ("Seed Bomb", 80, 100, 0.08),
        ("Giga Drain", 82, 100, 0.08),
        ("Energy Ball", 90, 100, 0.08),
        ("Leaf Blade", 92, 100, 0.18),
        ("Power Whip", 112, 88, 0.08),
        ("Solar Beam", 118, 90, 0.08),
    ],
    "electric": [
        ("Thunder Shock", 48, 100, 0.06),
        ("Shock Wave", 64, 100, 0.08),
        ("Spark", 68, 100, 0.08),
        ("Thunder Fang", 72, 95, 0.10),
        ("Discharge", 82, 100, 0.08),
        ("Wild Charge", 90, 95, 0.08),
        ("Thunderbolt", 92, 100, 0.08),
        ("Thunder", 112, 86, 0.08),
        ("Volt Tackle", 118, 92, 0.10),
    ],
    "ice": [
        ("Ice Shard", 54, 100, 0.10),
        ("Icy Wind", 62, 98, 0.08),
        ("Aurora Beam", 70, 100, 0.08),
        ("Ice Fang", 72, 95, 0.10),
        ("Ice Punch", 80, 100, 0.08),
        ("Freeze-Dry", 82, 100, 0.08),
        ("Icicle Crash", 88, 92, 0.08),
        ("Ice Beam", 92, 100, 0.08),
        ("Blizzard", 112, 86, 0.08),
    ],
    "fighting": [
        ("Mach Punch", 55, 100, 0.10),
        ("Karate Chop", 64, 100, 0.16),
        ("Brick Break", 78, 100, 0.08),
        ("Drain Punch", 80, 100, 0.08),
        ("Cross Chop", 94, 90, 0.18),
        ("Aura Sphere", 90, 100, 0.08),
        ("Superpower", 110, 92, 0.08),
        ("Close Combat", 116, 94, 0.08),
    ],
    "poison": [
        ("Poison Sting", 48, 100, 0.08),
        ("Acid Spray", 58, 100, 0.08),
        ("Venoshock", 72, 100, 0.08),
        ("Poison Fang", 72, 95, 0.10),
        ("Cross Poison", 78, 100, 0.18),
        ("Poison Jab", 84, 100, 0.08),
        ("Sludge Bomb", 92, 100, 0.08),
        ("Gunk Shot", 112, 86, 0.08),
    ],
    "ground": [
        ("Mud Shot", 58, 98, 0.08),
        ("Bulldoze", 68, 100, 0.08),
        ("Bone Club", 72, 95, 0.08),
        ("Dig", 80, 100, 0.08),
        ("Drill Run", 84, 95, 0.16),
        ("Earth Power", 92, 100, 0.08),
        ("High Horsepower", 95, 95, 0.08),
        ("Earthquake", 104, 100, 0.08),
    ],
    "flying": [
        ("Gust", 50, 100, 0.06),
        ("Aerial Ace", 66, 100, 0.10),
        ("Wing Attack", 68, 100, 0.08),
        ("Air Cutter", 70, 95, 0.16),
        ("Air Slash", 80, 95, 0.08),
        ("Acrobatics", 86, 100, 0.08),
        ("Brave Bird", 112, 92, 0.08),
        ("Hurricane", 112, 86, 0.08),
    ],
    "psychic": [
        ("Confusion", 54, 100, 0.06),
        ("Psybeam", 68, 100, 0.08),
        ("Psycho Cut", 76, 100, 0.18),
        ("Zen Headbutt", 82, 95, 0.08),
        ("Extrasensory", 84, 100, 0.08),
        ("Psyshock", 88, 100, 0.08),
        ("Psychic", 94, 100, 0.08),
        ("Future Sight", 114, 92, 0.08),
    ],
    "bug": [
        ("Struggle Bug", 54, 100, 0.08),
        ("Bug Bite", 64, 100, 0.08),
        ("Silver Wind", 70, 100, 0.08),
        ("Signal Beam", 78, 100, 0.08),
        ("X-Scissor", 84, 100, 0.10),
        ("Lunge", 84, 100, 0.08),
        ("Bug Buzz", 92, 100, 0.08),
        ("Megahorn", 112, 88, 0.08),
    ],
    "rock": [
        ("Rock Throw", 54, 96, 0.08),
        ("Rock Tomb", 66, 95, 0.08),
        ("Ancient Power", 70, 100, 0.08),
        ("Power Gem", 82, 100, 0.08),
        ("Rock Slide", 82, 95, 0.08),
        ("Stone Edge", 102, 88, 0.18),
        ("Head Smash", 120, 84, 0.08),
    ],
    "ghost": [
        ("Shadow Sneak", 56, 100, 0.10),
        ("Hex", 70, 100, 0.08),
        ("Ominous Wind", 70, 100, 0.08),
        ("Shadow Claw", 78, 100, 0.18),
        ("Shadow Ball", 88, 100, 0.08),
        ("Phantom Force", 96, 96, 0.08),
        ("Poltergeist", 108, 90, 0.08),
    ],
    "dragon": [
        ("Dragon Breath", 62, 100, 0.08),
        ("Breaking Swipe", 68, 100, 0.08),
        ("Dragon Claw", 82, 100, 0.10),
        ("Dragon Pulse", 88, 100, 0.08),
        ("Dragon Rush", 100, 88, 0.08),
        ("Outrage", 114, 94, 0.08),
        ("Draco Meteor", 122, 88, 0.08),
    ],
    "dark": [
        ("Bite", 62, 100, 0.08),
        ("Night Slash", 76, 100, 0.18),
        ("Throat Chop", 82, 100, 0.08),
        ("Crunch", 84, 100, 0.08),
        ("Dark Pulse", 86, 100, 0.08),
        ("Sucker Punch", 82, 100, 0.12),
        ("Foul Play", 95, 98, 0.08),
    ],
    "steel": [
        ("Bullet Punch", 56, 100, 0.10),
        ("Metal Claw", 60, 98, 0.08),
        ("Smart Strike", 74, 100, 0.08),
        ("Iron Head", 84, 100, 0.08),
        ("Flash Cannon", 86, 100, 0.08),
        ("Iron Tail", 96, 86, 0.10),
        ("Meteor Mash", 96, 94, 0.10),
    ],
    "fairy": [
        ("Fairy Wind", 50, 100, 0.06),
        ("Draining Kiss", 62, 100, 0.08),
        ("Dazzling Gleam", 82, 100, 0.08),
        ("Play Rough", 92, 95, 0.10),
        ("Moonblast", 98, 100, 0.08),
        ("Misty Explosion", 106, 95, 0.08),
    ],
}

COVERAGE_BY_PRIMARY = {
    "normal": ["fighting", "ground", "dark"],
    "fire": ["fighting", "dragon", "ground"],
    "water": ["ice", "ground", "dark"],
    "grass": ["poison", "ground", "fairy"],
    "electric": ["steel", "flying", "ice"],
    "ice": ["water", "ground", "psychic"],
    "fighting": ["rock", "dark", "steel"],
    "poison": ["dark", "ground", "bug"],
    "ground": ["rock", "steel", "fire"],
    "flying": ["fighting", "steel", "electric"],
    "psychic": ["fairy", "ghost", "fighting"],
    "bug": ["poison", "flying", "grass"],
    "rock": ["ground", "steel", "fire"],
    "ghost": ["dark", "psychic", "poison"],
    "dragon": ["fire", "steel", "electric"],
    "dark": ["fighting", "ghost", "poison"],
    "steel": ["rock", "ground", "fighting"],
    "fairy": ["psychic", "fire", "ghost"],
}

# Signature moves for iconic Pokemon & Legendaries across Gen 1-9
SIGNATURE_MOVES = {
    3: ("Frenzy Plant", "grass", 118, 92, 0.10),
    6: ("Blast Burn", "fire", 118, 92, 0.10),
    9: ("Hydro Cannon", "water", 118, 92, 0.10),
    25: ("Volt Tackle", "electric", 108, 96, 0.15),
    26: ("Thunderbolt Strike", "electric", 105, 100, 0.14),
    59: ("Extreme Speed", "normal", 92, 100, 0.15),
    65: ("Psychic Kinesis", "psychic", 104, 100, 0.12),
    68: ("Dynamic Punch", "fighting", 106, 92, 0.14),
    94: ("Shadow Vortex", "ghost", 106, 100, 0.14),
    130: ("Aqua Tempest", "water", 105, 96, 0.12),
    131: ("Freeze-Dry Melody", "ice", 98, 100, 0.12),
    143: ("Pulverizing Pancake", "normal", 116, 96, 0.10),
    144: ("Freezing Glare", "ice", 108, 98, 0.12),
    145: ("Thunderous Gale", "electric", 110, 96, 0.12),
    146: ("Fiery Wrath", "fire", 110, 96, 0.12),
    149: ("Dragon Comet", "dragon", 114, 96, 0.12),
    150: ("Psystrike", "psychic", 124, 100, 0.15),
    151: ("Genesis Supernova", "psychic", 122, 100, 0.15),
    248: ("Mountain Crusher", "rock", 112, 94, 0.15),
    249: ("Aeroblast", "flying", 118, 96, 0.18),
    250: ("Sacred Fire", "fire", 118, 96, 0.14),
    254: ("Leaf Blade Tempest", "grass", 108, 100, 0.20),
    257: ("Blaze Kick Supreme", "fire", 108, 96, 0.18),
    260: ("Muddy Tsunami", "water", 106, 96, 0.12),
    282: ("Moonlight Singularity", "fairy", 106, 100, 0.12),
    376: ("Meteor Mash Zero", "steel", 110, 96, 0.14),
    382: ("Origin Pulse", "water", 124, 92, 0.12),
    383: ("Precipice Blades", "ground", 124, 92, 0.12),
    384: ("Dragon Ascent", "flying", 128, 98, 0.15),
    445: ("Sandstorm Fang", "dragon", 112, 96, 0.14),
    448: ("Aura Sphere Alpha", "fighting", 108, 100, 0.16),
    483: ("Roar of Time", "dragon", 128, 92, 0.14),
    484: ("Spacial Rend", "dragon", 122, 96, 0.20),
    487: ("Shadow Force", "ghost", 124, 96, 0.12),
    491: ("Dark Void Pulse", "dark", 116, 94, 0.14),
    493: ("Judgment", "normal", 132, 100, 0.15),
    643: ("Blue Flare", "fire", 128, 92, 0.12),
    644: ("Bolt Strike", "electric", 128, 92, 0.12),
    658: ("Water Shuriken Barrage", "water", 106, 100, 0.20),
    681: ("King's Blade", "steel", 108, 100, 0.16),
    700: ("Pixilate Voice", "fairy", 104, 100, 0.12),
    716: ("Geomancy Blast", "fairy", 124, 100, 0.14),
    717: ("Oblivion Wing", "dark", 120, 98, 0.12),
    718: ("Core Enforcer", "dragon", 124, 98, 0.12),
    778: ("Play Rough Ambush", "fairy", 102, 98, 0.16),
    784: ("Clanging Scales", "dragon", 112, 98, 0.12),
    791: ("Sunsteel Strike", "steel", 122, 100, 0.12),
    792: ("Moongeist Beam", "ghost", 122, 100, 0.12),
    809: ("Double Iron Bash", "steel", 124, 98, 0.14),
    887: ("Dragon Darts", "dragon", 112, 100, 0.15),
    888: ("Behemoth Blade", "steel", 128, 100, 0.16),
    889: ("Behemoth Bash", "steel", 124, 100, 0.12),
    890: ("Eternabeam", "dragon", 132, 92, 0.12),
    892: ("Wicked Blow", "dark", 116, 100, 0.35),
    908: ("Flower Trick", "grass", 102, 100, 0.40),
    911: ("Torch Song", "fire", 104, 100, 0.12),
    914: ("Aqua Step", "water", 102, 100, 0.12),
    936: ("Armor Cannon", "fire", 116, 98, 0.12),
    937: ("Bitter Blade", "fire", 112, 100, 0.15),
    959: ("Gigaton Hammer", "steel", 126, 94, 0.12),
    964: ("Jet Punch", "water", 108, 100, 0.15),
    1007: ("Collision Course", "fighting", 128, 100, 0.16),
    1008: ("Electro Drift", "electric", 128, 100, 0.16),
}


@functools.lru_cache(maxsize=1500)
def _build_cached_moves(species_id, primary, secondary, tier, bst):
    h = (species_id * 2654435761) & 0xFFFFFFFF
    pool1 = TYPE_MOVE_POOLS.get(primary, TYPE_MOVE_POOLS["normal"])
    tier_boost = {
        "Common": 0,
        "Uncommon": 4,
        "Rare": 8,
        "Epic": 14,
        "Legendary": 20,
        "Mythic": 24,
    }.get(tier, 0)

    moves = []
    used_names = set()

    # 1. Signature / Heavy Primary Move (unique per species via curated dict or seeded index + power tune)
    if species_id in SIGNATURE_MOVES:
        sname, stype, spow, sacc, scrit = SIGNATURE_MOVES[species_id]
        moves.append({
            "name": sname,
            "type": stype,
            "power": spow,
            "acc": sacc,
            "crit_bonus": scrit,
            "role": "Signature",
        })
        used_names.add(sname)
    else:
        heavy_cands = pool1[len(pool1) // 2:]
        m1 = heavy_cands[h % len(heavy_cands)]
        pow1 = min(126, max(65, m1[1] + tier_boost - 4 + ((species_id % 7) - 3)))
        moves.append({
            "name": m1[0],
            "type": primary,
            "power": pow1,
            "acc": m1[2],
            "crit_bonus": m1[3],
            "role": "Chủ lực",
        })
        used_names.add(m1[0])

    # 2. Fast Accurate STAB Move of Primary Type
    light_cands = [m for m in pool1[: max(2, len(pool1) // 2 + 1)] if m[0] not in used_names] or pool1
    m2 = light_cands[(h >> 5) % len(light_cands)]
    pow2 = max(46, m2[1] + tier_boost // 2 + (species_id % 5))
    moves.append({
        "name": m2[0],
        "type": primary,
        "power": pow2,
        "acc": 100,
        "crit_bonus": max(0.10, m2[3]),
        "role": "Tốc độ",
    })
    used_names.add(m2[0])

    # 3. Dual-Type Move OR Tailored Coverage Type Move
    cov_choices = COVERAGE_BY_PRIMARY.get(primary, ["dark", "normal", "rock"])
    cov_type = secondary if secondary else cov_choices[(h >> 9) % len(cov_choices)]
    pool3 = [m for m in TYPE_MOVE_POOLS.get(cov_type, TYPE_MOVE_POOLS["normal"]) if m[0] not in used_names]
    m3 = pool3[(h >> 12) % len(pool3)]
    pow3 = max(58, m3[1] + tier_boost // 2 + ((species_id * 3) % 6) - 2)
    moves.append({
        "name": m3[0],
        "type": cov_type,
        "power": pow3,
        "acc": m3[2],
        "crit_bonus": m3[3],
        "role": "Phủ hệ",
    })
    used_names.add(m3[0])

    # 4. Finisher / Off-Type Surprise Move
    alt_cov_type = cov_choices[((h >> 15) + 1) % len(cov_choices)]
    if alt_cov_type == cov_type:
        alt_cov_type = "normal" if cov_type != "normal" else "dark"
    pool4 = [m for m in TYPE_MOVE_POOLS.get(alt_cov_type, TYPE_MOVE_POOLS["normal"]) if m[0] not in used_names]
    if not pool4:
        pool4 = [m for m in TYPE_MOVE_POOLS["normal"] if m[0] not in used_names]
    m4 = pool4[(h >> 18) % len(pool4)]
    pow4 = max(55, m4[1] + tier_boost // 2)
    moves.append({
        "name": m4[0],
        "type": alt_cov_type,
        "power": pow4,
        "acc": m4[2],
        "crit_bonus": m4[3],
        "role": "Chiến thuật",
    })

    return tuple(moves)


def build_moves_for_species(species_id, pokemon_by_id):
    canon = CANON_SPECIES_MOVES.get(str(int(species_id)))
    if canon:
        return [dict(m) for m in canon]
    sp = pokemon_by_id.get(species_id) or pokemon_by_id[25]
    types = sp.get("types") or ["normal"]
    primary = types[0]
    secondary = types[1] if len(types) > 1 else None
    tier = sp.get("tier", "Common")
    bst = sp.get("bst", 300)
    return [dict(m) for m in _build_cached_moves(int(species_id), primary, secondary, tier, bst)]

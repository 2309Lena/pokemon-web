import functools
import hashlib
import json
import os
import random
import re
from collections import deque

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

with open(os.path.join(DATA_DIR, "pokemon_master.json"), "r", encoding="utf-8") as f:
    POKEMON_LIST = json.load(f)

POKEMON_BY_ID = {p["id"]: p for p in POKEMON_LIST}
POKEMON_BY_SLUG = {p["slug"]: p for p in POKEMON_LIST}

# Build evolution forward map: parent_id -> [child_ids]
EVOLUTIONS_FORWARD = {}
for p in POKEMON_LIST:
    parent = p.get("evolves_from")
    if parent:
        EVOLUTIONS_FORWARD.setdefault(parent, []).append(p["id"])

with open(os.path.join(DATA_DIR, "world_countries.json"), "r", encoding="utf-8") as f:
    RAW_COUNTRIES = json.load(f)

# Iconic characteristic Pokémon pinned strictly to specific countries (exclusive to that country!)
CURATED_EXCLUSIVES = {
    "Japan": [25, 131, 658, 478, 503],           # Pikachu, Lapras, Greninja, Froslass, Samurott
    "China": [674, 675, 448, 889],               # Pancham, Pangoro, Lucario, Zamazenta
    "South Korea": [196, 892, 937],              # Espeon, Urshifu, Ceruledge
    "Vietnam": [384, 357, 497, 812],             # Rayquaza, Tropius, Serperior, Rillaboom
    "Thailand": [106, 763, 876],                 # Hitmonlee, Tsareena, Indeedee
    "India": [879, 308, 232],                    # Copperajah, Medicham, Donphan
    "Indonesia": [784, 911, 706],                # Kommo-o, Skeledirge, Goodra
    "Philippines": [745, 766, 941],              # Lycanroc, Passimian, Kilowattrel
    "Mongolia": [78, 750, 902],                  # Rapidash, Mudsdale, Basculegion
    "Nepal": [460, 473, 1004],                   # Abomasnow, Mamoswine, Chi-Yu
    "Saudi Arabia": [330, 637, 954],             # Flygon, Volcarona, Rabsca
    "United Arab Emirates": [248, 450, 844],     # Tyranitar, Hippowdon, Sandaconda
    "Turkey": [59, 668, 727],                    # Arcanine, Pyroar, Incineroar
    "United Kingdom": [865, 855, 836, 888],      # Sirfetch'd, Polteageist, Boltund, Zacian
    "France": [676, 700, 685, 716],              # Furfrou, Sylveon, Slurpuff, Xerneas
    "Germany": [681, 707, 823],                  # Aegislash, Klefki, Corviknight
    "Spain": [964, 1007, 475],                   # Palafin, Koraidon, Gallade
    "Italy": [928, 930, 936],                    # Smoliv, Arboliva, Armarouge
    "Greece": [483, 484, 980],                   # Dialga, Palkia, Clodsire
    "Russia": [217, 901, 461],                   # Ursaring, Ursaluna, Weavile
    "Norway": [863, 713, 365],                   # Perrserker, Avalugg, Walrein
    "Sweden": [376, 614, 975],                   # Metagross, Beartic, Cetitan
    "Iceland": [144, 321, 875],                  # Articuno, Wailord, Eiscue
    "Romania": [94, 778, 491],                   # Gengar, Mimikyu, Darkrai
    "Poland": [626, 208, 635],                   # Bouffalant, Steelix, Hydreigon
    "Switzerland": [241, 673, 718],              # Miltank, Gogoat, Zygarde
    "Ukraine": [192, 612, 931],                  # Sunflora, Haxorus, Squawkabilly
    "United States of America": [628, 128, 143, 809],  # Braviary, Tauros, Snorlax, Melmetal
    "Canada": [400, 586, 820],                   # Bibarel, Sawsbuck, Greedent
    "Mexico": [701, 272, 912],                   # Hawlucha, Ludicolo, Quaxly
    "Cuba": [733, 666, 976],                     # Toucannon, Vivillon, Veluza
    "Brazil": [914, 237, 151, 908],              # Quaquaval, Hitmontop, Mew, Meowscarada
    "Argentina": [398, 227, 740],                # Staraptor, Skarmory, Crabominable
    "Peru": [289, 561, 493],                     # Slaking, Sigilyph, Arceus
    "Chile": [395, 754, 1002],                   # Empoleon, Lurantis, Chien-Pao
    "Colombia": [553, 818, 893],                 # Krookodile, Inteleon, Zarude
    "Egypt": [563, 445, 769],                    # Cofagrigus, Garchomp, Sandygast
    "Kenya": [667, 203, 981],                    # Litleo, Girafarig, Farigiraf
    "South Africa": [405, 464, 523],             # Luxray, Rhyperior, Zebstrika
    "Morocco": [323, 839, 952],                  # Camerupt, Coalossal, Scovillain
    "Madagascar": [765, 254, 815],               # Oranguru, Sceptile, Cinderace
    "Nigeria": [776, 623, 949],                  # Turtonator, Golurk, Toedscruel
    "Australia": [115, 775, 257, 466],           # Kangaskhan, Komala, Blaziken, Electivire
    "New Zealand": [84, 85, 832],                # Doduo, Dodrio, Dubwool
    "Antarctica": [144, 378, 974, 875],          # Articuno, Regice, Cetoddle (Note: unique dedup handles overlaps)
}

BIOME_PREFERRED_TYPES = {
    "forest": {"grass", "bug", "normal", "flying", "fairy"},
    "jungle": {"grass", "bug", "poison", "dragon", "fighting"},
    "desert": {"ground", "rock", "fire", "dark", "bug"},
    "mountain": {"rock", "steel", "dragon", "fighting", "flying"},
    "glacier": {"ice", "water", "steel", "psychic"},
    "taiga": {"ice", "normal", "dark", "grass", "ghost"},
    "savanna": {"normal", "electric", "fire", "ground", "fighting"},
    "coast": {"water", "flying", "electric", "dragon"},
}

BIOME_PALETTE = {
    "forest": {"bg": "#1a3b24", "tileA": "#245232", "tileB": "#1f472b", "grass": "#3ea34b", "accent": "#6de079", "label": "Khu Rừng Ôn Đới"},
    "jungle": {"bg": "#113322", "tileA": "#184730", "tileB": "#143d29", "grass": "#22b563", "accent": "#5ef29c", "label": "Rừng Rậm Nhiệt Đới"},
    "desert": {"bg": "#4d381c", "tileA": "#c2944a", "tileB": "#b5873e", "grass": "#d9b061", "accent": "#ffd369", "label": "Sa Mạc Cát Vàng"},
    "mountain": {"bg": "#2b2c38", "tileA": "#4e5063", "tileB": "#444657", "grass": "#73778f", "accent": "#b5bce0", "label": "Dãy Núi Đá Cao"},
    "glacier": {"bg": "#1a334a", "tileA": "#89c2e8", "tileB": "#78b3db", "grass": "#bce3ff", "accent": "#ffffff", "label": "Băng Nguyên Tuyết Phủ"},
    "taiga": {"bg": "#1d2e2b", "tileA": "#32524c", "tileB": "#2b4742", "grass": "#4e8076", "accent": "#9be3d5", "label": "Rừng Lá Kim Phương Bắc"},
    "savanna": {"bg": "#3d3316", "tileA": "#8c762e", "tileB": "#7d6826", "grass": "#b59b3a", "accent": "#ffe066", "label": "Thảo Nguyên Hoang Dã"},
    "coast": {"bg": "#132e4a", "tileA": "#266899", "tileB": "#1f5a87", "grass": "#3da4de", "accent": "#8ee3ff", "label": "Bờ Biển & Đảo Xanh"},
}


def _build_countries():
    # Step 1: Claim all curated exclusives without duplicates across countries
    claimed_global = set()
    countries = []
    name_to_country = {}

    for raw in RAW_COUNTRIES:
        c = dict(raw)
        c["exclusive_pokemon"] = []
        c["local_pool"] = []
        countries.append(c)
        name_to_country[c["name"].lower()] = c

    # Match curated countries first
    for cname, pids in CURATED_EXCLUSIVES.items():
        c = name_to_country.get(cname.lower())
        if not c:
            continue
        for pid in pids:
            if pid in POKEMON_BY_ID and pid not in claimed_global:
                c["exclusive_pokemon"].append(pid)
                claimed_global.add(pid)

    # Step 2: Guarantee EVERY remaining country gets 2-3 unique exclusive Pokemon
    # drawn deterministically from unclaimed species (prioritizing biome match & higher evolutions/notables).
    unclaimed = [p["id"] for p in POKEMON_LIST if p["id"] not in claimed_global]
    rng = random.Random(42026)
    rng.shuffle(unclaimed)

    # Partition remaining species: first ensure every country without exclusives (or <2) gets 2-3 exclusives
    # Reserve remaining unclaimed ~500 species as shared biome regional pools (never colliding with claimed_global).
    for c in countries:
        target_excl = 3 if c["name"] in CURATED_EXCLUSIVES else 2
        pref_types = BIOME_PREFERRED_TYPES.get(c["biome"], {"normal"})
        while len(c["exclusive_pokemon"]) < target_excl and unclaimed:
            # Find first biome-matching species in unclaimed
            picked_idx = None
            for i, pid in enumerate(unclaimed[:80]):
                if set(POKEMON_BY_ID[pid]["types"]) & pref_types:
                    picked_idx = i
                    break
            if picked_idx is None:
                picked_idx = 0
            pid = unclaimed.pop(picked_idx)
            c["exclusive_pokemon"].append(pid)
            claimed_global.add(pid)

    # Ensure there are enough shared species in `unclaimed` for local pools
    shared_pool = unclaimed if len(unclaimed) >= 80 else [
        p["id"] for p in POKEMON_LIST if p["id"] not in claimed_global
    ]

    # Step 3: Populate each country's non-exclusive biome local_pool (8-10 species, strictly non-exclusive!)
    for c in countries:
        pref_types = BIOME_PREFERRED_TYPES.get(c["biome"], {"normal"})
        candidates = [
            pid for pid in shared_pool
            if (set(POKEMON_BY_ID[pid]["types"]) & pref_types) and not POKEMON_BY_ID[pid]["legendary"] and not POKEMON_BY_ID[pid]["mythical"]
        ]
        if len(candidates) < 10:
            candidates.extend(
                pid for pid in shared_pool if pid not in candidates and not POKEMON_BY_ID[pid]["legendary"]
            )
        h = int(hashlib.md5(c["id"].encode("utf-8")).hexdigest()[:8], 16)
        local_rng = random.Random(h)
        sample_count = min(9, len(candidates))
        c["local_pool"] = sorted(local_rng.sample(candidates, sample_count))

    return countries


COUNTRIES = _build_countries()
COUNTRIES_BY_ID = {c["id"]: c for c in COUNTRIES}
EXCLUSIVE_OWNER = {}
for _c in COUNTRIES:
    for _pid in _c["exclusive_pokemon"]:
        EXCLUSIVE_OWNER[_pid] = _c["id"]

PLAYABLE_CONTINENTS = ["Asia", "Europe", "Africa", "North America", "South America", "Oceania"]

WEATHER_DEFS = {
    "sunny": {"label": "☀️ Nắng Ấm", "types": {"grass", "normal", "bug", "fairy", "fire"}, "groundA": "#3c7a3e", "groundB": "#356e37", "grass": "#4fd158"},
    "rain": {"label": "🌧️ Mưa Rào", "types": {"water", "electric", "dragon", "bug"}, "groundA": "#265c52", "groundB": "#205047", "grass": "#22b884"},
    "sandstorm": {"label": "🏜️ Bão Cát", "types": {"ground", "rock", "fire", "steel"}, "groundA": "#c49650", "groundB": "#b88943", "grass": "#d6b05c"},
    "snow": {"label": "❄️ Tuyết Rơi", "types": {"ice", "steel", "psychic", "dark"}, "groundA": "#9ecfe8", "groundB": "#8dc2de", "grass": "#d2f0ff"},
    "mist": {"label": "🌫️ Sương Mù", "types": {"ghost", "fairy", "psychic", "dark", "poison"}, "groundA": "#3b476b", "groundB": "#323d5e", "grass": "#7c6bc4"},
    "storm": {"label": "⛈️ Giông Bão", "types": {"electric", "flying", "dragon", "fighting"}, "groundA": "#314252", "groundB": "#283745", "grass": "#4d8a7a"},
}

BIOME_WEATHERS = {
    "forest": ["sunny", "mist", "rain", "storm"],
    "jungle": ["rain", "sunny", "mist", "storm", "rain"],
    "desert": ["sandstorm", "sunny", "storm", "sandstorm"],
    "mountain": ["snow", "storm", "mist", "sunny", "snow"],
    "glacier": ["snow", "mist", "storm", "snow"],
    "taiga": ["snow", "mist", "sunny", "storm"],
    "savanna": ["sunny", "sandstorm", "storm", "rain"],
    "coast": ["rain", "sunny", "storm", "mist"],
}

CURATED_LANDMARKS = {
    "Vietnam": [
        ("Phố Cổ Hà Nội", "sunny"),
        ("Vịnh Hạ Long", "rain"),
        ("Đỉnh Fansipan Sapa", "snow"),
        ("Hang Sơn Đoòng", "mist"),
        ("Đồng Bằng Sông Cửu Long", "storm"),
    ],
    "Japan": [
        ("Cố Đô Kyoto", "sunny"),
        ("Phố Shibuya Tokyo", "storm"),
        ("Biển Đảo Okinawa", "rain"),
        ("Rừng Trúc Arashiyama", "mist"),
        ("Đỉnh Núi Phú Sĩ", "snow"),
    ],
    "United States of America": [
        ("Công Viên Trung Tâm NY", "sunny"),
        ("Đầm Lầy Everglades", "rain"),
        ("Hẻm Núi Grand Canyon", "sandstorm"),
        ("Rừng Sương Mù Redwood", "mist"),
        ("Dãy Núi Rocky", "snow"),
        ("Thung Lũng Sấm Texas", "storm"),
    ],
    "China": [
        ("Rừng Tre Tứ Xuyên", "sunny"),
        ("Vạn Lý Trường Thành", "storm"),
        ("Sa Mạc Gobi", "sandstorm"),
        ("Thung Lũng Cửu Trại Câu", "rain"),
        ("Hồ Sương Mù Quế Lâm", "mist"),
        ("Cao Nguyên Tây Tạng", "snow"),
    ],
    "Brazil": [
        ("Bãi Biển Copacabana", "sunny"),
        ("Rừng Mưa Amazon", "rain"),
        ("Thác Iguaçu", "storm"),
        ("Vùng Ngập Nước Pantanal", "mist"),
        ("Cao Nguyên Minas", "sandstorm"),
    ],
    "France": [
        ("Thung Lũng Loire", "sunny"),
        ("Bờ Biển Riviera", "rain"),
        ("Rừng Brocéliande", "mist"),
        ("Đỉnh An-pơ Mont Blanc", "snow"),
    ],
    "United Kingdom": [
        ("Thảo Nguyên Cotswolds", "sunny"),
        ("Hồ Sương Mù Loch Ness", "mist"),
        ("Bờ Đá Dover", "rain"),
        ("Cao Nguyên Scotland", "storm"),
    ],
    "Egypt": [
        ("Ốc Đảo Siwa", "sunny"),
        ("Sông Nile Huyền Thoại", "rain"),
        ("Kim Tự Tháp Giza", "sandstorm"),
        ("Hầm Mộ Hoàng Gia", "mist"),
    ],
    "Australia": [
        ("Rạn San Hô Great Barrier", "rain"),
        ("Rừng Mưa Daintree", "sunny"),
        ("Đá Đỏ Uluru Outback", "sandstorm"),
        ("Núi Xanh Blue Mountains", "mist"),
        ("Vịnh Bão Tasman", "storm"),
    ],
    "Russia": [
        ("Thảo Nguyên Sông Volga", "sunny"),
        ("Rừng Taiga Siberi", "mist"),
        ("Hồ Baikal Đóng Băng", "snow"),
        ("Đỉnh Elbrus", "storm"),
        ("Bán Đảo Kamchatka", "rain"),
        ("Bắc Cực Tundra", "snow"),
    ],
    "India": [
        ("Rừng Sundarbans", "rain"),
        ("Sa Mạc Thar", "sandstorm"),
        ("Thung Lũng Sông Hằng", "sunny"),
        ("Đền Cổ Mù Sương", "mist"),
        ("Dãy Himalaya", "snow"),
    ],
    "South Korea": [
        ("Cung Điện Seoul", "sunny"),
        ("Đảo Jeju Gió Biển", "rain"),
        ("Đỉnh Seoraksan", "snow"),
        ("Rừng Đá Huyền Bí", "mist"),
    ],
    "Thailand": [
        ("Vịnh Đảo Phuket", "rain"),
        ("Rừng Xanh Chiang Mai", "sunny"),
        ("Thung Lũng Mây Pai", "mist"),
        ("Bờ Sông Chao Phraya", "storm"),
    ],
    "Germany": [
        ("Thung Lũng Rhine", "sunny"),
        ("Rừng Đen Black Forest", "mist"),
        ("Biển Bắc Friesland", "storm"),
        ("Đỉnh Zugspitze Bavaria", "snow"),
    ],
    "Italy": [
        ("Đồng Quê Tuscany", "sunny"),
        ("Kênh Đào Venice", "rain"),
        ("Đấu Trường Cổ Rome", "sandstorm"),
        ("Đỉnh Tuyết Dolomites", "snow"),
    ],
    "Spain": [
        ("Bờ Biển Costa del Sol", "sunny"),
        ("Cao Nguyên Mancha", "sandstorm"),
        ("Rừng Phép Galicia", "mist"),
        ("Dãy Núi Pyrenees", "snow"),
    ],
    "Canada": [
        ("Thác Niagara", "rain"),
        ("Rừng Lá Phong Ontario", "sunny"),
        ("Hồ Mù Sương Banff", "mist"),
        ("Bắc Cực Yukon", "snow"),
        ("Vịnh Bão Hudson", "storm"),
    ],
    "Mexico": [
        ("Rừng Cổ Maya Yucatán", "rain"),
        ("Sa Mạc Sonora", "sandstorm"),
        ("Thung Lũng Oaxaca", "sunny"),
        ("Núi Lửa Popocatépetl", "storm"),
    ],
    "Indonesia": [
        ("Đảo Thần Bali", "sunny"),
        ("Rừng Mưa Borneo", "rain"),
        ("Núi Lửa Bromo", "storm"),
        ("Đảo Rồng Komodo", "sandstorm"),
        ("Hồ Toba Mù Sương", "mist"),
    ],
    "Kenya": [
        ("Thảo Nguyên Maasai Mara", "sunny"),
        ("Sa Mạc Turkana", "sandstorm"),
        ("Hồ Victoria", "rain"),
        ("Đỉnh Núi Kenya", "snow"),
    ],
    "Antarctica": [
        ("Thềm Băng Ross", "snow"),
        ("Hẻm Núi Bão Tuyết", "storm"),
        ("Hang Pha Lê Nam Cực", "mist"),
        ("Eo Biển Băng Trôi", "rain"),
    ],
}

GENERIC_LANDMARK_TEMPLATES = {
    "sunny": ["Thung Lũng Hoa", "Thảo Nguyên Xanh", "Quảng Trường Nắng", "Đồi Cỏ Gió"],
    "rain": ["Bến Cảng Biển", "Thác Nước Bạc", "Hồ Sông Xanh", "Vịnh San Hô"],
    "sandstorm": ["Cồn Cát Vàng", "Hẻm Đá Đỏ", "Ốc Đảo Cổ", "Bãi Đá Hoang"],
    "snow": ["Đỉnh Tuyết Trắng", "Băng Nguyên Lạnh", "Đèo Sương Băng", "Rừng Thông Tuyết"],
    "mist": ["Rừng Cổ Thụ", "Thánh Tích Mù Sương", "Hang Động Pha Lê", "Khu Rừng Thiêng"],
    "storm": ["Đỉnh Sấm Sét", "Vách Đá Gió", "Vịnh Sóng Lớn", "Cao Nguyên Bão"],
}

SHARED_NON_EXCLUSIVE = [p["id"] for p in POKEMON_LIST if p["id"] not in EXCLUSIVE_OWNER]


def _country_geo_span(c):
    coords = re.findall(r"(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)", c["svg_path"])
    if not coords:
        return 10.0
    xs = [float(x) for x, _ in coords]
    ys = [float(y) for _, y in coords]
    span_x = min(220.0, max(xs) - min(xs))
    span_y = max(ys) - min(ys)
    return (span_x * span_y) ** 0.5


def get_country_landmarks(country_id):
    """Return 2 to 6 landmarks with distinct weathers & expanded Pokémon pools for a country."""
    c = COUNTRIES_BY_ID.get(country_id) or COUNTRIES[0]
    if c["name"] in CURATED_LANDMARKS:
        specs = CURATED_LANDMARKS[c["name"]]
    else:
        span = _country_geo_span(c)
        if span >= 65:
            count = 5
        elif span >= 35:
            count = 4
        elif span >= 16:
            count = 3
        else:
            count = 2
        h = int(hashlib.md5(c["id"].encode("utf-8")).hexdigest()[:8], 16)
        rng = random.Random(h)
        w_opts = BIOME_WEATHERS.get(c["biome"], ["sunny", "rain", "mist", "storm"])
        weathers = []
        for idx in range(count):
            w = w_opts[idx % len(w_opts)]
            weathers.append(w)
        specs = []
        used_names = set()
        for idx, w in enumerate(weathers):
            tlist = GENERIC_LANDMARK_TEMPLATES[w]
            base = tlist[(h + idx) % len(tlist)]
            name = f"{base} {c['name']}" if base in used_names or idx == count - 1 else base
            used_names.add(base)
            specs.append((name, w))

    # Build rich, non-exclusive weather-matched Pokémon pool per landmark!
    landmarks = []
    h_base = int(hashlib.sha1(c["id"].encode("utf-8")).hexdigest()[:8], 16)
    for idx, (lname, weather) in enumerate(specs):
        wdef = WEATHER_DEFS[weather]
        w_types = wdef["types"]
        candidates = [
            pid for pid in SHARED_NON_EXCLUSIVE
            if (set(POKEMON_BY_ID[pid]["types"]) & w_types)
            and (idx == len(specs) - 1 or (not POKEMON_BY_ID[pid]["legendary"] and not POKEMON_BY_ID[pid]["mythical"]))
        ]
        if len(candidates) < 10:
            candidates = SHARED_NON_EXCLUSIVE
        lrng = random.Random(h_base + idx * 97)
        pool = sorted(lrng.sample(candidates, min(10, len(candidates))))
        landmarks.append({
            "id": f"lm_{idx}",
            "name": lname,
            "weather": weather,
            "weather_label": wdef["label"],
            "is_signature": idx == len(specs) - 1,
            "pokemon_pool": pool,
        })
    return landmarks


def pick_starter_country(continent=None):
    """Pick 1 random starting country ONLY inside the chosen continent (all others start locked!)."""
    if continent not in PLAYABLE_CONTINENTS:
        continent = random.choice(PLAYABLE_CONTINENTS)
    pool = [c for c in COUNTRIES if c["continent"] == continent]
    return random.choice(pool)["id"]


def get_country_encounter(country_id, trainer_level=1, force_exclusive=False, zone_id=None, weather=None):
    """Return wild encounter matched to country + current landmark weather, keeping exclusives strict."""
    c = COUNTRIES_BY_ID.get(country_id) or COUNTRIES[0]
    excl = c["exclusive_pokemon"]
    landmarks = get_country_landmarks(c["id"])

    active_lm = None
    if zone_id:
        active_lm = next((lm for lm in landmarks if lm["id"] == zone_id), None)
    if not active_lm and weather:
        active_lm = next((lm for lm in landmarks if lm["weather"] == weather), None)

    pool = list(c["local_pool"])
    if active_lm:
        pool.extend(active_lm["pokemon_pool"])
        pool.extend(active_lm["pokemon_pool"])  # weight landmark weather pool higher!

    excl_chance = 0.55 if (active_lm and active_lm["is_signature"]) else 0.34
    is_exclusive = False
    if excl and (force_exclusive or random.random() < excl_chance or not pool):
        excl_weights = {"Mythic": 2, "Legendary": 4, "Epic": 14, "Rare": 30, "Uncommon": 35, "Common": 45}
        w_list = [excl_weights.get(POKEMON_BY_ID[pid].get("tier", "Rare"), 20) for pid in excl]
        species_id = random.choices(excl, weights=w_list, k=1)[0]
        is_exclusive = True
    else:
        wild_weights = {"Mythic": 1, "Legendary": 2, "Epic": 8, "Rare": 18, "Uncommon": 32, "Common": 48}
        w_list = [wild_weights.get(POKEMON_BY_ID[pid].get("tier", "Common"), 20) for pid in pool]
        species_id = random.choices(pool, weights=w_list, k=1)[0]

    sp = POKEMON_BY_ID[species_id]
    base_lvl = max(3, min(85, trainer_level * 2 + random.randint(-1, 4)))
    if active_lm and active_lm["is_signature"]:
        base_lvl += 2
    if sp["legendary"] or sp["mythical"]:
        base_lvl = max(base_lvl, 12 + trainer_level * 2)
    is_shiny = random.random() < 0.025
    return {
        "species_id": species_id,
        "species": sp,
        "level": base_lvl,
        "is_exclusive": is_exclusive,
        "is_shiny": is_shiny,
        "landmark_name": active_lm["name"] if active_lm else c["name"],
        "weather": active_lm["weather"] if active_lm else "sunny",
    }


@functools.lru_cache(maxsize=256)
def get_country_map_layout(country_id):
    """Generate a rich multi-level Nintendo DS (HGSS/B2W2) style 2D map with terraces, cliffs, waterfalls, bridges, gazebos, fences & roaming Pokemon."""
    c = COUNTRIES_BY_ID.get(country_id) or COUNTRIES[0]
    landmarks = get_country_landmarks(c["id"])
    n_lm = len(landmarks)

    size_table = {
        2: (36, 26),
        3: (44, 30),
        4: (52, 36),
        5: (58, 40),
        6: (64, 44),
    }
    W, H = size_table.get(n_lm, (52, 36))

    seed = int(hashlib.sha256(c["id"].encode("utf-8")).hexdigest()[:8], 16)
    rng = random.Random(seed)

    # Tile codes:
    # 0=grass, 1=tall_grass, 2=tree/obstacle, 3=pokecenter, 4=ace_trainer,
    # 5=water, 6=sand/shore, 7=dirt_road, 8=flowers, 9=wood_bridge, 10=signpost,
    # 11=stairs, 12=cliff_wall, 13=gazebo, 14=park_fence, 15=cave_door,
    # 16=log_stump, 17=lamp_bench, 18=water_rock_lily
    BLOCKED = {2, 5, 12, 13, 14, 16, 17, 18}

    grid = [[0 for _ in range(W)] for _ in range(H)]
    elev = [[0 for _ in range(W)] for _ in range(H)]
    zone_grid = [[0 for _ in range(W)] for _ in range(H)]

    # 1. Rich Multi-Tier Terraced Plateau Layout (so cliffs, stairs & waterfalls appear right inside viewport!)
    mid_y = H // 2 - 2
    for y in range(H):
        for x in range(W):
            if y < 5:
                elev[y][x] = 2
            elif y < mid_y - 1:
                elev[y][x] = 1
            elif x < 10 or x >= W - 10:
                elev[y][x] = 1
            else:
                elev[y][x] = 0

    # Raised central west & east garden plateaus with terraced edges right around landmark plazas
    for y in range(mid_y + 1, H - 5):
        for x in range(11, min(W - 11, 20)):
            if y < H - 8:
                elev[y][x] = 1
        for x in range(max(12, W - 18), W - 10):
            if y < mid_y + 7:
                elev[y][x] = 1

    # 2. Dense Overlapping Double-Row Forest Framing & Natural Interior Tree Clusters
    for y in range(H):
        for x in range(W):
            if x <= 1 or y <= 1 or x >= W - 2 or y >= H - 2:
                grid[y][x] = 2
            elif (x == 2 or y == 2 or x == W - 3 or y == H - 3) and rng.random() < 0.78:
                grid[y][x] = 2

    # 3. Auto-place 3D South-facing Cliff Walls wherever elev drops downward (elev[y-1] > elev[y])
    for y in range(2, H - 2):
        for x in range(2, W - 2):
            if elev[y - 1][x] > elev[y][x]:
                grid[y][x] = 12
                if elev[y - 1][x] == 2 and y - 2 >= 2 and rng.random() < 0.52 and grid[y - 2][x] == 0:
                    grid[y - 2][x] = 2

    # 4. Wide Main North-South River + Stepped Waterfall Drops + West Stream
    rivers_x = [W // 2 + 2]
    if W >= 40:
        rivers_x.append(13)

    for r_idx, base_rx in enumerate(rivers_x):
        cur_rx = base_rx
        river_half = 2 if r_idx == 0 else 1
        for y in range(2, H - 2):
            if y % 5 == 0 and r_idx == 0:
                cur_rx = max(base_rx - 2, min(base_rx + 2, cur_rx + rng.choice([-1, 0, 1])))
            for dx in range(-river_half + 1, river_half + 1):
                rx = cur_rx + dx
                if 2 <= rx < W - 2:
                    grid[y][rx] = 5
                    if r_idx == 0 and y > 4 and elev[y - 1][rx] == elev[y][rx] and rng.random() < 0.11:
                        grid[y][rx] = 18

    # 5. Partition landmarks smoothly across walkable regions
    cols = 2 if n_lm <= 4 else 3
    rows = (n_lm + cols - 1) // cols
    centers = []
    for idx in range(n_lm):
        r_idx = idx // cols
        c_idx = idx % cols
        zx = int((c_idx + 0.5) / cols * (W - 10)) + 5
        zy = int((r_idx + 0.5) / rows * (H - 12)) + 6
        while zx < W - 4 and grid[zy][zx] in (5, 12, 18):
            zx += 2
        if grid[zy][zx] in (2, 5, 12, 18):
            zx = min(W - 5, max(4, zx + 3))
        centers.append((zx, zy))

    for y in range(H):
        for x in range(W):
            best_i = 0
            best_d = 1e9
            for idx, (cx, cy) in enumerate(centers):
                d = (x - cx) ** 2 + (y - cy) ** 2 + rng.randint(-4, 4)
                if d < best_d:
                    best_d = d
                    best_i = idx
            zone_grid[y][x] = best_i

    # 6. Structured Landmark Plazas: Iron Fences, Conical Gazebos, Lamps, Signposts, Rectangular Tall Grass
    for idx, (cx, cy) in enumerate(centers):
        my_elev = elev[cy][cx]
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                px, py = max(3, min(W - 4, cx + dx)), max(3, min(H - 4, cy + dy))
                if grid[py][px] not in (5, 18):
                    elev[py][px] = my_elev
                    grid[py][px] = 7 if abs(dx) <= 1 and abs(dy) <= 1 else 0

        # Add park fences & conical gazebos around ALL plazas so every screen looks built like a Nintendo route park!
        for fx in range(cx - 2, cx + 2):
            fy = cy - 2
            if 3 <= fx < W - 3 and 3 <= fy < H - 3 and grid[fy][fx] in (0, 8):
                grid[fy][fx] = 14
        gx, gy = cx + 2, cy - 1
        if 3 <= gx < W - 3 and 3 <= gy < H - 3 and grid[gy][gx] not in (5, 18, 3, 4):
            grid[gy][gx] = 13

        sx_sign, sy_sign = max(3, cx - 2), max(3, cy)
        if grid[sy_sign][sx_sign] not in (5, 18, 13, 3, 4):
            grid[sy_sign][sx_sign] = 10
        lx, ly = min(W - 4, cx + 2), min(H - 4, cy + 1)
        if grid[ly][lx] in (0, 8):
            grid[ly][lx] = 17

        for ox, oy in ((-5, 2), (3, -4)):
            mx = max(3, min(W - 7, cx + ox))
            my = max(3, min(H - 6, cy + oy))
            for dy in range(3):
                for dx in range(4):
                    tx, ty = mx + dx, my + dy
                    if 3 <= tx < W - 3 and 3 <= ty < H - 3 and grid[ty][tx] == 0:
                        grid[ty][tx] = 1

    # 7. Connect landmarks with 2-tile dirt routes, wooden bridges & cliff staircases!
    def carve_nintendo_route(x0, y0, x1, y1):
        mid_x = x1 if rng.random() < 0.5 else (x0 + x1) // 2
        pts = []
        cx, cy = x0, y0
        while cx != mid_x:
            cx += 1 if mid_x > cx else -1
            pts.append((cx, cy))
        while cy != y1:
            cy += 1 if y1 > cy else -1
            pts.append((cx, cy))
        while cx != x1:
            cx += 1 if x1 > cx else -1
            pts.append((cx, cy))

        for px, py in pts:
            for wdx, wdy in ((0, 0), (1, 0), (0, 1)):
                rx = max(2, min(W - 3, px + wdx))
                ry = max(2, min(H - 3, py + wdy))
                cur = grid[ry][rx]
                if cur in (5, 18):
                    grid[ry][rx] = 9
                elif cur == 12:
                    grid[ry][rx] = 11
                elif cur not in (3, 4, 9, 10, 11):
                    grid[ry][rx] = 7

    for i in range(len(centers) - 1):
        carve_nintendo_route(centers[i][0], centers[i][1], centers[i + 1][0], centers[i + 1][1])
    if len(centers) >= 3:
        carve_nintendo_route(centers[0][0], centers[0][1], centers[-1][0], centers[-1][1])

    # Place 2-3 Cave entrances tucked naturally into south cliff walls!
    caves_placed = 0
    for y in range(4, H - 4):
        for x in range(4, W - 4):
            if grid[y][x] == 12 and grid[y + 1][x] in (0, 7, 8) and grid[y][x - 1] == 12 and grid[y][x + 1] == 12:
                if caves_placed < 3 and rng.random() < 0.18:
                    grid[y][x] = 15
                    caves_placed += 1

    # Cluster small forest groves (2x2 overlapping canopies) + lush flowers, mushrooms & fallen logs!
    for y in range(3, H - 4):
        for x in range(3, W - 4):
            if grid[y][x] != 0:
                continue
            roll = rng.random()
            if roll < 0.055:
                # 2x2 cozy overlapping tree cluster if clear
                for gdy in (0, 1):
                    for gdx in (0, 1):
                        if grid[y + gdy][x + gdx] == 0 and (gdx + gdy == 0 or rng.random() < 0.72):
                            grid[y + gdy][x + gdx] = 2
            elif roll < 0.105:
                grid[y][x] = 2
            elif roll < 0.255:
                grid[y][x] = 8  # Abundant wildflowers & mushrooms!
            elif roll < 0.285:
                grid[y][x] = 16  # Mossy fallen logs & stumps!
            elif roll < 0.30:
                grid[y][x] = 17  # Lamps along routes!

    # 8. Place Spawn, PokéCenter & Ace Trainer with guaranteed front entry access
    sx, sy = centers[0]
    hx, hy = max(3, min(W - 4, sx + 2)), max(3, min(H - 4, sy - 2))
    tx, ty = centers[-1]
    if grid[hy][hx] in (5, 18, 12):
        hx, hy = max(3, sx + 1), min(H - 4, sy + 1)

    grid[sy][sx] = 7
    grid[hy][hx] = 3
    grid[ty][tx] = 4
    if hy + 1 < H - 2 and grid[hy + 1][hx] in BLOCKED:
        grid[hy + 1][hx] = 7
    if ty + 1 < H - 2 and grid[ty + 1][tx] in BLOCKED:
        grid[ty + 1][tx] = 7

    # 9. Guarantee BFS reachability across walkable tiles (not in BLOCKED)
    def bfs():
        seen = {(sx, sy)}
        q = deque([(sx, sy)])
        while q:
            qx, qy = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = qx + dx, qy + dy
                if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and grid[ny][nx] not in BLOCKED:
                    seen.add((nx, ny))
                    q.append((nx, ny))
        return seen

    reach = bfs()
    for target in [(hx, hy), (tx, ty)] + centers:
        if target not in reach:
            carve_nintendo_route(sx, sy, target[0], target[1])
            grid[hy][hx] = 3
            grid[ty][tx] = 4

    # 10. Pick 8 Overworld Roaming Wild Pokemon sprites placed safely on walkable grass/clearings
    reach = bfs()
    walk_candidates = [
        (px, py) for (px, py) in reach
        if grid[py][px] in (0, 1, 8) and abs(px - sx) + abs(py - sy) >= 4
    ]
    rng.shuffle(walk_candidates)
    overworld_pokemon = []
    for ox, oy in walk_candidates[:8]:
        z_idx = zone_grid[oy][ox]
        lm = landmarks[z_idx]
        pool = lm["pokemon_pool"] or c["local_pool"]
        if pool:
            pid = rng.choice(pool)
            overworld_pokemon.append({
                "species_id": pid,
                "name": POKEMON_BY_ID[pid]["name"],
                "x": ox,
                "y": oy,
            })

    zones_meta = []
    for idx, lm in enumerate(landmarks):
        wdef = WEATHER_DEFS[lm["weather"]]
        zones_meta.append({
            "id": lm["id"],
            "index": idx,
            "name": lm["name"],
            "weather": lm["weather"],
            "weather_label": lm["weather_label"],
            "is_signature": lm["is_signature"],
            "cx": centers[idx][0],
            "cy": centers[idx][1],
            "groundA": wdef["groundA"],
            "groundB": wdef["groundB"],
            "grassColor": wdef["grass"],
            "pokemon": [
                {"id": pid, "name": POKEMON_BY_ID[pid]["name"], "types": POKEMON_BY_ID[pid]["types"]}
                for pid in lm["pokemon_pool"]
            ],
        })

    return {
        "width": W,
        "height": H,
        "landmark_count": n_lm,
        "spawn": {"x": sx, "y": sy},
        "heal_pos": {"x": hx, "y": hy},
        "trainer_pos": {"x": tx, "y": ty},
        "biome": c["biome"],
        "palette": BIOME_PALETTE.get(c["biome"], BIOME_PALETTE["forest"]),
        "grid": grid,
        "elev_grid": elev,
        "zone_grid": zone_grid,
        "zones": zones_meta,
        "overworld_pokemon": overworld_pokemon,
    }

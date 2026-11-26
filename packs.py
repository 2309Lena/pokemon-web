import random
from db import add_pokemon_to_user, award_trainer_xp, get_conn, POKEMON_BY_ID
from relics_missions import get_relic_bonuses, record_mission_event
from world_data import EXCLUSIVE_OWNER, POKEMON_LIST

PACK_CATALOG = [
    {
        "id": "kanto_origins",
        "name": "Kanto Classic Booster",
        "subtitle": "Huyền thoại Gen 1 & Khởi đầu kinh điển",
        "price": 300,
        "color": "#e63946",
        "accent": "#ffd166",
        "badge": "GEN 1",
        "gen_filter": [1],
        "type_filter": None,
        "shiny_rate": 0.03,
        "legend_rate": 0.05,
        "exclusive_boost": 0.10,
        "cover_id": 6,
    },
    {
        "id": "inferno_blaze",
        "name": "Blazing Inferno Pack",
        "subtitle": "Hệ Lửa & Rồng rực cháy sức mạnh",
        "price": 350,
        "color": "#f77f00",
        "accent": "#fcbf49",
        "badge": "FIRE / DRAGON",
        "gen_filter": None,
        "type_filter": ["fire", "dragon"],
        "shiny_rate": 0.04,
        "legend_rate": 0.06,
        "exclusive_boost": 0.15,
        "cover_id": 384,
    },
    {
        "id": "abyssal_tide",
        "name": "Abyssal Ocean Pack",
        "subtitle": "Đại dương sâu thẳm hệ Nước & Băng",
        "price": 350,
        "color": "#0077b6",
        "accent": "#90e0ef",
        "badge": "WATER / ICE",
        "gen_filter": None,
        "type_filter": ["water", "ice"],
        "shiny_rate": 0.04,
        "legend_rate": 0.06,
        "exclusive_boost": 0.15,
        "cover_id": 382,
    },
    {
        "id": "emerald_wilds",
        "name": "Emerald Jungle Pack",
        "subtitle": "Rừng rậm nhiệt đới hệ Cỏ, Bọ & Độc",
        "price": 350,
        "color": "#2a9d8f",
        "accent": "#a7f3d0",
        "badge": "GRASS / BUG",
        "gen_filter": None,
        "type_filter": ["grass", "bug", "poison"],
        "shiny_rate": 0.04,
        "legend_rate": 0.05,
        "exclusive_boost": 0.15,
        "cover_id": 254,
    },
    {
        "id": "volt_surge",
        "name": "Volt & Steel Surge",
        "subtitle": "Tia chớp siêu tốc & Giáp thép bất bại",
        "price": 400,
        "color": "#ffb703",
        "accent": "#8ecae6",
        "badge": "ELECTRIC / STEEL",
        "gen_filter": None,
        "type_filter": ["electric", "steel"],
        "shiny_rate": 0.045,
        "legend_rate": 0.07,
        "exclusive_boost": 0.18,
        "cover_id": 25,
    },
    {
        "id": "astral_shadow",
        "name": "Shadow & Astral Pack",
        "subtitle": "Tâm linh huyền bí, Ma & Bóng tối",
        "price": 450,
        "color": "#7209b7",
        "accent": "#f72585",
        "badge": "PSYCHIC / GHOST",
        "gen_filter": None,
        "type_filter": ["psychic", "ghost", "dark", "fairy"],
        "shiny_rate": 0.05,
        "legend_rate": 0.08,
        "exclusive_boost": 0.20,
        "cover_id": 94,
    },
    {
        "id": "terra_titan",
        "name": "Terra & Titan Pack",
        "subtitle": "Hóa thạch cổ đại, Đất, Đá & Võ sĩ",
        "price": 400,
        "color": "#b07d4f",
        "accent": "#f4a261",
        "badge": "ROCK / FIGHT",
        "gen_filter": None,
        "type_filter": ["rock", "ground", "fighting"],
        "shiny_rate": 0.04,
        "legend_rate": 0.07,
        "exclusive_boost": 0.18,
        "cover_id": 448,
    },
    {
        "id": "paldea_horizon",
        "name": "Galar & Paldea Horizon",
        "subtitle": "Thế hệ mới Gen 8 & Gen 9 siêu hiếm",
        "price": 500,
        "color": "#4361ee",
        "accent": "#4cc9f0",
        "badge": "GEN 8-9",
        "gen_filter": [8, 9],
        "type_filter": None,
        "shiny_rate": 0.055,
        "legend_rate": 0.09,
        "exclusive_boost": 0.22,
        "cover_id": 1007,
    },
    {
        "id": "world_expedition",
        "name": "World Explorer Pack",
        "subtitle": "Tỷ lệ cao mở ra Pokémon Đặc Trưng Quốc Gia!",
        "price": 600,
        "color": "#06d6a0",
        "accent": "#ffd166",
        "badge": "WORLD EXCLUSIVE",
        "gen_filter": None,
        "type_filter": None,
        "shiny_rate": 0.06,
        "legend_rate": 0.10,
        "exclusive_boost": 0.55,
        "cover_id": 151,
    },
    {
        "id": "prismatic_god",
        "name": "Prismatic Mythic & Shiny",
        "subtitle": "Gói VIP đảm bảo Rare+, cơ hội Shiny & Huyền Thoại cao",
        "price": 1200,
        "color": "#d90429",
        "accent": "#ffe66d",
        "badge": "VIP ULTRA",
        "gen_filter": None,
        "type_filter": None,
        "shiny_rate": 0.18,
        "legend_rate": 0.28,
        "exclusive_boost": 0.35,
        "cover_id": 493,
    },
]

PACK_BY_ID = {p["id"]: p for p in PACK_CATALOG}


def _pool_for_pack(pack):
    pool = []
    for p in POKEMON_LIST:
        if pack["gen_filter"] and p["gen"] not in pack["gen_filter"]:
            continue
        if pack["type_filter"] and not (set(p["types"]) & set(pack["type_filter"])):
            continue
        pool.append(p)
    return pool or POKEMON_LIST


def _rarity_for_pokemon(p, is_shiny):
    if is_shiny:
        return "Shiny"
    return p.get("tier", "Common")


def open_booster_pack(user_id, pack_id):
    pack = PACK_BY_ID.get(pack_id)
    if not pack:
        return None, "Gói bài không tồn tại."

    conn = get_conn()
    u = conn.execute("SELECT coins FROM users WHERE id = ?", (user_id,)).fetchone()
    if not u:
        conn.close()
        return None, "Người chơi không tồn tại."
    if u["coins"] < pack["price"]:
        conn.close()
        return None, f"Không đủ PokéCoins! Cần {pack['price']} Coins."

    # Deduct price
    conn.execute("UPDATE users SET coins = coins - ? WHERE id = ?", (pack["price"], user_id))
    existing_species = {
        r["species_id"]
        for r in conn.execute("SELECT DISTINCT species_id FROM user_pokemon WHERE user_id = ?", (user_id,)).fetchall()
    }
    conn.commit()
    conn.close()

    pool = _pool_for_pack(pack)
    legends = [p for p in pool if p["legendary"] or p["mythical"]] or [
        p for p in POKEMON_LIST if p["legendary"] or p["mythical"]
    ]
    rares = [p for p in pool if (p["hp"] + p["atk"] + p["def"] + p["spd"]) >= 260 and not p["legendary"] and not p["mythical"]] or pool
    commons = [p for p in pool if (p["hp"] + p["atk"] + p["def"] + p["spd"]) < 260 and not p["legendary"] and not p["mythical"]] or pool
    excl_pool = [p for p in pool if p["id"] in EXCLUSIVE_OWNER] or pool

    cards = []
    stardust_bonus = 0
    for slot_idx in range(5):
        is_hit_slot = slot_idx == 4
        is_vip = pack["id"] == "prismatic_god"
        is_shiny = random.random() < (pack["shiny_rate"] * (2.2 if is_hit_slot else 0.7))

        roll = random.random()
        if is_hit_slot and roll < pack["legend_rate"]:
            picked = random.choice(legends)
        elif random.random() < pack["exclusive_boost"] and slot_idx >= 3:
            picked = random.choice(excl_pool)
        elif is_hit_slot or is_vip or (slot_idx == 3 and roll < 0.65):
            picked = random.choice(rares)
        else:
            picked = random.choice(commons)

        lvl = 1
        added = add_pokemon_to_user(
            user_id,
            picked["id"],
            level=lvl,
            is_shiny=is_shiny,
            source=f"pack:{pack_id}",
            auto_assign=True,
        )
        is_duplicate = picked["id"] in existing_species
        existing_species.add(picked["id"])
        if is_duplicate:
            stardust_bonus += 25

        cards.append(
            {
                "pokemon": added,
                "rarity": _rarity_for_pokemon(picked, is_shiny),
                "is_new": not is_duplicate,
                "exclusive_country_id": EXCLUSIVE_OWNER.get(picked["id"]),
            }
        )

    trainer_res = award_trainer_xp(user_id, 18, coins_gain=0, stardust_gain=stardust_bonus)
    record_mission_event(user_id, "gacha_pull", 1)
    return {
        "pack": pack,
        "cards": cards,
        "stardust_gained": stardust_bonus,
        "trainer": trainer_res,
    }, None


# ---------------- GACHA BANNERS (GEN 1-9 REGION + THEME + PITY + EGG) ----------------
GACHA_BANNERS = [
    {"id": "kanto", "region": "Kanto", "gen_label": "Gen 1", "title": "Kanto Mystery", "subtitle": "The 151 Pokémon of generation 1. The legendaries await!", "gens": [1], "featured": [150, 149, 151], "grad": "linear-gradient(125deg, #432874 0%, #2a3c74 52%, #1e5f74 100%)"},
    {"id": "johto", "region": "Johto", "gen_label": "Gen 2", "title": "Johto Legends", "subtitle": "100 classic Pokémon from Johto's golden towers!", "gens": [2], "featured": [249, 248, 250], "grad": "linear-gradient(125deg, #5c3a18 0%, #2b3a67 55%, #165b6e 100%)"},
    {"id": "hoenn", "region": "Hoenn", "gen_label": "Gen 3", "title": "Hoenn Sky & Sea", "subtitle": "135 tropical Pokémon & ancient weather titans!", "gens": [3], "featured": [384, 382, 383], "grad": "linear-gradient(125deg, #134e4a 0%, #1d3557 55%, #4a1d6e 100%)"},
    {"id": "sinnoh", "region": "Sinnoh", "gen_label": "Gen 4", "title": "Sinnoh Mythic", "subtitle": "107 Pokémon of time, space & Mt. Coronet!", "gens": [4], "featured": [483, 445, 493], "grad": "linear-gradient(125deg, #312e81 0%, #1e293b 55%, #0f4c5c 100%)"},
    {"id": "unova", "region": "Unova", "gen_label": "Gen 5", "title": "Unova Ideals", "subtitle": "156 metropolitan Pokémon of Truth & Ideals!", "gens": [5], "featured": [643, 635, 644], "grad": "linear-gradient(125deg, #1e1b4b 0%, #374151 55%, #1e3a5f 100%)"},
    {"id": "kalos", "region": "Kalos", "gen_label": "Gen 6", "title": "Kalos Aura", "subtitle": "72 stylish Kalos stars & Aura Champions!", "gens": [6], "featured": [716, 658, 718], "grad": "linear-gradient(125deg, #581c87 0%, #1e3a8a 55%, #0e7490 100%)"},
    {"id": "alola", "region": "Alola", "gen_label": "Gen 7", "title": "Alola Sun & Moon", "subtitle": "88 island guardians & cosmic Ultra legends!", "gens": [7], "featured": [791, 778, 792], "grad": "linear-gradient(125deg, #7c2d12 0%, #312e81 55%, #0f766e 100%)"},
    {"id": "galar", "region": "Galar", "gen_label": "Gen 8", "title": "Galar Crown", "subtitle": "96 Galar & Hisui warriors of Sword & Shield!", "gens": [8], "featured": [888, 887, 890], "grad": "linear-gradient(125deg, #701a75 0%, #1e3a8a 55%, #0369a1 100%)"},
    {"id": "paldea", "region": "Paldea", "gen_label": "Gen 9", "title": "Paldea Treasure", "subtitle": "120 modern Paldea paradox & academy legends!", "gens": [9], "featured": [1007, 937, 1008], "grad": "linear-gradient(125deg, #7f1d1d 0%, #3b0764 55%, #155e75 100%)"},
]
GACHA_BY_ID = {b["id"]: b for b in GACHA_BANNERS}

ODDS_WEIGHTS = [
    ("Mythic", 0.5),
    ("Legendary", 1.5),
    ("Epic", 6.5),
    ("Rare", 16.5),
    ("Uncommon", 30.0),
    ("Common", 45.0),
]

DUP_COINS_BY_TIER = {
    "Mythic": 400,
    "Legendary": 250,
    "Epic": 110,
    "Rare": 65,
    "Uncommon": 45,
    "Common": 30,
}


def _partition_banner_tiers(banner):
    pool = [p for p in POKEMON_LIST if p["gen"] in banner["gens"]]
    tiers = {"Mythic": [], "Legendary": [], "Epic": [], "Rare": [], "Uncommon": [], "Common": []}
    for p in pool:
        t = p.get("tier", "Common")
        if t in tiers:
            tiers[t].append(p)
    for k in tiers:
        if not tiers[k]:
            tiers[k] = tiers["Legendary"] or pool
    return pool, tiers


def get_gacha_banners_meta():
    out = []
    for b in GACHA_BANNERS:
        pool, tiers = _partition_banner_tiers(b)
        out.append({
            **b,
            "total_species": len(pool),
            "species_ids": [p["id"] for p in pool],
            "odds": [
                {"tier": "Mythic", "pct": 0.5, "count": len(tiers["Mythic"]), "ball": "/static/assets/items/master-ball.png", "color": "#fb7185"},
                {"tier": "Legendary", "pct": 1.5, "count": len(tiers["Legendary"]), "ball": "/static/assets/items/master-ball.png", "color": "#c084fc"},
                {"tier": "Epic", "pct": 6.5, "count": len(tiers["Epic"]), "ball": "/static/assets/items/ultra-ball.png", "color": "#facc15"},
                {"tier": "Rare", "pct": 16.5, "count": len(tiers["Rare"]), "ball": "/static/assets/items/great-ball.png", "color": "#38bdf8"},
                {"tier": "Uncommon", "pct": 30, "count": len(tiers["Uncommon"]), "ball": "/static/assets/items/safari-ball.png", "color": "#4ade80"},
                {"tier": "Common", "pct": 45, "count": len(tiers["Common"]), "ball": "/static/assets/items/poke-ball.png", "color": "#cbd5e1"},
            ],
        })
    return out


def pull_gacha_banner(user_id, banner_id, pull_mode="x1"):
    banner = GACHA_BY_ID.get(banner_id)
    if not banner:
        return None, "Banner Gacha không tồn tại."

    modes = {
        "x1": (1, "tickets", 1),
        "x10_t1": (10, "tickets", 10),
        "x10_t10": (10, "tickets_x10", 1),
        "x100_t1": (100, "tickets", 100),
        "x100_t10": (100, "tickets_x10", 10),
    }
    if pull_mode not in modes:
        return None, "Chế độ quay không hợp lệ."

    pull_count, col, cost = modes[pull_mode]
    conn = get_conn()
    u = conn.execute("SELECT tickets, tickets_x10 FROM users WHERE id = ?", (user_id,)).fetchone()
    if not u:
        conn.close()
        return None, "Người chơi không tồn tại."
    have = u[col]
    if have < cost:
        conn.close()
        label = "×10 tickets" if col == "tickets_x10" else "tickets"
        return None, f"Không đủ {label}! Cần {cost}, hiện có {have}."

    conn.execute(f"UPDATE users SET {col} = {col} - ? WHERE id = ?", (cost, user_id))
    pity_row = conn.execute(
        "SELECT pity_count, egg_progress FROM gacha_pity WHERE user_id = ? AND banner_id = ?",
        (user_id, banner_id),
    ).fetchone()
    pity = pity_row["pity_count"] if pity_row else 0
    egg_prog = pity_row["egg_progress"] if pity_row else 0

    owned_species = {
        r["species_id"]
        for r in conn.execute("SELECT DISTINCT species_id FROM user_pokemon WHERE user_id = ?", (user_id,)).fetchall()
    }
    owned_shinies = {
        r["species_id"]
        for r in conn.execute("SELECT DISTINCT species_id FROM user_pokemon WHERE user_id = ? AND is_shiny = 1", (user_id,)).fetchall()
    }
    conn.commit()
    conn.close()

    bonuses = get_relic_bonuses(user_id)
    shiny_prob = 0.01 * bonuses["shiny_mult"]
    pool, tiers = _partition_banner_tiers(banner)

    results = []
    coins_from_dupes = 0
    has_epic_plus = False

    def roll_tier(force_tier=None):
        if force_tier:
            return force_tier
        r = random.uniform(0, 100)
        acc = 0.0
        for tname, pct in ODDS_WEIGHTS:
            acc += pct
            if r <= acc:
                return tname
        return "Common"

    for i in range(pull_count):
        if pity >= 70:
            tier = "Mythic" if random.random() < 0.25 else "Legendary"
        elif pull_count >= 10 and i == pull_count - 1 and not has_epic_plus:
            tier = "Epic"
        else:
            tier = roll_tier()

        if tier in ("Mythic", "Legendary", "Epic"):
            has_epic_plus = True
        if tier in ("Mythic", "Legendary"):
            pity = 0
        else:
            pity += 1

        is_shiny = random.random() < shiny_prob
        cand_list = tiers[tier]
        if is_shiny:
            unowned_sh = [p for p in cand_list if p["id"] not in owned_shinies]
            if not unowned_sh:
                unowned_sh = [p for p in pool if p["id"] not in owned_shinies]
            picked = random.choice(unowned_sh or cand_list)
            owned_shinies.add(picked["id"])
        else:
            picked = random.choice(cand_list)

        is_dup = picked["id"] in owned_species
        owned_species.add(picked["id"])
        if is_dup:
            coins_from_dupes += DUP_COINS_BY_TIER.get(tier, 35)

        lvl = 1
        added = add_pokemon_to_user(
            user_id,
            picked["id"],
            level=lvl,
            is_shiny=is_shiny,
            source=f"gacha:{banner_id}",
            auto_assign=True,
        )
        results.append({
            "pokemon": added,
            "tier": tier,
            "is_shiny": is_shiny,
            "is_new": not is_dup,
        })

    # Egg progress (+1 per 10 pulls, hatches at 10!)
    hatched_eggs = []
    egg_prog += pull_count // 10
    while egg_prog >= 10:
        egg_prog -= 10
        egg_pick = random.choice(tiers["Epic"] + tiers["Legendary"])
        egg_shiny = random.random() < (shiny_prob * 3)
        egg_added = add_pokemon_to_user(
            user_id, egg_pick["id"], level=1, is_shiny=egg_shiny, source=f"egg:{banner_id}", auto_assign=True
        )
        hatched_eggs.append(egg_added)

    conn = get_conn()
    conn.execute(
        """
        INSERT INTO gacha_pity (user_id, banner_id, pity_count, egg_progress)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, banner_id) DO UPDATE SET pity_count = excluded.pity_count, egg_progress = excluded.egg_progress
        """,
        (user_id, banner_id, pity, egg_prog),
    )
    conn.commit()
    conn.close()

    trainer_res = award_trainer_xp(user_id, pull_count * 4, coins_gain=coins_from_dupes)
    record_mission_event(user_id, "gacha_pull", pull_count)

    # Sort best highlights first so 100 pulls display cleanly
    tier_rank = {"Mythic": 0, "Legendary": 1, "Epic": 2, "Rare": 3, "Uncommon": 4, "Common": 5}
    results_sorted = sorted(results, key=lambda r: (0 if r["is_shiny"] else 1, tier_rank.get(r["tier"], 6)))

    return {
        "banner_id": banner_id,
        "pull_count": pull_count,
        "pulls": results_sorted[:30],  # show top 30 highlights in reveal modal
        "total_pulled": len(results),
        "coins_from_dupes": coins_from_dupes,
        "pity": pity,
        "egg_progress": egg_prog,
        "hatched_eggs": hatched_eggs,
        "trainer": trainer_res,
    }, None

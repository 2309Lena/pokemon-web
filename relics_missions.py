import datetime
import random

RELIC_DROP_WEIGHTS = [
    ("Common", 52.0),
    ("Uncommon", 27.0),
    ("Rare", 14.0),
    ("Epic", 5.5),
    ("Legendary", 1.2),
    ("Mythic", 0.3),
]

RELIC_DUP_COINS = {
    "Common": 35,
    "Uncommon": 65,
    "Rare": 120,
    "Epic": 220,
    "Legendary": 450,
    "Mythic": 800,
}

_ICON_BY_ANIM = {
    "claw": "/static/assets/relics/crimson_claw.png",
    "shield": "/static/assets/relics/aegis_shield.png",
    "wing": "/static/assets/relics/zephyr_wing.png",
    "heart": "/static/assets/relics/vital_heart.png",
    "charm": "/static/assets/relics/lucky_charm.png",
    "crown": "/static/assets/relics/star_crown.png",
}

RELIC_CATALOG = [
    # --- 6 CLASSIC CORE RELICS (Rebalanced into Rare & Epic Tiers) ---
    {
        "id": "crimson_claw", "name": "Vuốt Rồng Đỏ", "en_name": "Crimson Dragon Claw",
        "tier": "Rare", "icon": _ICON_BY_ANIM["claw"], "anim": "claw", "hue": 0, "color": "#ef4444",
        "stat_label": "+18% ATK cho toàn đội", "desc": "Mỗi đòn đánh tỏa hỏa khí, tăng mạnh sức công phá của Pokémon.",
        "price": 1150, "bonuses": {"atk_mult": 0.18},
    },
    {
        "id": "aegis_shield", "name": "Khiên Pha Lê Aegis", "en_name": "Aegis Prism Shield",
        "tier": "Rare", "icon": _ICON_BY_ANIM["shield"], "anim": "shield", "hue": 0, "color": "#38bdf8",
        "stat_label": "+20% DEF cho toàn đội", "desc": "Kết giới pha lê xoay quanh giảm sát thương gánh chịu.",
        "price": 1150, "bonuses": {"def_mult": 0.20},
    },
    {
        "id": "zephyr_wing", "name": "Cánh Sấm Gió", "en_name": "Zephyr Thunder Wing",
        "tier": "Rare", "icon": _ICON_BY_ANIM["wing"], "anim": "wing", "hue": 0, "color": "#22c55e",
        "stat_label": "+22% SPD ra đòn trước", "desc": "Luồng điện gió nâng tốc độ phản xạ giúp Pokémon đánh trước đối thủ.",
        "price": 1250, "bonuses": {"spd_mult": 0.22},
    },
    {
        "id": "vital_heart", "name": "Ngọc Sinh Mệnh", "en_name": "Ancient Vital Orb",
        "tier": "Rare", "icon": _ICON_BY_ANIM["heart"], "anim": "heart", "hue": 0, "color": "#f43f5e",
        "stat_label": "+20% Max HP bền bỉ", "desc": "Nhịp đập sinh lực vĩnh cửu gia tăng máu tối đa cho cả đội.",
        "price": 1200, "bonuses": {"hp_mult": 0.20},
    },
    {
        "id": "lucky_charm", "name": "Chuông Vàng May Mắn", "en_name": "Golden Lucky Charm",
        "tier": "Epic", "icon": _ICON_BY_ANIM["charm"], "anim": "charm", "hue": 0, "color": "#fbbf24",
        "stat_label": "+35% PokéCoins & +15% Bắt", "desc": "Tiếng chuông chiêu tài và tăng tỷ lệ thu phục Pokémon hoang dã.",
        "price": 2500, "bonuses": {"coin_mult": 0.35, "catch_bonus": 0.15},
    },
    {
        "id": "star_crown", "name": "Vương Miện Tinh Tú", "en_name": "Astral Star Crown",
        "tier": "Epic", "icon": _ICON_BY_ANIM["crown"], "anim": "crown", "hue": 0, "color": "#c084fc",
        "stat_label": "+30% XP & ×2 Tỉ lệ Shiny", "desc": "Ánh sao hoàng gia giúp Trainer thăng cấp nhanh và thu hút Shiny.",
        "price": 2900, "bonuses": {"xp_mult": 0.30, "shiny_mult": 1.0},
    },
]

# +50 NEW TIERED RELICS (Common=16, Uncommon=13, Rare=+7=11, Epic=+6=8, Legendary=5, Mythic=3 -> Total 56 Relics!)
_EXTRA_RELIC_SPECS = [
    # Common (16) - Low price 180..320, +5%..+9% starter buffs
    ("c_wood_fang", "Nanh Gỗ Rừng", "Common", "claw", 95, "#84cc16", "+6% ATK", 180, {"atk_mult": 0.06}),
    ("c_pebble_buckler", "Khiên Đá Cuội", "Common", "shield", 160, "#94a3b8", "+7% DEF", 180, {"def_mult": 0.07}),
    ("c_leaf_feather", "Lông Chim Xanh", "Common", "wing", 30, "#4ade80", "+7% SPD", 190, {"spd_mult": 0.07}),
    ("c_berry_core", "Hạt Mầm Sinh Lực", "Common", "heart", 110, "#22c55e", "+7% Max HP", 190, {"hp_mult": 0.07}),
    ("c_copper_bell", "Chuông Đồng Nhỏ", "Common", "charm", -25, "#d97706", "+12% Coins", 220, {"coin_mult": 0.12}),
    ("c_tin_tiara", "Mũ Sắt Tập Sự", "Common", "crown", 170, "#cbd5e1", "+12% XP", 220, {"xp_mult": 0.12}),
    ("c_spark_talon", "Móng Tia Chớp", "Common", "claw", 55, "#facc15", "+8% ATK", 250, {"atk_mult": 0.08}),
    ("c_moss_shell", "Giáp Rêu Phong", "Common", "shield", 270, "#10b981", "+9% DEF", 260, {"def_mult": 0.09}),
    ("c_breeze_plume", "Cánh Gió Nhẹ", "Common", "wing", 70, "#38bdf8", "+9% SPD", 260, {"spd_mult": 0.09}),
    ("c_amber_seed", "Nhựa Hổ Phách", "Common", "heart", 40, "#f59e0b", "+9% Max HP", 260, {"hp_mult": 0.09}),
    ("c_snare_charm", "Bùa Săn Bắt Sơ Cấp", "Common", "charm", 155, "#2dd4bf", "+6% Tỉ lệ Bắt", 280, {"catch_bonus": 0.06}),
    ("c_rust_spur", "Cựa Đồng Rỉ", "Common", "claw", 25, "#fb923c", "+5% ATK · +4% SPD", 270, {"atk_mult": 0.05, "spd_mult": 0.04}),
    ("c_clay_ward", "Mảnh Gốm Hộ Thân", "Common", "shield", 200, "#a8a29e", "+5% DEF · +5% HP", 270, {"def_mult": 0.05, "hp_mult": 0.05}),
    ("c_dawn_ribbon", "Dải Lụa Bình Minh", "Common", "charm", 210, "#f472b6", "+10% XP · +8% Coins", 300, {"xp_mult": 0.10, "coin_mult": 0.08}),
    ("c_mint_crest", "Huy Hiệu Bạc Hà", "Common", "crown", 125, "#34d399", "+6% HP · +5% DEF", 290, {"hp_mult": 0.06, "def_mult": 0.05}),
    ("c_lucky_penny", "Đồng Xu Cổ", "Common", "charm", 15, "#eab308", "+16% PokéCoins", 320, {"coin_mult": 0.16}),
    # Uncommon (13) - Moderate price 450..760, +10%..+15% buffs
    ("u_iron_claw", "Vuốt Thép Rèn", "Uncommon", "claw", 215, "#60a5fa", "+12% ATK", 460, {"atk_mult": 0.12}),
    ("u_coral_barrier", "Khiên San Hô", "Uncommon", "shield", 310, "#fb7185", "+14% DEF", 480, {"def_mult": 0.14}),
    ("u_swift_pinion", "Cánh Bạc Xé Gió", "Uncommon", "wing", 185, "#67e8f9", "+14% SPD", 490, {"spd_mult": 0.14}),
    ("u_crimson_core", "Tim Pha Lê Đỏ", "Uncommon", "heart", -15, "#ef4444", "+14% Max HP", 490, {"hp_mult": 0.14}),
    ("u_hunter_amulet", "Bùa Thợ Săn", "Uncommon", "charm", 95, "#4ade80", "+12% Bắt Pokémon", 550, {"catch_bonus": 0.12}),
    ("u_scholar_circlet", "Vòng Tri Thức", "Uncommon", "crown", 210, "#38bdf8", "+22% Trainer XP", 560, {"xp_mult": 0.22}),
    ("u_merchant_bell", "Chuông Thương Nhân", "Uncommon", "charm", -40, "#fbbf24", "+24% PokéCoins", 580, {"coin_mult": 0.24}),
    ("u_frost_talon", "Móng Băng Giá", "Uncommon", "claw", 185, "#93c5fd", "+9% ATK · +7% SPD", 620, {"atk_mult": 0.09, "spd_mult": 0.07}),
    ("u_granite_plate", "Giáp Hoa Cương", "Uncommon", "shield", 45, "#facc15", "+10% DEF · +8% HP", 640, {"def_mult": 0.10, "hp_mult": 0.08}),
    ("u_gale_crest", "Phong Ấn Lốc Xoáy", "Uncommon", "wing", 240, "#818cf8", "+10% SPD · +8% ATK", 660, {"spd_mult": 0.10, "atk_mult": 0.08}),
    ("u_glitter_pendant", "Mặt Dây Ánh Kim", "Uncommon", "crown", 60, "#fde047", "+40% Tỉ lệ Shiny", 720, {"shiny_mult": 0.40}),
    ("u_vigor_vessel", "Bình Sinh Khí", "Uncommon", "heart", 265, "#c084fc", "+11% HP · +8% DEF", 680, {"hp_mult": 0.11, "def_mult": 0.08}),
    ("u_safari_totem", "Vật Tổ Safari", "Uncommon", "charm", 130, "#22c55e", "+10% Bắt · +14% Coins", 750, {"catch_bonus": 0.10, "coin_mult": 0.14}),
    # Rare (+7 -> total 11) - Mid-high price 1050..1650
    ("r_abyssal_fang", "Nanh Vực Thẳm", "Rare", "claw", 265, "#a855f7", "+15% ATK · +10% SPD", 1300, {"atk_mult": 0.15, "spd_mult": 0.10}),
    ("r_obsidian_aegis", "Khiên Hắc Diện Thạch", "Rare", "shield", 295, "#94a3b8", "+16% DEF · +12% HP", 1350, {"def_mult": 0.16, "hp_mult": 0.12}),
    ("r_tempest_wing", "Cánh Cuồng Phong", "Rare", "wing", 155, "#2dd4bf", "+18% SPD · +10% ATK", 1400, {"spd_mult": 0.18, "atk_mult": 0.10}),
    ("r_phoenix_heart", "Trái Tim Phượng Hoàng", "Rare", "heart", 35, "#fb923c", "+18% HP · +10% ATK", 1450, {"hp_mult": 0.18, "atk_mult": 0.10}),
    ("r_master_lure", "Chuông Thu Phục Bậc Thầy", "Rare", "charm", 290, "#c084fc", "+18% Bắt · +20% Shiny", 1500, {"catch_bonus": 0.18, "shiny_mult": 0.20}),
    ("r_treasure_scepter", "Ấn Kho Báu Cổ", "Rare", "crown", 45, "#fbbf24", "+30% Coins · +20% XP", 1550, {"coin_mult": 0.30, "xp_mult": 0.20}),
    ("r_venom_spurs", "Móng Độc Hoàng Gia", "Rare", "claw", 120, "#22c55e", "+16% ATK · +12% DEF", 1420, {"atk_mult": 0.16, "def_mult": 0.12}),
    # Epic (+6 -> total 8) - High price 2400..3600
    ("e_dragonlord_claw", "Trảo Long Vương", "Epic", "claw", 320, "#f43f5e", "+24% ATK · +15% SPD", 2800, {"atk_mult": 0.24, "spd_mult": 0.15}),
    ("e_diamond_bastion", "Pháo Đài Kim Cương", "Epic", "shield", 190, "#67e8f9", "+25% DEF · +18% HP", 2900, {"def_mult": 0.25, "hp_mult": 0.18}),
    ("e_thunderbird_pinion", "Cánh Lôi Thần", "Epic", "wing", 50, "#facc15", "+26% SPD · +16% ATK", 3000, {"spd_mult": 0.26, "atk_mult": 0.16}),
    ("e_immortal_ruby", "Hồng Ngọc Bất Tử", "Epic", "heart", 340, "#fb7185", "+26% HP · +18% DEF", 3100, {"hp_mult": 0.26, "def_mult": 0.18}),
    ("e_prism_lantern", "Lồng Đèn Ánh Sáng", "Epic", "charm", 240, "#f472b6", "+20% Bắt · ×2.2 Shiny", 3300, {"catch_bonus": 0.20, "shiny_mult": 1.2}),
    ("e_royal_vault", "Vương Ấn Hoàng Kim", "Epic", "crown", 30, "#f59e0b", "+45% Coins · +35% XP", 3600, {"coin_mult": 0.45, "xp_mult": 0.35}),
    # Legendary (5) - Expensive grind trophies 5500..8000, Drop rate 1.2%!
    ("l_rayquaza_talon", "Thiên Long Trảo (Rayquaza)", "Legendary", "claw", 110, "#10b981", "+32% ATK · +22% SPD · +12% HP", 6200, {"atk_mult": 0.32, "spd_mult": 0.22, "hp_mult": 0.12}),
    ("l_regigigas_aegis", "Thánh Khiên Thái Cổ", "Legendary", "shield", 35, "#fbbf24", "+34% DEF · +28% HP · +10% ATK", 6400, {"def_mult": 0.34, "hp_mult": 0.28, "atk_mult": 0.10}),
    ("l_zapdos_tempest", "Cánh Lôi Đế Tối Thượng", "Legendary", "wing", 40, "#facc15", "+35% SPD · +24% ATK · +15% XP", 6800, {"spd_mult": 0.35, "atk_mult": 0.24, "xp_mult": 0.15}),
    ("l_mewtwo_mind_orb", "Tâm Ngọc Mewtwo", "Legendary", "heart", 280, "#c084fc", "+30% ATK · +30% HP · +20% DEF", 7400, {"atk_mult": 0.30, "hp_mult": 0.30, "def_mult": 0.20}),
    ("l_hooh_sacred_bell", "Chuông Thánh Ho-Oh", "Legendary", "charm", 350, "#f97316", "+28% Bắt · +60% Coins · ×2.5 Shiny", 7900, {"catch_bonus": 0.28, "coin_mult": 0.60, "shiny_mult": 1.5}),
    # Mythic (3) - Pinnacle endgame Relics 11500..15000, Drop rate 0.3%!
    ("m_arceus_crown", "Thánh Quán Arceus (Creation)", "Mythic", "crown", 48, "#fde047", "+42% ATK/DEF/SPD/HP · +40% XP", 14500, {"atk_mult": 0.42, "def_mult": 0.42, "spd_mult": 0.42, "hp_mult": 0.42, "xp_mult": 0.40}),
    ("m_eternatus_core", "Lõi Vô Cực Eternatus", "Mythic", "heart", 295, "#e879f9", "+48% ATK · +45% HP · +35% SPD", 12500, {"atk_mult": 0.48, "hp_mult": 0.45, "spd_mult": 0.35}),
    ("m_mew_genesis_bell", "Khải Huyền Chuông Mew", "Mythic", "charm", 315, "#f472b6", "+35% Bắt · +80% Coins · ×3.5 Shiny · +25% All", 13500, {"catch_bonus": 0.35, "coin_mult": 0.80, "shiny_mult": 2.5, "atk_mult": 0.25, "spd_mult": 0.25}),
]

for _rid, _name, _tier, _anim, _hue, _col, _slabel, _price, _bon in _EXTRA_RELIC_SPECS:
    RELIC_CATALOG.append({
        "id": _rid,
        "name": _name,
        "en_name": _name,
        "tier": _tier,
        "icon": _ICON_BY_ANIM[_anim],
        "anim": _anim,
        "hue": _hue,
        "color": _col,
        "stat_label": _slabel,
        "desc": f"Thánh vật bậc {_tier}: {_slabel}. Rơi hiếm khi đánh quái hoặc mua bằng PokéCoins!",
        "price": _price,
        "bonuses": _bon,
    })

RELIC_BY_ID = {r["id"]: r for r in RELIC_CATALOG}
RELICS_BY_TIER = {}
for _r in RELIC_CATALOG:
    RELICS_BY_TIER.setdefault(_r["tier"], []).append(_r)


def roll_relic_drop(user_id, drop_chance=0.14):
    """Roll monster-drop Relic following Tier weights (low Legendary 1.2% / Mythic 0.3%)."""
    if random.random() >= drop_chance:
        return None
    from db import get_conn

    tiers = [t for t, _ in RELIC_DROP_WEIGHTS]
    weights = [w for _, w in RELIC_DROP_WEIGHTS]
    chosen_tier = random.choices(tiers, weights=weights, k=1)[0]
    pool = RELICS_BY_TIER.get(chosen_tier) or RELIC_CATALOG
    rel = random.choice(pool)

    conn = get_conn()
    existing = conn.execute(
        "SELECT unlocked FROM user_relics WHERE user_id = ? AND relic_id = ?",
        (user_id, rel["id"]),
    ).fetchone()
    if existing and existing["unlocked"]:
        dup_coins = RELIC_DUP_COINS.get(rel["tier"], 40)
        conn.execute("UPDATE users SET coins = coins + ? WHERE id = ?", (dup_coins, user_id))
        conn.commit()
        conn.close()
        return {"relic": rel, "is_new": False, "dup_coins": dup_coins}

    eq_cnt = conn.execute(
        "SELECT COUNT(*) as c FROM user_relics WHERE user_id = ? AND equipped = 1", (user_id,)
    ).fetchone()["c"]
    auto_eq = 1 if eq_cnt < 3 else 0
    conn.execute(
        """
        INSERT INTO user_relics (user_id, relic_id, unlocked, equipped)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(user_id, relic_id) DO UPDATE SET unlocked = 1, equipped = MAX(equipped, excluded.equipped)
        """,
        (user_id, rel["id"], auto_eq),
    )
    conn.commit()
    conn.close()
    return {"relic": rel, "is_new": True, "dup_coins": 0}

MISSION_CATALOG = [
    # DAILY MISSIONS
    {
        "id": "d_win_3",
        "period": "daily",
        "title": "Chiến thắng 3 trận đấu",
        "event": "battle_win",
        "target": 3,
        "rewards": {"coins": 110, "tickets": 2, "xp": 35},
    },
    {
        "id": "d_catch_2",
        "period": "daily",
        "title": "Bắt 2 Pokémon hoang dã",
        "event": "catch",
        "target": 2,
        "rewards": {"coins": 90, "tickets": 2, "poke_ball": 4, "xp": 30},
    },
    {
        "id": "d_pull_1",
        "period": "daily",
        "title": "Quay Gacha hoặc mở Pack 1 lần",
        "event": "gacha_pull",
        "target": 1,
        "rewards": {"coins": 75, "tickets": 1, "xp": 25},
    },
    # WEEKLY MISSIONS
    {
        "id": "w_win_15",
        "period": "weekly",
        "title": "Thắng 15 trận trong tuần",
        "event": "battle_win",
        "target": 15,
        "rewards": {"coins": 450, "tickets_x10": 2, "xp": 120},
    },
    {
        "id": "w_catch_10",
        "period": "weekly",
        "title": "Thu phục 10 Pokémon trong tuần",
        "event": "catch",
        "target": 10,
        "rewards": {"coins": 380, "tickets_x10": 1, "ultra_ball": 5, "xp": 100},
    },
    {
        "id": "w_cup_3",
        "period": "weekly",
        "title": "Thắng 3 trận Grand Cup hoặc PvP",
        "event": "cup_or_pvp_win",
        "target": 3,
        "rewards": {"coins": 550, "tickets_x10": 2, "rare_candy": 2, "xp": 150},
    },
    {
        "id": "w_hard_wins",
        "period": "weekly",
        "title": "🔥 Quest Khó Tuần: Thắng 30 trận đấu",
        "event": "battle_win",
        "target": 30,
        "rewards": {"coins": 650, "tickets_x10": 2, "plate_stone": 1, "xp": 180},
    },
    {
        "id": "w_hard_cup",
        "period": "weekly",
        "title": "🔥 Quest Khó Tuần: Thắng 6 trận Grand Cup / PvP",
        "event": "cup_or_pvp_win",
        "target": 6,
        "rewards": {"coins": 750, "tickets_x10": 3, "plate_stone": 1, "xp": 220},
    },
    # MONTHLY MISSIONS
    {
        "id": "m_unlock_3",
        "period": "monthly",
        "title": "Mở khóa 3 quốc gia mới trong tháng",
        "event": "country_unlock",
        "target": 3,
        "rewards": {"coins": 1100, "tickets_x10": 4, "master_ball": 1, "xp": 250},
    },
    {
        "id": "m_pull_50",
        "period": "monthly",
        "title": "Quay Gacha 50 lượt trong tháng",
        "event": "gacha_pull",
        "target": 50,
        "rewards": {"coins": 1250, "tickets_x10": 5, "xp": 250},
    },
    {
        "id": "m_champ_1",
        "period": "monthly",
        "title": "Vô địch 1 giải Grand Cup (6v6)",
        "event": "cup_champ",
        "target": 1,
        "rewards": {"coins": 1600, "tickets_x10": 5, "master_ball": 2, "xp": 350},
    },
]
MISSION_BY_ID = {m["id"]: m for m in MISSION_CATALOG}


def current_period_key(period_type):
    today = datetime.date.today()
    if period_type == "daily":
        return today.strftime("%Y-%m-%d")
    if period_type == "weekly":
        iso = today.isocalendar()
        return f"{iso[0]}-W{iso[1]:02d}"
    return today.strftime("%Y-%m")


def get_user_relics(user_id, conn=None):
    from db import get_conn

    own_conn = conn is None
    if own_conn:
        conn = get_conn()
    rows = {
        r["relic_id"]: dict(r)
        for r in conn.execute("SELECT * FROM user_relics WHERE user_id = ?", (user_id,)).fetchall()
    }
    if own_conn:
        conn.close()
    res = []
    for rel in RELIC_CATALOG:
        ur = rows.get(rel["id"])
        res.append(
            {
                **rel,
                "unlocked": bool(ur and ur["unlocked"]),
                "equipped": bool(ur and ur["equipped"]),
            }
        )
    return res


def get_relic_bonuses(user_id, conn=None):
    bonuses = {
        "atk_mult": 1.0,
        "def_mult": 1.0,
        "spd_mult": 1.0,
        "hp_mult": 1.0,
        "coin_mult": 1.0,
        "xp_mult": 1.0,
        "catch_bonus": 0.0,
        "shiny_mult": 1.0,
        "equipped_ids": [],
    }
    for rel in get_user_relics(user_id, conn=conn):
        if rel["equipped"]:
            bonuses["equipped_ids"].append(rel["id"])
            for k, v in rel["bonuses"].items():
                bonuses[k] += v
    return bonuses


def buy_relic(user_id, relic_id):
    from db import get_conn

    rel = RELIC_BY_ID.get(relic_id)
    if not rel:
        return None, "Relic không tồn tại."
    conn = get_conn()
    existing = conn.execute(
        "SELECT unlocked FROM user_relics WHERE user_id = ? AND relic_id = ?", (user_id, relic_id)
    ).fetchone()
    if existing and existing["unlocked"]:
        conn.close()
        return None, "Bạn đã sở hữu Relic này rồi."
    u = conn.execute("SELECT coins FROM users WHERE id = ?", (user_id,)).fetchone()
    if u["coins"] < rel["price"]:
        conn.close()
        return None, f"Không đủ Coins! Cần {rel['price']} Coins."
    conn.execute("UPDATE users SET coins = coins - ? WHERE id = ?", (rel["price"], user_id))
    eq_cnt = conn.execute(
        "SELECT COUNT(*) as c FROM user_relics WHERE user_id = ? AND equipped = 1", (user_id,)
    ).fetchone()["c"]
    auto_eq = 1 if eq_cnt < 3 else 0
    conn.execute(
        """
        INSERT INTO user_relics (user_id, relic_id, unlocked, equipped)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(user_id, relic_id) DO UPDATE SET unlocked = 1, equipped = MAX(equipped, excluded.equipped)
        """,
        (user_id, relic_id, auto_eq),
    )
    conn.commit()
    conn.close()
    return rel, None


def toggle_equip_relic(user_id, relic_id):
    from db import get_conn

    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM user_relics WHERE user_id = ? AND relic_id = ? AND unlocked = 1",
        (user_id, relic_id),
    ).fetchone()
    if not row:
        conn.close()
        return None, "Bạn chưa mở khóa Relic này."
    if row["equipped"]:
        conn.execute(
            "UPDATE user_relics SET equipped = 0 WHERE user_id = ? AND relic_id = ?",
            (user_id, relic_id),
        )
        new_state = False
    else:
        cnt = conn.execute(
            "SELECT COUNT(*) as c FROM user_relics WHERE user_id = ? AND equipped = 1", (user_id,)
        ).fetchone()["c"]
        if cnt >= 3:
            conn.close()
            return None, "Chỉ trang bị tối đa 3 Relic cùng lúc! Hãy tháo bớt 1 cái."
        conn.execute(
            "UPDATE user_relics SET equipped = 1 WHERE user_id = ? AND relic_id = ?",
            (user_id, relic_id),
        )
        new_state = True
    conn.commit()
    conn.close()
    return {"equipped": new_state}, None


def record_mission_event(user_id, event_type, delta=1):
    from db import get_conn

    matching = [m for m in MISSION_CATALOG if m["event"] == event_type]
    if not matching:
        return
    conn = get_conn()
    for m in matching:
        pkey = current_period_key(m["period"])
        conn.execute(
            """
            INSERT INTO user_missions (user_id, mission_id, period_key, progress, claimed)
            VALUES (?, ?, ?, ?, 0)
            ON CONFLICT(user_id, mission_id, period_key) DO UPDATE SET
                progress = MIN(?, progress + excluded.progress)
            """,
            (user_id, m["id"], pkey, min(m["target"], delta), m["target"]),
        )
    conn.commit()
    conn.close()


def get_user_missions(user_id, conn=None):
    from db import get_conn

    own_conn = conn is None
    if own_conn:
        conn = get_conn()
    pkeys = {p: current_period_key(p) for p in ("daily", "weekly", "monthly")}
    rows = conn.execute(
        "SELECT mission_id, period_key, progress, claimed FROM user_missions WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    if own_conn:
        conn.close()
    row_map = {(r["mission_id"], r["period_key"]): dict(r) for r in rows}

    res = []
    for m in MISSION_CATALOG:
        pk = pkeys[m["period"]]
        st = row_map.get((m["id"], pk), {"progress": 0, "claimed": 0})
        res.append(
            {
                **m,
                "period_key": pk,
                "progress": min(m["target"], st["progress"]),
                "claimed": bool(st["claimed"]),
                "can_claim": st["progress"] >= m["target"] and not st["claimed"],
            }
        )
    return res


def claim_mission_reward(user_id, mission_id):
    from db import award_trainer_xp, change_item_qty, get_conn

    m = MISSION_BY_ID.get(mission_id)
    if not m:
        return None, "Nhiệm vụ không tồn tại."
    pk = current_period_key(m["period"])
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM user_missions WHERE user_id = ? AND mission_id = ? AND period_key = ?",
        (user_id, mission_id, pk),
    ).fetchone()
    if not row or row["progress"] < m["target"]:
        conn.close()
        return None, "Bạn chưa hoàn thành mục tiêu nhiệm vụ này."
    if row["claimed"]:
        conn.close()
        return None, "Bạn đã nhận thưởng nhiệm vụ này rồi."

    conn.execute(
        "UPDATE user_missions SET claimed = 1 WHERE user_id = ? AND mission_id = ? AND period_key = ?",
        (user_id, mission_id, pk),
    )
    rew = m["rewards"]
    t1 = rew.get("tickets", 0)
    t10 = rew.get("tickets_x10", 0)
    if t1 or t10:
        conn.execute(
            "UPDATE users SET tickets = tickets + ?, tickets_x10 = tickets_x10 + ? WHERE id = ?",
            (t1, t10, user_id),
        )
    conn.commit()
    conn.close()

    for item_k in ("poke_ball", "great_ball", "ultra_ball", "master_ball", "rare_candy", "plate_stone"):
        if rew.get(item_k):
            change_item_qty(user_id, item_k, rew[item_k])

    award_trainer_xp(user_id, rew.get("xp", 0), coins_gain=rew.get("coins", 0))
    return m, None

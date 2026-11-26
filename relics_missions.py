import datetime

RELIC_CATALOG = [
    {
        "id": "crimson_claw",
        "name": "Vuốt Rồng Đỏ",
        "en_name": "Crimson Dragon Claw",
        "icon": "/static/assets/relics/crimson_claw.png",
        "anim": "claw",
        "color": "#ef4444",
        "stat_label": "+18% ATK cho toàn đội",
        "desc": "Mỗi đòn đánh tỏa hỏa khí, tăng mạnh sức công phá của Pokémon.",
        "price": 800,
        "bonuses": {"atk_mult": 0.18},
    },
    {
        "id": "aegis_shield",
        "name": "Khiên Pha Lê Aegis",
        "en_name": "Aegis Prism Shield",
        "icon": "/static/assets/relics/aegis_shield.png",
        "anim": "shield",
        "color": "#38bdf8",
        "stat_label": "+20% DEF cho toàn đội",
        "desc": "Kết giới pha lê xoay quanh giảm sát thương gánh chịu.",
        "price": 800,
        "bonuses": {"def_mult": 0.20},
    },
    {
        "id": "zephyr_wing",
        "name": "Cánh Sấm Gió",
        "en_name": "Zephyr Thunder Wing",
        "icon": "/static/assets/relics/zephyr_wing.png",
        "anim": "wing",
        "color": "#22c55e",
        "stat_label": "+22% SPD ra đòn trước",
        "desc": "Luồng điện gió nâng tốc độ phản xạ giúp Pokémon đánh trước đối thủ.",
        "price": 900,
        "bonuses": {"spd_mult": 0.22},
    },
    {
        "id": "vital_heart",
        "name": "Ngọc Sinh Mệnh",
        "en_name": "Ancient Vital Orb",
        "icon": "/static/assets/relics/vital_heart.png",
        "anim": "heart",
        "color": "#f43f5e",
        "stat_label": "+20% Max HP bền bỉ",
        "desc": "Nhịp đập sinh lực vĩnh cửu gia tăng máu tối đa cho cả đội.",
        "price": 900,
        "bonuses": {"hp_mult": 0.20},
    },
    {
        "id": "lucky_charm",
        "name": "Chuông Vàng May Mắn",
        "en_name": "Golden Lucky Charm",
        "icon": "/static/assets/relics/lucky_charm.png",
        "anim": "charm",
        "color": "#fbbf24",
        "stat_label": "+35% PokéCoins & +15% Bắt",
        "desc": "Tiếng chuông chiêu tài và tăng tỷ lệ thu phục Pokémon hoang dã.",
        "price": 1200,
        "bonuses": {"coin_mult": 0.35, "catch_bonus": 0.15},
    },
    {
        "id": "star_crown",
        "name": "Vương Miện Tinh Tú",
        "en_name": "Astral Star Crown",
        "icon": "/static/assets/relics/star_crown.png",
        "anim": "crown",
        "color": "#c084fc",
        "stat_label": "+30% XP & ×2 Tỉ lệ Shiny",
        "desc": "Ánh sao hoàng gia giúp Trainer thăng cấp nhanh và thu hút Shiny.",
        "price": 1500,
        "bonuses": {"xp_mult": 0.30, "shiny_mult": 1.0},
    },
]

RELIC_BY_ID = {r["id"]: r for r in RELIC_CATALOG}

MISSION_CATALOG = [
    # DAILY MISSIONS
    {
        "id": "d_win_3",
        "period": "daily",
        "title": "Chiến thắng 3 trận đấu",
        "event": "battle_win",
        "target": 3,
        "rewards": {"coins": 300, "tickets": 2, "xp": 35},
    },
    {
        "id": "d_catch_2",
        "period": "daily",
        "title": "Bắt 2 Pokémon hoang dã",
        "event": "catch",
        "target": 2,
        "rewards": {"coins": 250, "tickets": 2, "poke_ball": 4, "xp": 30},
    },
    {
        "id": "d_pull_1",
        "period": "daily",
        "title": "Quay Gacha hoặc mở Pack 1 lần",
        "event": "gacha_pull",
        "target": 1,
        "rewards": {"coins": 200, "tickets": 1, "xp": 25},
    },
    # WEEKLY MISSIONS
    {
        "id": "w_win_15",
        "period": "weekly",
        "title": "Thắng 15 trận trong tuần",
        "event": "battle_win",
        "target": 15,
        "rewards": {"coins": 1200, "tickets_x10": 2, "xp": 120},
    },
    {
        "id": "w_catch_10",
        "period": "weekly",
        "title": "Thu phục 10 Pokémon trong tuần",
        "event": "catch",
        "target": 10,
        "rewards": {"coins": 1000, "tickets_x10": 1, "ultra_ball": 5, "xp": 100},
    },
    {
        "id": "w_cup_3",
        "period": "weekly",
        "title": "Thắng 3 trận Grand Cup hoặc PvP",
        "event": "cup_or_pvp_win",
        "target": 3,
        "rewards": {"coins": 1500, "tickets_x10": 2, "rare_candy": 2, "xp": 150},
    },
    # MONTHLY MISSIONS
    {
        "id": "m_unlock_3",
        "period": "monthly",
        "title": "Mở khóa 3 quốc gia mới trong tháng",
        "event": "country_unlock",
        "target": 3,
        "rewards": {"coins": 3000, "tickets_x10": 4, "master_ball": 1, "xp": 250},
    },
    {
        "id": "m_pull_50",
        "period": "monthly",
        "title": "Quay Gacha 50 lượt trong tháng",
        "event": "gacha_pull",
        "target": 50,
        "rewards": {"coins": 3500, "tickets_x10": 5, "xp": 250},
    },
    {
        "id": "m_champ_1",
        "period": "monthly",
        "title": "Vô địch 1 giải Grand Cup (6v6)",
        "event": "cup_champ",
        "target": 1,
        "rewards": {"coins": 4000, "tickets_x10": 5, "master_ball": 2, "xp": 350},
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

    for item_k in ("poke_ball", "great_ball", "ultra_ball", "master_ball", "rare_candy"):
        if rew.get(item_k):
            change_item_qty(user_id, item_k, rew[item_k])

    award_trainer_xp(user_id, rew.get("xp", 0), coins_gain=rew.get("coins", 0))
    return m, None

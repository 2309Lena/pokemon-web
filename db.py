import json
import os
import random
import sqlite3
import time
from werkzeug.security import check_password_hash, generate_password_hash

from world_data import (
    COUNTRIES_BY_ID,
    EVOLUTIONS_FORWARD,
    POKEMON_BY_ID,
    pick_starter_country,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("POKEMON_DB_PATH") or os.path.join(BASE_DIR, "pokemon_world.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_conn()
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
    except sqlite3.OperationalError:
        pass
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            xp INTEGER NOT NULL DEFAULT 0,
            coins INTEGER NOT NULL DEFAULT 500,
            stardust INTEGER NOT NULL DEFAULT 100,
            open_points INTEGER NOT NULL DEFAULT 0,
            tickets INTEGER NOT NULL DEFAULT 12,
            tickets_x10 INTEGER NOT NULL DEFAULT 1,
            daily_last TEXT DEFAULT '',
            created_at REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS unlocked_countries (
            user_id INTEGER NOT NULL,
            country_id TEXT NOT NULL,
            is_starter INTEGER NOT NULL DEFAULT 0,
            catches_count INTEGER NOT NULL DEFAULT 0,
            trainer_defeated INTEGER NOT NULL DEFAULT 0,
            unlocked_at REAL NOT NULL,
            PRIMARY KEY (user_id, country_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_pokemon (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            species_id INTEGER NOT NULL,
            nickname TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 5,
            xp INTEGER NOT NULL DEFAULT 0,
            hp_iv INTEGER NOT NULL DEFAULT 15,
            atk_iv INTEGER NOT NULL DEFAULT 15,
            def_iv INTEGER NOT NULL DEFAULT 15,
            spd_iv INTEGER NOT NULL DEFAULT 15,
            is_shiny INTEGER NOT NULL DEFAULT 0,
            caught_country_id TEXT DEFAULT '',
            source TEXT NOT NULL DEFAULT 'wild',
            team_slot_3 INTEGER DEFAULT NULL,
            team_slot_6 INTEGER DEFAULT NULL,
            created_at REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS inventory (
            user_id INTEGER NOT NULL,
            item_key TEXT NOT NULL,
            qty INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, item_key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS pokedex (
            user_id INTEGER NOT NULL,
            species_id INTEGER NOT NULL,
            seen INTEGER NOT NULL DEFAULT 1,
            caught INTEGER NOT NULL DEFAULT 0,
            shiny_caught INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, species_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS cup_progress (
            user_id INTEGER NOT NULL,
            cup_id TEXT NOT NULL,
            current_stage INTEGER NOT NULL DEFAULT 1,
            wins INTEGER NOT NULL DEFAULT 0,
            championships INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, cup_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS active_battles (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            mode TEXT NOT NULL,
            state_json TEXT NOT NULL,
            updated_at REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS online_rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            host_user_id INTEGER NOT NULL,
            mode TEXT NOT NULL,
            max_slots INTEGER NOT NULL DEFAULT 2,
            status TEXT NOT NULL DEFAULT 'waiting',
            state_json TEXT NOT NULL DEFAULT '{}',
            created_at REAL NOT NULL,
            FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS room_players (
            room_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            slot_index INTEGER NOT NULL,
            ready INTEGER NOT NULL DEFAULT 0,
            offer_pokemon_id INTEGER DEFAULT NULL,
            team_json TEXT NOT NULL DEFAULT '[]',
            PRIMARY KEY (room_id, user_id),
            FOREIGN KEY (room_id) REFERENCES online_rooms(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS gacha_pity (
            user_id INTEGER NOT NULL,
            banner_id TEXT NOT NULL,
            pity_count INTEGER NOT NULL DEFAULT 0,
            egg_progress INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, banner_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_relics (
            user_id INTEGER NOT NULL,
            relic_id TEXT NOT NULL,
            unlocked INTEGER NOT NULL DEFAULT 1,
            equipped INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, relic_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_missions (
            user_id INTEGER NOT NULL,
            mission_id TEXT NOT NULL,
            period_key TEXT NOT NULL,
            progress INTEGER NOT NULL DEFAULT 0,
            claimed INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, mission_id, period_key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS friendships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requester_id INTEGER NOT NULL,
            addressee_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at REAL NOT NULL,
            UNIQUE(requester_id, addressee_id),
            FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS forum_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category TEXT NOT NULL DEFAULT 'suggestion',
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            dev_status TEXT NOT NULL DEFAULT 'open',
            created_at REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS forum_likes (
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            PRIMARY KEY (post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS forum_replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at REAL NOT NULL,
            FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS pvp_invites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            receiver_id INTEGER NOT NULL,
            room_id INTEGER NOT NULL,
            room_code TEXT NOT NULL,
            mode TEXT NOT NULL DEFAULT 'pvp_3v3',
            status TEXT NOT NULL DEFAULT 'pending',
            expires_at REAL NOT NULL,
            created_at REAL NOT NULL,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """
    )
    # Safe migration for existing SQLite databases missing new columns
    cols = {r["name"] for r in cur.execute("PRAGMA table_info(users)").fetchall()}
    if "tickets" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN tickets INTEGER NOT NULL DEFAULT 12")
    if "tickets_x10" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN tickets_x10 INTEGER NOT NULL DEFAULT 1")
    if "last_seen" not in cols:
        cur.execute("ALTER TABLE users ADD COLUMN last_seen REAL NOT NULL DEFAULT 0")
    conn.commit()
    conn.close()


def touch_user_seen(user_id):
    conn = get_conn()
    conn.execute("UPDATE users SET last_seen = ? WHERE id = ?", (time.time(), user_id))
    conn.commit()
    conn.close()


def trainer_xp_needed(level):
    return 80 + (level - 1) * 45


def pokemon_xp_needed(level):
    return 35 + level * 18


def calc_pokemon_stats(species_id, level, hp_iv=15, atk_iv=15, def_iv=15, spd_iv=15):
    sp = POKEMON_BY_ID.get(species_id, POKEMON_BY_ID[25])
    max_hp = int(((2 * sp["hp"] + hp_iv) * level) / 100) + level + 14
    atk = int(((2 * sp["atk"] + atk_iv) * level) / 100) + 6
    dfn = int(((2 * sp["def"] + def_iv) * level) / 100) + 6
    spd = int(((2 * sp["spd"] + spd_iv) * level) / 100) + 6
    return {"max_hp": max_hp, "atk": atk, "def": dfn, "spd": spd}


def serialize_user_pokemon(row):
    d = dict(row)
    sp = POKEMON_BY_ID.get(d["species_id"], POKEMON_BY_ID[25])
    stats = calc_pokemon_stats(
        d["species_id"], d["level"], d["hp_iv"], d["atk_iv"], d["def_iv"], d["spd_iv"]
    )
    d["species_name"] = sp["name"]
    d["types"] = sp["types"]
    d["gen"] = sp["gen"]
    d["tier"] = sp.get("tier", "Common")
    d["bst"] = sp.get("bst", 300)
    d["capture_rate"] = sp.get("capture_rate", 45)
    d["legendary"] = sp["legendary"]
    d["mythical"] = sp["mythical"]
    d["stats"] = stats
    d["xp_needed"] = pokemon_xp_needed(d["level"])
    d["can_evolve"] = bool(EVOLUTIONS_FORWARD.get(d["species_id"])) and d["level"] >= 12
    d["evolves_to"] = EVOLUTIONS_FORWARD.get(d["species_id"], [])
    return d


def create_user(username, password, starter_species_id=25, starter_continent="Asia"):
    username = username.strip()
    if len(username) < 2 or len(username) > 24:
        return None, "Tên đăng nhập phải từ 2 đến 24 ký tự."
    if len(password) < 4:
        return None, "Mật khẩu tối thiểu 4 ký tự."
    if starter_species_id not in POKEMON_BY_ID:
        starter_species_id = 25

    conn = get_conn()
    cur = conn.cursor()
    now = time.time()
    try:
        cur.execute(
            """
            INSERT INTO users (username, password_hash, level, xp, coins, stardust, open_points, created_at)
            VALUES (?, ?, 1, 0, 500, 100, 0, ?)
            """,
            (username, generate_password_hash(password), now),
        )
    except sqlite3.IntegrityError:
        conn.close()
        return None, "Tên tài khoản đã tồn tại."

    uid = cur.lastrowid

    # Spawn ONLY 1 starting country in the chosen continent; all other continents stay locked!
    starter_cid = pick_starter_country(starter_continent)
    cur.execute(
        """
        INSERT INTO unlocked_countries (user_id, country_id, is_starter, unlocked_at)
        VALUES (?, ?, 1, ?)
        """,
        (uid, starter_cid, now),
    )

    # Starter items
    starter_items = [
        ("poke_ball", 12),
        ("great_ball", 4),
        ("ultra_ball", 1),
        ("master_ball", 0),
        ("potion", 6),
        ("super_potion", 2),
        ("rare_candy", 1),
    ]
    for item_key, qty in starter_items:
        cur.execute(
            "INSERT INTO inventory (user_id, item_key, qty) VALUES (?, ?, ?)",
            (uid, item_key, qty),
        )

    # Grant 1 starter stat Relic unlocked & equipped so player gets an animated Relic right away!
    cur.execute(
        "INSERT INTO user_relics (user_id, relic_id, unlocked, equipped) VALUES (?, 'crimson_claw', 1, 1)",
        (uid,),
    )

    conn.commit()
    conn.close()

    # Give starter Pokemon at Lv.5 in both Team 3 and Team 6 slot 1
    add_pokemon_to_user(
        uid,
        starter_species_id,
        level=5,
        caught_country_id=starter_cid,
        source="starter",
        auto_assign=True,
    )
    return uid, None


def authenticate_user(username, password):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (username.strip(),)).fetchone()
    conn.close()
    if not row or not check_password_hash(row["password_hash"], password):
        return None
    return dict(row)


def add_pokemon_to_user(
    user_id,
    species_id,
    level=5,
    is_shiny=False,
    caught_country_id="",
    source="wild",
    auto_assign=True,
):
    sp = POKEMON_BY_ID.get(species_id, POKEMON_BY_ID[25])
    conn = get_conn()
    cur = conn.cursor()

    slot3 = None
    slot6 = None
    if auto_assign:
        used3 = {
            r["team_slot_3"]
            for r in cur.execute(
                "SELECT team_slot_3 FROM user_pokemon WHERE user_id = ? AND team_slot_3 IS NOT NULL",
                (user_id,),
            )
        }
        for s in (1, 2, 3):
            if s not in used3:
                slot3 = s
                break

        used6 = {
            r["team_slot_6"]
            for r in cur.execute(
                "SELECT team_slot_6 FROM user_pokemon WHERE user_id = ? AND team_slot_6 IS NOT NULL",
                (user_id,),
            )
        }
        for s in (1, 2, 3, 4, 5, 6):
            if s not in used6:
                slot6 = s
                break

    cur.execute(
        """
        INSERT INTO user_pokemon (
            user_id, species_id, nickname, level, xp,
            hp_iv, atk_iv, def_iv, spd_iv, is_shiny,
            caught_country_id, source, team_slot_3, team_slot_6, created_at
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            species_id,
            sp["name"],
            level,
            random.randint(10, 31),
            random.randint(10, 31),
            random.randint(10, 31),
            random.randint(10, 31),
            1 if is_shiny else 0,
            caught_country_id,
            source,
            slot3,
            slot6,
            time.time(),
        ),
    )
    poke_id = cur.lastrowid

    # Mark Pokedex seen + caught
    cur.execute(
        """
        INSERT INTO pokedex (user_id, species_id, seen, caught, shiny_caught)
        VALUES (?, ?, 1, 1, ?)
        ON CONFLICT(user_id, species_id) DO UPDATE SET
            seen = 1,
            caught = 1,
            shiny_caught = MAX(shiny_caught, excluded.shiny_caught)
        """,
        (user_id, species_id, 1 if is_shiny else 0),
    )

    if caught_country_id:
        cur.execute(
            """
            UPDATE unlocked_countries
            SET catches_count = catches_count + 1
            WHERE user_id = ? AND country_id = ?
            """,
            (user_id, caught_country_id),
        )

    conn.commit()
    row = cur.execute("SELECT * FROM user_pokemon WHERE id = ?", (poke_id,)).fetchone()
    conn.close()
    return serialize_user_pokemon(row)


def mark_pokedex_seen(user_id, species_id):
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO pokedex (user_id, species_id, seen, caught, shiny_caught)
        VALUES (?, ?, 1, 0, 0)
        ON CONFLICT(user_id, species_id) DO UPDATE SET seen = 1
        """,
        (user_id, species_id),
    )
    conn.commit()
    conn.close()


def award_trainer_xp(user_id, xp_gain, coins_gain=0, stardust_gain=0):
    """Add Trainer XP/coins/stardust. Every Trainer level-up grants +1 Open Point!"""
    conn = get_conn()
    u = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not u:
        conn.close()
        return None
    lvl = u["level"]
    xp = u["xp"] + xp_gain
    coins = u["coins"] + coins_gain
    stardust = u["stardust"] + stardust_gain
    open_pts = u["open_points"]
    leveled_up = 0

    while xp >= trainer_xp_needed(lvl):
        xp -= trainer_xp_needed(lvl)
        lvl += 1
        open_pts += 1
        leveled_up += 1
        coins += 100

    conn.execute(
        """
        UPDATE users SET level = ?, xp = ?, coins = ?, stardust = ?, open_points = ?
        WHERE id = ?
        """,
        (lvl, xp, coins, stardust, open_pts, user_id),
    )
    if leveled_up > 0:
        conn.execute(
            """
            INSERT INTO inventory (user_id, item_key, qty) VALUES (?, 'poke_ball', ?)
            ON CONFLICT(user_id, item_key) DO UPDATE SET qty = qty + excluded.qty
            """,
            (user_id, 2 * leveled_up),
        )
    conn.commit()
    conn.close()
    return {
        "level": lvl,
        "xp": xp,
        "xp_needed": trainer_xp_needed(lvl),
        "coins": coins,
        "stardust": stardust,
        "open_points": open_pts,
        "leveled_up": leveled_up,
    }


def award_pokemon_xp(user_id, poke_id, xp_gain):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM user_pokemon WHERE id = ? AND user_id = ?", (poke_id, user_id)
    ).fetchone()
    if not row:
        conn.close()
        return None
    lvl = row["level"]
    xp = row["xp"] + xp_gain
    gained_levels = 0
    while lvl < 100 and xp >= pokemon_xp_needed(lvl):
        xp -= pokemon_xp_needed(lvl)
        lvl += 1
        gained_levels += 1

    conn.execute(
        "UPDATE user_pokemon SET level = ?, xp = ? WHERE id = ?", (lvl, xp, poke_id)
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM user_pokemon WHERE id = ?", (poke_id,)).fetchone()
    conn.close()
    res = serialize_user_pokemon(updated)
    res["gained_levels"] = gained_levels
    return res


def evolve_pokemon(user_id, poke_id):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM user_pokemon WHERE id = ? AND user_id = ?", (poke_id, user_id)
    ).fetchone()
    if not row:
        conn.close()
        return None, "Không tìm thấy Pokémon."
    children = EVOLUTIONS_FORWARD.get(row["species_id"], [])
    if not children:
        conn.close()
        return None, "Pokémon này đã đạt cấp tiến hóa tối đa."
    if row["level"] < 12:
        conn.close()
        return None, "Cần tối thiểu Lv.12 để tiến hóa."

    new_species_id = children[0]
    new_sp = POKEMON_BY_ID[new_species_id]
    conn.execute(
        "UPDATE user_pokemon SET species_id = ?, nickname = ? WHERE id = ?",
        (new_species_id, new_sp["name"], poke_id),
    )
    conn.execute(
        """
        INSERT INTO pokedex (user_id, species_id, seen, caught, shiny_caught)
        VALUES (?, ?, 1, 1, ?)
        ON CONFLICT(user_id, species_id) DO UPDATE SET
            seen = 1, caught = 1, shiny_caught = MAX(shiny_caught, excluded.shiny_caught)
        """,
        (user_id, new_species_id, row["is_shiny"]),
    )
    conn.commit()
    updated = conn.execute("SELECT * FROM user_pokemon WHERE id = ?", (poke_id,)).fetchone()
    conn.close()
    return serialize_user_pokemon(updated), None


def unlock_country_for_user(user_id, country_id):
    if country_id not in COUNTRIES_BY_ID:
        return None, "Quốc gia không hợp lệ."
    conn = get_conn()
    u = conn.execute("SELECT open_points FROM users WHERE id = ?", (user_id,)).fetchone()
    if not u:
        conn.close()
        return None, "Không tìm thấy người chơi."
    exists = conn.execute(
        "SELECT 1 FROM unlocked_countries WHERE user_id = ? AND country_id = ?",
        (user_id, country_id),
    ).fetchone()
    if exists:
        conn.close()
        return None, "Bạn đã mở khóa quốc gia này rồi."
    if u["open_points"] < 1:
        conn.close()
        return None, "Bạn không đủ Open Point! Hãy lên cấp Trainer để nhận +1 Open Point."

    conn.execute(
        "UPDATE users SET open_points = open_points - 1 WHERE id = ?", (user_id,)
    )
    conn.execute(
        """
        INSERT INTO unlocked_countries (user_id, country_id, is_starter, unlocked_at)
        VALUES (?, ?, 0, ?)
        """,
        (user_id, country_id, time.time()),
    )
    conn.commit()
    remaining = conn.execute(
        "SELECT open_points FROM users WHERE id = ?", (user_id,)
    ).fetchone()["open_points"]
    conn.close()
    from relics_missions import record_mission_event
    record_mission_event(user_id, "country_unlock", 1)
    return {"country": COUNTRIES_BY_ID[country_id], "open_points": remaining}, None


def get_inventory(user_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT item_key, qty FROM inventory WHERE user_id = ?", (user_id,)
    ).fetchall()
    conn.close()
    return {r["item_key"]: r["qty"] for r in rows}


def change_item_qty(user_id, item_key, delta):
    conn = get_conn()
    cur_row = conn.execute(
        "SELECT qty FROM inventory WHERE user_id = ? AND item_key = ?",
        (user_id, item_key),
    ).fetchone()
    cur_qty = cur_row["qty"] if cur_row else 0
    if cur_qty + delta < 0:
        conn.close()
        return False
    conn.execute(
        """
        INSERT INTO inventory (user_id, item_key, qty) VALUES (?, ?, ?)
        ON CONFLICT(user_id, item_key) DO UPDATE SET qty = qty + ?
        """,
        (user_id, item_key, max(0, delta), delta),
    )
    conn.commit()
    conn.close()
    return True


def get_user_team(user_id, max_size=3):
    col = "team_slot_3" if max_size == 3 else "team_slot_6"
    conn = get_conn()
    rows = conn.execute(
        f"""
        SELECT * FROM user_pokemon
        WHERE user_id = ? AND {col} IS NOT NULL
        ORDER BY {col} ASC
        """,
        (user_id,),
    ).fetchall()
    if not rows:
        # Fallback to first available Pokemon
        rows = conn.execute(
            "SELECT * FROM user_pokemon WHERE user_id = ? ORDER BY id ASC LIMIT ?",
            (user_id, max_size),
        ).fetchall()
    conn.close()
    return [serialize_user_pokemon(r) for r in rows]


def set_team_slot(user_id, poke_id, mode_size, slot_num):
    if mode_size not in (3, 6):
        return False, "Chế độ đội hình phải là 3 hoặc 6."
    col = "team_slot_3" if mode_size == 3 else "team_slot_6"
    if slot_num is not None and (slot_num < 1 or slot_num > mode_size):
        return False, f"Vị trí slot phải từ 1 đến {mode_size}."

    conn = get_conn()
    own = conn.execute(
        "SELECT id FROM user_pokemon WHERE id = ? AND user_id = ?", (poke_id, user_id)
    ).fetchone()
    if not own:
        conn.close()
        return False, "Không sở hữu Pokémon này."

    if slot_num is not None:
        conn.execute(
            f"UPDATE user_pokemon SET {col} = NULL WHERE user_id = ? AND {col} = ?",
            (user_id, slot_num),
        )
    conn.execute(
        f"UPDATE user_pokemon SET {col} = ? WHERE id = ? AND user_id = ?",
        (slot_num, poke_id, user_id),
    )
    conn.commit()
    conn.close()
    return True, None


def get_user_profile(user_id):
    conn = get_conn()
    u = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not u:
        conn.close()
        return None
    unlocked = [
        dict(r)
        for r in conn.execute(
            "SELECT * FROM unlocked_countries WHERE user_id = ?", (user_id,)
        ).fetchall()
    ]
    pokes = [
        serialize_user_pokemon(r)
        for r in conn.execute(
            "SELECT * FROM user_pokemon WHERE user_id = ? ORDER BY level DESC, id DESC",
            (user_id,),
        ).fetchall()
    ]
    inv = {
        r["item_key"]: r["qty"]
        for r in conn.execute(
            "SELECT item_key, qty FROM inventory WHERE user_id = ?", (user_id,)
        ).fetchall()
    }
    dex_rows = conn.execute(
        "SELECT species_id, seen, caught, shiny_caught FROM pokedex WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    dex_stats = {
        "seen": sum(1 for r in dex_rows if r["seen"]),
        "caught": sum(1 for r in dex_rows if r["caught"]),
        "shiny": sum(1 for r in dex_rows if r["shiny_caught"]),
        "caught_ids": [r["species_id"] for r in dex_rows if r["caught"]],
    }
    cups = {
        r["cup_id"]: dict(r)
        for r in conn.execute(
            "SELECT * FROM cup_progress WHERE user_id = ?", (user_id,)
        ).fetchall()
    }
    pity_rows = conn.execute(
        "SELECT banner_id, pity_count, egg_progress FROM gacha_pity WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    pity_map = {r["banner_id"]: {"pity": r["pity_count"], "egg": r["egg_progress"]} for r in pity_rows}
    from relics_missions import get_relic_bonuses, get_user_missions, get_user_relics

    relics = get_user_relics(user_id, conn=conn)
    bonuses = get_relic_bonuses(user_id, conn=conn)
    missions = get_user_missions(user_id, conn=conn)
    conn.close()

    return {
        "id": u["id"],
        "username": u["username"],
        "level": u["level"],
        "xp": u["xp"],
        "xp_needed": trainer_xp_needed(u["level"]),
        "coins": u["coins"],
        "stardust": u["stardust"],
        "open_points": u["open_points"],
        "tickets": u["tickets"] if "tickets" in u.keys() else 12,
        "tickets_x10": u["tickets_x10"] if "tickets_x10" in u.keys() else 1,
        "daily_last": u["daily_last"],
        "unlocked_countries": unlocked,
        "pokemon": pokes,
        "inventory": inv,
        "pokedex": dex_stats,
        "cups": cups,
        "pity_map": pity_map,
        "relics": relics,
        "relic_bonuses": bonuses,
        "missions": missions,
    }


def get_user_hud_state(user_id):
    """Lightweight state for mid-battle turns without re-serializing full Pokemon collection."""
    conn = get_conn()
    u = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not u:
        conn.close()
        return None
    inv = {
        r["item_key"]: r["qty"]
        for r in conn.execute("SELECT item_key, qty FROM inventory WHERE user_id = ?", (user_id,)).fetchall()
    }
    from relics_missions import get_user_missions
    missions = get_user_missions(user_id, conn=conn)
    conn.close()
    return {
        "level": u["level"],
        "xp": u["xp"],
        "xp_needed": trainer_xp_needed(u["level"]),
        "coins": u["coins"],
        "stardust": u["stardust"],
        "open_points": u["open_points"],
        "tickets": u["tickets"] if "tickets" in u.keys() else 12,
        "tickets_x10": u["tickets_x10"] if "tickets_x10" in u.keys() else 1,
        "inventory": inv,
        "missions": missions,
    }

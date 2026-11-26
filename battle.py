import json
import random
import time
import uuid

from db import (
    add_pokemon_to_user,
    award_pokemon_xp,
    award_trainer_xp,
    calc_pokemon_stats,
    change_item_qty,
    get_conn,
    get_user_team,
    mark_pokedex_seen,
)
from relics_missions import get_relic_bonuses, record_mission_event, roll_relic_drop
from world_data import COUNTRIES_BY_ID, POKEMON_BY_ID, POKEMON_LIST, get_country_encounter
from moves_catalog import build_moves_for_species as _build_species_moves

# 18-Type Effectiveness Chart (only non-1.0 multipliers stored)
TYPE_CHART = {
    "normal": {"rock": 0.5, "ghost": 0.0, "steel": 0.5},
    "fire": {"fire": 0.5, "water": 0.5, "grass": 2.0, "ice": 2.0, "bug": 2.0, "rock": 0.5, "dragon": 0.5, "steel": 2.0},
    "water": {"fire": 2.0, "water": 0.5, "grass": 0.5, "ground": 2.0, "rock": 2.0, "dragon": 0.5},
    "electric": {"water": 2.0, "electric": 0.5, "grass": 0.5, "ground": 0.0, "flying": 2.0, "dragon": 0.5},
    "grass": {"fire": 0.5, "water": 2.0, "grass": 0.5, "poison": 0.5, "ground": 2.0, "flying": 0.5, "bug": 0.5, "rock": 2.0, "dragon": 0.5, "steel": 0.5},
    "ice": {"fire": 0.5, "water": 0.5, "grass": 2.0, "ice": 0.5, "ground": 2.0, "flying": 2.0, "dragon": 2.0, "steel": 0.5},
    "fighting": {"normal": 2.0, "ice": 2.0, "poison": 0.5, "flying": 0.5, "psychic": 0.5, "bug": 0.5, "rock": 2.0, "ghost": 0.0, "dark": 2.0, "steel": 2.0, "fairy": 0.5},
    "poison": {"grass": 2.0, "poison": 0.5, "ground": 0.5, "rock": 0.5, "ghost": 0.5, "steel": 0.0, "fairy": 2.0},
    "ground": {"fire": 2.0, "electric": 2.0, "grass": 0.5, "poison": 2.0, "flying": 0.0, "bug": 0.5, "rock": 2.0, "steel": 2.0},
    "flying": {"electric": 0.5, "grass": 2.0, "fighting": 2.0, "bug": 2.0, "rock": 0.5, "steel": 0.5},
    "psychic": {"fighting": 2.0, "poison": 2.0, "psychic": 0.5, "dark": 0.0, "steel": 0.5},
    "bug": {"fire": 0.5, "grass": 2.0, "fighting": 0.5, "poison": 0.5, "flying": 0.5, "psychic": 2.0, "ghost": 0.5, "dark": 2.0, "steel": 0.5, "fairy": 0.5},
    "rock": {"fire": 2.0, "ice": 2.0, "fighting": 0.5, "ground": 0.5, "flying": 2.0, "bug": 2.0, "steel": 0.5},
    "ghost": {"normal": 0.0, "psychic": 2.0, "ghost": 2.0, "dark": 0.5},
    "dragon": {"dragon": 2.0, "steel": 0.5, "fairy": 0.0},
    "dark": {"fighting": 0.5, "psychic": 2.0, "ghost": 2.0, "dark": 0.5, "fairy": 0.5},
    "steel": {"fire": 0.5, "water": 0.5, "electric": 0.5, "ice": 2.0, "rock": 2.0, "steel": 0.5, "fairy": 2.0},
    "fairy": {"fire": 0.5, "fighting": 2.0, "poison": 0.5, "dragon": 2.0, "dark": 2.0, "steel": 0.5},
}

TYPE_MOVES = {
    "normal": [("Tackle", 45), ("Hyper Fang", 75)],
    "fire": [("Flamethrower", 85), ("Fire Blast", 105)],
    "water": [("Water Pulse", 65), ("Hydro Pump", 105)],
    "electric": [("Thunderbolt", 85), ("Volt Tackle", 105)],
    "grass": [("Razor Leaf", 60), ("Solar Beam", 105)],
    "ice": [("Ice Beam", 85), ("Blizzard", 105)],
    "fighting": [("Brick Break", 75), ("Close Combat", 110)],
    "poison": [("Sludge Bomb", 85), ("Venoshock", 70)],
    "ground": [("Earthquake", 95), ("Dig", 75)],
    "flying": [("Aerial Ace", 65), ("Hurricane", 105)],
    "psychic": [("Psybeam", 70), ("Psychic", 95)],
    "bug": [("X-Scissor", 80), ("Bug Buzz", 90)],
    "rock": [("Rock Slide", 75), ("Stone Edge", 100)],
    "ghost": [("Shadow Ball", 85), ("Phantom Force", 95)],
    "dragon": [("Dragon Claw", 80), ("Draco Meteor", 115)],
    "dark": [("Crunch", 80), ("Dark Pulse", 85)],
    "steel": [("Iron Head", 80), ("Flash Cannon", 90)],
    "fairy": [("Dazzling Gleam", 80), ("Moonblast", 95)],
}

CUPS = {
    "continental_cup": {
        "id": "continental_cup",
        "name": "Continental Grand Cup (6v6)",
        "desc": "Giải vô địch châu lục 4 vòng đấu đội hình 6 Pokémon!",
        "stages": 4,
        "base_level": 10,
        "reward_coins": 400,
        "reward_xp": 95,
    },
    "world_masters": {
        "id": "world_masters",
        "name": "World Masters Cup (6v6)",
        "desc": "Đỉnh cao thế giới 5 vòng với đội hình 6 Pokémon mạnh nhất!",
        "stages": 5,
        "base_level": 20,
        "reward_coins": 750,
        "reward_xp": 150,
    },
}


def type_multiplier(move_type, def_types):
    mult = 1.0
    chart = TYPE_CHART.get(move_type, {})
    for dt in def_types:
        mult *= chart.get(dt, 1.0)
    return mult


def build_moves_for_species(species_id):
    return _build_species_moves(species_id, POKEMON_BY_ID)


def fighter_from_user_pokemon(up, bonuses=None):
    b = bonuses or {}
    max_hp = int(up["stats"]["max_hp"] * b.get("hp_mult", 1.0))
    atk = int(up["stats"]["atk"] * b.get("atk_mult", 1.0))
    dfn = int(up["stats"]["def"] * b.get("def_mult", 1.0))
    spd = int(up["stats"]["spd"] * b.get("spd_mult", 1.0))
    return {
        "user_pokemon_id": up["id"],
        "species_id": up["species_id"],
        "name": up["nickname"],
        "level": up["level"],
        "types": up["types"],
        "tier": up.get("tier", "Common"),
        "bst": up.get("bst", 300),
        "hp": max_hp,
        "max_hp": max_hp,
        "atk": atk,
        "def": dfn,
        "spd": spd,
        "is_shiny": bool(up["is_shiny"]),
        "moves": [dict(m) for m in (up.get("moves") or build_moves_for_species(up["species_id"]))],
    }


def fighter_from_wild(species_id, level, is_shiny=False, is_exclusive=False):
    sp = POKEMON_BY_ID[species_id]
    stats = calc_pokemon_stats(species_id, level)
    return {
        "user_pokemon_id": None,
        "species_id": species_id,
        "name": sp["name"],
        "level": level,
        "types": sp["types"],
        "tier": sp.get("tier", "Common"),
        "bst": sp.get("bst", 300),
        "hp": stats["max_hp"],
        "max_hp": stats["max_hp"],
        "atk": stats["atk"],
        "def": stats["def"],
        "spd": stats["spd"],
        "is_shiny": is_shiny,
        "is_exclusive": is_exclusive,
        "moves": build_moves_for_species(species_id),
    }


def calc_damage(attacker, defender, move):
    eff = type_multiplier(move["type"], defender["types"])
    if eff == 0:
        return 0, 0.0, False

    is_stab = move["type"] in attacker["types"]
    stab = 1.28 if is_stab else 1.0

    # Distinct scaling when hitting Neutral (Không khắc) vs Super-Effective (Khắc hệ) vs Resisted (Kháng hệ)
    crit_chance = float(move.get("crit_bonus", 0.08))
    if eff >= 4.0:
        eff_mult = 3.6  # Double-weakness massive burst
        crit_chance += 0.10
    elif eff >= 2.0:
        eff_mult = 2.15  # Distinct boosted weakness exploit vs neutral
        crit_chance += 0.06
    elif eff < 1.0:
        eff_mult = 0.55 if eff >= 0.5 else 0.30
    else:
        eff_mult = 1.0

    crit = random.random() < crit_chance
    crit_mult = 1.55 if crit else 1.0
    rand = random.uniform(0.90, 1.04)

    raw = (((2 * attacker["level"] / 5 + 2) * move["power"] * (attacker["atk"] / max(1, defender["def"]))) / 42 + 2)
    dmg = int(max(1, raw * stab * eff_mult * crit_mult * rand))
    return dmg, eff, crit


def _save_battle(battle_id, user_id, mode, state):
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO active_battles (id, user_id, mode, state_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
        """,
        (battle_id, user_id, mode, json.dumps(state), time.time()),
    )
    conn.commit()
    conn.close()


def _load_battle(battle_id, user_id):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM active_battles WHERE id = ? AND user_id = ?", (battle_id, user_id)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row["state_json"])


def start_wild_or_trainer_battle(user_id, country_id, mode="wild", force_exclusive=False, zone_id=None, weather=None):
    if country_id not in COUNTRIES_BY_ID:
        return None, "Quốc gia không tồn tại."
    conn = get_conn()
    unlocked = conn.execute(
        "SELECT 1 FROM unlocked_countries WHERE user_id = ? AND country_id = ?",
        (user_id, country_id),
    ).fetchone()
    u = conn.execute("SELECT level FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not unlocked:
        return None, "Bạn chưa mở khóa quốc gia này!"

    team_rows = get_user_team(user_id, max_size=3)
    if not team_rows:
        return None, "Bạn chưa có Pokémon trong đội hình 3!"

    bonuses = get_relic_bonuses(user_id)
    player_team = [fighter_from_user_pokemon(p, bonuses) for p in team_rows]
    country = COUNTRIES_BY_ID[country_id]
    trainer_lvl = u["level"]

    if mode == "trainer":
        # Country Ace Trainer with 3 country Pokémon (including exclusive!)
        enemy_team = []
        for idx in range(3):
            enc = get_country_encounter(country_id, trainer_lvl, force_exclusive=(idx == 2))
            mark_pokedex_seen(user_id, enc["species_id"])
            enemy_team.append(
                fighter_from_wild(
                    enc["species_id"],
                    max(5, enc["level"] + idx + 1),
                    is_shiny=False,
                    is_exclusive=enc["is_exclusive"],
                )
            )
        title = f"Ace Trainer {country['name']} (3v3)"
        can_catch = False
    else:
        enc = get_country_encounter(country_id, trainer_lvl, force_exclusive=force_exclusive, zone_id=zone_id, weather=weather)
        mark_pokedex_seen(user_id, enc["species_id"])
        enemy_team = [
            fighter_from_wild(
                enc["species_id"],
                enc["level"],
                is_shiny=enc["is_shiny"],
                is_exclusive=enc["is_exclusive"],
            )
        ]
        excl_tag = f" [ĐỘC QUYỀN {country['name']}]" if enc["is_exclusive"] else ""
        loc_tag = f" @ {enc['landmark_name']}" if enc.get("landmark_name") else ""
        title = f"{enemy_team[0]['name']} hoang dã{loc_tag}{excl_tag}"
        can_catch = True

    bid = uuid.uuid4().hex[:12]
    state = {
        "battle_id": bid,
        "mode": mode,
        "max_team": 3,
        "country_id": country_id,
        "country_name": country["name"],
        "title": title,
        "can_catch": can_catch,
        "player_team": player_team,
        "player_active": 0,
        "enemy_team": enemy_team,
        "enemy_active": 0,
        "status": "ongoing",
        "winner": None,
        "turn": 1,
        "log": [f"Trận chiến bắt đầu: {title}! Bạn mang theo đội hình {len(player_team)} Pokémon."],
        "rewards": None,
    }
    _save_battle(bid, user_id, mode, state)
    return state, None


def start_cup_battle(user_id, cup_id):
    cup = CUPS.get(cup_id)
    if not cup:
        return None, "Giải đấu không tồn tại."
    team_rows = get_user_team(user_id, max_size=6)
    if not team_rows:
        return None, "Bạn cần ít nhất 1 Pokémon trong đội hình 6 để tham dự Grand Cup."

    conn = get_conn()
    prog = conn.execute(
        "SELECT * FROM cup_progress WHERE user_id = ? AND cup_id = ?", (user_id, cup_id)
    ).fetchone()
    stage = prog["current_stage"] if prog else 1
    conn.close()

    bonuses = get_relic_bonuses(user_id)
    player_team = [fighter_from_user_pokemon(p, bonuses) for p in team_rows]
    # 6-Pokemon enemy roster scaling with stage!
    lvl_base = cup["base_level"] + (stage - 1) * 4
    candidates = [p for p in POKEMON_LIST if (stage >= cup["stages"] or not p["legendary"])]
    picked = random.sample(candidates, 6)
    enemy_team = []
    for i, sp in enumerate(picked):
        mark_pokedex_seen(user_id, sp["id"])
        enemy_team.append(fighter_from_wild(sp["id"], lvl_base + (i // 2)))

    bid = uuid.uuid4().hex[:12]
    state = {
        "battle_id": bid,
        "mode": "cup",
        "cup_id": cup_id,
        "cup_stage": stage,
        "max_team": 6,
        "country_id": "",
        "country_name": cup["name"],
        "title": f"{cup['name']} — Vòng {stage}/{cup['stages']}",
        "can_catch": False,
        "player_team": player_team,
        "player_active": 0,
        "enemy_team": enemy_team,
        "enemy_active": 0,
        "status": "ongoing",
        "winner": None,
        "turn": 1,
        "log": [f"Grand Cup Vòng {stage}/{cup['stages']}! Đội hình tối đa 6 Pokémon sẵn sàng!"],
        "rewards": None,
    }
    _save_battle(bid, user_id, "cup", state)
    return state, None


def _finish_battle_win(user_id, state):
    mode = state["mode"]
    coins = 45
    xp = 35
    poke_xp = 30
    extra_msg = ""

    if mode == "trainer":
        coins = 110
        xp = 65
        poke_xp = 55
        if state["country_id"]:
            conn = get_conn()
            conn.execute(
                "UPDATE unlocked_countries SET trainer_defeated = 1 WHERE user_id = ? AND country_id = ?",
                (user_id, state["country_id"]),
            )
            conn.commit()
            conn.close()
    elif mode == "cup":
        cup = CUPS[state["cup_id"]]
        stage = state["cup_stage"]
        coins = cup["reward_coins"] // 2 + stage * 65
        xp = cup["reward_xp"] // 2 + stage * 25
        poke_xp = 80
        conn = get_conn()
        next_stage = stage + 1
        champ = 0
        if next_stage > cup["stages"]:
            next_stage = 1
            champ = 1
            coins += cup["reward_coins"]
            extra_msg = f" 🏆 BẠN ĐÃ VÔ ĐỊCH {cup['name']}!"
        conn.execute(
            """
            INSERT INTO cup_progress (user_id, cup_id, current_stage, wins, championships)
            VALUES (?, ?, ?, 1, ?)
            ON CONFLICT(user_id, cup_id) DO UPDATE SET
                current_stage = excluded.current_stage,
                wins = wins + 1,
                championships = championships + excluded.championships
            """,
            (user_id, state["cup_id"], next_stage, champ),
        )
        conn.commit()
        conn.close()
        if champ:
            change_item_qty(user_id, "ultra_ball", 2)
            change_item_qty(user_id, "rare_candy", 1)

    bonuses = get_relic_bonuses(user_id)
    coins = int(coins * bonuses["coin_mult"])
    xp = int(xp * bonuses["xp_mult"])

    # Drop Gacha Tickets on battle win!
    drop_t1 = 2 if mode in ("trainer", "cup") else (1 if random.random() < 0.7 else 0)
    drop_t10 = 1 if (mode == "cup" and "VÔ ĐỊCH" in extra_msg) or (mode == "trainer" and random.random() < 0.25) else 0
    if drop_t1 or drop_t10:
        conn = get_conn()
        conn.execute(
            "UPDATE users SET tickets = tickets + ?, tickets_x10 = tickets_x10 + ? WHERE id = ?",
            (drop_t1, drop_t10, user_id),
        )
        conn.commit()
        conn.close()
        if drop_t1:
            extra_msg += f" · +{drop_t1} 🎫 Ticket"
        if drop_t10:
            extra_msg += f" · +{drop_t10} 🎟️ ×10 Ticket"

    trainer_res = award_trainer_xp(user_id, xp, coins_gain=coins)
    for pf in state["player_team"]:
        if pf.get("user_pokemon_id"):
            award_pokemon_xp(user_id, pf["user_pokemon_id"], poke_xp)

    record_mission_event(user_id, "battle_win", 1)
    if mode == "cup":
        record_mission_event(user_id, "cup_or_pvp_win", 1)
        if "VÔ ĐỊCH" in extra_msg:
            record_mission_event(user_id, "cup_champ", 1)

    drop_rate = 0.65 if "VÔ ĐỊCH" in extra_msg else (0.38 if mode == "cup" else (0.28 if mode == "trainer" else 0.14))
    dropped_relic = roll_relic_drop(user_id, drop_chance=drop_rate)
    if dropped_relic:
        r_obj = dropped_relic["relic"]
        if dropped_relic["is_new"]:
            extra_msg += f" · 🎁 Rơi Relic [{r_obj['tier']}]: {r_obj['name']}!"
        else:
            extra_msg += f" · 🔮 Relic trùng {r_obj['name']} -> +{dropped_relic['dup_coins']} Coins!"

    state["rewards"] = {
        "coins": coins,
        "trainer_xp": xp,
        "pokemon_xp": poke_xp,
        "trainer": trainer_res,
        "extra": extra_msg,
        "dropped_relic": dropped_relic,
    }


def perform_battle_action(user_id, battle_id, action, param=None):
    state = _load_battle(battle_id, user_id)
    if not state:
        return None, "Không tìm thấy trận đấu."
    if state["status"] != "ongoing":
        return {"state": state, "events": []}, None

    events = []
    p_team = state["player_team"]
    e_team = state["enemy_team"]
    p = p_team[state["player_active"]]
    e = e_team[state["enemy_active"]]
    logs = []

    def enemy_turn():
        nonlocal p, e
        if e["hp"] <= 0 or p["hp"] <= 0:
            return
        emove = random.choice(e["moves"])
        dmg, eff, crit = calc_damage(e, p, emove)
        p["hp"] = max(0, p["hp"] - dmg)
        eff_txt = (
            " 💥 [SIÊU KHẮC ×4!]" if eff >= 4 else
            " 🔥 [KHẮC HỆ ×2!]" if eff >= 2 else
            " 🚫 [VÔ HIỆU ×0]" if eff == 0 else
            " 🛡️ [Kháng ×0.5]" if 0 < eff < 1 else
            " ⚔️ [Thường ×1]"
        )
        crit_txt = " Chí mạng!" if crit else ""
        logs.append(f"{e['name']} dùng {emove['name']} gây {dmg} sát thương!{eff_txt}{crit_txt}")
        events.append({"actor": "enemy", "type": "attack", "move": emove, "dmg": dmg, "eff": eff, "crit": crit})

        if p["hp"] <= 0:
            logs.append(f"{p['name']} đã kiệt sức!")
            # Auto switch if player has healthy pokemon, else lose
            alive_idx = next((i for i, x in enumerate(p_team) if x["hp"] > 0), None)
            if alive_idx is not None:
                state["player_active"] = alive_idx
                p = p_team[alive_idx]
                logs.append(f"Bạn tung {p['name']} ra trận!")
                events.append({"actor": "player", "type": "switch", "index": alive_idx})
            else:
                state["status"] = "lost"
                state["winner"] = "enemy"
                logs.append("Tất cả Pokémon của bạn đã kiệt sức! Bạn rút lui về PokéCenter.")

    if action == "run":
        if not state["can_catch"]:
            return None, "Không thể bỏ chạy trong trận đấu Trainer / Grand Cup!"
        state["status"] = "fled"
        logs.append("Bạn đã rút lui an toàn!")
        events.append({"actor": "player", "type": "run"})

    elif action == "switch":
        idx = int(param)
        if idx < 0 or idx >= len(p_team) or p_team[idx]["hp"] <= 0:
            return None, "Không thể đổi sang Pokémon này."
        if idx == state["player_active"]:
            return None, "Pokémon này đang chiến đấu!"
        state["player_active"] = idx
        p = p_team[idx]
        logs.append(f"Bạn thu hồi và tung {p['name']} (Lv.{p['level']}) ra sân!")
        events.append({"actor": "player", "type": "switch", "index": idx})
        enemy_turn()

    elif action == "potion":
        item_key = str(param or "potion")
        heal_amt = 60 if item_key == "super_potion" else 30
        if not change_item_qty(user_id, item_key, -1):
            return None, "Bạn đã hết bình hồi máu này!"
        old_hp = p["hp"]
        p["hp"] = min(p["max_hp"], p["hp"] + heal_amt)
        logs.append(f"Bạn dùng {item_key} hồi +{p['hp'] - old_hp} HP cho {p['name']}!")
        events.append({"actor": "player", "type": "heal", "amount": p["hp"] - old_hp})
        enemy_turn()

    elif action == "catch":
        if not state["can_catch"]:
            return None, "Không thể ném Poké Ball vào Pokémon của Trainer khác!"
        ball_key = str(param or "poke_ball")
        ball_mult = {"poke_ball": 1.0, "great_ball": 1.6, "ultra_ball": 2.4, "master_ball": 999.0}.get(ball_key)
        if not ball_mult:
            return None, "Loại bóng không hợp lệ."
        if not change_item_qty(user_id, ball_key, -1):
            return None, f"Bạn đã hết {ball_key}!"

        bonuses = get_relic_bonuses(user_id)
        hp_ratio = e["hp"] / max(1, e["max_hp"])
        catch_prob = 1.0 if ball_key == "master_ball" else min(0.96, (1.15 - hp_ratio * 0.75) * 0.45 * ball_mult + bonuses["catch_bonus"])
        caught = random.random() <= catch_prob
        shakes = 3 if caught else random.randint(0, 2)
        events.append({"actor": "player", "type": "throw_ball", "ball": ball_key, "shakes": shakes, "caught": caught})

        if caught:
            added = add_pokemon_to_user(
                user_id,
                e["species_id"],
                level=e["level"],
                is_shiny=e["is_shiny"],
                caught_country_id=state["country_id"],
                source="wild",
                auto_assign=True,
            )
            state["status"] = "caught"
            state["winner"] = "player"
            trainer_res = award_trainer_xp(user_id, int(45 * bonuses["xp_mult"]), coins_gain=int(35 * bonuses["coin_mult"]))
            record_mission_event(user_id, "catch", 1)
            record_mission_event(user_id, "battle_win", 1)
            dropped_relic = roll_relic_drop(user_id, drop_chance=0.14)
            state["rewards"] = {
                "caught_pokemon": added,
                "coins": int(35 * bonuses["coin_mult"]),
                "trainer_xp": int(45 * bonuses["xp_mult"]),
                "trainer": trainer_res,
                "dropped_relic": dropped_relic,
            }
            logs.append(f"✨ Đã bắt thành công {e['name']} (Lv.{e['level']})!")
            if dropped_relic:
                ro = dropped_relic["relic"]
                logs.append(f"🎁 Quái đánh rơi Relic [{ro['tier']}]: {ro['name']}!" if dropped_relic["is_new"] else f"🔮 Relic trùng {ro['name']} (+{dropped_relic['dup_coins']} Coins)!")
        else:
            logs.append(f"{e['name']} đã phá vỡ {ball_key} sau {shakes} lần rung!")
            enemy_turn()

    elif action == "move":
        midx = int(param or 0)
        if midx < 0 or midx >= len(p["moves"]):
            midx = 0
        pmove = p["moves"][midx]

        def player_strike():
            nonlocal e
            dmg, eff, crit = calc_damage(p, e, pmove)
            e["hp"] = max(0, e["hp"] - dmg)
            eff_txt = (
            " 💥 [SIÊU KHẮC ×4!]" if eff >= 4 else
            " 🔥 [KHẮC HỆ ×2!]" if eff >= 2 else
            " 🚫 [VÔ HIỆU ×0]" if eff == 0 else
            " 🛡️ [Kháng ×0.5]" if 0 < eff < 1 else
            " ⚔️ [Thường ×1]"
        )
            crit_txt = " Chí mạng!" if crit else ""
            logs.append(f"{p['name']} dùng {pmove['name']} gây {dmg} sát thương!{eff_txt}{crit_txt}")
            events.append({"actor": "player", "type": "attack", "move": pmove, "dmg": dmg, "eff": eff, "crit": crit})

            if e["hp"] <= 0:
                logs.append(f"{e['name']} của đối thủ đã gục ngã!")
                next_e = next((i for i, x in enumerate(e_team) if x["hp"] > 0), None)
                if next_e is not None:
                    state["enemy_active"] = next_e
                    e = e_team[next_e]
                    logs.append(f"Đối thủ tung {e['name']} (Lv.{e['level']}) ra trận!")
                    events.append({"actor": "enemy", "type": "switch", "index": next_e})
                else:
                    state["status"] = "won"
                    state["winner"] = "player"
                    _finish_battle_win(user_id, state)
                    logs.append(f"🎉 Chiến thắng! +{state['rewards']['coins']} Coins & +{state['rewards']['trainer_xp']} XP!")
                return True
            return False

        if p["spd"] >= e["spd"]:
            enemy_fainted = player_strike()
            if state["status"] == "ongoing" and not enemy_fainted:
                enemy_turn()
        else:
            enemy_turn()
            if state["status"] == "ongoing" and p["hp"] > 0:
                player_strike()

    else:
        return None, "Hành động không hợp lệ."

    state["turn"] += 1
    state["log"].extend(logs)
    state["log"] = state["log"][-14:]
    _save_battle(battle_id, user_id, state["mode"], state)
    return {"state": state, "events": events}, None

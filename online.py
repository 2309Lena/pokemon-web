import json
import random
import string
import time

from battle import calc_damage, fighter_from_user_pokemon
from db import award_trainer_xp, get_conn, get_user_team, serialize_user_pokemon


def _gen_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def _format_room(conn, r):
    players = conn.execute(
        """
        SELECT rp.*, u.username, u.level
        FROM room_players rp
        JOIN users u ON u.id = rp.user_id
        WHERE rp.room_id = ?
        ORDER BY rp.slot_index ASC
        """,
        (r["id"],),
    ).fetchall()
    plist = []
    for p in players:
        offer_poke = None
        if p["offer_pokemon_id"]:
            prow = conn.execute(
                "SELECT * FROM user_pokemon WHERE id = ?", (p["offer_pokemon_id"],)
            ).fetchone()
            if prow:
                offer_poke = serialize_user_pokemon(prow)
        plist.append(
            {
                "user_id": p["user_id"],
                "username": p["username"],
                "level": p["level"],
                "slot_index": p["slot_index"],
                "role": "fighter" if p["slot_index"] <= 2 else "spectator",
                "ready": bool(p["ready"]),
                "offer_pokemon_id": p["offer_pokemon_id"],
                "offer_pokemon": offer_poke,
            }
        )
    host_row = conn.execute(
        "SELECT username FROM users WHERE id = ?", (r["host_user_id"],)
    ).fetchone()
    spectator_count = sum(1 for p in plist if p["slot_index"] > 2)
    fighter_count = len(plist) - spectator_count
    return {
        "id": r["id"],
        "code": r["code"],
        "title": r["title"],
        "host_user_id": r["host_user_id"],
        "host_username": host_row["username"] if host_row else "Host",
        "mode": r["mode"],
        "max_slots": r["max_slots"],
        "occupied_slots": len(plist),
        "fighter_count": fighter_count,
        "spectator_count": spectator_count,
        "spectators_open": max(0, r["max_slots"] - 2),
        "status": r["status"],
        "players": plist,
        "state": json.loads(r["state_json"] or "{}"),
    }


def list_rooms():
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM online_rooms WHERE status != 'closed' ORDER BY id DESC LIMIT 30"
    ).fetchall()
    res = [_format_room(conn, r) for r in rows]
    conn.close()
    return res


def get_room(room_id):
    conn = get_conn()
    r = conn.execute("SELECT * FROM online_rooms WHERE id = ?", (room_id,)).fetchone()
    if not r:
        conn.close()
        return None
    res = _format_room(conn, r)
    conn.close()
    return res


def create_room(user_id, title, mode="pvp_3v3", max_slots=4):
    if mode not in ("pvp_3v3", "pvp_6v6", "trade"):
        return None, "Chế độ phòng không hợp lệ."
    max_slots = max(2, min(10, int(max_slots or 4)))
    title = (title or "Phòng Đấu Pokémon").strip()[:40]
    code = _gen_code()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO online_rooms (code, title, host_user_id, mode, max_slots, status, state_json, created_at)
        VALUES (?, ?, ?, ?, ?, 'waiting', '{}', ?)
        """,
        (code, title, user_id, mode, max_slots, time.time()),
    )
    rid = cur.lastrowid
    cur.execute(
        """
        INSERT INTO room_players (room_id, user_id, slot_index, ready)
        VALUES (?, ?, 1, 0)
        """,
        (rid, user_id),
    )
    conn.commit()
    conn.close()
    return get_room(rid), None


def join_room(user_id, room_id_or_code):
    conn = get_conn()
    if str(room_id_or_code).isdigit():
        r = conn.execute(
            "SELECT * FROM online_rooms WHERE id = ?", (int(room_id_or_code),)
        ).fetchone()
    else:
        r = conn.execute(
            "SELECT * FROM online_rooms WHERE code = ?", (str(room_id_or_code).upper(),)
        ).fetchone()
    if not r or r["status"] == "closed":
        conn.close()
        return None, "Không tìm thấy phòng."

    existing = conn.execute(
        "SELECT 1 FROM room_players WHERE room_id = ? AND user_id = ?",
        (r["id"], user_id),
    ).fetchone()
    if existing:
        conn.close()
        return get_room(r["id"]), None

    players = conn.execute(
        "SELECT slot_index FROM room_players WHERE room_id = ?", (r["id"],)
    ).fetchall()
    if len(players) >= r["max_slots"]:
        conn.close()
        return None, "Phòng đã đầy chỗ!"

    used_slots = {p["slot_index"] for p in players}
    next_slot = next(s for s in range(1, r["max_slots"] + 1) if s not in used_slots)
    conn.execute(
        "INSERT INTO room_players (room_id, user_id, slot_index, ready) VALUES (?, ?, ?, 0)",
        (r["id"], user_id, next_slot),
    )
    conn.commit()
    conn.close()
    return get_room(r["id"]), None


def leave_room(user_id, room_id):
    conn = get_conn()
    r = conn.execute("SELECT * FROM online_rooms WHERE id = ?", (room_id,)).fetchone()
    if not r:
        conn.close()
        return True
    conn.execute(
        "DELETE FROM room_players WHERE room_id = ? AND user_id = ?", (room_id, user_id)
    )
    rem = conn.execute(
        "SELECT COUNT(*) as c FROM room_players WHERE room_id = ?", (room_id,)
    ).fetchone()["c"]
    if rem == 0 or r["host_user_id"] == user_id:
        conn.execute("UPDATE online_rooms SET status = 'closed' WHERE id = ?", (room_id,))
    conn.commit()
    conn.close()
    return True


def toggle_pvp_ready(user_id, room_id):
    conn = get_conn()
    r = conn.execute("SELECT * FROM online_rooms WHERE id = ?", (room_id,)).fetchone()
    if not r or r["mode"] not in ("pvp_3v3", "pvp_6v6"):
        conn.close()
        return None, "Phòng PvP không hợp lệ."
    rp = conn.execute(
        "SELECT * FROM room_players WHERE room_id = ? AND user_id = ?", (room_id, user_id)
    ).fetchone()
    if not rp:
        conn.close()
        return None, "Bạn không ở trong phòng này."
    if rp["slot_index"] > 2:
        conn.close()
        return None, "Bạn đang ở slot Khán giả (Slot 3+). Chỉ 2 Đấu thủ mới cần Sẵn sàng!"

    team_size = 6 if r["mode"] == "pvp_6v6" else 3
    team = [fighter_from_user_pokemon(p) for p in get_user_team(user_id, max_size=team_size)]
    if not team:
        conn.close()
        return None, f"Bạn chưa có Pokémon trong đội hình {team_size}!"

    new_ready = 0 if rp["ready"] else 1
    conn.execute(
        "UPDATE room_players SET ready = ?, team_json = ? WHERE room_id = ? AND user_id = ?",
        (new_ready, json.dumps(team), room_id, user_id),
    )
    conn.commit()

    # Check if top 2 slot players are both ready -> Start PvP Battle!
    challengers = conn.execute(
        """
        SELECT rp.*, u.username FROM room_players rp
        JOIN users u ON u.id = rp.user_id
        WHERE rp.room_id = ? ORDER BY rp.slot_index ASC LIMIT 2
        """,
        (room_id,),
    ).fetchall()
    if len(challengers) == 2 and all(c["ready"] == 1 for c in challengers):
        p1, p2 = challengers[0], challengers[1]
        pvp_state = {
            "turn": 1,
            "status": "ongoing",
            "winner_user_id": None,
            "p1_user_id": p1["user_id"],
            "p2_user_id": p2["user_id"],
            "teams": {
                str(p1["user_id"]): json.loads(p1["team_json"]),
                str(p2["user_id"]): json.loads(p2["team_json"]),
            },
            "active": {
                str(p1["user_id"]): 0,
                str(p2["user_id"]): 0,
            },
            "pending_actions": {},
            "log": [f"⚔️ PvP {r['mode'].upper()} bắt đầu: {p1['username']} vs {p2['username']}!"],
        }
        conn.execute(
            "UPDATE online_rooms SET status = 'in_progress', state_json = ? WHERE id = ?",
            (json.dumps(pvp_state), room_id),
        )
        conn.commit()

    conn.close()
    return get_room(room_id), None


def submit_pvp_action(user_id, room_id, action, param=0):
    conn = get_conn()
    r = conn.execute("SELECT * FROM online_rooms WHERE id = ?", (room_id,)).fetchone()
    if not r or r["status"] != "in_progress":
        conn.close()
        return None, "Trận PvP chưa bắt đầu hoặc đã kết thúc."

    st = json.loads(r["state_json"])
    uid_key = str(user_id)
    if uid_key not in (str(st["p1_user_id"]), str(st["p2_user_id"])):
        conn.close()
        return None, "Bạn đang ở chế độ khán giả."
    if st["status"] != "ongoing":
        conn.close()
        return get_room(room_id), None

    st["pending_actions"][uid_key] = {"action": action, "param": int(param or 0)}

    u1 = str(st["p1_user_id"])
    u2 = str(st["p2_user_id"])
    if u1 in st["pending_actions"] and u2 in st["pending_actions"]:
        logs = []
        a1 = st["pending_actions"][u1]
        a2 = st["pending_actions"][u2]
        st["pending_actions"] = {}

        # Process switches first
        for ukey, act in ((u1, a1), (u2, a2)):
            if act["action"] == "switch":
                idx = act["param"]
                t = st["teams"][ukey]
                if 0 <= idx < len(t) and t[idx]["hp"] > 0:
                    st["active"][ukey] = idx
                    logs.append(f"Người chơi đổi sang {t[idx]['name']}!")

        # Order attacks by speed
        f1 = st["teams"][u1][st["active"][u1]]
        f2 = st["teams"][u2][st["active"][u2]]
        order = [(u1, u2, a1), (u2, u1, a2)] if f1["spd"] >= f2["spd"] else [(u2, u1, a2), (u1, u2, a1)]
        turn_events = []

        for atk_u, def_u, act in order:
            if act["action"] != "move" or st["status"] != "ongoing":
                continue
            atk_f = st["teams"][atk_u][st["active"][atk_u]]
            def_f = st["teams"][def_u][st["active"][def_u]]
            if atk_f["hp"] <= 0 or def_f["hp"] <= 0:
                continue
            midx = max(0, min(len(atk_f["moves"]) - 1, act["param"]))
            mv = atk_f["moves"][midx]
            dmg, eff, crit = calc_damage(atk_f, def_f, mv)
            def_f["hp"] = max(0, def_f["hp"] - dmg)
            turn_events.append({
                "actor_user_id": int(atk_u),
                "target_user_id": int(def_u),
                "move_type": mv["type"],
                "dmg": dmg,
                "eff": eff,
                "crit": crit,
            })
            logs.append(f"{atk_f['name']} dùng {mv['name']} gây {dmg} sát thương!")
            if def_f["hp"] <= 0:
                logs.append(f"{def_f['name']} gục ngã!")
                nxt = next((i for i, x in enumerate(st["teams"][def_u]) if x["hp"] > 0), None)
                if nxt is not None:
                    st["active"][def_u] = nxt
                    logs.append(f"Tung {st['teams'][def_u][nxt]['name']} ra sân!")
                else:
                    st["status"] = "finished"
                    st["winner_user_id"] = int(atk_u)
                    logs.append("🏆 Trận PvP kết thúc! Người thắng nhận +140 Coins & +60 XP!")
                    award_trainer_xp(int(atk_u), 60, coins_gain=140)
                    award_trainer_xp(int(def_u), 20, coins_gain=30)

        st["last_events"] = turn_events
        st["turn"] += 1
        st["log"] = (st["log"] + logs)[-12:]
        new_status = "finished" if st["status"] == "finished" else "in_progress"
        conn.execute(
            "UPDATE online_rooms SET status = ?, state_json = ? WHERE id = ?",
            (new_status, json.dumps(st), room_id),
        )
    else:
        conn.execute(
            "UPDATE online_rooms SET state_json = ? WHERE id = ?",
            (json.dumps(st), room_id),
        )

    conn.commit()
    conn.close()
    return get_room(room_id), None


def select_trade_pokemon(user_id, room_id, user_pokemon_id):
    conn = get_conn()
    r = conn.execute("SELECT * FROM online_rooms WHERE id = ?", (room_id,)).fetchone()
    if not r or r["mode"] != "trade":
        conn.close()
        return None, "Đây không phải phòng Trade."
    own = conn.execute(
        "SELECT id FROM user_pokemon WHERE id = ? AND user_id = ?",
        (user_pokemon_id, user_id),
    ).fetchone()
    if not own:
        conn.close()
        return None, "Bạn không sở hữu Pokémon này."

    # Reset ready flags when an offer changes
    conn.execute("UPDATE room_players SET ready = 0 WHERE room_id = ?", (room_id,))
    conn.execute(
        "UPDATE room_players SET offer_pokemon_id = ? WHERE room_id = ? AND user_id = ?",
        (user_pokemon_id, room_id, user_id),
    )
    conn.commit()
    conn.close()
    return get_room(room_id), None


def confirm_trade(user_id, room_id):
    conn = get_conn()
    r = conn.execute("SELECT * FROM online_rooms WHERE id = ?", (room_id,)).fetchone()
    if not r or r["mode"] != "trade":
        conn.close()
        return None, "Đây không phải phòng Trade."

    conn.execute(
        "UPDATE room_players SET ready = 1 WHERE room_id = ? AND user_id = ?",
        (room_id, user_id),
    )
    conn.commit()

    players = conn.execute(
        "SELECT * FROM room_players WHERE room_id = ? ORDER BY slot_index ASC LIMIT 2",
        (room_id,),
    ).fetchall()
    if (
        len(players) == 2
        and players[0]["ready"] == 1
        and players[1]["ready"] == 1
        and players[0]["offer_pokemon_id"]
        and players[1]["offer_pokemon_id"]
    ):
        p1, p2 = players[0], players[1]
        pk1 = conn.execute(
            "SELECT * FROM user_pokemon WHERE id = ? AND user_id = ?",
            (p1["offer_pokemon_id"], p1["user_id"]),
        ).fetchone()
        pk2 = conn.execute(
            "SELECT * FROM user_pokemon WHERE id = ? AND user_id = ?",
            (p2["offer_pokemon_id"], p2["user_id"]),
        ).fetchone()
        if not pk1 or not pk2:
            conn.close()
            return None, "Pokémon giao dịch không còn hợp lệ."

        c1 = conn.execute(
            "SELECT COUNT(*) as c FROM user_pokemon WHERE user_id = ?", (p1["user_id"],)
        ).fetchone()["c"]
        c2 = conn.execute(
            "SELECT COUNT(*) as c FROM user_pokemon WHERE user_id = ?", (p2["user_id"],)
        ).fetchone()["c"]
        if c1 < 1 or c2 < 1:
            conn.close()
            return None, "Mỗi người chơi phải có ít nhất 1 Pokémon."

        # Atomic ownership swap
        conn.execute(
            "UPDATE user_pokemon SET user_id = ?, source = 'trade', team_slot_3 = NULL, team_slot_6 = NULL WHERE id = ?",
            (p2["user_id"], pk1["id"]),
        )
        conn.execute(
            "UPDATE user_pokemon SET user_id = ?, source = 'trade', team_slot_3 = NULL, team_slot_6 = NULL WHERE id = ?",
            (p1["user_id"], pk2["id"]),
        )
        # Update Pokedex for both recipients
        for uid, sp_id, shiny in (
            (p2["user_id"], pk1["species_id"], pk1["is_shiny"]),
            (p1["user_id"], pk2["species_id"], pk2["is_shiny"]),
        ):
            conn.execute(
                """
                INSERT INTO pokedex (user_id, species_id, seen, caught, shiny_caught)
                VALUES (?, ?, 1, 1, ?)
                ON CONFLICT(user_id, species_id) DO UPDATE SET
                    seen = 1, caught = 1, shiny_caught = MAX(shiny_caught, excluded.shiny_caught)
                """,
                (uid, sp_id, shiny),
            )

        conn.execute(
            "UPDATE room_players SET ready = 0, offer_pokemon_id = NULL WHERE room_id = ?",
            (room_id,),
        )
        st = {
            "last_trade": f"🤝 Giao dịch thành công #{pk1['species_id']} ↔ #{pk2['species_id']}! (+25 XP)"
        }
        conn.execute(
            "UPDATE online_rooms SET state_json = ? WHERE id = ?",
            (json.dumps(st), room_id),
        )
        conn.commit()
        conn.close()
        award_trainer_xp(p1["user_id"], 25)
        award_trainer_xp(p2["user_id"], 25)
        return get_room(room_id), None

    conn.close()
    return get_room(room_id), None

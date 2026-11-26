import time
from db import get_conn
from world_data import POKEMON_BY_ID

SALVAGE_RATES = {
    "Common": {"coins": 60, "tickets": 0, "tickets_x10": 0},
    "Uncommon": {"coins": 120, "tickets": 0, "tickets_x10": 0},
    "Rare": {"coins": 0, "tickets": 3, "tickets_x10": 0},
    "Epic": {"coins": 0, "tickets": 5, "tickets_x10": 0},
    "Legendary": {"coins": 0, "tickets": 0, "tickets_x10": 1},
    "Mythic": {"coins": 0, "tickets": 0, "tickets_x10": 3},
}


def salvage_pokemon_list(user_id, pokemon_ids=None, bulk_tier=None, keep_team=True):
    """Dismantle selected Pokemon or non-team Pokemon of a given tier into Coins or Gacha Tickets."""
    conn = get_conn()
    all_rows = conn.execute(
        "SELECT id, species_id, level, is_shiny, team_slot_3, team_slot_6 FROM user_pokemon WHERE user_id = ?",
        (user_id,),
    ).fetchall()
    if len(all_rows) <= 1:
        conn.close()
        return None, "Bạn phải giữ lại ít nhất 1 Pokémon!"

    targets = []
    if pokemon_ids:
        want = {int(pid) for pid in pokemon_ids}
        targets = [r for r in all_rows if r["id"] in want]
        if not targets:
            conn.close()
            return None, "Không tìm thấy Pokémon để tách."
    elif bulk_tier:
        seen_species = set()
        for r in all_rows:
            sp = POKEMON_BY_ID.get(r["species_id"], POKEMON_BY_ID[25])
            t = sp.get("tier", "Common")
            if bulk_tier == "duplicates":
                # Keep highest level or team Pokemon, salvage duplicate lower ones (excluding Shiny)
                if r["is_shiny"] or (keep_team and (r["team_slot_3"] or r["team_slot_6"])):
                    seen_species.add(r["species_id"])
                    continue
                if r["species_id"] in seen_species:
                    targets.append(r)
                else:
                    seen_species.add(r["species_id"])
            elif t == bulk_tier:
                if keep_team and (r["team_slot_3"] or r["team_slot_6"]):
                    continue
                if r["is_shiny"]:
                    continue
                targets.append(r)
        if not targets:
            conn.close()
            return None, "Không có Pokémon nào phù hợp (đã bỏ qua Pokémon trong đội hình & Shiny)."
    else:
        conn.close()
        return None, "Chưa chọn Pokémon để tách."

    # Never leave the player with 0 Pokemon!
    if len(targets) >= len(all_rows):
        targets = targets[: len(all_rows) - 1]
    if not targets:
        conn.close()
        return None, "Bạn phải giữ lại ít nhất 1 Pokémon!"

    total_coins = 0
    total_t1 = 0
    total_t10 = 0
    for r in targets:
        sp = POKEMON_BY_ID.get(r["species_id"], POKEMON_BY_ID[25])
        tier = sp.get("tier", "Common")
        rate = SALVAGE_RATES.get(tier, SALVAGE_RATES["Common"])
        total_coins += rate["coins"]
        total_t1 += rate["tickets"]
        total_t10 += rate["tickets_x10"]

    del_ids = [r["id"] for r in targets]
    placeholders = ",".join("?" for _ in del_ids)
    conn.execute(
        f"DELETE FROM user_pokemon WHERE user_id = ? AND id IN ({placeholders})",
        [user_id, *del_ids],
    )
    conn.execute(
        "UPDATE users SET coins = coins + ?, tickets = tickets + ?, tickets_x10 = tickets_x10 + ? WHERE id = ?",
        (total_coins, total_t1, total_t10, user_id),
    )
    conn.commit()
    conn.close()

    return {
        "count": len(del_ids),
        "coins": total_coins,
        "tickets": total_t1,
        "tickets_x10": total_t10,
    }, None


def get_friends_overview(user_id):
    now = time.time()
    conn = get_conn()
    conn.execute("UPDATE users SET last_seen = ? WHERE id = ?", (now, user_id))
    conn.commit()

    rows = conn.execute(
        """
        SELECT f.id as req_id, f.requester_id, f.addressee_id, f.status, f.created_at,
               u.id as other_id, u.username, u.level, u.last_seen,
               (SELECT COUNT(*) FROM unlocked_countries uc WHERE uc.user_id = u.id) as countries_cnt,
               (SELECT COUNT(*) FROM pokedex px WHERE px.user_id = u.id AND px.caught = 1) as dex_cnt
        FROM friendships f
        JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
        WHERE f.requester_id = ? OR f.addressee_id = ?
        ORDER BY f.id DESC
        """,
        (user_id, user_id, user_id),
    ).fetchall()
    conn.close()

    friends = []
    incoming = []
    outgoing = []
    for r in rows:
        item = {
            "request_id": r["req_id"],
            "user_id": r["other_id"],
            "username": r["username"],
            "level": r["level"],
            "online": (now - (r["last_seen"] or 0)) < 120,
            "countries": r["countries_cnt"],
            "pokedex": r["dex_cnt"],
        }
        if r["status"] == "accepted":
            friends.append(item)
        elif r["addressee_id"] == user_id:
            incoming.append(item)
        else:
            outgoing.append(item)

    return {"friends": friends, "incoming": incoming, "outgoing": outgoing}


def send_friend_request(user_id, target_username):
    target_username = (target_username or "").strip()
    if not target_username:
        return None, "Vui lòng nhập tên Trainer cần kết bạn."
    conn = get_conn()
    target = conn.execute(
        "SELECT id, username FROM users WHERE LOWER(username) = LOWER(?)", (target_username,)
    ).fetchone()
    if not target:
        conn.close()
        return None, f"Không tìm thấy Trainer '{target_username}'."
    if target["id"] == user_id:
        conn.close()
        return None, "Không thể tự kết bạn với chính mình!"

    existing = conn.execute(
        """
        SELECT * FROM friendships
        WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
        """,
        (user_id, target["id"], target["id"], user_id),
    ).fetchone()

    if existing:
        if existing["status"] == "accepted":
            conn.close()
            return None, f"Bạn và {target['username']} đã là bạn bè rồi."
        if existing["requester_id"] == target["id"]:
            # Mutual request -> auto accept!
            conn.execute("UPDATE friendships SET status = 'accepted' WHERE id = ?", (existing["id"],))
            conn.commit()
            conn.close()
            return {"status": "accepted", "username": target["username"]}, None
        conn.close()
        return None, f"Đã gửi lời mời kết bạn cho {target['username']} rồi."

    conn.execute(
        "INSERT INTO friendships (requester_id, addressee_id, status, created_at) VALUES (?, ?, 'pending', ?)",
        (user_id, target["id"], time.time()),
    )
    conn.commit()
    conn.close()
    return {"status": "pending", "username": target["username"]}, None


def respond_friend_request(user_id, request_id, action):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM friendships WHERE id = ? AND addressee_id = ? AND status = 'pending'",
        (request_id, user_id),
    ).fetchone()
    if not row:
        conn.close()
        return None, "Không tìm thấy lời mời kết bạn."
    if action == "accept":
        conn.execute("UPDATE friendships SET status = 'accepted' WHERE id = ?", (request_id,))
    else:
        conn.execute("DELETE FROM friendships WHERE id = ?", (request_id,))
    conn.commit()
    conn.close()
    return {"action": action}, None


def remove_friend(user_id, friend_user_id):
    conn = get_conn()
    conn.execute(
        """
        DELETE FROM friendships
        WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)
        """,
        (user_id, friend_user_id, friend_user_id, user_id),
    )
    conn.commit()
    conn.close()
    return True

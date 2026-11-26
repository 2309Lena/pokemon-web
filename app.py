import datetime
import glob
import gzip
import hashlib
import hmac
import os
import secrets
import subprocess
import time
from functools import wraps

from flask import Flask, jsonify, render_template, request, session

from battle import (
    CUPS,
    perform_battle_action,
    start_cup_battle,
    start_wild_or_trainer_battle,
)
from db import (
    MULTITYPE_SPECIES,
    PLATE_CATALOG,
    authenticate_user,
    award_pokemon_xp,
    award_trainer_xp,
    change_item_qty,
    create_user,
    evolve_pokemon,
    get_conn,
    get_user_hud_state,
    get_user_profile,
    init_db,
    pokemon_xp_needed,
    serialize_user_pokemon,
    set_team_slot,
    touch_user_seen,
    unlock_country_for_user,
)
from friends_salvage import (
    SALVAGE_RATES,
    create_pvp_invite,
    get_friends_overview,
    poll_pvp_invites,
    remove_friend,
    respond_friend_request,
    respond_pvp_invite,
    salvage_pokemon_list,
    search_users_for_friend,
    send_friend_request,
)
from online import (
    confirm_trade,
    create_room,
    get_room,
    join_room,
    leave_room,
    list_rooms,
    select_trade_pokemon,
    submit_pvp_action,
    toggle_pvp_ready,
)
from packs import (
    PACK_CATALOG,
    get_gacha_banners_meta,
    open_booster_pack,
    pull_gacha_banner,
)
from relics_missions import (
    RELIC_CATALOG,
    buy_relic,
    claim_mission_reward,
    get_user_missions,
    toggle_equip_relic,
)
from world_data import (
    BIOME_PALETTE,
    COUNTRIES,
    COUNTRIES_BY_ID,
    EXCLUSIVE_OWNER,
    POKEMON_BY_ID,
    POKEMON_LIST,
    get_country_map_layout,
)

def _get_secret_key():
    env_k = os.environ.get("POKEMON_SECRET_KEY")
    if env_k:
        return env_k
    key_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".secret_key")
    if os.path.exists(key_file):
        with open(key_file, "r", encoding="utf-8") as f:
            k = f.read().strip()
            if k:
                return k
    k = secrets.token_hex(32)
    try:
        with open(key_file, "w", encoding="utf-8") as f:
            f.write(k)
    except OSError:
        pass
    return k


app = Flask(__name__)
app.secret_key = _get_secret_key()
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


def _compute_asset_ver():
    base = os.path.dirname(os.path.abspath(__file__))
    mtimes = []
    for rel in ("static/style.css", "static/vfx.js", "static/app.js"):
        p = os.path.join(base, rel)
        if os.path.exists(p):
            mtimes.append(int(os.path.getmtime(p)))
    return str(max(mtimes) if mtimes else 1)


ASSET_VER = _compute_asset_ver()


@app.after_request
def optimize_response(resp):
    if request.path.startswith("/static/assets/") and resp.status_code == 200:
        resp.headers["Cache-Control"] = "public, max-age=86400"
    elif request.path.startswith("/static/") and resp.status_code == 200:
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    if (
        resp.status_code == 200
        and not resp.direct_passthrough
        and "gzip" in request.headers.get("Accept-Encoding", "").lower()
        and "Content-Encoding" not in resp.headers
        and resp.content_length
        and resp.content_length > 1024
        and any(t in (resp.mimetype or "") for t in ("json", "javascript", "css", "html", "svg"))
    ):
        data = gzip.compress(resp.get_data(), compresslevel=6)
        resp.set_data(data)
        resp.headers["Content-Encoding"] = "gzip"
        resp.headers["Vary"] = "Accept-Encoding"
        resp.headers["Content-Length"] = len(data)
    return resp

SHOP_ITEMS = [
    {"key": "poke_ball", "name": "Poké Ball", "price": 50, "icon": "/static/assets/items/poke-ball.png", "desc": "Bóng tiêu chuẩn bắt Pokémon hoang dã."},
    {"key": "great_ball", "name": "Great Ball", "price": 120, "icon": "/static/assets/items/great-ball.png", "desc": "Tăng 1.6x tỷ lệ bắt Pokémon."},
    {"key": "ultra_ball", "name": "Ultra Ball", "price": 250, "icon": "/static/assets/items/ultra-ball.png", "desc": "Tăng 2.4x tỷ lệ bắt Pokémon hiếm."},
    {"key": "master_ball", "name": "Master Ball", "price": 1500, "icon": "/static/assets/items/master-ball.png", "desc": "Bắt chắc chắn 100% không trượt!"},
    {"key": "potion", "name": "Potion (+30 HP)", "price": 60, "icon": "/static/assets/items/potion.png", "desc": "Hồi phục 30 HP trong trận đấu."},
    {"key": "super_potion", "name": "Super Potion (+60 HP)", "price": 150, "icon": "/static/assets/items/super-potion.png", "desc": "Hồi phục 60 HP trong trận đấu."},
    {"key": "rare_candy", "name": "Rare Candy (+1 Lv)", "price": 200, "icon": "/static/assets/items/rare-candy.png", "desc": "Dùng trực tiếp để tăng 1 cấp cho Pokémon."},
    {"key": "ticket", "name": "Gacha Ticket (×1)", "price": 220, "icon": "/static/assets/ui/ticket_gold.png", "desc": "Vé quay Gacha 1 lượt theo từng vùng Gen 1–9."},
    {"key": "ticket_x10", "name": "Royal Ticket (×10)", "price": 2100, "icon": "/static/assets/ui/ticket_x10.png", "desc": "Vé VIP quay ngay 10 lượt Gacha, đảm bảo Epic+!"},
]
SHOP_BY_KEY = {i["key"]: i for i in SHOP_ITEMS}


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        uid = session.get("user_id")
        if not uid:
            return jsonify({"error": "Vui lòng đăng nhập."}), 401
        return fn(uid, *args, **kwargs)

    return wrapper


@app.route("/")
def index():
    return render_template("index.html", asset_v=ASSET_VER)


@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "")
    password = data.get("password", "")
    starter_id = int(data.get("starter_id", 25))
    starter_continent = data.get("starter_continent", "Asia")
    uid, err = create_user(username, password, starter_id, starter_continent)
    if err:
        return jsonify({"error": err}), 400
    session["user_id"] = uid
    return jsonify({"user": get_user_profile(uid)})


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    u = authenticate_user(data.get("username", ""), data.get("password", ""))
    if not u:
        return jsonify({"error": "Sai tên đăng nhập hoặc mật khẩu."}), 401
    session["user_id"] = u["id"]
    touch_user_seen(u["id"])
    return jsonify({"user": get_user_profile(u["id"])})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.pop("user_id", None)
    return jsonify({"ok": True})


@app.route("/api/me")
def api_me():
    uid = session.get("user_id")
    if not uid:
        return jsonify({"user": None})
    prof = get_user_profile(uid)
    if not prof:
        session.pop("user_id", None)
        return jsonify({"user": None})
    touch_user_seen(uid)
    return jsonify({"user": prof})


@app.route("/api/daily", methods=["POST"])
@login_required
def api_daily(uid):
    today = datetime.date.today().isoformat()
    conn = get_conn()
    u = conn.execute("SELECT daily_last FROM users WHERE id = ?", (uid,)).fetchone()
    if u and u["daily_last"] == today:
        conn.close()
        return jsonify({"error": "Hôm nay bạn đã nhận quà điểm danh rồi!"}), 400
    conn.execute("UPDATE users SET daily_last = ? WHERE id = ?", (today, uid))
    conn.commit()
    conn.close()
    change_item_qty(uid, "poke_ball", 5)
    change_item_qty(uid, "great_ball", 2)
    award_trainer_xp(uid, 40, coins_gain=150, stardust_gain=50)
    return jsonify({"user": get_user_profile(uid), "message": "🎁 Nhận thưởng ngày: +150 Coins, +40 XP, +5 Poké Ball, +2 Great Ball!"})


POKEDEX_SPECIES_PAYLOAD = [
    {
        "id": p["id"],
        "name": p["name"],
        "types": p["types"],
        "gen": p["gen"],
        "hp": p["hp"],
        "atk": p["atk"],
        "def": p["def"],
        "spd": p["spd"],
        "bst": p.get("bst", 300),
        "capture_rate": p.get("capture_rate", 45),
        "tier": p.get("tier", "Common"),
        "legendary": p["legendary"],
        "mythical": p["mythical"],
        "exclusive_country_id": EXCLUSIVE_OWNER.get(p["id"]),
        "exclusive_country_name": COUNTRIES_BY_ID[EXCLUSIVE_OWNER[p["id"]]]["name"]
        if p["id"] in EXCLUSIVE_OWNER
        else None,
    }
    for p in POKEMON_LIST
]


@app.route("/api/pokedex")
def api_pokedex():
    return jsonify({"species": POKEDEX_SPECIES_PAYLOAD})


@app.route("/api/world")
@login_required
def api_world(uid):
    prof = get_user_profile(uid)
    unlocked_map = {c["country_id"]: c for c in prof["unlocked_countries"]}
    countries_payload = []
    for c in COUNTRIES:
        u_info = unlocked_map.get(c["id"])
        countries_payload.append(
            {
                "id": c["id"],
                "name": c["name"],
                "continent": c["continent"],
                "biome": c["biome"],
                "biome_label": BIOME_PALETTE.get(c["biome"], BIOME_PALETTE["forest"])["label"],
                "cx": c["cx"],
                "cy": c["cy"],
                "svg_path": c["svg_path"],
                "unlocked": bool(u_info),
                "is_starter": bool(u_info and u_info["is_starter"]),
                "trainer_defeated": bool(u_info and u_info["trainer_defeated"]),
                "catches_count": u_info["catches_count"] if u_info else 0,
                "exclusive_pokemon": [
                    {
                        "id": pid,
                        "name": POKEMON_BY_ID[pid]["name"],
                        "types": POKEMON_BY_ID[pid]["types"],
                        "tier": POKEMON_BY_ID[pid].get("tier", "Common"),
                    }
                    for pid in c["exclusive_pokemon"]
                ],
                "local_pool": [
                    {
                        "id": pid,
                        "name": POKEMON_BY_ID[pid]["name"],
                        "types": POKEMON_BY_ID[pid]["types"],
                        "tier": POKEMON_BY_ID[pid].get("tier", "Common"),
                    }
                    for pid in c["local_pool"]
                ],
            }
        )
    return jsonify({"countries": countries_payload, "open_points": prof["open_points"]})


@app.route("/api/world/unlock", methods=["POST"])
@login_required
def api_world_unlock(uid):
    data = request.get_json(silent=True) or {}
    cid = data.get("country_id", "")
    res, err = unlock_country_for_user(uid, cid)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"result": res, "user": get_user_profile(uid)})


@app.route("/api/explore/<country_id>")
@login_required
def api_explore_map(uid, country_id):
    if country_id not in COUNTRIES_BY_ID:
        return jsonify({"error": "Quốc gia không tồn tại."}), 404
    conn = get_conn()
    unlocked = conn.execute(
        "SELECT 1 FROM unlocked_countries WHERE user_id = ? AND country_id = ?",
        (uid, country_id),
    ).fetchone()
    conn.close()
    if not unlocked:
        return jsonify({"error": "Bạn cần dùng 1 Open Point để mở khóa quốc gia này trước!"}), 403
    layout = get_country_map_layout(country_id)
    c = COUNTRIES_BY_ID[country_id]
    return jsonify(
        {
            "country": {
                "id": c["id"],
                "name": c["name"],
                "continent": c["continent"],
                "biome": c["biome"],
                "exclusive_pokemon": [POKEMON_BY_ID[pid] for pid in c["exclusive_pokemon"]],
                "local_pool": [POKEMON_BY_ID[pid] for pid in c["local_pool"]],
            },
            "map": layout,
        }
    )


@app.route("/api/battle/start", methods=["POST"])
@login_required
def api_battle_start(uid):
    data = request.get_json(silent=True) or {}
    country_id = data.get("country_id", "")
    mode = data.get("mode", "wild")
    force_excl = bool(data.get("force_exclusive", False))
    zone_id = data.get("zone_id")
    weather = data.get("weather")
    state, err = start_wild_or_trainer_battle(
        uid, country_id, mode=mode, force_exclusive=force_excl, zone_id=zone_id, weather=weather
    )
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"state": state, "user": get_user_profile(uid)})


@app.route("/api/battle/action", methods=["POST"])
@login_required
def api_battle_action(uid):
    data = request.get_json(silent=True) or {}
    battle_id = data.get("battle_id", "")
    action = data.get("action", "")
    param = data.get("param")
    res, err = perform_battle_action(uid, battle_id, action, param)
    if err:
        return jsonify({"error": err}), 400
    if res["state"]["status"] == "ongoing":
        return jsonify({"state": res["state"], "events": res["events"], "hud": get_user_hud_state(uid)})
    return jsonify({"state": res["state"], "events": res["events"], "user": get_user_profile(uid)})


@app.route("/api/cup/list")
@login_required
def api_cup_list(uid):
    prof = get_user_profile(uid)
    return jsonify({"cups": list(CUPS.values()), "progress": prof["cups"]})


@app.route("/api/cup/start", methods=["POST"])
@login_required
def api_cup_start(uid):
    data = request.get_json(silent=True) or {}
    cup_id = data.get("cup_id", "continental_cup")
    state, err = start_cup_battle(uid, cup_id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"state": state, "user": get_user_profile(uid)})


@app.route("/api/packs")
def api_packs_list():
    return jsonify({"packs": PACK_CATALOG, "shop_items": SHOP_ITEMS})


@app.route("/api/packs/open", methods=["POST"])
@login_required
def api_packs_open(uid):
    data = request.get_json(silent=True) or {}
    pack_id = data.get("pack_id", "")
    res, err = open_booster_pack(uid, pack_id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"result": res, "user": get_user_profile(uid)})


@app.route("/api/shop/buy", methods=["POST"])
@login_required
def api_shop_buy(uid):
    data = request.get_json(silent=True) or {}
    item_key = data.get("item_key", "")
    qty = max(1, min(100, int(data.get("qty", 1))))
    item = SHOP_BY_KEY.get(item_key)
    if not item:
        return jsonify({"error": "Vật phẩm không tồn tại."}), 400
    cost = item["price"] * qty
    conn = get_conn()
    u = conn.execute("SELECT coins FROM users WHERE id = ?", (uid,)).fetchone()
    if u["coins"] < cost:
        conn.close()
        return jsonify({"error": f"Không đủ Coins! Cần {cost} Coins."}), 400
    conn.execute("UPDATE users SET coins = coins - ? WHERE id = ?", (cost, uid))
    if item_key == "ticket":
        conn.execute("UPDATE users SET tickets = tickets + ? WHERE id = ?", (qty, uid))
    elif item_key == "ticket_x10":
        conn.execute("UPDATE users SET tickets_x10 = tickets_x10 + ? WHERE id = ?", (qty, uid))
    conn.commit()
    conn.close()
    if item_key not in ("ticket", "ticket_x10"):
        change_item_qty(uid, item_key, qty)
    return jsonify({"user": get_user_profile(uid), "message": f"Đã mua {qty}x {item['name']}!"})


@app.route("/api/gacha/banners")
def api_gacha_banners():
    return jsonify({"banners": get_gacha_banners_meta()})


@app.route("/api/gacha/pull", methods=["POST"])
@login_required
def api_gacha_pull(uid):
    data = request.get_json(silent=True) or {}
    res, err = pull_gacha_banner(uid, data.get("banner_id", "kanto"), data.get("mode", "x1"))
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"result": res, "user": get_user_profile(uid)})


@app.route("/api/relics/buy", methods=["POST"])
@login_required
def api_relics_buy(uid):
    data = request.get_json(silent=True) or {}
    rel, err = buy_relic(uid, data.get("relic_id", ""))
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"relic": rel, "user": get_user_profile(uid), "message": f"Đã mở khóa {rel['name']}!"})


@app.route("/api/relics/equip", methods=["POST"])
@login_required
def api_relics_equip(uid):
    data = request.get_json(silent=True) or {}
    res, err = toggle_equip_relic(uid, data.get("relic_id", ""))
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"result": res, "user": get_user_profile(uid)})


@app.route("/api/missions")
@login_required
def api_missions(uid):
    return jsonify({"missions": get_user_missions(uid)})


@app.route("/api/missions/claim", methods=["POST"])
@login_required
def api_missions_claim(uid):
    data = request.get_json(silent=True) or {}
    m, err = claim_mission_reward(uid, data.get("mission_id", ""))
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"mission": m, "user": get_user_profile(uid), "message": f"🎁 Đã nhận thưởng: {m['title']}!"})


@app.route("/api/team/assign", methods=["POST"])
@login_required
def api_team_assign(uid):
    data = request.get_json(silent=True) or {}
    poke_id = int(data.get("pokemon_id", 0))
    mode_size = int(data.get("mode_size", 3))
    slot_num = data.get("slot")
    slot_num = int(slot_num) if slot_num is not None else None
    ok, err = set_team_slot(uid, poke_id, mode_size, slot_num)
    if not ok:
        return jsonify({"error": err}), 400
    return jsonify({"user": get_user_profile(uid)})


@app.route("/api/pokemon/evolve", methods=["POST"])
@login_required
def api_pokemon_evolve(uid):
    data = request.get_json(silent=True) or {}
    poke_id = int(data.get("pokemon_id", 0))
    poke, err = evolve_pokemon(uid, poke_id)
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"pokemon": poke, "user": get_user_profile(uid)})


@app.route("/api/pokemon/candy", methods=["POST"])
@login_required
def api_pokemon_candy(uid):
    data = request.get_json(silent=True) or {}
    poke_id = int(data.get("pokemon_id", 0))
    amount_raw = data.get("amount", 1)

    conn = get_conn()
    prow = conn.execute(
        "SELECT level FROM user_pokemon WHERE id = ? AND user_id = ?", (poke_id, uid)
    ).fetchone()
    inv_row = conn.execute(
        "SELECT qty FROM inventory WHERE user_id = ? AND item_key = 'rare_candy'", (uid,)
    ).fetchone()
    conn.close()

    if not prow:
        return jsonify({"error": "Không tìm thấy Pokémon."}), 404
    cur_lvl = prow["level"]
    if cur_lvl >= 100:
        return jsonify({"error": "Pokémon đã đạt cấp tối đa (Lv.100)."}), 400

    have_candy = inv_row["qty"] if inv_row else 0
    if have_candy <= 0:
        return jsonify({"error": "Bạn đã hết Rare Candy!"}), 400

    levels_room = 100 - cur_lvl
    if str(amount_raw).strip().lower() == "max":
        use_qty = min(levels_room, have_candy)
    else:
        try:
            req = max(1, min(100, int(amount_raw)))
        except (TypeError, ValueError):
            req = 1
        use_qty = min(req, levels_room)
        if have_candy < use_qty:
            return jsonify({"error": f"Không đủ Rare Candy! Cần {use_qty} viên (hiện có {have_candy})."}), 400

    if not change_item_qty(uid, "rare_candy", -use_qty):
        return jsonify({"error": "Bạn đã hết Rare Candy!"}), 400

    xp_total = sum(pokemon_xp_needed(l) for l in range(cur_lvl, cur_lvl + use_qty))
    updated = award_pokemon_xp(uid, poke_id, xp_total)
    return jsonify({
        "pokemon": updated,
        "used": use_qty,
        "message": f"🍬 {updated['nickname']} tăng +{use_qty} cấp lên Lv.{updated['level']}!",
        "user": get_user_profile(uid),
    })


@app.route("/api/pokemon/plate", methods=["POST"])
@login_required
def api_pokemon_plate(uid):
    data = request.get_json(silent=True) or {}
    poke_id = int(data.get("pokemon_id", 0))
    plate_type = (data.get("plate_type") or "normal").strip().lower()
    if plate_type not in PLATE_CATALOG:
        return jsonify({"error": "Hệ Phiến Đá không hợp lệ."}), 400

    conn = get_conn()
    prow = conn.execute(
        "SELECT * FROM user_pokemon WHERE id = ? AND user_id = ?", (poke_id, uid)
    ).fetchone()
    if not prow:
        conn.close()
        return jsonify({"error": "Không tìm thấy Pokémon."}), 404
    if prow["species_id"] not in MULTITYPE_SPECIES:
        conn.close()
        return jsonify({"error": "Chỉ Pokémon có đặc tính Đa Hệ (Arceus / Silvally) mới gắn được Phiến Đá!"}), 400
    if (prow["plate_type"] or "normal") == plate_type:
        conn.close()
        return jsonify({"error": f"Pokémon đang mang {PLATE_CATALOG[plate_type]} rồi."}), 400

    if plate_type != "normal":
        conn.close()
        if not change_item_qty(uid, "plate_stone", -1):
            return jsonify({"error": "Bạn đã hết Phiến Đá Đa Hệ! Chỉ có thể nhận qua Quest Khó Hàng Tuần."}), 400
        conn = get_conn()

    conn.execute(
        "UPDATE user_pokemon SET plate_type = ? WHERE id = ? AND user_id = ?",
        (None if plate_type == "normal" else plate_type, poke_id, uid),
    )
    conn.commit()
    updated_row = conn.execute("SELECT * FROM user_pokemon WHERE id = ?", (poke_id,)).fetchone()
    conn.close()
    updated = serialize_user_pokemon(updated_row)
    return jsonify({
        "pokemon": updated,
        "message": f"🔮 {updated['nickname']} đã chuyển sang {PLATE_CATALOG[plate_type]}!",
        "user": get_user_profile(uid),
    })


@app.route("/api/pokemon/salvage", methods=["POST"])
@login_required
def api_pokemon_salvage(uid):
    data = request.get_json(silent=True) or {}
    bulk_tier = data.get("bulk_tier")
    species_id = data.get("species_id")
    poke_ids = data.get("pokemon_ids")
    if poke_ids is None and data.get("pokemon_id") is not None:
        poke_ids = [int(data["pokemon_id"])]
    keep_team = bool(data.get("keep_team", True))

    res, err = salvage_pokemon_list(
        uid, pokemon_ids=poke_ids, bulk_tier=bulk_tier, keep_team=keep_team, species_id=species_id
    )
    if err:
        return jsonify({"error": err}), 400

    parts = []
    if res["coins"]:
        parts.append(f"+{res['coins']} PokéCoins")
    if res["tickets"]:
        parts.append(f"+{res['tickets']} Vé quay thường")
    if res["tickets_x10"]:
        parts.append(f"+{res['tickets_x10']} Vé Tím (x10)")
    msg = f"Đã tách {res['count']} Pokémon → {', '.join(parts)}!"
    return jsonify({"result": res, "rates": SALVAGE_RATES, "message": msg, "user": get_user_profile(uid)})


@app.route("/api/friends", methods=["GET"])
@login_required
def api_friends_list(uid):
    touch_user_seen(uid)
    return jsonify(get_friends_overview(uid))


@app.route("/api/friends/search", methods=["GET"])
@login_required
def api_friends_search(uid):
    touch_user_seen(uid)
    q = request.args.get("q", "")
    return jsonify({"users": search_users_for_friend(uid, q)})


@app.route("/api/friends/request", methods=["POST"])
@login_required
def api_friends_request(uid):
    touch_user_seen(uid)
    data = request.get_json(silent=True) or {}
    res, err = send_friend_request(uid, data.get("username", ""))
    if err:
        return jsonify({"error": err}), 400
    msg = (
        f"Bạn và {res['username']} đã trở thành bạn bè!"
        if res["status"] == "accepted"
        else f"Đã gửi lời mời kết bạn tới {res['username']}!"
    )
    return jsonify({"result": res, "message": msg, "overview": get_friends_overview(uid)})


@app.route("/api/friends/respond", methods=["POST"])
@login_required
def api_friends_respond(uid):
    touch_user_seen(uid)
    data = request.get_json(silent=True) or {}
    req_id = int(data.get("request_id", 0))
    action = data.get("action", "")
    res, err = respond_friend_request(uid, req_id, action)
    if err:
        return jsonify({"error": err}), 400
    msg = "Đã chấp nhận kết bạn!" if res["action"] == "accept" else "Đã từ chối lời mời."
    return jsonify({"result": res, "message": msg, "overview": get_friends_overview(uid)})


@app.route("/api/friends/remove", methods=["POST"])
@login_required
def api_friends_remove(uid):
    touch_user_seen(uid)
    data = request.get_json(silent=True) or {}
    friend_id = int(data.get("friend_id", 0))
    remove_friend(uid, friend_id)
    return jsonify({"message": "Đã hủy kết bạn.", "overview": get_friends_overview(uid)})


@app.route("/api/friends/invite", methods=["POST"])
@login_required
def api_friends_invite(uid):
    touch_user_seen(uid)
    data = request.get_json(silent=True) or {}
    res, err = create_pvp_invite(
        uid,
        target_username=data.get("username"),
        friend_id=data.get("friend_id"),
        mode=data.get("mode", "pvp_3v3"),
    )
    if err:
        return jsonify({"error": err}), 400
    return jsonify(res)


@app.route("/api/friends/invites/poll", methods=["GET"])
@login_required
def api_friends_invite_poll(uid):
    touch_user_seen(uid)
    return jsonify(poll_pvp_invites(uid))


@app.route("/api/friends/invite/respond", methods=["POST"])
@login_required
def api_friends_invite_respond(uid):
    touch_user_seen(uid)
    data = request.get_json(silent=True) or {}
    res, err = respond_pvp_invite(uid, data.get("invite_id", 0), data.get("action", "decline"))
    if err:
        return jsonify({"error": err}), 400
    return jsonify(res)


def _fetch_forum_posts(uid, category="all"):
    conn = get_conn()
    params = []
    where = ""
    if category and category != "all":
        where = "WHERE fp.category = ?"
        params.append(category)
    rows = conn.execute(
        f"""
        SELECT fp.id, fp.user_id, fp.category, fp.title, fp.content, fp.dev_status, fp.created_at,
               u.username, u.level,
               (SELECT COUNT(*) FROM forum_likes fl WHERE fl.post_id = fp.id) as likes_count,
               (SELECT 1 FROM forum_likes fl2 WHERE fl2.post_id = fp.id AND fl2.user_id = ?) as liked_by_me
        FROM forum_posts fp
        JOIN users u ON u.id = fp.user_id
        {where}
        ORDER BY fp.id DESC
        LIMIT 80
        """,
        [uid, *params],
    ).fetchall()

    post_ids = [r["id"] for r in rows]
    replies_by_post = {pid: [] for pid in post_ids}
    if post_ids:
        ph = ",".join("?" for _ in post_ids)
        rep_rows = conn.execute(
            f"""
            SELECT fr.id, fr.post_id, fr.user_id, fr.content, fr.created_at, u.username, u.level
            FROM forum_replies fr
            JOIN users u ON u.id = fr.user_id
            WHERE fr.post_id IN ({ph})
            ORDER BY fr.id ASC
            """,
            post_ids,
        ).fetchall()
        for rr in rep_rows:
            replies_by_post[rr["post_id"]].append(
                {
                    "id": rr["id"],
                    "username": rr["username"],
                    "level": rr["level"],
                    "content": rr["content"],
                    "created_at": rr["created_at"],
                }
            )
    conn.close()

    return [
        {
            "id": r["id"],
            "category": r["category"],
            "title": r["title"],
            "content": r["content"],
            "dev_status": r["dev_status"],
            "created_at": r["created_at"],
            "username": r["username"],
            "level": r["level"],
            "likes_count": r["likes_count"],
            "liked_by_me": bool(r["liked_by_me"]),
            "is_mine": r["user_id"] == uid,
            "replies": replies_by_post.get(r["id"], []),
        }
        for r in rows
    ]


@app.route("/api/forum/posts", methods=["GET"])
@login_required
def api_forum_list(uid):
    cat = request.args.get("category", "all")
    return jsonify({"posts": _fetch_forum_posts(uid, cat)})


@app.route("/api/forum/posts", methods=["POST"])
@login_required
def api_forum_create(uid):
    data = request.get_json(silent=True) or {}
    category = (data.get("category") or "suggestion").strip()
    if category not in ("suggestion", "bug", "balance", "chat"):
        category = "suggestion"
    title = (data.get("title") or "").strip()[:100]
    content = (data.get("content") or "").strip()[:1500]
    if len(title) < 3:
        return jsonify({"error": "Tiêu đề phải có ít nhất 3 ký tự."}), 400
    if len(content) < 5:
        return jsonify({"error": "Nội dung góp ý phải có ít nhất 5 ký tự."}), 400

    conn = get_conn()
    conn.execute(
        "INSERT INTO forum_posts (user_id, category, title, content, created_at) VALUES (?, ?, ?, ?, ?)",
        (uid, category, title, content, time.time()),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Đã gửi góp ý lên Forum cho Dev đọc!", "posts": _fetch_forum_posts(uid)})


@app.route("/api/forum/posts/<int:post_id>/like", methods=["POST"])
@login_required
def api_forum_like(uid, post_id):
    conn = get_conn()
    exists = conn.execute("SELECT 1 FROM forum_posts WHERE id = ?", (post_id,)).fetchone()
    if not exists:
        conn.close()
        return jsonify({"error": "Bài viết không tồn tại."}), 404
    liked = conn.execute("SELECT 1 FROM forum_likes WHERE post_id = ? AND user_id = ?", (post_id, uid)).fetchone()
    if liked:
        conn.execute("DELETE FROM forum_likes WHERE post_id = ? AND user_id = ?", (post_id, uid))
    else:
        conn.execute("INSERT INTO forum_likes (post_id, user_id) VALUES (?, ?)", (post_id, uid))
    conn.commit()
    conn.close()
    return jsonify({"posts": _fetch_forum_posts(uid)})


@app.route("/api/forum/posts/<int:post_id>/reply", methods=["POST"])
@login_required
def api_forum_reply(uid, post_id):
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()[:800]
    if len(content) < 2:
        return jsonify({"error": "Bình luận quá ngắn."}), 400
    conn = get_conn()
    exists = conn.execute("SELECT 1 FROM forum_posts WHERE id = ?", (post_id,)).fetchone()
    if not exists:
        conn.close()
        return jsonify({"error": "Bài viết không tồn tại."}), 404
    conn.execute(
        "INSERT INTO forum_replies (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
        (post_id, uid, content, time.time()),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Đã bình luận!", "posts": _fetch_forum_posts(uid)})


@app.route("/api/forum/posts/<int:post_id>", methods=["DELETE"])
@login_required
def api_forum_delete(uid, post_id):
    conn = get_conn()
    row = conn.execute("SELECT user_id FROM forum_posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Bài viết không tồn tại."}), 404
    if row["user_id"] != uid:
        conn.close()
        return jsonify({"error": "Bạn chỉ có thể xóa bài viết của chính mình."}), 403
    conn.execute("DELETE FROM forum_posts WHERE id = ?", (post_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Đã xóa bài viết.", "posts": _fetch_forum_posts(uid)})


@app.route("/api/online/rooms")
@login_required
def api_online_rooms(uid):
    return jsonify({"rooms": list_rooms()})


@app.route("/api/online/rooms/<int:room_id>")
@login_required
def api_online_room_detail(uid, room_id):
    r = get_room(room_id)
    if not r:
        return jsonify({"error": "Phòng không tồn tại."}), 404
    return jsonify({"room": r})


@app.route("/api/online/create", methods=["POST"])
@login_required
def api_online_create(uid):
    data = request.get_json(silent=True) or {}
    room, err = create_room(uid, data.get("title", "Phòng Pokémon"), data.get("mode", "pvp_3v3"), data.get("max_slots", 2))
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"room": room})


@app.route("/api/online/join", methods=["POST"])
@login_required
def api_online_join(uid):
    data = request.get_json(silent=True) or {}
    room, err = join_room(uid, data.get("room_id") or data.get("code", ""))
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"room": room})


@app.route("/api/online/leave", methods=["POST"])
@login_required
def api_online_leave(uid):
    data = request.get_json(silent=True) or {}
    leave_room(uid, int(data.get("room_id", 0)))
    return jsonify({"ok": True})


@app.route("/api/online/pvp/ready", methods=["POST"])
@login_required
def api_online_pvp_ready(uid):
    data = request.get_json(silent=True) or {}
    room, err = toggle_pvp_ready(uid, int(data.get("room_id", 0)))
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"room": room})


@app.route("/api/online/pvp/action", methods=["POST"])
@login_required
def api_online_pvp_action(uid):
    data = request.get_json(silent=True) or {}
    room, err = submit_pvp_action(
        uid,
        int(data.get("room_id", 0)),
        data.get("action", "move"),
        data.get("param", 0),
    )
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"room": room, "user": get_user_profile(uid)})


@app.route("/api/online/trade/offer", methods=["POST"])
@login_required
def api_online_trade_offer(uid):
    data = request.get_json(silent=True) or {}
    room, err = select_trade_pokemon(
        uid, int(data.get("room_id", 0)), int(data.get("pokemon_id", 0))
    )
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"room": room})


@app.route("/api/online/trade/confirm", methods=["POST"])
@login_required
def api_online_trade_confirm(uid):
    data = request.get_json(silent=True) or {}
    room, err = confirm_trade(uid, int(data.get("room_id", 0)))
    if err:
        return jsonify({"error": err}), 400
    return jsonify({"room": room, "user": get_user_profile(uid)})


def _get_webhook_secret():
    env_s = os.environ.get("GITHUB_WEBHOOK_SECRET")
    if env_s:
        return env_s.strip()
    sec_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".webhook_secret")
    if os.path.exists(sec_file):
        with open(sec_file, "r", encoding="utf-8") as f:
            s = f.read().strip()
            if s:
                return s
    s = secrets.token_hex(24)
    try:
        with open(sec_file, "w", encoding="utf-8") as f:
            f.write(s)
    except OSError:
        pass
    return s


@app.route("/api/webhook/deploy", methods=["POST"])
def api_webhook_deploy():
    secret = _get_webhook_secret()
    sig_header = request.headers.get("X-Hub-Signature-256", "")
    if not sig_header.startswith("sha256="):
        return jsonify({"error": "Missing signature"}), 403
    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"), request.get_data(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig_header, expected):
        return jsonify({"error": "Invalid signature"}), 403

    event = request.headers.get("X-GitHub-Event", "")
    if event == "ping":
        return jsonify({"ok": True, "event": "ping"})
    if event != "push":
        return jsonify({"ok": True, "ignored_event": event})

    payload = request.get_json(silent=True) or {}
    if payload.get("ref") != "refs/heads/main":
        return jsonify({"ok": True, "ignored_ref": payload.get("ref")})

    repo_dir = os.path.dirname(os.path.abspath(__file__))
    proc = subprocess.run(
        ["git", "pull", "origin", "main"],
        cwd=repo_dir,
        capture_output=True,
        text=True,
        timeout=25,
    )
    if proc.returncode != 0:
        return jsonify({"ok": False, "stderr": proc.stderr}), 500

    reloaded = []
    for wsgi_path in glob.glob("/var/www/*_wsgi.py"):
        try:
            os.utime(wsgi_path, None)
            reloaded.append(wsgi_path)
        except OSError:
            pass
    return jsonify({"ok": True, "stdout": proc.stdout.strip(), "reloaded": reloaded})


init_db()
_get_webhook_secret()

if __name__ == "__main__":
    port = int(os.environ.get("PORT") or os.environ.get("SERVER_PORT") or 5001)
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)

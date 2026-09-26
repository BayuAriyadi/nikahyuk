#!/usr/bin/env bash
# Smoke test DELETE /api/invitations/{id}: happy path, 401, 403, 404, cascade DB, prune disk.
set -u
export PATH=/opt/data/bin:/opt/data/opt:$PATH
cd /opt/data/projects/nikahyuk
BASE=http://127.0.0.1:8010/api
PSQL="psql -h /opt/data/cache/scratch/pgsock -U nikahyuk -d nikahyuk -tA"
TOK=$(cat /opt/data/cache/scratch/task8_token.txt)
TS=$(date +%s)
PASS=0; FAIL=0
ok(){ echo "PASS: $1"; PASS=$((PASS+1)); }
bad(){ echo "FAIL: $1"; FAIL=$((FAIL+1)); }
jget(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)"; }

# --- 1. create invitation
RESP=$(curl -s -X POST $BASE/invitations -H "Authorization: Bearer $TOK" -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d '{"template_name":"klasik","bride_data":{"groom":{"name":"Uji Hapus"},"bride":{"name":"Coba Hapus"}}}')
ID=$(echo "$RESP" | jget '["data"]["id"]')
SLUG=$(echo "$RESP" | jget '["data"]["slug"]')
if [ -n "$ID" ]; then ok "create undangan ($SLUG)"; else bad "create undangan: $RESP"; exit 1; fi

# --- 2. upload foto
PHOTO=$(ls storage/app/public/gallery/andi-dewi/*.jpg | head -1)
URL=$(curl -s -X POST $BASE/invitations/$ID/photos -H "Authorization: Bearer $TOK" -H 'Accept: application/json' -F "photo=@$PHOTO" | jget '["data"]["url"]')
FILE="storage/app/public${URL#/storage}"
if [ -f "$FILE" ]; then ok "foto terupload, ada di disk ($URL)"; else bad "foto tidak ada di disk ($URL)"; fi

# --- 3. tamu + checkout (transaksi) untuk bukti cascade
# (RSVP publik tidak dipakai: undangan masih draft, kontrak publik draft -> 404)
$PSQL -c "INSERT INTO guests (id, invitation_id, name, rsvp_status, message, created_at, updated_at) VALUES (gen_random_uuid(), '$ID', 'Tamu Uji', 'attending', 'tes hapus', now(), now());" >/dev/null
C=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/invitations/$SLUG/checkout -H "Authorization: Bearer $TOK" -H 'Accept: application/json')
echo "info: checkout http $C"
G=$($PSQL -c "SELECT count(*) FROM guests WHERE invitation_id='$ID';")
T=$($PSQL -c "SELECT count(*) FROM transactions WHERE invitation_id='$ID';")
if [ "$G" = 1 ]; then ok "guest row ada sebelum hapus"; else bad "guest count=$G"; fi
if [ "$T" = 1 ]; then ok "transaction row ada sebelum hapus"; else bad "tx count=$T"; fi

# --- 4. authz
C=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $BASE/invitations/$ID -H 'Accept: application/json')
if [ "$C" = 401 ]; then ok "tanpa token http 401"; else bad "tanpa token http $C"; fi
B=$(curl -s -X POST $BASE/register -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -d "{\"name\":\"Uji Hapus B\",\"email\":\"uji.hapus.$TS@test.local\",\"password\":\"rahasia12345\",\"password_confirmation\":\"rahasia12345\"}")
BTOK=$(echo "$B" | jget '["token"]')
C=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $BASE/invitations/$ID -H "Authorization: Bearer $BTOK" -H 'Accept: application/json')
if [ "$C" = 403 ]; then ok "user lain http 403"; else bad "user lain http $C"; fi

# --- 5. hapus + cascade + prune
C=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $BASE/invitations/$ID -H "Authorization: Bearer $TOK" -H 'Accept: application/json')
if [ "$C" = 204 ]; then ok "owner hapus http 204"; else bad "owner hapus http $C"; fi
C=$(curl -s -o /dev/null -w '%{http_code}' $BASE/invitations/$SLUG -H 'Accept: application/json')
if [ "$C" = 404 ]; then ok "halaman publik 404 setelah hapus"; else bad "publik http $C"; fi
N=$($PSQL -c "SELECT count(*) FROM invitations WHERE id='$ID';")
G=$($PSQL -c "SELECT count(*) FROM guests WHERE invitation_id='$ID';")
T=$($PSQL -c "SELECT count(*) FROM transactions WHERE invitation_id='$ID';")
if [ "$N" = 0 ]; then ok "invitation row hilang"; else bad "invitation count=$N"; fi
if [ "$G" = 0 ]; then ok "guest ikut terhapus (cascade)"; else bad "guest count=$G"; fi
if [ "$T" = 0 ]; then ok "transaction ikut terhapus (cascade)"; else bad "tx count=$T"; fi
if [ ! -e "storage/app/public/gallery/$SLUG" ]; then ok "folder galeri terhapus"; else bad "folder galeri masih ada"; fi
C=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $BASE/invitations/$ID -H "Authorization: Bearer $TOK" -H 'Accept: application/json')
if [ "$C" = 404 ]; then ok "hapus ulang http 404"; else bad "hapus ulang http $C"; fi

# --- cleanup user B
$PSQL -c "DELETE FROM users WHERE email='uji.hapus.$TS@test.local';" >/dev/null
echo "== PASS=$PASS FAIL=$FAIL =="

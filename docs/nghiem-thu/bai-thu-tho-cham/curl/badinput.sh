#!/bin/bash
B=http://localhost:4555/api/v1
J='content-type: application/json'
echo "== Giới hạn tốc độ (5/phút): 8 lần đăng nhập sai, CÙNG một x-forwarded-for"
for i in $(seq 1 8); do curl -s -o /dev/null -w '%{http_code} ' -H "$J" -H 'x-forwarded-for: 203.0.113.7' -X POST $B/auth/login -d '{"email":"x@nt.local","password":"sai"}'; done; echo
echo "== 8 lần đăng nhập sai, MỖI lần đổi x-forwarded-for"
for i in $(seq 1 8); do curl -s -o /dev/null -w '%{http_code} ' -H "$J" -H "x-forwarded-for: 198.51.100.$i" -X POST $B/auth/login -d '{"email":"x@nt.local","password":"sai"}'; done; echo
echo "== 8 lần đăng nhập sai, KHÔNG gửi x-forwarded-for"
for i in $(seq 1 8); do curl -s -o /dev/null -w '%{http_code} ' -H "$J" -X POST $B/auth/login -d '{"email":"x@nt.local","password":"sai"}'; done; echo

X(){ echo "-- $1"; shift; curl -s -w '  [HTTP %{http_code}]\n' "$@"; }
echo "== JSON hỏng"
X "JSON hỏng" -H "$J" -H 'x-forwarded-for: 192.0.2.1' -X POST $B/auth/login -d '{"email":'
echo "== Thân quá 100kb"
python3 -c "import json;print(json.dumps({'email':'a@b.vn','password':'x'*200000}))" > ${TMPDIR:-/tmp}/nt-big.json
X "thân 200KB" -H "$J" -H 'x-forwarded-for: 192.0.2.2' -X POST $B/auth/login --data-binary @${TMPDIR:-/tmp}/nt-big.json
echo "== Bảng mã lạ"
X "charset=utf-7" -H 'content-type: application/json; charset=utf-7' -H 'x-forwarded-for: 192.0.2.3' -X POST $B/auth/login -d '{"email":"a@b.vn","password":"x"}'
echo "== Nén lạ"
X "content-encoding: br-la" -H "$J" -H 'content-encoding: xyz' -H 'x-forwarded-for: 192.0.2.4' -X POST $B/auth/login -d '{"email":"a@b.vn","password":"x"}'
echo "== Ký tự rỗng \\u0000 trong họ tên"
X "fullName chứa \\u0000" -H "$J" -H 'x-forwarded-for: 192.0.2.5' -X POST $B/auth/register -d "{\"email\":\"nul$RANDOM@nt.local\",\"password\":\"mat-khau-nt-123\",\"fullName\":\"A\\u0000B\"}"
echo "== Kiểu sai"
X "email là số" -H "$J" -H 'x-forwarded-for: 192.0.2.6' -X POST $B/auth/login -d '{"email":123,"password":["x"]}'
echo "== Thân là mảng / null"
X "thân là null" -H "$J" -H 'x-forwarded-for: 192.0.2.7' -X POST $B/auth/login -d 'null'
echo "== Email rất dài"
E=$(python3 -c "print('a'*300+'@nt.local')")
X "email 309 ký tự" -H "$J" -H 'x-forwarded-for: 192.0.2.8' -X POST $B/auth/login -d "{\"email\":\"$E\",\"password\":\"x\"}"

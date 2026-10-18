#!/bin/bash
# Gọi thử thật vào bản build đang chạy ở cổng 4555
B=http://localhost:4555/api/v1
J='content-type: application/json'
R=$RANDOM
pass=0; total=0
chk(){ total=$((total+1)); if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "OK   [$1] $2"; else echo "SAI  [$1] mong $3 nhận $2"; fi; }
code(){ echo "$1" | tail -n1; }
body(){ echo "$1" | sed '$d'; }
req(){ curl -s -w '\n%{http_code}' -H "$J" -H "x-forwarded-for: 10.0.$1.1" "${@:2}"; }

r=$(req 1 -X POST $B/auth/register -d "{\"email\":\"chu$R@nt.local\",\"password\":\"mat-khau-nt-123\",\"fullName\":\"Chủ NT\"}"); chk "đăng ký" $(code "$r") 201
AT=$(body "$r" | jq -r .accessToken); RT=$(body "$r" | jq -r .refreshToken)
r=$(req 2 -X POST $B/auth/login -d "{\"email\":\"chu$R@nt.local\",\"password\":\"mat-khau-nt-123\"}"); chk "đăng nhập" $(code "$r") 200
r=$(req 3 -X POST $B/auth/login -d "{\"email\":\"chu$R@nt.local\",\"password\":\"sai-mat-khau\"}"); chk "đăng nhập sai" $(code "$r") 401
r=$(req 3 $B/auth/me -H "authorization: Bearer $AT"); chk "/auth/me" $(code "$r") 200
r=$(req 4 -X POST $B/auth/refresh -d "{\"refreshToken\":\"$RT\"}"); chk "refresh" $(code "$r") 200
RT2=$(body "$r" | jq -r .refreshToken); AT=$(body "$r" | jq -r .accessToken)
r=$(req 5 -X POST $B/auth/refresh -d "{\"refreshToken\":\"$RT\"}"); chk "refresh dùng lại thẻ cũ" $(code "$r") 401
r=$(req 6 -X POST $B/auth/refresh -d "{\"refreshToken\":\"$RT2\"}"); chk "thẻ mới sau khi phát hiện dùng lại" $(code "$r") 401
r=$(req 7 -X POST $B/auth/login -d "{\"email\":\"chu$R@nt.local\",\"password\":\"mat-khau-nt-123\"}"); AT=$(body "$r" | jq -r .accessToken); RT=$(body "$r" | jq -r .refreshToken)
r=$(req 7 -X POST $B/orgs -H "authorization: Bearer $AT" -d "{\"name\":\"Studio NT\",\"slug\":\"studio-nt-$R\",\"kind\":\"TEAM\"}"); chk "tạo tổ chức" $(code "$r") 201
ORG=$(body "$r" | jq -r .id)
r=$(req 7 $B/orgs/$ORG -H "authorization: Bearer $AT"); chk "xem tổ chức" $(code "$r") 200
r=$(req 7 -X PATCH $B/orgs/$ORG -H "authorization: Bearer $AT" -d '{"name":"Studio NT 2","timezone":"Asia/Bangkok"}'); chk "sửa tổ chức" $(code "$r") 200
r=$(req 8 -X POST $B/auth/register -d "{\"email\":\"tho$R@nt.local\",\"password\":\"mat-khau-nt-123\",\"fullName\":\"Thợ NT\"}"); chk "đăng ký thợ" $(code "$r") 201
AT2=$(body "$r" | jq -r .accessToken)
r=$(req 8 -X POST $B/orgs/$ORG/members -H "authorization: Bearer $AT" -d "{\"email\":\"tho$R@nt.local\",\"roleKeys\":[\"artist\"]}"); chk "thêm thành viên" $(code "$r") 201
MID=$(body "$r" | jq -r .id)
r=$(req 8 $B/orgs/$ORG/members -H "authorization: Bearer $AT"); chk "danh sách thành viên" $(code "$r") 200
r=$(req 8 -X POST $B/orgs/$ORG/roles -H "authorization: Bearer $AT" -d '{"key":"le_tan_2","name":"Lễ tân 2","permissions":["org.read"]}'); chk "tạo vai trò tuỳ chỉnh" $(code "$r") 201
RID=$(body "$r" | jq -r .id)
r=$(req 8 -X PATCH $B/orgs/$ORG/roles/$RID -H "authorization: Bearer $AT" -d '{"permissions":["org.read","members.read"]}'); chk "sửa vai trò tuỳ chỉnh" $(code "$r") 200
r=$(req 8 -X PATCH $B/orgs/$ORG/members/$MID -H "authorization: Bearer $AT" -d '{"roleKeys":["le_tan_2"]}'); chk "đổi vai trò thành viên" $(code "$r") 200
r=$(req 8 -X PATCH $B/orgs/$ORG/members/$MID -H "authorization: Bearer $AT2" -d '{"roleKeys":["admin"]}'); chk "thợ tự nâng lên quản trị" $(code "$r") 403
r=$(req 8 $B/orgs/$ORG/audit-logs -H "authorization: Bearer $AT2"); chk "thợ xem nhật ký" $(code "$r") 403
r=$(req 8 -X DELETE $B/orgs/$ORG/members/$MID -H "authorization: Bearer $AT"); chk "cho thành viên rời" $(code "$r") 204
r=$(req 8 $B/orgs/$ORG -H "authorization: Bearer $AT2"); chk "người đã rời xem tổ chức" $(code "$r") 404
r=$(req 8 $B/orgs/$ORG/audit-logs -H "authorization: Bearer $AT"); chk "chủ xem nhật ký" $(code "$r") 200
echo "   nhật ký: $(body "$r" | jq -c '[.items[].action]')"
r=$(req 9 -X POST $B/auth/logout -d "{\"refreshToken\":\"$RT\"}"); chk "đăng xuất" $(code "$r") 204
r=$(req 9 -X POST $B/auth/refresh -d "{\"refreshToken\":\"$RT\"}"); chk "refresh sau đăng xuất" $(code "$r") 401
r=$(req 9 $B/auth/me -H "authorization: Bearer $AT"); echo "   (ghi chú) /auth/me bằng access token cũ sau đăng xuất -> $(code "$r")"
r=$(req 9 $B/openapi.json); chk "openapi" $(code "$r") 200
echo "KẾT QUẢ: $pass/$total"

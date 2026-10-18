#!/bin/bash
# Luồng thật lát 1 vào bản build đang chạy ở cổng 4556 (thợ chấm).
B=http://localhost:4556/api/v1
R=$RANDOM$RANDOM
pass=0; total=0
chk(){ total=$((total+1)); if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "OK   [$1] $2"; else echo "SAI  [$1] mong $3 nhận $2"; fi; }
J(){ curl -s -w '\n%{http_code}' -H 'content-type: application/json' -H "idempotency-key: k-$RANDOM$RANDOM$RANDOM" "$@"; }
code(){ echo "$1" | tail -n1; }
body(){ echo "$1" | sed '$d'; }

r=$(J -X POST $B/auth/register -d "{\"email\":\"l1chu$R@nt.local\",\"password\":\"mat-khau-nt-123\",\"fullName\":\"Chủ Lát Một\"}"); chk "đăng ký chủ" $(code "$r") 201
AT=$(body "$r" | jq -r .accessToken); H="authorization: Bearer $AT"
r=$(J -X POST $B/auth/register -d "{\"email\":\"l1tho$R@nt.local\",\"password\":\"mat-khau-nt-123\",\"fullName\":\"Nguyễn Thị Hoa\"}"); chk "đăng ký thợ" $(code "$r") 201
r=$(J -X POST $B/orgs -H "$H" -d "{\"name\":\"Studio Lát 1\",\"slug\":\"lat1-$R\",\"kind\":\"TEAM\"}"); chk "tạo tổ chức" $(code "$r") 201
O=$B/orgs/$(body "$r" | jq -r .id)
r=$(J -X POST $O/members -H "$H" -d "{\"email\":\"l1tho$R@nt.local\",\"roleKeys\":[\"artist\"]}"); chk "thêm thợ" $(code "$r") 201
MID=$(body "$r" | jq -r .id)
r=$(J $O/makeup-subjects -H "$H"); chk "nhân vật mặc định" $(code "$r") 200
BRIDE=$(body "$r" | jq -r '(.items // .)[] | select(.name=="Cô dâu") | .id'); echo "   nhân vật: $(body "$r" | jq -c '[(.items // .)[].name]')"
r=$(J -X POST $O/services -H "$H" -d '{"code":"TOC","name":"Làm tóc","kind":"ADDON","durationMinutes":30,"listPrice":300000}'); chk "dịch vụ phụ tóc" $(code "$r") 201; HAIR=$(body "$r" | jq -r .id)
r=$(J -X POST $O/services -H "$H" -d '{"code":"LENS","name":"Lens","kind":"ADDON","durationMinutes":5,"listPrice":100000}'); chk "dịch vụ phụ lens" $(code "$r") 201; LENS=$(body "$r" | jq -r .id)
r=$(J -X POST $O/services -H "$H" -d '{"code":"CA-SOM","name":"Ca sớm trước 5h","kind":"SURCHARGE","durationMinutes":1,"listPrice":200000}'); chk "phụ phí ca sớm" $(code "$r") 201; EARLY=$(body "$r" | jq -r .id)
r=$(J -X POST $O/packages -H "$H" -d "{\"code\":\"CO-DAU\",\"name\":\"Gói cô dâu\",\"durationMinutes\":180,\"depositAmount\":1000000,\"subjectId\":\"$BRIDE\",\"locationTypes\":[\"STUDIO\",\"CUSTOMER_HOME\"],\"listPrice\":3500000,\"salePrice\":3000000,\"items\":[{\"serviceId\":\"$LENS\",\"isOptional\":true}]}"); chk "gói cô dâu" $(code "$r") 201; PKG=$(body "$r" | jq -r .id)
r=$(J -X PUT $O/travel-fee-policy -H "$H" -d '{"defaultMode":"PER_KM","fixedAmount":150000,"perKmAmount":5000,"freeKm":3,"minimumAmount":50000,"roundTrip":true}'); chk "cài phí di chuyển" $(code "$r") 200
CT="{\"newCustomer\":{\"fullName\":\"Trần Thu Hà\",\"phone\":\"+84 912 345 678\"},\"eventDate\":\"2027-03-08T05:00:00+07:00\",\"lines\":[{\"kind\":\"PACKAGE\",\"packageId\":\"$PKG\",\"quantity\":1,\"locationType\":\"CUSTOMER_HOME\",\"address\":\"12 Nguyễn Trãi, Hà Nội\",\"scheduledStart\":\"2027-03-08T04:00:00+07:00\",\"scheduledEnd\":\"2027-03-08T07:00:00+07:00\",\"addons\":[{\"serviceId\":\"$HAIR\",\"quantity\":1}],\"travel\":{\"mode\":\"PER_KM\",\"distanceKm\":12.5}},{\"kind\":\"SURCHARGE\",\"serviceId\":\"$EARLY\",\"quantity\":1}]}"
r=$(J -X POST $O/contracts/quote -H "$H" -d "$CT"); chk "xem trước hợp đồng" $(code "$r") 200; QT=$(body "$r" | jq -c '{subtotal,total,depositRequired}')
r=$(J -X POST $O/contracts -H "$H" -d "$CT"); chk "lập hợp đồng tại nhà theo km" $(code "$r") 201
C=$(body "$r" | jq -r .id); CC=$(body "$r" | jq -c '{subtotal,total,depositRequired}')
echo "   mã: $(body "$r" | jq -r .code); dòng: $(body "$r" | jq -c '[.lines[] | {kind,name,unitPrice,quantity,lineTotal, km:.distanceKm}]')"
echo "   xem trước $QT | hợp đồng $CC"
chk "xem trước = hợp đồng" "$QT" "$CC"
# 3.000.000 + 300.000 + (12,5×2−3=22 km × 5.000 = 110.000) + 200.000 = 3.610.000
chk "tổng đúng công thức" "$(body "$r" | jq -r .total)" 3610000
LINE=$(body "$r" | jq -r '.lines[] | select(.kind=="PACKAGE") | .id')
r=$(J -X POST $O/contracts/$C/status -H "$H" -d '{"to":"CONFIRMED"}'); chk "xác nhận hợp đồng" $(code "$r") 200
r=$(J -X PATCH $O/contracts/$C -H "$H" -d '{"discount":100000}'); chk "giảm giá sau xác nhận bị chặn" $(code "$r") 409
r=$(J -X POST $O/contracts/$C/lines -H "$H" -d '{"kind":"CUSTOM","name":"Phát sinh: makeup thêm mẹ","quantity":1,"unitPrice":500000}'); chk "thêm phát sinh" $(code "$r") 201
chk "tổng sau phát sinh" "$(body "$r" | jq -r .total)" 4110000
chk "dòng đánh dấu sau xác nhận" "$(body "$r" | jq -r '[.lines[] | select(.addedAfterConfirm==true)] | length')" 1
AP="{\"contractId\":\"$C\",\"contractLineId\":\"$LINE\",\"startsAt\":\"2027-03-08T04:00:00+07:00\",\"endsAt\":\"2027-03-08T07:00:00+07:00\",\"travelBeforeMin\":45,\"travelAfterMin\":30,\"status\":\"CONFIRMED\",\"staff\":[{\"membershipId\":\"$MID\",\"role\":\"PRIMARY\"}]}"
r=$(J -X POST $O/appointments -H "$H" -d "$AP"); chk "tạo lịch gắn dòng hợp đồng" $(code "$r") 201
echo "   khoảng bận: $(body "$r" | jq -c '.staff[0] | {blockStart,blockEnd}')"
r=$(J -X POST $O/appointments -H "$H" -d "{\"startsAt\":\"2027-03-07T21:00:00Z\",\"endsAt\":\"2027-03-07T21:30:00Z\",\"status\":\"CONFIRMED\",\"staff\":[{\"membershipId\":\"$MID\"}]}"); chk "trùng vì giờ di chuyển trước" $(code "$r") 409
echo "   lời báo: $(body "$r" | jq -r .error.message)"
r=$(J -X POST $O/staff-tiers -H "$H" -d '{"name":"Bậc 3"}'); chk "tạo bậc lương" $(code "$r") 201; TIER=$(body "$r" | jq -r .id)
r=$(J -X PATCH $O/staff/$MID -H "$H" -d "{\"tierId\":\"$TIER\",\"displayName\":\"Hoa\"}"); chk "gán bậc cho thợ" $(code "$r") 200
r=$(J -X PUT $O/packages/$PKG/pay-rates -H "$H" -d "{\"rates\":[{\"tierId\":\"$TIER\",\"amount\":450000}]}"); chk "đặt tiền công gói theo bậc" $(code "$r") 200
echo "   bảng tiền công: $(body "$r" | jq -c '[.items[] | {bac:.tier.name, amount, tho:[.staff[] | {displayName,initials}]}]')"
r=$(J -X PUT $O/packages/$PKG/pay-rates -H "$H" -d "{\"rates\":[{\"tierId\":\"$TIER\",\"amount\":450000.5}]}"); chk "tiền công số lẻ bị chặn" $(code "$r") 400
r=$(J $O/audit-logs?pageSize=100 -H "$H"); echo "   nhật ký: $(body "$r" | jq -c '[.items[].action] | reverse')"
echo "KẾT QUẢ: $pass/$total"

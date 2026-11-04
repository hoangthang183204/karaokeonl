# KARAOKE ONLINE

Phòng karaoke multiplayer trên web: không gian low-poly, TV YouTube dùng IFrame Player API, hàng chờ bài, quyền host / co-host / member, và micro qua LiveKit khi đã cấu hình.

Nhúng video YouTube không cấp giấy phép kinh doanh dịch vụ karaoke.

## Chạy local

Cần Node.js 22 và Docker (cho PostgreSQL).

```powershell
cd "D:\Game\KARAOKE ONLINE"
docker compose up -d postgres
copy .env.example .env
npm install
npm run db:deploy
npm run dev
```

- Web: http://localhost:3000
- API + Colyseus: http://localhost:3001/api/health

Tạo tài khoản, tạo phòng, mở thêm một trình duyệt hoặc cửa sổ ẩn danh để thử đồng bộ.

## Biến môi trường

| Biến | Việc gì xảy ra nếu thiếu |
| --- | --- |
| `JWT_SECRET` | Server từ chối khởi động |
| `DATABASE_URL` | Không lưu phòng |
| `YOUTUBE_API_KEY` | Tìm kiếm báo chưa cấu hình. Dán link vẫn chạy qua oEmbed |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Nút micro báo chưa cấu hình. YouTube vẫn phát trên loa từng máy |

API key chỉ nằm ở server.

## Kiến trúc ngắn

- `packages/shared`: luật TV thuần (URL, quyền, hàng chờ, vote skip, đồng hồ phát). Có unit test.
- `apps/server`: NestJS REST + Colyseus trên cùng cổng. PostgreSQL lưu phòng, hàng chờ, quyền, vote, log. Trạng thái đang phát sống trong room Colyseus. `current_time` là mốc tại `updated_at`, không ghi mỗi giây.
- `apps/web`: Next.js, React Three Fiber, overlay YouTube bám màn hình TV 3D. Client tính thời gian dự kiến và chỉ seek khi lệch từ 1,5 giây.

Server là nguồn chuẩn. Client không tự nhận host và không tự ghi trạng thái TV.

## REST và realtime

REST: đăng ký, phòng, tìm YouTube, snapshot TV, thêm/phát/next/xóa hàng chờ, quyền, vote skip, token LiveKit.

WebSocket Colyseus `karaoke`: pause, resume, seek, previous, reorder, chuyển host, đổi vai, đồng bộ, di chuyển, ngồi, chat, biểu cảm. Mọi lệnh TV kiểm tra thành viên, quyền, `requestId` và `expectedRevision`.

Client vào phòng bằng `joinOrCreate("karaoke", { token, roomCode })`. Không dùng tên option `roomId`: Colyseus giữ tên đó cho nội bộ và bỏ qua khi lọc phòng. Schema Colyseus cần `useDefineForClassFields: false` trong `apps/server/tsconfig.json`, nếu không các field TV (tên phòng, host, quyền) không được đồng bộ.

## Đồng bộ phát

Khi đang `playing`, thời điểm dự kiến = `anchorTime + (serverNow - updatedAt) / 1000`. Client ước lượng lệch đồng hồ từ bản tin `tv:sync` mỗi 5 giây. Lệch nhỏ thì bỏ qua. Lệch lớn thì seek. Buffering cục bộ không bị seek liên tục.

Quảng cáo, mạng và autoplay của trình duyệt làm các máy không khớp từng frame. Sau khi restart server, bài đang phát được tạm dừng tại vị trí ước tính.

## Kiểm thử đã có trong repo

```powershell
npm test
```

Unit test gồm parse URL, quyền, hàng chờ, vote, revision, đồng hồ phát, và mô phỏng 2/5/10/20 client đọc cùng một trạng thái. Đây không phải bài đo tải mạng 20–50 người thật. Chưa chạy bài đó trên VPS trong lần dựng này.

## Production

`docker compose up --build` chạy Postgres, API và web. `nginx/nginx.conf` là mẫu proxy. HTTPS cần chứng chỉ trên VPS và URL public đúng trong `NEXT_PUBLIC_*` (các biến này được nhúng lúc build web).

Một process Colyseus là đủ cho MVP. Nhiều instance cần Redis presence; Redis chưa được thêm vì một server là đủ cho bước này.

export const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  stale_revision: "Trạng thái TV vừa thay đổi. Hãy thử lại.",
  duplicate_request: "Lệnh này đã được xử lý.",
  invalid_request: "Lệnh không hợp lệ.",
  invalid_video: "Mã video YouTube không hợp lệ.",
  video_unavailable: "Video không tồn tại, đã bị xóa, ở chế độ riêng tư hoặc không cho phép nhúng.",
  embed_forbidden: "Video không cho phép phát nhúng trên web.",
  metadata_unavailable: "Không lấy được thông tin video từ YouTube. Hãy thử lại.",
  quota_exceeded: "Đã hết hạn mức YouTube Data API. Tạm thời hãy dán link video.",
  search_unconfigured: "Chưa cấu hình YouTube Data API. Bạn vẫn có thể dán link YouTube.",
  search_empty: "Không tìm thấy video phù hợp.",
  queue_full: "Danh sách chờ đã đầy.",
  user_queue_full: "Bạn đã thêm quá nhiều bài đang chờ.",
  duplicate_video: "Bài này đã có trong danh sách hoặc đang phát.",
  empty_queue: "Không còn bài hát trong hàng chờ.",
  no_previous: "Không có bài hát trước đó.",
  song_not_found: "Không tìm thấy bài trong hàng chờ.",
  nothing_playing: "Chưa có bài hát để điều khiển.",
  bad_seek: "Thời điểm tua không hợp lệ.",
  already_voted: "Bạn đã bình chọn bỏ qua bài này.",
  vote_cooldown: "Bạn vừa bình chọn. Hãy chờ một lát.",
  vote_disabled: "Phòng đang tắt bình chọn bỏ qua bài.",
  host_can_skip: "Chủ phòng chuyển bài trực tiếp, không cần bình chọn.",
  not_ended: "Bài hát chưa phát xong.",
  not_in_room: "Bạn không ở trong phòng này.",
  room_full: "Phòng đã đủ người.",
  room_not_found: "Không tìm thấy phòng.",
  rate_limited: "Bạn thao tác quá nhanh. Hãy chậm lại.",
  unauthenticated: "Bạn cần đăng nhập.",
  autoplay_blocked: "Trình duyệt chặn tự phát có tiếng. Hãy bấm để bật âm thanh.",
  player_not_ready: "Trình phát YouTube chưa sẵn sàng.",
  youtube_player_error: "YouTube không phát được video này.",
  region_blocked: "Video bị giới hạn khu vực.",
  network: "Mất kết nối. Đang thử kết nối lại.",
  voice_unconfigured: "Chưa cấu hình LiveKit. Micro karaoke chưa thể nối phòng thoại.",
  invalid_role: "Không thể đổi vai trò này.",
  target_not_found: "Không tìm thấy người chơi.",
};

export function errorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Đã xảy ra lỗi.";
}

export function youtubePlayerError(code: number): { code: string; message: string } {
  switch (code) {
    case 2:
      return { code: "invalid_video", message: errorMessage("invalid_video") };
    case 5:
      return { code: "youtube_player_error", message: "Trình phát HTML5 của YouTube gặp lỗi. Hãy tải lại video." };
    case 100:
      return { code: "video_unavailable", message: "Video đã bị xóa, đặt riêng tư hoặc không còn tồn tại." };
    case 101:
    case 150:
      return { code: "embed_forbidden", message: "Chủ video không cho phép phát nhúng trên trang web khác." };
    default:
      return { code: "youtube_player_error", message: errorMessage("youtube_player_error") };
  }
}

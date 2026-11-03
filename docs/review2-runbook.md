# Review 2 chạy và kiểm tra

Hai repo dùng nhánh `feature/review2-completion-20261103`. Không merge hoặc push vào main.
Mã nguồn kiểm thử nằm trong repo, không cần một phần mềm kiểm thử riêng bên ngoài.

## Chạy ứng dụng

1. Trong repo backend, áp dụng migration theo thứ tự và cấu hình kết nối database bằng user-secrets. Script CI/seed chỉ dành cho database thử riêng, không chạy reset lên database đang dùng.
2. Chạy `dotnet run --project backend/AutoScenarioX.Api` tại port 5080.
3. Trong repo frontend chạy `npm ci`, sau đó `npm run dev`. Vite chuyển `/api` tới backend.
4. Đưa một version READY vào campaign, chọn Ego agent và cấu hình Oracle rồi bấm Start.
5. Chạy `Start-ASX-Worker.bat --carla-root "C:\Users\admin\Downloads\CARLA_0.9.16"` trong repo backend. Worker chọn map từ từng execution package, luôn dùng Low.

Worker cần Python tương thích wheel CARLA. Cài dependency từ `tools/requirements-worker.txt` bằng đúng Python mà launcher in ra. Video cần cửa sổ CARLA, `mss`, OpenCV và `imageio-ffmpeg`. Không dùng `--quick`, `--lite`, `--simulate` hoặc telemetry fixture làm bằng chứng chạy đủ route.

Dev chỉ dùng khi backend bật rõ `Auth:Mode=Dev` trong Development. Role selector không đổi role database và không xác thực mật khẩu. Với tài khoản thật, dùng Supabase mode. Ngoài chuỗi kết nối PostgreSQL, backend cần `Auth:AnonKey` được lưu bằng user-secrets; không đặt khóa backend hoặc mật khẩu vào biến `VITE_*`.

## Kiểm tra trong repo

```powershell
npm run lint
npm run build
npm run verify:api
npm run test:coverage
npx playwright install chromium
npm run test:e2e
```

Backend có lệnh .NET/Python và database thử trong `docs/review2-backend-tests.md`.
CI chạy trên push nhánh, PR và tag `review-2`. Lỗi test làm job thất bại; TRX/JUnit, coverage và browser trace được giữ trong Actions artifacts. Hosted CI không chạy CARLA và báo Skip rõ cho kiểm tra cần bản ghi thật.

## Luồng demo cho năm thành viên

Đây là phân công chuẩn bị demo, không phải lịch sử xác nhận ai đã viết hoặc duyệt code.

| Người | Luồng | Thao tác và kết quả cần thấy | Kiểm tra lỗi |
|---|---|---|---|
| Thuận | 1 | Scenario Engineer tạo nháp, lưu, validate và publish. Có version READY bất biến. | JSON sai không publish; revision cũ bị từ chối. |
| Đạt | 2 | Test Engineer chọn READY, so sánh Gower/DTW, xếp hạng và lưu thứ tự. | Thiếu lịch sử báo rõ; input đổi thì bỏ ranking cũ. |
| Huy | 3 | Test Engineer Start; worker nhận run, chạy Ego/actor/event, upload kết quả. | Hai worker không nhận trùng; lỗi hạ tầng tạo lần thử mới có liên kết. |
| Bảo | 4 | Reviewer gom, kiểm chứng, giải thích, tạo báo cáo và hoàn thành review. | Sai role trả 403; chưa đủ bước không được chuyển tiếp; giữ bằng chứng khi chạy lại. |
| Tuấn | 5 | Admin đổi role/khóa user, tạo Oracle version, xem worker, lưu settings và xem audit. | Admin cuối cùng được bảo vệ; tải lại phải còn dữ liệu vừa lưu. |

## Bằng chứng và phạm vi

`docs/review2-evidence.json` ghi revision, CI URL, 12 map/run/version, kiểm tra Autopilot và browser tới CARLA. Bộ hiện tại có 406 .NET, 53 Python, 95 Vitest và 68 Playwright invocations; chúng không phải tổng số test chức năng duy nhất. Hợp đồng frontend đã kiểm tra 88/88 HTTP operations bằng dữ liệu giả lập.

Đã chạy local với PostgreSQL 18 riêng, CARLA 0.9.16 Low và API thật. Thao tác Admin được đọc lại từ database. Video, JSONL, ảnh, TRX và ba Report 5 nằm trong thư mục `outputs/review2-20261103`. Oracle có thể trả FAIL khi xe vi phạm; đó là kết quả được giữ lại.

Các giới hạn còn mở:

- Chưa kiểm chứng Supabase signup/email recovery thật vì thiếu Auth key/provider configuration. Chưa có URL staging dùng chung.
- Adapter private Supabase Storage có test HTTP, chưa chạy với bucket thật.
- Import OpenSCENARIO là tập con tĩnh được mô tả trong backend. Gom nhóm là threshold connected components, chưa phải HDBSCAN; không hỗ trợ synchronized arrival.
- Progress là snapshot định kỳ, video xem sau upload. Không có streaming camera.
- Retention lưu chính sách và giữ bằng chứng đang tham chiếu; không tự xóa artifact.
- Mẫu local 200 request/50 client không lỗi, trung bình 284 ms, tối đa 1.721 ms; đạt 98,8 RPS, thấp hơn ngưỡng 100 của SRS. Chưa xác nhận tải lớn hoặc độ ổn định dài hạn.

PR frontend: https://github.com/bg489/SEP_Frontend/pull/5.
PR backend: https://github.com/huylh14/AutoScenarioX/pull/16.

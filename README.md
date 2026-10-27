# AutoScenarioX Frontend

React + TypeScript, Redux Toolkit và Redux Saga; giao diện tiếng Việt/tiếng Anh với màu chủ đạo `#FF6363`, `#FCFFA7`.

Frontend này gọi **backend của nhóm** tại:

```text
C:\Users\admin\Desktop\Hoc Bai\SEP\Project\AutoScenarioX\AutoScenarioX\backend
```

Không chạy backend cũ ở `Project\Backend`. Các thay đổi trong nhánh này chỉ thuộc repository Frontend; backend của nhóm giữ nguyên.

## Chức năng và nguồn dữ liệu

| Chức năng | Nguồn dữ liệu / hành vi |
| --- | --- |
| Login, refresh token, current user | API `/api/v1/auth`; Supabase Auth qua .NET 8 khi cấu hình Supabase |
| Scenario repository | API thật: tìm kiếm/phân trang, metadata, archive/restore/clone |
| Authoring | Draft JSON theo schema; form map, route/spawn/transform, ego/NPC, pedestrian/obstacle, weather, event/trigger, parameter và execution |
| Validate/publish | Báo cáo validation, revision/If-Match; publish phiên bản READY, giữ version bất biến |
| Version/diff/import/export/variant | API thật; JSON/YAML; diff giữa các version của cùng scenario |
| Campaign | API thật; chọn **scenarioVersionId READY** với search/filter; SUT Behavior Agent hoặc Autopilot |
| Prioritization | API thật; lưu thứ tự vào campaign. APFD/APFDc là **ước lượng từ đặc trưng**, không phải kết quả đo của campaign đã chạy |
| Execution | API thật: start/rerun, poll runs, xem Oracle evaluation/violation, tải JSON và video nếu worker đã ghi được |
| Oracle config | Đọc cấu hình thật trong workspace execution; form sửa Oracle cũ là mock |
| Worker settings/status, user administration, register/reset password, profile editing | **Mock/demo** vì backend chưa có API; không tạo tài khoản Supabase hoặc lưu mật khẩu |
| Scenario clusters, failure clustering/review, APFD report, analytics settings, audit | **Mock trên trình duyệt**, có nhãn rõ ràng |

Không tự chuyển lỗi HTTP/network của chức năng thật thành mock thành công. Mọi thao tác API từ UI đi qua Redux Saga, gồm download. Loading và khóa thao tác xuất hiện khi request đang chạy.

## Chạy trên máy

Yêu cầu Node.js tương thích Vite, npm; .NET **8 SDK** và cấu hình database theo repository backend của nhóm.

Terminal backend:

```powershell
cd "C:\Users\admin\Desktop\Hoc Bai\SEP\Project\AutoScenarioX\AutoScenarioX\backend"
dotnet run --project AutoScenarioX.Api --launch-profile http
```

Backend đọc connection string từ .NET user-secrets `autoscenariox-api-dev`, key `ConnectionStrings:Supabase`. Không đưa secret vào frontend/Git. Database của nhóm dùng schema `asx` và SQL migrations trong repository backend; không chạy lại seed/reset trên database dùng chung.

Terminal frontend:

```powershell
cd "C:\Users\admin\Desktop\Hoc Bai\SEP\Project\Frontend"
# Chỉ copy khi chưa có file local.
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run dev
```

Mở URL Vite in trong terminal, thường `http://localhost:5173`. Vite proxy `/api` tới `http://localhost:5080`; Swagger ở `http://localhost:5080/swagger`.

### Xác thực

`.env.example` mặc định `VITE_AUTH_MODE=Supabase`. Backend phải có `Auth:Mode=Supabase`, `Auth:ProjectUrl`, `Auth:AnonKey` theo hướng dẫn của nhóm. Tài khoản thật đăng nhập qua API; role lấy từ backend. Register và forgot-password trong UI hiện chỉ là demo có nhãn, không tạo session/tài khoản thật.

Backend trên máy hiện cấu hình Dev; `.env.local` hiện ghép tương ứng:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=
VITE_AUTH_MODE=Dev
```

Chọn **Open development workspace** để dùng danh tính Dev do backend cấu hình. Dev **không kiểm tra email/mật khẩu**; UI hiện cảnh báo rõ. Chuyển cả frontend và backend sang Supabase khi dùng xác thực thật. Frontend không sửa role lưu trong database; chế độ Supabase luôn lấy role thật từ backend.

### Đổi role trong Dev

- Trước khi vào workspace: chọn **Dev role / Vai trò Dev** trên màn hình đăng nhập, rồi bấm **Open development workspace**.
- Sau khi vào workspace: đổi **Dev role / Vai trò Dev** trên thanh trên cùng. Giao diện trở về Tổng quan, tải lại dữ liệu và menu theo role vừa chọn qua Redux Saga.
- Có đủ `SCENARIO_ENGINEER`, `TEST_ENGINEER`, `TEST_REVIEWER`, `ADMIN`. Lựa chọn được nhớ trong session của tab trình duyệt.

Frontend gửi header `X-Asx-Dev-Role` cho các request Dev, dùng cơ chế đã có của backend. `/auth/me` hiện trả role lưu trong database, nên trong Dev giao diện hiển thị role tạm thời đã chọn để khớp với quyền mà header áp dụng. Việc này không đổi tài khoản hoặc role trong database. Nếu `/me` lỗi, frontend không tạo phiên giả để vào hệ thống.

Bộ chọn và header Dev bị tắt khi `VITE_AUTH_MODE=Supabase`; role trong phiên Supabase không bị ghi đè.

`VITE_DATA_MODE=mock` chỉ xem trước workflow, không bật phiên đăng nhập giả. `.env.local` được Git ignore.

## CARLA với backend hiện có

CARLA cài tại `C:\Users\admin\Downloads\CARLA_0.9.16`; luôn dùng Low quality. Backend hiện **không có API quản lý process worker**, nên màn hình Worker chỉ lưu cấu hình mẫu trên trình duyệt; nó không xác nhận kết nối hoặc mở CARLA.

Để chạy thật, cần khởi động worker hiện có của repository backend theo hướng dẫn của nhóm. Frontend chỉ tạo/start campaign, theo dõi run và hiển thị kết quả backend trả về. Source/launcher của backend không được sửa trong nhánh này; lỗi Python/runtime thuộc backend sẽ được hiển thị, không thay bằng PASS giả.

Luồng dữ liệu hiện có:

```text
UI → Redux Saga → teamClient → .NET API → Supabase PostgreSQL
                                   ↑
                    Python worker ↔ CARLA 0.9.16
```

Scenario phải được save/validate/publish READY trước khi chọn vào campaign. Start campaign chỉ tạo hàng đợi; cần worker thực sự claim/chạy/upload telemetry để có kết quả. Rerun hiện **xóa run cũ của campaign** và UI yêu cầu xác nhận. Backend chưa có cancel campaign.

Backend nhóm dùng canonical JSON/YAML và Python API worker. Nó không dùng endpoint OpenSCENARIO/ScenarioRunner của backend cũ. Không diễn giải các ghi chú tự do thành route/event có thể thực thi.

Tham khảo chính thức: [Synchrony](https://carla.readthedocs.io/en/0.9.16/adv_synchrony_timestep/), [Traffic Manager](https://carla.readthedocs.io/en/0.9.16/adv_traffic_manager/), [Rendering/Low](https://carla.readthedocs.io/en/0.9.16/adv_rendering_options/). Low vẫn render; no-rendering làm camera/GPU sensor trả dữ liệu rỗng.

## Cấu trúc tích hợp

- `src/services/backendCapabilities.ts`: module thật/mock.
- `src/services/teamClient.ts`: auth token/refresh, ProblemDetails, loading/download.
- `src/services/teamScenarios.ts`: repository, draft, version, handoff.
- `src/services/teamOperations.ts`: campaign/run/Oracle DTO.
- `src/components/TeamScenarioWorkspace.tsx`, `TeamOperationsWorkspace.tsx`: màn hình theo contract backend nhóm.

Để deploy ở origin khác, đặt `VITE_API_BASE_URL` và CORS theo backend. `TEAM_API_TARGET` thay đích proxy của Vite khi phát triển. Không đặt Supabase service-role key, DB password hoặc connection string trong biến `VITE_*`.

## Git

Làm việc trên nhánh tính năng, commit theo chức năng; không push trực tiếp main. Yêu cầu hiện tại chỉ commit, chưa push.

```powershell
git branch --show-current
git status
git log --oneline -8
# Khi đã kiểm tra và muốn push nhánh hiện tại:
git push -u origin HEAD
```

### Giới hạn worker đã đối chiếu trong source backend

Worker hiện gọi recorder với `record_video`, `lite`, `max_sim_s`, nhưng hàm recorder chưa nhận các đối số này; worker cũng mong tuple trong khi recorder hiện trả đường dẫn string. Vì vậy việc start campaign qua API chưa đồng nghĩa có thể chạy CARLA thành công.

Recorder hiện chỉ hỗ trợ `pedestrian_crossing`, `lead_vehicle_brake`; chưa thực thi `vehicle_cut_in`, `traffic_light_override`, SUT Autopilot và kiểm tra red-light. Worker chỉ gửi header Dev, chưa hỗ trợ Bearer Supabase. Các lỗi/giới hạn này thuộc backend hiện có và không được sửa trong công việc frontend này. Không dùng `--simulate` để xác nhận chạy CARLA thật.

# AutoScenarioX Frontend

Current Week 2 branch: `feature/week2-completion-20261119`. The matching backend
is now in `Project\Backend`, active project `backend/AutoScenarioX.Api` (.NET 8,
`/api/v1`); its previous Identity host is preserved under `legacy/identity-api`.
The old backend paths and acceptance counts below describe previous revisions.
Use [docs/week2-verification.md](docs/week2-verification.md) for the current
configuration, executed tests, task coverage and remaining external acceptance.

React + TypeScript, Redux Toolkit và Redux Saga; giao diện tiếng Việt/tiếng Anh với màu chủ đạo `#FF6363`, `#FCFFA7`.

Frontend này gọi **backend của nhóm** tại:

```text
C:\Users\admin\Desktop\Hoc Bai\SEP\Project\Backend\backend
```

Chạy project `AutoScenarioX.Api` của repo Backend. Host Identity cũ được giữ trong `legacy/identity-api` và không dùng chung với frontend này.

## Chức năng và nguồn dữ liệu

| Chức năng | Nguồn dữ liệu / hành vi |
| --- | --- |
| Login, refresh token, current user | API `/api/v1/auth`; Supabase Auth qua .NET 8 khi cấu hình Supabase |
| Scenario repository | API thật: tìm kiếm/phân trang, bộ lọc tag, metadata, archive/restore/clone; thay tags và xem lịch sử thay đổi |
| Authoring | Template từ backend; bản đồ spawn tương tác; form theo schema hiện hành cho map, route/transform, ego/NPC, pedestrian/obstacle, weather, event/trigger, parameter và execution; giữ JSON đầy đủ |
| Validate/publish | Báo cáo validation, revision/If-Match; publish phiên bản READY, giữ version bất biến |
| Version/diff/import/export/variant | API thật; JSON/YAML; diff giữa các version; chiến lược sinh biến thể và seed theo backend |
| Scenario coverage | API thật `/api/v1/coverage`; phiên bản READY mới nhất hoặc mọi phiên bản READY, ma trận bản đồ/thời tiết/phân loại/event và truy xuất từng version |
| Campaign | API thật; chọn **scenarioVersionId READY** với search/filter; SUT Behavior Agent hoặc Autopilot |
| Prioritization | API thật; lưu thứ tự vào campaign. APFD/APFDc là **ước lượng từ đặc trưng**, không phải kết quả đo của campaign đã chạy |
| Execution | API thật: start/rerun, poll runs, xem đầy đủ Oracle evaluation/violation, tải JSON; phát MP4 có xác thực và tải video nếu worker đã upload |
| Backend data | API thật: READY mới nhất/lịch sử, execution package, map chi tiết/spawn, template/catalog/schema, coverage, tài khoản và danh sách bảng database còn thiếu |
| Failure insights / Review queue / Campaign reports | API thật theo campaign: group → verify → similar → explainability → generate → review; trả các run chưa giải thích được về Flow 3; đọc APFD/APFDc và các đường cong từ kết quả backend |
| Worker API tools | API thật nâng cao: claim/running/requeue-infra, upload NDJSON và MP4 gốc, đọc kết quả/gói thực thi; không khởi động CARLA |
| Oracle config | API thật: tạo phiên bản bất biến, kích hoạt mặc định và giữ cấu hình campaign cũ |
| Worker, user administration, register/reset password, profile editing | API thật qua Saga; Supabase account/email cần cấu hình provider phía backend |
| Scenario similarity, analytics settings, audit | API thật: Gower/DTW v1 và kết quả so sánh lưu database; cài đặt/audit tải lại từ backend |

Không tự chuyển lỗi HTTP/network của chức năng thật thành mock thành công. Mọi thao tác API từ UI đi qua Redux Saga, gồm download. Loading và khóa thao tác xuất hiện khi request đang chạy.

Kiểm tra contract hiện tại: **88/88 HTTP method + route** trong snapshot. Kết quả live và phạm vi nghiệm thu được ghi riêng tại `docs/week2-evidence.json`.

```powershell
npm run verify:api
npm run build
```

`verify:api` dùng transport/file giả lập trong bộ nhớ; không ghi database, khởi động CARLA hoặc gọi backend thật. Kiểm tra gồm If-Match, multipart, bộ lọc/tag/history/template/variant, coverage và hình học bản đồ, các bước failure analysis, query/payload, file PUT, auth refresh/401, Blob video và đủ 66 operation trong snapshot.

### Test thao tác trình duyệt cho scenario và campaign

```powershell
npm ci
npx playwright install chromium
npm run test:e2e
# Xem thao tác trực tiếp hoặc mở báo cáo sau khi chạy:
npm run test:e2e -- --headed
npx playwright show-report
```

Nếu máy đã có Chrome và không tải được Chromium, có thể dùng `$env:PLAYWRIGHT_CHANNEL = 'chrome'` rồi chạy `npm run test:e2e` trong cùng terminal PowerShell.

Test Playwright nằm trong `tests/e2e`, chạy Chromium và tự mở Vite tại `http://127.0.0.1:4173` (cổng này cần trống). Cấu hình test dùng `api` + xác thực `Dev`; mọi request `/api/**` được chặn bằng fixture riêng cho từng test, không cần backend/CARLA và không ghi database. Không thay đổi `.env.local`.

- Scenario: tìm kiếm/lọc/phân trang, tạo từ template, sửa–lưu–validate–publish READY, chặn JSON lỗi, cảnh báo validation, xung đột revision, archive/restore và tải JSON.
- Campaign: tìm kiếm, chọn phiên bản READY qua nhiều bộ lọc, sắp thứ tự/bỏ chọn, tạo/sửa SUT, lỗi lưu và thử lại, start với run đang chờ, xác nhận/hủy rerun.

Khi test lỗi, `test-results/` giữ screenshot và trace; báo cáo HTML nằm trong `playwright-report/`. Đây là kiểm tra UI với API giả lập; không xác nhận backend hoặc worker chạy mô phỏng thật.

Mọi thao tác ghi dùng cùng transport Redux Saga. Regroup thay phiên phân tích đang có; Return to Flow 3 có thể xóa telemetry/evaluation/video của các run được backend chọn; Rerun có thể thay run cũ. Giao diện giải thích tác động và yêu cầu xác nhận cho các thao tác này. Một kết quả `null` hoặc chưa đủ bước phân tích được hiển thị là chưa có dữ liệu, không thay bằng APFD/APFDc giả.

## Chạy trên máy

Yêu cầu Node.js tương thích Vite, npm; .NET **8 SDK** và cấu hình database theo repository backend của nhóm.

Terminal backend:

```powershell
cd "C:\Users\admin\Desktop\Hoc Bai\SEP\Project\Backend\backend"
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

`.env.example` mặc định `VITE_AUTH_MODE=Supabase`. Backend phải có `Auth:Mode=Supabase`, `Auth:ProjectUrl`, `Auth:AnonKey`. Login/register/recovery gọi API thật; role lấy từ backend. Thiếu provider trả lỗi cấu hình rõ ràng, không tạo tài khoản hoặc thông báo thành công giả.

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

Scenario phải được save/validate/publish READY trước khi chọn vào campaign. Start campaign tạo hàng đợi; worker claim/chạy/upload telemetry để có kết quả. Rerun tạo attempt mới có liên kết, giữ kết quả và bằng chứng cũ. Backend chưa có cancel campaign.

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

Frontend dùng API có sẵn và giữ nguyên các sửa đổi launcher/worker do bạn thực hiện. Start campaign chỉ tạo hàng đợi; quá trình CARLA phải được worker bên ngoài thực thi và upload telemetry. Nút `Claim` trong công cụ nâng cao dành cho xử lý thủ công: nó lấy tác vụ khỏi hàng đợi, nên worker thông thường sẽ không nhận lại tác vụ đó. Không cần thao tác này khi chạy campaign theo luồng worker bình thường.

Recorder hiện thực năm event/trigger theo schema, BehaviorAgent/Autopilot và kiểm tra red-light. Worker dùng Bearer khi có `ASX_ACCESS_TOKEN`, hoặc header Dev khi backend bật Development. Unsupported sync/time_gap_s bị từ chối rõ ràng. Việc API lưu cấu hình chưa chứng minh mô phỏng đã thực thi; bằng chứng thật của nhánh hiện tại được ghi tại `docs/week2-evidence.json`. Không dùng `--simulate` để xác nhận CARLA thật.

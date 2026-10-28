# Backend API coverage

Ngày đối chiếu: **2026-10-28**. Phạm vi: **66 HTTP method + route** do Swagger của `AutoScenarioX.Api` công bố, đối chiếu controller, DTO, service và frontend tham khảo trong repository backend. Backend và worker không bị sửa trong công việc này.

## Cách kiểm tra

Chạy `npm run verify:api`. Các bộ kiểm tra thực thi adapter frontend với transport trong bộ nhớ, đối chiếu method, URL, query, payload, header, file upload/download, lỗi và trạng thái. Chương trình tổng hợp so sánh các lời gọi đã thực thi với `docs/backend-endpoints.json`; thiếu một operation sẽ thất bại. Không gọi database hoặc CARLA thật.

Ngoài kiểm tra contract, giao diện phải có đường truy cập dưới đây. Auth refresh được gọi tự động khi token sắp hết hạn/HTTP 401 và có nút làm mới phiên ở mục Account & session.

## Các thao tác hiện có

| Method | Route | Màn hình / luồng |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | Login Supabase; Account & session; refresh tự động/manual qua Saga |
| POST | `/api/v1/auth/refresh` | Login Supabase; Account & session; refresh tự động/manual qua Saga |
| GET | `/api/v1/auth/me` | Login Supabase; Account & session; refresh tự động/manual qua Saga |
| GET | `/api/v1/campaigns` | Campaigns: builder, detail, edit, start/rerun; Execution; READY picker |
| POST | `/api/v1/campaigns` | Campaigns: builder, detail, edit, start/rerun; Execution; READY picker |
| GET | `/api/v1/campaigns/{id}` | Campaigns: builder, detail, edit, start/rerun; Execution; READY picker |
| PATCH | `/api/v1/campaigns/{id}` | Campaigns: builder, detail, edit, start/rerun; Execution; READY picker |
| POST | `/api/v1/campaigns/{id}/start` | Campaigns: builder, detail, edit, start/rerun; Execution; READY picker |
| POST | `/api/v1/campaigns/{id}/rerun` | Campaigns: builder, detail, edit, start/rerun; Execution; READY picker |
| GET | `/api/v1/campaigns/{id}/runs` | Campaigns: builder, detail, edit, start/rerun; Execution; READY picker |
| GET | `/api/v1/campaigns/available-scenarios` | Campaigns: builder, detail, edit, start/rerun; Execution; READY picker |
| GET | `/api/health/db` | Backend data → Database status |
| GET | `/api/v1/oracle-configs` | Test oracles; Execution → Oracle result/video; Worker API tools |
| GET | `/api/v1/runs/{id}/result` | Test oracles; Execution → Oracle result/video; Worker API tools |
| POST | `/api/v1/runs/claim` | Test oracles; Execution → Oracle result/video; Worker API tools |
| POST | `/api/v1/runs/{id}/running` | Test oracles; Execution → Oracle result/video; Worker API tools |
| POST | `/api/v1/runs/{id}/requeue-infra` | Test oracles; Execution → Oracle result/video; Worker API tools |
| PUT | `/api/v1/runs/{id}/telemetry` | Test oracles; Execution → Oracle result/video; Worker API tools |
| PUT | `/api/v1/runs/{id}/video` | Test oracles; Execution → Oracle result/video; Worker API tools |
| GET | `/api/v1/runs/{id}/video` | Test oracles; Execution → Oracle result/video; Worker API tools |
| GET | `/api/v1/prioritization/strategies` | Prioritization: campaign / tự chọn READY / UUID phiên bản |
| POST | `/api/v1/prioritization/rank` | Prioritization: campaign / tự chọn READY / UUID phiên bản |
| GET | `/api/v1/reference/maps` | Backend data → Maps & schema; Scenario editor → View schema |
| GET | `/api/v1/reference/catalog` | Backend data → Maps & schema; Scenario editor → View schema |
| GET | `/api/v1/reference/scenario-schema` | Backend data → Maps & schema; Scenario editor → View schema |
| GET | `/api/v1/reference/maps/{mapName}` | Scenario editor / Backend data → bản đồ tương tác, tọa độ và hướng từng spawn |
| GET | `/api/v1/reference/scenario-templates` | Scenario library → tạo từ template; Backend data → template catalogue |
| GET | `/api/v1/coverage` | Scenario coverage / Backend data → coverage, scope latest/all, ma trận và các version READY |
| GET | `/api/v1/tags` | Scenario library → danh mục tags, tìm kiếm và gắn tag |
| PUT | `/api/v1/scenarios/{scenarioId}/tags` | Scenario definition → thay toàn bộ tags của hồ sơ scenario |
| GET | `/api/v1/scenarios/{scenarioId}/history` | Scenario → Activity/history, phân trang và dữ liệu sự kiện gốc |
| GET | `/api/v1/campaigns/{campaignId}/failure-analysis` | Failure insights / Review queue / Campaign reports → phiên phân tích đã lưu |
| POST | `/api/v1/campaigns/{campaignId}/failure-analysis` | Failure insights → group/regroup từ kết quả Oracle; xác nhận trước khi thay phiên cũ |
| POST | `/api/v1/campaigns/{campaignId}/failure-analysis/verify` | Failure insights → verify theo trạng thái backend |
| POST | `/api/v1/campaigns/{campaignId}/failure-analysis/similar` | Failure insights → gom lỗi tương tự |
| POST | `/api/v1/campaigns/{campaignId}/failure-analysis/explainability` | Failure insights → kiểm tra khả năng giải thích bằng dữ liệu thật |
| POST | `/api/v1/campaigns/{campaignId}/failure-analysis/return-to-flow3` | Failure insights → xác nhận đưa các run chưa giải thích được về hàng đợi |
| POST | `/api/v1/campaigns/{campaignId}/failure-analysis/generate` | Failure insights / Review queue → tạo báo cáo từ phiên phân tích |
| POST | `/api/v1/campaigns/{campaignId}/failure-analysis/review` | Review queue → quyết định needs_more/complete và ghi chú |
| GET | `/api/v1/campaigns/{campaignId}/failure-analysis/evaluation` | Campaign reports → APFD/APFDc đã đo, baseline và các điểm đường cong |
| GET | `/api/v1/scenarios/{scenarioId}/draft` | Scenario library/editor → draft save/validate/discard/export |
| POST | `/api/v1/scenarios/{scenarioId}/draft` | Scenario library/editor → draft save/validate/discard/export |
| PUT | `/api/v1/scenarios/{scenarioId}/draft` | Scenario library/editor → draft save/validate/discard/export |
| DELETE | `/api/v1/scenarios/{scenarioId}/draft` | Scenario library/editor → draft save/validate/discard/export |
| GET | `/api/v1/scenarios/{scenarioId}/draft/export` | Scenario library/editor → draft save/validate/discard/export |
| POST | `/api/v1/scenarios/{scenarioId}/draft/validate` | Scenario library/editor → draft save/validate/discard/export |
| POST | `/api/v1/scenarios/import` | Scenario library/import → JSON/YAML import & import history |
| GET | `/api/v1/scenarios/{scenarioId}/imports` | Scenario library/import → JSON/YAML import & import history |
| GET | `/api/v1/scenarios` | Scenario library → search/profile/clone/archive/restore |
| POST | `/api/v1/scenarios` | Scenario library → search/profile/clone/archive/restore |
| GET | `/api/v1/scenarios/{scenarioId}` | Scenario library → search/profile/clone/archive/restore |
| PATCH | `/api/v1/scenarios/{scenarioId}` | Scenario library → search/profile/clone/archive/restore |
| POST | `/api/v1/scenarios/{scenarioId}/archive` | Scenario library → search/profile/clone/archive/restore |
| POST | `/api/v1/scenarios/{scenarioId}/restore` | Scenario library → search/profile/clone/archive/restore |
| POST | `/api/v1/scenarios/{scenarioId}/clone` | Scenario library → search/profile/clone/archive/restore |
| POST | `/api/v1/scenarios/{scenarioId}/versions/{versionNumber}/variant-batches` | Scenario library → Variants: generate/list/detail |
| GET | `/api/v1/scenarios/{scenarioId}/versions/{versionNumber}/variant-batches` | Scenario library → Variants: generate/list/detail |
| GET | `/api/v1/scenarios/{scenarioId}/versions/{versionNumber}/variant-batches/{batchId}` | Scenario library → Variants: generate/list/detail |
| GET | `/api/v1/scenario-versions/ready` | Backend data → READY versions → Inspect/download package |
| GET | `/api/v1/scenario-versions/{scenarioVersionId}/execution-package` | Backend data → READY versions → Inspect/download package |
| GET | `/api/v1/scenarios/{scenarioId}/versions` | Scenario library → Versions: publish/detail/diff/export/deprecate |
| POST | `/api/v1/scenarios/{scenarioId}/versions` | Scenario library → Versions: publish/detail/diff/export/deprecate |
| GET | `/api/v1/scenarios/{scenarioId}/versions/{versionNumber}/export` | Scenario library → Versions: publish/detail/diff/export/deprecate |
| GET | `/api/v1/scenarios/{scenarioId}/versions/{versionNumber}` | Scenario library → Versions: publish/detail/diff/export/deprecate |
| GET | `/api/v1/scenarios/{scenarioId}/versions/diff` | Scenario library → Versions: publish/detail/diff/export/deprecate |
| POST | `/api/v1/scenarios/{scenarioId}/versions/{versionNumber}/deprecate` | Scenario library → Versions: publish/detail/diff/export/deprecate |

## Phạm vi quyền và trạng thái

- Scenario authoring: Scenario Engineer và Admin. Các vai trò còn lại xem các phiên bản READY qua mục Backend data.
- Campaign, ranking và chạy test: Test Engineer/Admin. Đọc kết quả, Oracle và reference có trên các vai trò; nút ghi được giới hạn theo luồng sử dụng và backend vẫn xác thực request.
- Worker API tools: khu vực nâng cao dành cho Test Engineer/Admin. Claim/running/requeue/upload cần chọn đích và xác nhận tác động. Giao diện không tự claim khi mở trang, không tạo telemetry mẫu và không tự gán PASS.
- Telemetry/video upload gửi file gốc bằng raw PUT; đánh giá Oracle và trạng thái run lấy từ backend. Provenance file do người vận hành xác nhận; frontend không thể chứng minh một file bất kỳ được tạo bởi CARLA.
- Video xem trong web được lấy bằng transport có token, hiển thị qua Blob URL và thu hồi URL khi đóng/đổi run. Video chưa upload hoặc lỗi codec được báo rõ.
- Coverage và failure analysis có cho cả bốn vai trò đã đăng nhập, theo các controller `[Authorize]` hiện tại. Backend vẫn quyết định quyền cuối cùng. Scenario tags/history giữ policy authoring của backend.
- Health mới hiển thị `status`, `missingTables`, `postgres`. Giao diện còn đọc được phản hồi legacy có `asxTables`/`expectedTables`; không suy diễn danh sách bảng thiếu từ số đếm cũ.
- Map view dùng tọa độ spawn từ API; không tự vẽ giả làn đường hoặc khẳng định vị trí an toàn để spawn. Validate/READY không chứng minh CARLA đã thực thi thành công.
- Failure analysis lấy đúng phiên phân tích, feature, fault, explanation, report, review note và effectiveness từ API. Chưa có phân tích (404) là trạng thái trống; lỗi HTTP khác hiển thị rõ. Không phát POST tự động khi mở trang.
- Các chỉ số APFD/APFDc ở Prioritization là ước lượng xếp hạng; ở Campaign reports là số liệu backend tính từ các run đã đánh giá. Giá trị `null` giữ trạng thái chưa đủ dữ liệu, không đổi thành 0.

## Những thứ không nằm trong 66 operation

Backend hiện không có endpoint register/reset password, CRUD user/role, sửa Oracle config, quản lý process worker, phân cụm scenario tự động, analytics preferences hoặc audit listing toàn hệ thống. Các module tương ứng tiếp tục có nhãn mock. Lịch sử từng scenario và failure analysis/review/effectiveness đã có API và không còn thuộc nhóm này.

Tại thời điểm kiểm tra, checkout backend có merge conflict chưa được giải quyết, và API localhost:5080 ngừng phục vụ sau khi đã lấy snapshot Swagger 66 operation. Frontend được đối chiếu bằng snapshot và source hiện có; kiểm tra contract/UI dùng transport hoặc server thử nghiệm riêng. Việc build lại backend và kiểm thử CARLA thực tế cần thực hiện sau khi nhóm backend hoàn tất merge. Không sửa conflict, migration hoặc worker để làm kiểm tra frontend vượt qua.

100% trong tài liệu này nghĩa là đã có frontend cho mọi operation của contract backend đang được công bố, kèm kiểm tra contract. Nó không khẳng định backend đã hoàn thành mọi yêu cầu đồ án, mọi payload đều chạy thành công, hoặc CARLA đã được kiểm thử đầu-cuối trong lần sửa frontend này. Backend/worker vẫn quyết định hành vi thực thi, khả năng recorder, quyền API, giới hạn upload và kết quả Oracle.

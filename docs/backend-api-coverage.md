# Backend API coverage

Ngày đối chiếu: **2026-10-27**. Phạm vi: **51 HTTP method + route** do Swagger của `AutoScenarioX.Api` công bố, đối chiếu lại controller, DTO, service và UI hiện tại. Backend và worker không bị sửa trong công việc này.

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
- Health hiển thị nguyên trạng `status`, `asxTables`, `expectedTables`, `postgres`. Health backend hiện so sánh số lượng bảng kỳ vọng; đây chưa phải kiểm tra đầy đủ schema.

## Những thứ không nằm trong 51 operation

Backend hiện không có endpoint register/reset password, CRUD user/role, sửa Oracle config, quản lý process worker, phân cụm lỗi/root-cause review/APFD report, analytics preferences hoặc audit listing. Các module cũ tương ứng vẫn được đánh dấu mock; không tính chúng là dữ liệu thật hoặc là API đã có.

100% trong tài liệu này nghĩa là đã có frontend cho mọi operation của contract backend đang được công bố, kèm kiểm tra contract. Nó không khẳng định backend đã hoàn thành mọi yêu cầu đồ án, mọi payload đều chạy thành công, hoặc CARLA đã được kiểm thử đầu-cuối trong lần sửa frontend này. Backend/worker vẫn quyết định hành vi thực thi, khả năng recorder, quyền API, giới hạn upload và kết quả Oracle.

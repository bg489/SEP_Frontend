import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { vietnameseTranslations } from "./translations";

export type Locale = "en" | "vi";

type TranslationState = { source: string; lastApplied: string };
type AttributeStates = Map<string, TranslationState>;

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
} | null>(null);
const textStates = new WeakMap<Text, TranslationState>();
const attributeStates = new WeakMap<Element, AttributeStates>();
const translatedAttributes = ["placeholder", "title", "aria-label", "alt"] as const;

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function translateDynamic(value: string) {
  let match = value.match(
    /^A password reset link is ready to send to (.+) when authentication is connected\.$/,
  );
  if (match) return "Liên kết đặt lại mật khẩu sẽ được gửi tới " + match[1] + " khi kết nối xác thực được thiết lập.";
  match = value.match(/^(\d+) need review$/);
  if (match) return match[1] + " mục cần duyệt";
  match = value.match(/^(\d+)% complete$/);
  if (match) return "hoàn tất " + match[1] + "%";
  match = value.match(/^(\d+)\s+(?:sec|second|seconds) ago$/);
  if (match) return match[1] + " giây trước";
  match = value.match(/^(\d+)\s+(?:min|minute|minutes) ago$/);
  if (match) return match[1] + " phút trước";
  match = value.match(/^(\d+) rules enabled\.$/);
  if (match) return match[1] + " quy tắc đang bật.";
  match = value.match(/^(\d+) failure labels$/);
  if (match) return match[1] + " nhãn lỗi";
  match = value.match(/^(\d+) scenarios?$/);
  if (match) return match[1] + " kịch bản";
  match = value.match(/^(\d+) actors?$/);
  if (match) return match[1] + " tác nhân";
  match = value.match(/^(\d+) affected runs?$/);
  if (match) return match[1] + " lượt chạy bị ảnh hưởng";
  match = value.match(/^(\d+) runs?$/);
  if (match) return match[1] + " lượt chạy";
  match = value.match(/^(\d+) executions$/);
  if (match) return match[1] + " lượt thực thi";
  match = value.match(/^(\d+) shown$/);
  if (match) return match[1] + " đang hiển thị";
  match = value.match(/^(\d+) approved · (\d+) need attention$/);
  if (match) return match[1] + " đã duyệt · " + match[2] + " cần chú ý";
  match = value.match(/^(\d+) scenarios shown · ([\d,]+) in library$/);
  if (match) return "Đang hiển thị " + match[1] + " kịch bản · " + match[2] + " trong thư viện";
  match = value.match(/^(\d+)\s+scenarios\s+·\s+(\d+)% complete$/);
  if (match) return match[1] + " kịch bản · hoàn tất " + match[2] + "%";
  match = value.match(/^scenarios\s+·\s+(\d+)% complete$/);
  if (match) return "kịch bản · hoàn tất " + match[1] + "%";
  match = value.match(/^scenarios\s+·\s+In execution queue$/);
  if (match) return "kịch bản · Trong hàng đợi thực thi";
  match = value.match(/^(\d+)\s+need review across recent executions$/);
  if (match) return match[1] + " mục cần duyệt trong các lượt thực thi gần đây";
  match = value.match(/^Scenario (.+) saved as draft\.$/);
  if (match) return "Kịch bản " + match[1] + " đã được lưu thành bản nháp.";
  match = value.match(/^Campaign (.+) has been created\.$/);
  if (match) return "Chiến dịch " + match[1] + " đã được tạo.";
  match = value.match(/^Switched to (.+) workspace preview\.$/);
  if (match) return "Đã chuyển sang chế độ xem trước không gian làm việc " + (vietnameseTranslations[match[1]] ?? match[1]) + ".";
  match = value.match(/^(.+) updated in the mock workspace\.$/);
  if (match) return match[1] + " đã được cập nhật trong không gian mẫu.";
  match = value.match(/^(.+) saved as immutable version (.+)\.$/);
  if (match) return match[1] + " đã lưu thành phiên bản bất biến " + match[2] + ".";
  match = value.match(/^(.+) submitted for review\. Save edits before submitting\.$/);
  if (match) return "Đã gửi " + match[1] + " để duyệt. Hãy lưu chỉnh sửa trước khi gửi duyệt.";
  match = value.match(/^(.+) cloned to (.+)\.$/);
  if (match) return "Đã nhân bản " + match[1] + " thành " + match[2] + ".";
  match = value.match(/^Scenario ranking generated for (.+) with (.+)\.$/);
  if (match) return "Đã tạo thứ tự ưu tiên cho " + match[1] + " bằng chiến lược " + (vietnameseTranslations[match[2]] ?? match[2]) + ".";
  match = value.match(/^Select a campaign with scenarios before requesting prioritization\.$/);
  if (match) return "Hãy chọn chiến dịch có kịch bản trước khi yêu cầu xếp ưu tiên.";
  match = value.match(/^(.+) ranking for (.+); (.+)\.$/);
  if (match) return (vietnameseTranslations[match[1]] ?? match[1]) + " cho " + match[2] + "; " + match[3] + ".";
  match = value.match(/^APFD (.+); estimated APFDc (.+); (.+) used for (.+)\.$/);
  if (match) return "APFD " + match[1] + "; APFDc ước tính " + match[2] + "; dùng " + match[3] + " cho " + match[4] + ".";
  match = value.match(/^Imported from (.+)\. Review the scenario definition before approval\.$/);
  if (match) return "Đã nhập từ " + match[1] + ". Hãy xem lại định nghĩa kịch bản trước khi phê duyệt.";
  match = value.match(/^(.+) was imported as a draft\.$/);
  if (match) return match[1] + " đã được nhập dưới dạng bản nháp.";
  match = value.match(/^Invitation prepared for (.+)\.$/);
  if (match) return "Đã chuẩn bị lời mời cho " + match[1] + ".";
  match = value.match(/^(.+) removed from this mock directory\.$/);
  if (match) return "Đã xóa " + match[1] + " khỏi danh bạ mẫu này.";
  match = value.match(/^(.+) started in the mock queue\.$/);
  if (match) return "Đã bắt đầu " + match[1] + " trong hàng đợi mẫu.";
  match = value.match(/^(.+) marked complete in the mock queue\.$/);
  if (match) return "Đã đánh dấu " + match[1] + " hoàn tất trong hàng đợi mẫu.";
  match = value.match(/^(.+) added to the mock simulation cluster\.$/);
  if (match) return "Đã thêm " + match[1] + " vào cụm mô phỏng mẫu.";
  match = value.match(/^(.+) approved for campaign use\.$/);
  if (match) return "Đã phê duyệt " + match[1] + " để sử dụng trong chiến dịch.";
  match = value.match(/^(.+) returned to draft( with a mock review note)?\.$/);
  if (match) return "Đã chuyển " + match[1] + " về bản nháp" + (match[2] ? " kèm ghi chú duyệt mẫu" : "") + ".";
  match = value.match(/^(.+):(\d+) is already used by a registered mock worker\.$/);
  if (match) return match[1] + ":" + match[2] + " đã được một máy chạy mẫu đăng ký sử dụng.";
  match = value.match(/^Failure analytics period changed to (.+); mock chart values are illustrative\.$/);
  if (match) return "Đã đổi kỳ phân tích lỗi sang " + match[1] + "; số liệu biểu đồ chỉ mang tính minh họa.";
  match = value.match(/^Updated just now using (.+)$/);
  if (match) return "Vừa cập nhật bằng " + match[1];
  match = value.match(/^Violations surfaced across (.+)\.$/);
  if (match) return "Vi phạm được phát hiện trong " + (vietnameseTranslations[match[1]] ?? match[1]) + ".";

  const localizedFragments = value
    .replace(/\b(\d+)\s+affected runs?\b/gi, "$1 lượt chạy bị ảnh hưởng")
    .replace(/\b(\d+)\s+failure labels?\b/gi, "$1 nhãn lỗi")
    .replace(/\b(\d+)\s+evidence points?\b/gi, "$1 điểm bằng chứng")
    .replace(/\b(\d+)\s+actors?\b/gi, "$1 tác nhân")
    .replace(/\b(\d+)\s*%\s*confidence\b/gi, "$1% độ tin cậy")
    .replace(/\baffected runs?\b/gi, "lượt chạy bị ảnh hưởng")
    .replace(/\bfailure labels?\b/gi, "nhãn lỗi")
    .replace(/\bevidence points?\b/gi, "điểm bằng chứng")
    .replace(/\bactors?\b/gi, "tác nhân")
    .replace(/%\s*confidence\b/gi, "% độ tin cậy")
    .replace(/\bowner\b/gi, "người phụ trách");
  return localizedFragments === value ? undefined : localizedFragments;
}

function translate(value: string, locale: Locale) {
  if (locale === "en") return value;
  const key = normalize(value);
  if (!key) return value;
  const result = vietnameseTranslations[key] ?? translateDynamic(key);
  if (!result) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  return leading + result + trailing;
}

function processText(node: Text, locale: Locale) {
  const current = node.data;
  let state = textStates.get(node);
  if (!state) {
    state = { source: current, lastApplied: current };
    textStates.set(node, state);
  } else if (current !== state.lastApplied) {
    state.source = current;
  }

  const option = node.parentElement?.closest("option") as HTMLOptionElement | null;
  if (option && !option.hasAttribute("value")) {
    option.setAttribute("value", option.value);
  }

  const next = translate(state.source, locale);
  state.lastApplied = next;
  if (current !== next) node.data = next;
}

function processAttributes(element: Element, locale: Locale) {
  let states = attributeStates.get(element);
  if (!states) {
    states = new Map();
    attributeStates.set(element, states);
  }
  for (const name of translatedAttributes) {
    if (!element.hasAttribute(name)) continue;
    const current = element.getAttribute(name) ?? "";
    let state = states.get(name);
    if (!state) {
      state = { source: current, lastApplied: current };
      states.set(name, state);
    } else if (current !== state.lastApplied) {
      state.source = current;
    }
    const next = translate(state.source, locale);
    state.lastApplied = next;
    if (current !== next) element.setAttribute(name, next);
  }
}

function translateTree(node: Node, locale: Locale) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text;
    if (text.parentElement && !text.parentElement.closest("script,style,code,pre,svg")) {
      processText(text, locale);
    }
    return;
  }
  if (!(node instanceof Element) || node.matches("script,style,code,pre,svg")) return;
  processAttributes(node, locale);
  for (const child of Array.from(node.childNodes)) translateTree(child, locale);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    localStorage.getItem("asx-locale") === "vi" ? "vi" : "en",
  );
  const value = useMemo(
    () => ({ locale, setLocale: (next: Locale) => setLocaleState(next) }),
    [locale],
  );

  useEffect(() => {
    localStorage.setItem("asx-locale", locale);
    document.documentElement.lang = locale;
    const root = document.getElementById("root");
    if (!root) return;
    translateTree(root, locale);

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target instanceof Text) {
          if (
            record.target.parentElement &&
            !record.target.parentElement.closest("script,style,code,pre,svg")
          ) {
            processText(record.target, locale);
          }
        } else if (record.type === "attributes" && record.target instanceof Element) {
          processAttributes(record.target, locale);
        } else {
          for (const added of Array.from(record.addedNodes)) translateTree(added, locale);
          if (record.target instanceof Element) processAttributes(record.target, locale);
        }
      }
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });
    return () => observer.disconnect();
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LanguageProvider");
  return context;
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div className={"language-switch " + className} role="group" aria-label="Switch language">
      <button
        type="button"
        className={locale === "en" ? "active" : ""}
        aria-pressed={locale === "en"}
        aria-label="Switch to English"
        onClick={() => setLocale("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={locale === "vi" ? "active" : ""}
        aria-pressed={locale === "vi"}
        aria-label="Switch to Vietnamese"
        onClick={() => setLocale("vi")}
      >
        VI
      </button>
    </div>
  );
}

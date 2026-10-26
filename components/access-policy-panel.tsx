"use client";

import { useId, useState } from "react";
import { Copy, Download, ShieldCheck } from "lucide-react";
import { useI18n, type Language } from "@/lib/i18n";

interface PolicyCopy {
  title: string;
  description: string;
  draft: string;
  refererTitle: string;
  enabled: string;
  enabledHint: string;
  allowMissing: string;
  allowMissingHint: string;
  allowSameOrigin: string;
  refererSameOriginHint: string;
  hosts: string;
  hostsHint: string;
  addHostname: string;
  hostError: string;
  corsTitle: string;
  corsHint: string;
  corsSameOriginHint: string;
  origins: string;
  originsHint: string;
  addOrigin: string;
  originError: string;
  protectAssets: string;
  protectAssetsHint: string;
  preview: string;
  normalization: string;
  invalidPreview: string;
  copy: string;
  download: string;
  copied: string;
  copyFailed: string;
  downloaded: string;
  downloadFailed: string;
  siteUnavailable: string;
  invalidSite: string;
  added: string;
  line: string;
  applyTitle: string;
  applySteps: string;
  securityNote: string;
}

const COPY: Record<Language, PolicyCopy> = {
  zh: {
    title: "访问策略与防盗链配置",
    description: "生成 Referer 白名单、CORS 与图片直链保护配置。",
    draft: "仅浏览器草稿 · 不会修改当前部署，也不会在刷新后保留。此表单不会读取线上策略。",
    refererTitle: "Referer 防盗链",
    enabled: "启用 Referer 检查",
    enabledHint: "启用后，受保护的请求必须满足以下任一放行条件；关闭后跳过 Referer 检查。",
    allowMissing: "允许无 Referer 的请求",
    allowMissingHint: "适用于地址栏直访、curl 和部分 Markdown 客户端。关闭后，这些请求可能被拒绝。",
    allowSameOrigin: "放行同源请求",
    refererSameOriginHint: "允许 Referer 与图片服务的协议、主机及端口相同的请求。",
    hosts: "Referer 主机名白名单",
    hostsHint: "每行一个精确主机名或 *.example.com；通配符只匹配子域，不含 example.com 本身。不要填写协议、端口或路径。国际域名请使用 Punycode。关闭 Referer 检查时保留这些设置。",
    addHostname: "添加当前站点主机名",
    hostError: "请输入有效主机名或 *.example.com，不接受 URL、端口、路径及其他通配符。",
    corsTitle: "CORS 跨域读取",
    corsHint: "CORS 决定浏览器脚本能否读取跨域响应；图片嵌入通常不受 CORS 限制。CORS 放行不会绕过 Referer 检查。",
    corsSameOriginHint: "为与图片服务同源的 Origin 放行响应读取。此开关独立于 Referer 的同源设置。",
    origins: "允许读取响应的 Origin",
    originsHint: "每行一个完整 http(s) Origin，例如 https://blog.example.com 或 http://localhost:3000。禁止路径（包括末尾 /）、查询、片段、凭据和通配符。",
    addOrigin: "添加当前站点 Origin",
    originError: "请输入精确的 http(s) Origin，不能包含路径、末尾 /、查询、片段、凭据或通配符。",
    protectAssets: "保护图片文件直链",
    protectAssetsHint: "Workers Assets 模式下检查图片文件直链，并要求 assets.run_worker_first = true。Pages 部署需另配中间件或边缘规则。关闭此项可能允许通过文件地址绕过随机接口的检查。",
    preview: "access-policy.json 预览",
    normalization: "导出会忽略空行、去重，并规范化主机名大小写及 Origin（包括默认端口）。留空表示不添加额外白名单。",
    invalidPreview: "请先修正标记的白名单条目，再预览、复制或下载配置。",
    copy: "复制 JSON",
    download: "下载 access-policy.json",
    copied: "JSON 已复制。",
    copyFailed: "复制失败：请手动选择下方 JSON 预览并复制，或下载配置文件。",
    downloaded: "已发起下载。请将 access-policy.json 放到项目根目录。",
    downloadFailed: "下载失败：请复制 JSON 并在项目根目录保存为 access-policy.json。",
    siteUnavailable: "无法获取当前站点的主机名或 Origin，请手动填写。",
    invalidSite: "当前站点地址不符合该字段格式，请手动填写有效值。",
    added: "当前站点已加入白名单（重复项会自动合并）。",
    line: "行号",
    applyTitle: "生成并部署后生效",
    applySteps: "将下载的 access-policy.json 放到项目根目录，在该目录运行下面的命令，再按项目流程重新构建并部署生成的 Worker 与站点产物。修改本页或下载文件都不会直接更新线上 Worker。",
    securityNote: "Referer 可被客户端省略或伪造，此策略用于防盗链，不作为身份认证。",
  },
  en: {
    title: "Access policy & hotlink protection",
    description: "Generate Referer, CORS, and direct image protection settings.",
    draft: "Browser draft only · Changes do not update the deployment or survive a reload. This form does not load the live policy.",
    refererTitle: "Referer hotlink protection",
    enabled: "Enable Referer checks",
    enabledHint: "Protected requests must meet at least one allowance below. Turning this off skips Referer checks.",
    allowMissing: "Allow requests without a Referer",
    allowMissingHint: "Supports address bar visits, curl, and some Markdown clients. Disabling this may block those requests.",
    allowSameOrigin: "Allow same-origin requests",
    refererSameOriginHint: "Allow a Referer with the same scheme, host, and port as the image service.",
    hosts: "Allowed Referer hostnames",
    hostsHint: "One exact hostname or *.example.com per line. The wildcard matches subdomains only, excluding example.com itself. Do not include schemes, ports, or paths. Use Punycode for international domains. These settings are retained when Referer checks are off.",
    addHostname: "Add current site hostname",
    hostError: "Enter a valid hostname or *.example.com, without a URL, port, path, or other wildcards.",
    corsTitle: "CORS response access",
    corsHint: "CORS controls whether browser scripts can read cross-origin responses; embedding images usually does not require it. A CORS allowance does not bypass Referer checks.",
    corsSameOriginHint: "Allow response access for an Origin matching the image service. This is independent of the Referer same-origin setting.",
    origins: "Allowed response Origins",
    originsHint: "One complete http(s) Origin per line, such as https://blog.example.com or http://localhost:3000. No paths (including a trailing /), queries, fragments, credentials, or wildcards.",
    addOrigin: "Add current site Origin",
    originError: "Enter an exact http(s) Origin without a path, trailing /, query, fragment, credentials, or wildcard.",
    protectAssets: "Protect direct image file URLs",
    protectAssetsHint: "Check direct image URLs in Workers Assets mode with assets.run_worker_first = true. Pages deployments need separate middleware or edge rules. Turning this off may allow file URLs to bypass random endpoint checks.",
    preview: "access-policy.json preview",
    normalization: "Export skips blank lines, removes duplicates, and normalizes hostname casing and Origins (including default ports). Empty fields add no extra allowances.",
    invalidPreview: "Fix the marked whitelist entries before previewing, copying, or downloading the configuration.",
    copy: "Copy JSON",
    download: "Download access-policy.json",
    copied: "JSON copied.",
    copyFailed: "Copy failed. Select and copy the JSON preview below manually, or download the configuration file.",
    downloaded: "Download started. Place access-policy.json in the project root.",
    downloadFailed: "Download failed. Copy the JSON and save it as access-policy.json in the project root.",
    siteUnavailable: "The current site hostname or Origin is unavailable. Enter it manually.",
    invalidSite: "The current site address does not match this field's format. Enter a valid value manually.",
    added: "Current site added to the whitelist (duplicates are merged automatically).",
    line: "Line",
    applyTitle: "Generate and deploy to apply",
    applySteps: "Place the downloaded access-policy.json in the project root and run the command below from that directory. Then rebuild and deploy the generated Worker and site assets using your project workflow. Editing this page or downloading a file does not update the live Worker.",
    securityNote: "Clients can omit or forge Referer headers. This policy discourages hotlinking; it does not provide authentication.",
  },
};

const CLI = "python gen_img.py --hash-length 2 --access-policy ./access-policy.json";

function parseLines(value: string) {
  return value.split(/\r?\n/).map((text, index) => ({ value: text.trim(), line: index + 1 }))
    .filter((entry) => entry.value.length > 0);
}

function isIPv6(value: string): boolean {
  if (!value.includes(":") || !/^[a-f0-9:.]+$/i.test(value)) return false;
  try {
    return new URL(`http://[${value}]`).hostname.startsWith("[");
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

function validHostname(value: string): boolean {
  const wildcard = value.startsWith("*.");
  const hostname = wildcard ? value.slice(2) : value;
  if (isIPv6(hostname)) return !wildcard;
  const labels = hostname.split(".");
  const ipv4 = labels.length === 4 && labels.every((label) =>
    /^(0|[1-9][0-9]{0,2})$/.test(label) && Number(label) <= 255
  );
  if (wildcard && ipv4) return false;
  return hostname.length <= 253 && labels.every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)
  );
}

function normalizeOrigin(value: string): string | null {
  if (!/^https?:\/\/[^/?#\s\\*]+$/i.test(value)) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
    if (url.username || url.password || value.includes("@") || !validHostname(hostname)) return null;
    return url.origin;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

interface PolicyCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}

function PolicyCheckbox({ id, checked, onChange, label, hint }: PolicyCheckboxProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={`${id}-hint`}
        className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <div className="space-y-1">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">{label}</label>
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export function AccessPolicyPanel() {
  const { lang } = useI18n();
  const text = COPY[lang];
  const id = useId();
  const [enabled, setEnabled] = useState(true);
  const [allowMissing, setAllowMissing] = useState(true);
  const [refererSameOrigin, setRefererSameOrigin] = useState(true);
  const [corsSameOrigin, setCorsSameOrigin] = useState(true);
  const [protectAssets, setProtectAssets] = useState(true);
  const [hosts, setHosts] = useState("");
  const [origins, setOrigins] = useState("");
  const [notice, setNotice] = useState<{ key: "copied" | "copyFailed" | "downloaded" | "downloadFailed" | "siteUnavailable" | "invalidSite" | "added"; error: boolean } | null>(null);

  const hostEntries = parseLines(hosts);
  const originEntries = parseLines(origins);
  const invalidHosts = hostEntries.filter((entry) => !validHostname(entry.value));
  const invalidOrigins = originEntries.filter((entry) => normalizeOrigin(entry.value) === null);
  const valid = invalidHosts.length === 0 && invalidOrigins.length === 0;
  const json = valid ? JSON.stringify({
    version: 1,
    referer: {
      enabled,
      allowMissing,
      allowSameOrigin: refererSameOrigin,
      allowedHosts: [...new Set(hostEntries.map((entry) => entry.value.toLowerCase()))],
    },
    cors: {
      allowSameOrigin: corsSameOrigin,
      allowedOrigins: [...new Set(originEntries.map((entry) => normalizeOrigin(entry.value)))],
    },
    protectAssetImages: protectAssets,
  }, null, 2) + "\n" : "";

  const update = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setNotice(null);
  };

  const addCurrentSite = (field: "hosts" | "origins") => {
    const value = field === "hosts" ? window.location.hostname : window.location.origin;
    if (!value || value === "null") {
      setNotice({ key: "siteUnavailable", error: true });
      return;
    }
    if (field === "hosts" ? !validHostname(value) : normalizeOrigin(value) === null) {
      setNotice({ key: "invalidSite", error: true });
      return;
    }
    const current = field === "hosts" ? hosts : origins;
    const setter = field === "hosts" ? setHosts : setOrigins;
    setter([...new Set([...parseLines(current).map((entry) => entry.value), value])].join("\n"));
    setNotice({ key: "added", error: false });
  };

  const copyJson = async () => {
    if (!valid) return;
    try {
      if (!navigator.clipboard?.writeText) {
        setNotice({ key: "copyFailed", error: true });
        return;
      }
      await navigator.clipboard.writeText(json);
      setNotice({ key: "copied", error: false });
    } catch (error) {
      console.error("Access policy clipboard copy failed:", error);
      setNotice({ key: "copyFailed", error: true });
    }
  };

  const downloadJson = () => {
    if (!valid) return;
    let url: string | undefined;
    const link = document.createElement("a");
    try {
      url = URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
      link.href = url;
      link.download = "access-policy.json";
      document.body.appendChild(link);
      link.click();
      setNotice({ key: "downloaded", error: false });
    } catch (error) {
      console.error("Access policy download failed:", error);
      setNotice({ key: "downloadFailed", error: true });
    } finally {
      link.remove();
      if (url) {
        const downloadUrl = url;
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    }
  };

  const buttonClass = "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";
  const textareaClass = "w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-red-500";

  return (
    <section aria-labelledby={`${id}-title`} className="mb-8 overflow-hidden rounded-2xl border border-border bg-card/75 shadow-xs">
      <div className="space-y-3 border-b border-border/60 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <h2 id={`${id}-title`} className="text-base font-semibold sm:text-lg">{text.title}</h2>
            <p className="text-sm text-muted-foreground">{text.description}</p>
          </div>
        </div>
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">{text.draft}</p>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <fieldset className="min-w-0 space-y-4">
            <legend className="mb-3 text-sm font-semibold">{text.refererTitle}</legend>
            <PolicyCheckbox id={`${id}-enabled`} checked={enabled} onChange={(value) => update(setEnabled, value)} label={text.enabled} hint={text.enabledHint} />
            <PolicyCheckbox id={`${id}-missing`} checked={allowMissing} onChange={(value) => update(setAllowMissing, value)} label={text.allowMissing} hint={text.allowMissingHint} />
            <PolicyCheckbox id={`${id}-referer-same`} checked={refererSameOrigin} onChange={(value) => update(setRefererSameOrigin, value)} label={text.allowSameOrigin} hint={text.refererSameOriginHint} />
            <div className="space-y-2">
              <label htmlFor={`${id}-hosts`} className="block text-sm font-medium">{text.hosts}</label>
              <p id={`${id}-hosts-hint`} className="text-xs leading-relaxed text-muted-foreground">{text.hostsHint}</p>
              <textarea id={`${id}-hosts`} rows={5} value={hosts} onChange={(event) => update(setHosts, event.target.value)} aria-invalid={invalidHosts.length > 0} aria-describedby={`${id}-hosts-hint${invalidHosts.length ? ` ${id}-hosts-error` : ""}`} placeholder={"blog.example.com\n*.example.com"} spellCheck={false} autoCapitalize="none" className={textareaClass} />
              {invalidHosts.length > 0 && (
                <p id={`${id}-hosts-error`} role="alert" className="text-xs text-red-700 dark:text-red-400">
                  {text.hostError} ({text.line}: {invalidHosts.map((entry) => entry.line).join(", ")})
                </p>
              )}
              <button type="button" onClick={() => addCurrentSite("hosts")} className={buttonClass}>{text.addHostname}</button>
            </div>
          </fieldset>

          <fieldset className="min-w-0 space-y-4">
            <legend className="mb-3 text-sm font-semibold">{text.corsTitle}</legend>
            <p className="text-xs leading-relaxed text-muted-foreground">{text.corsHint}</p>
            <PolicyCheckbox id={`${id}-cors-same`} checked={corsSameOrigin} onChange={(value) => update(setCorsSameOrigin, value)} label={text.allowSameOrigin} hint={text.corsSameOriginHint} />
            <div className="space-y-2">
              <label htmlFor={`${id}-origins`} className="block text-sm font-medium">{text.origins}</label>
              <p id={`${id}-origins-hint`} className="text-xs leading-relaxed text-muted-foreground">{text.originsHint}</p>
              <textarea id={`${id}-origins`} rows={5} value={origins} onChange={(event) => update(setOrigins, event.target.value)} aria-invalid={invalidOrigins.length > 0} aria-describedby={`${id}-origins-hint${invalidOrigins.length ? ` ${id}-origins-error` : ""}`} placeholder={"https://blog.example.com\nhttp://localhost:3000"} spellCheck={false} autoCapitalize="none" className={textareaClass} />
              {invalidOrigins.length > 0 && (
                <p id={`${id}-origins-error`} role="alert" className="text-xs text-red-700 dark:text-red-400">
                  {text.originError} ({text.line}: {invalidOrigins.map((entry) => entry.line).join(", ")})
                </p>
              )}
              <button type="button" onClick={() => addCurrentSite("origins")} className={buttonClass}>{text.addOrigin}</button>
            </div>
          </fieldset>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <PolicyCheckbox id={`${id}-assets`} checked={protectAssets} onChange={(value) => update(setProtectAssets, value)} label={text.protectAssets} hint={text.protectAssetsHint} />
        </div>

        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-muted-foreground">{text.normalization}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!valid} onClick={copyJson} className={buttonClass}><Copy aria-hidden="true" className="h-4 w-4" />{text.copy}</button>
            <button type="button" disabled={!valid} onClick={downloadJson} className={buttonClass}><Download aria-hidden="true" className="h-4 w-4" />{text.download}</button>
          </div>
          <div role="status" aria-live="polite" aria-atomic="true" className="text-xs leading-relaxed">
            {notice && <p className={notice.error ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}>{text[notice.key]}</p>}
          </div>
          <label htmlFor={`${id}-json`} className="block text-sm font-medium">{text.preview}</label>
          <textarea id={`${id}-json`} readOnly value={json} rows={16} spellCheck={false} aria-describedby={!valid ? `${id}-preview-error` : undefined} className={textareaClass} />
          {!valid && (
            <p id={`${id}-preview-error`} className="text-xs text-muted-foreground">{text.invalidPreview}</p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold">{text.applyTitle}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{text.applySteps}</p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs leading-relaxed"><code>{CLI}</code></pre>
          <p className="text-xs leading-relaxed text-muted-foreground">{text.securityNote}</p>
        </div>
      </div>
    </section>
  );
}

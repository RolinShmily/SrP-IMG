"use client";

import React, { createContext, useContext, useState, useSyncExternalStore } from "react";

export type Language = "zh" | "en";

export interface Translations {
  nav: {
    home: string;
    gallery: string;
    settings: string;
    github: string;
  };
  home: {
    badge: string;
    heroTitle: string;
    heroSubtitle: string;
    exploreBtn: string;
    settingsBtn: string;
    liveDemoTitle: string;
    liveDemoSubtitle: string;
    refreshBtn: string;
    copyDirectBtn: string;
    categoriesTitle: string;
    categoriesSubtitle: string;
    featuresTitle: string;
    featuresSubtitle: string;
    featFreeTitle: string;
    featFreeDesc: string;
    featEdgeTitle: string;
    featEdgeDesc: string;
    featSecurityTitle: string;
    featSecurityDesc: string;
    featUaTitle: string;
    featUaDesc: string;
  };
  gallery: {
    title: string;
    subtitle: string;
    countSuffix: string;
    emptyTitle: string;
    emptyDesc: string;
    copySuccess: string;
    copyDirect: string;
    loadedAll: string;
    loading: string;
  };
  settings: {
    title: string;
    subtitle: string;
    baseDomain: string;
    copy: string;
    copied: string;
    all: string;
    tabQuery: string;
    tabDirect: string;
    queryBanner: string;
    directBanner: string;
    cfGuideTitle: string;
    cfGuideTag: string;
    cfGuideDesc: string;
    cfExpand: string;
    cfCollapse: string;
    rule1Title: string;
    rule1Desc: string;
    rule2Title: string;
    rule2Desc: string;
    rule3Title: string;
    rule3Desc: string;
    currentRulesTitle: string;
    dynamicNote: string;
    matchLabel: string;
    rewriteLabel: string;
    copyMatch: string;
    copyRewrite: string;
    extSuffix: string;
  };
  categories: {
    h: string;
    v: string;
    a: string;
    gif: string;
    other: string;
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  zh: {
    nav: {
      home: "首页",
      gallery: "画廊",
      settings: "配置 & API",
      github: "开源仓库",
    },
    home: {
      badge: "开源·零成本·全功能随机图片解决方案",
      heroTitle: "SrP-IMG 全能随机图库",
      heroSubtitle: "基于 Cloudflare Workers 与 Next.js 打造的无限流量、智能多分类随机图片 API 与现代化瀑布流画廊。",
      exploreBtn: "进入画廊",
      settingsBtn: "API 与配置",
      liveDemoTitle: "在线实时体验",
      liveDemoSubtitle: "点击下方按钮体验毫秒级随机分发与设备自适应",
      refreshBtn: "换一张",
      copyDirectBtn: "复制直链",
      categoriesTitle: "图库全景与素材分类",
      categoriesSubtitle: "所有分类均由 Python 离线扩散自动导出，无需手动干预",
      featuresTitle: "核心技术架构优势",
      featuresSubtitle: "专为边缘 Serverless 调优的高性能设计",
      featFreeTitle: "真正零成本·无限流量",
      featFreeDesc: "静态素材托管于 Cloudflare 边缘缓存，结合 Transform Rules 0 消耗 Worker 请求额度。",
      featEdgeTitle: "无感边缘重写",
      featEdgeDesc: "URL 保持极简优雅（如 /h, /a），浏览器地址栏无痕不变，直接输出高清图片流。",
      featSecurityTitle: "Referer 防盗链保护",
      featSecurityDesc: "白名单保护防蹭流量，放行空 Referer 确保 Markdown 与本地终端丝滑调用。",
      featUaTitle: "UA 智能设备分流",
      featUaDesc: "单接口智能探测访问设备：移动端返回高清竖屏壁纸，PC 端返回横屏风景插画。",
    },
    gallery: {
      title: "SrP-IMG 瀑布流画廊",
      subtitle: "动态加载、沉浸预览与多比例自适应",
      countSuffix: "张素材",
      emptyTitle: "该分类暂无有效图片素材",
      emptyDesc: "请在 oriImg 目录中放置单张体积 ≤ 5MB 的图片后重新构建。",
      copySuccess: "已复制",
      copyDirect: "复制直链",
      loadedAll: "已加载全部图片",
      loading: "加载中...",
    },
    settings: {
      title: "API 调用指南 & 边缘配置",
      subtitle: "包含即开即用 302 API、无感边缘直链与防冲突规则生成器",
      baseDomain: "服务基准域名",
      copy: "复制",
      copied: "已复制",
      all: "全部",
      tabQuery: "即开即用 API",
      tabDirect: "无感直链模式",
      queryBanner: "【即开即用模式】：直接通过 Worker 进行 302 随机重定向，部署完成即 100% 全网可用，完美适配 Markdown、外链博客及各类前端调用。",
      directBanner: "【极简无感直链说明】：此模式地址保持极简（如 /a），返回图片时浏览器 URL 始终无痕保持不变。由于在 Cloudflare 边缘重写并直接命中静态资产，完全不消耗 Worker 调用额度（真正 0 成本、无限调用）。",
      cfGuideTitle: "Cloudflare 边缘防冲突重写规则参考与生成器",
      cfGuideTag: "零消耗·无限流量",
      cfGuideDesc: "针对当前站点所有分类一键生成规范表达式，解决多分类“打架”、误伤与 404 隐患",
      cfExpand: "展开配置规则",
      cfCollapse: "收起规则",
      rule1Title: "1. 精准路径前缀隔离",
      rule1Desc: "匹配条件采用 eq \"/cat\" or starts_with(\"/cat/\")，避免 /anime 被 /a 抢先误伤！",
      rule2Title: "2. 杜绝末尾斜杠 404",
      rule2Desc: "重写目标写死固定前缀 concat(\"/cat/\", ...)，避免末尾斜杠拼出双斜杠 404。",
      rule3Title: "3. 严格对齐真实扩展名",
      rule3Desc: "自动提取分类真实后缀（如头像为 .jpeg，GIF 为 .gif），严禁全写成 .jpg。",
      currentRulesTitle: "当前站点分类规则（进入 Cloudflare 控制台 -> Rules -> Transform Rules -> URL Rewrite）：",
      dynamicNote: "重写类型必须选择 Dynamic (动态)",
      matchLabel: "1. 匹配条件 (When incoming requests match - Custom expression):",
      rewriteLabel: "2. 重写路径至 (Path rewrite to - Dynamic):",
      copyMatch: "复制条件",
      copyRewrite: "复制表达式",
      extSuffix: "产物后缀",
    },
    categories: {
      h: "横屏",
      v: "竖屏",
      a: "头像",
      gif: "GIF",
      other: "分类",
    },
  },
  en: {
    nav: {
      home: "Home",
      gallery: "Gallery",
      settings: "Config & API",
      github: "GitHub",
    },
    home: {
      badge: "Open Source · Zero Cost · Unlimited Random Image Solution",
      heroTitle: "SrP-IMG Random Image API",
      heroSubtitle: "An unlimited-traffic, smart multi-category random image solution and modern gallery built on Cloudflare Workers & Next.js.",
      exploreBtn: "Explore Gallery",
      settingsBtn: "API & Config",
      liveDemoTitle: "Live Interactive Preview",
      liveDemoSubtitle: "Experience sub-millisecond random dispatch and device-adaptive image delivery",
      refreshBtn: "Randomize",
      copyDirectBtn: "Copy Link",
      categoriesTitle: "Library Overview & Categories",
      categoriesSubtitle: "All categories are auto-diffused by Python offline build without manual code changes",
      featuresTitle: "Core Architectural Advantages",
      featuresSubtitle: "High-performance serverless design tuned for edge networks",
      featFreeTitle: "Truly Zero Cost · Unlimited",
      featFreeDesc: "Static assets served directly from Cloudflare edge cache with Transform Rules consuming 0 Worker quota.",
      featEdgeTitle: "Seamless Edge Rewrite",
      featEdgeDesc: "Clean and concise URLs (e.g. /h, /a) where browser address bar stays unchanged while streaming image data.",
      featSecurityTitle: "Referer Hotlink Protection",
      featSecurityDesc: "Whitelisted referrer policy prevents hotlinking while empty referrers stay open for Markdown & curl.",
      featUaTitle: "Device-Aware Smart Routing",
      featUaDesc: "Intelligently delivers vertical wallpapers to mobile devices and horizontal scenery to desktops.",
    },
    gallery: {
      title: "SrP-IMG Visual Gallery",
      subtitle: "Dynamic loading, immersive modal preview & adaptive aspect ratios",
      countSuffix: "images",
      emptyTitle: "No valid images in this category",
      emptyDesc: "Please place images <= 5MB in the oriImg directory and run build.",
      copySuccess: "Copied!",
      copyDirect: "Copy Link",
      loadedAll: "All images loaded",
      loading: "Loading...",
    },
    settings: {
      title: "API Guide & Edge Configuration",
      subtitle: "Instant 302 API endpoints, edge seamless direct links, and anti-conflict rule generator",
      baseDomain: "Base Service Domain",
      copy: "Copy",
      copied: "Copied!",
      all: "All",
      tabQuery: "Instant API",
      tabDirect: "Direct Link Mode",
      queryBanner: "[Instant API Mode]: Dispatches 302 redirects directly from Workers. Ready to use immediately across Markdown, blogs, and apps without extra Cloudflare setup.",
      directBanner: "[Direct Link Mode]: Ultra-clean URLs (e.g. /a) where browser address bar stays seamless. Rewritten at Cloudflare edge to consume 0 Worker quota.",
      cfGuideTitle: "Cloudflare Edge Anti-Conflict Rewrite Rule Generator",
      cfGuideTag: "Zero Quota · Unlimited",
      cfGuideDesc: "Standardized expressions for each category preventing rule collisions, prefix mis-matches, and 404 errors",
      cfExpand: "Expand Config Rules",
      cfCollapse: "Collapse Rules",
      rule1Title: "1. Strict Path Prefix Isolation",
      rule1Desc: "Uses eq \"/cat\" or starts_with(\"/cat/\") to prevent /anime from being hijacked by /a!",
      rule2Title: "2. Prevent Trailing Slash 404",
      rule2Desc: "Rewrites with fixed prefix concat(\"/cat/\", ...) to avoid double slash 404 errors.",
      rule3Title: "3. Match Exact Output Extension",
      rule3Desc: "Automatically matches actual category extension (.jpeg, .gif, .jpg) instead of hardcoding .jpg.",
      currentRulesTitle: "Current Category Rules (In Cloudflare Dashboard -> Rules -> Transform Rules -> URL Rewrite):",
      dynamicNote: "Rewrite type must be set to Dynamic",
      matchLabel: "1. Match Condition (When incoming requests match - Custom expression):",
      rewriteLabel: "2. Path Rewrite To (Dynamic):",
      copyMatch: "Copy Condition",
      copyRewrite: "Copy Expression",
      extSuffix: "Output Ext",
    },
    categories: {
      h: "Horizontal",
      v: "Vertical",
      a: "Avatar",
      gif: "GIF",
      other: "Category",
    },
  },
};

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType>({
  lang: "zh",
  setLang: () => {},
  t: TRANSLATIONS.zh,
});

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): Language {
  if (typeof window === "undefined") return "zh";
  try {
    const stored = localStorage.getItem("srp_lang") as Language | null;
    if (stored === "zh" || stored === "en") return stored;
    if (navigator.language?.toLowerCase().startsWith("en")) return "en";
  } catch {
    // ignore
  }
  return "zh";
}

function getServerSnapshot(): Language {
  return "zh";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const storedLang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [overrideLang, setOverrideLang] = useState<Language | null>(null);
  const lang = overrideLang ?? storedLang;

  const setLang = (newLang: Language) => {
    setOverrideLang(newLang);
    try {
      localStorage.setItem("srp_lang", newLang);
      window.dispatchEvent(new Event("storage"));
    } catch {
      // ignore
    }
  };

  const value: I18nContextType = {
    lang,
    setLang,
    t: TRANSLATIONS[lang] || TRANSLATIONS.zh,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  return useContext(I18nContext);
}

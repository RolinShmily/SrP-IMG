"use client";

import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

export type Language = "zh" | "en";

export interface Translations {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    home: string;
    gallery: string;
    settings: string;
    github: string;
    primary: string;
    switchTheme: string;
    switchLanguage: string;
    skipToContent: string;
    menu: string;
    closeMenu: string;
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
    copied: string;
    copyFailed: string;
    browseGallery: string;
    animatedFormat: string;
    adaptive: string;
    previewAlt: string;
    previewLoading: string;
    previewError: string;
    retry: string;
    previewNote: string;
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
  };
  categories: {
    h: string;
    v: string;
    a: string;
    gif: string;
    other: string;
  };
  footer: {
    description: string;
    project: string;
    docs: string;
    releases: string;
    blog: string;
    license: string;
    top: string;
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  zh: {
    meta: {
      title: "SrP-IMG — 随机图片 API 与画廊",
      description: "基于 Cloudflare Workers 与 Next.js 的多分类随机图片服务，支持可配置访问策略与自适应画廊。",
    },
    nav: {
      home: "首页",
      gallery: "画廊",
      settings: "API",
      github: "开源仓库",
      primary: "主导航",
      switchTheme: "切换明暗主题",
      switchLanguage: "切换为英语",
      skipToContent: "跳到主要内容",
      menu: "打开导航菜单",
      closeMenu: "关闭导航菜单",
    },
    home: {
      badge: "开源 · 多分类 · 可配置的随机图片服务",
      heroTitle: "SrP-IMG 全能随机图库",
      heroSubtitle: "基于 Cloudflare Workers 与 Next.js 构建的多分类随机图片 API，配备访问策略配置与自适应画廊。",
      exploreBtn: "进入画廊",
      settingsBtn: "API 与配置",
      liveDemoTitle: "在线实时体验",
      liveDemoSubtitle: "随机浏览各类原图，体验设备自适应分发",
      refreshBtn: "换一张",
      copyDirectBtn: "复制直链",
      copied: "已复制",
      copyFailed: "复制失败，请允许剪贴板访问后重试。",
      browseGallery: "浏览画廊",
      animatedFormat: "动态格式",
      adaptive: "自适应",
      previewAlt: "随机图片预览",
      previewLoading: "正在加载图片…",
      previewError: "图片加载失败，请重试。",
      retry: "重新加载",
      previewNote: "完整显示原图，保留原始比例",
      categoriesTitle: "图库全景与素材分类",
      categoriesSubtitle: "所有分类均由 Python 离线扩散自动导出，无需手动干预",
      featuresTitle: "核心技术架构优势",
      featuresSubtitle: "专为边缘 Serverless 调优的高性能设计",
      featFreeTitle: "静态托管与边缘分发",
      featFreeDesc: "图片可由 Cloudflare 静态资产分发。启用 Worker 直链保护会执行 Worker，额度取决于部署方式与套餐。",
      featEdgeTitle: "自适应瀑布流画廊",
      featEdgeDesc: "按真实比例排布，支持分类切换、键盘浏览与沉浸式预览。",
      featSecurityTitle: "可配置的访问策略",
      featSecurityDesc: "Referer 与 CORS 白名单以运行时变量下发，不写进代码，也不随仓库发布。",
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
      title: "API 调用指南",
      subtitle: "302 随机重定向接口与直链路径的调用方式",
    },
    categories: {
      h: "横屏",
      v: "竖屏",
      a: "头像",
      gif: "GIF",
      other: "分类",
    },
    footer: {
      description: "基于 Cloudflare 与 Next.js 的多分类随机图片服务。配置清晰，选择自由。",
      project: "项目源码",
      docs: "使用说明",
      releases: "发布记录",
      blog: "作者博客",
      license: "MIT License",
      top: "返回顶部",
    },
  },
  en: {
    meta: {
      title: "SrP-IMG — Random Image API & Gallery",
      description: "A multi-category random image service with configurable access policies and an adaptive gallery, built on Cloudflare Workers and Next.js.",
    },
    nav: {
      home: "Home",
      gallery: "Gallery",
      settings: "API",
      github: "GitHub Repository",
      primary: "Main navigation",
      switchTheme: "Toggle color theme",
      switchLanguage: "Switch to Chinese",
      skipToContent: "Skip to main content",
      menu: "Open navigation menu",
      closeMenu: "Close navigation menu",
    },
    home: {
      badge: "Open Source · Multiple Categories · Configurable Access",
      heroTitle: "SrP-IMG Random Image API",
      heroSubtitle: "A multi-category random image API with configurable access policies and an adaptive gallery, built on Cloudflare Workers & Next.js.",
      exploreBtn: "Explore Gallery",
      settingsBtn: "API & Config",
      liveDemoTitle: "Live Interactive Preview",
      liveDemoSubtitle: "Browse random original images and try device-adaptive delivery",
      refreshBtn: "Randomize",
      copyDirectBtn: "Copy Link",
      copied: "Copied",
      copyFailed: "Copy failed. Allow clipboard access and try again.",
      browseGallery: "Browse gallery",
      animatedFormat: "Animated",
      adaptive: "Adaptive",
      previewAlt: "Random image preview",
      previewLoading: "Loading image…",
      previewError: "The image could not load. Please try again.",
      retry: "Try again",
      previewNote: "Full image, original proportions",
      categoriesTitle: "Library Overview & Categories",
      categoriesSubtitle: "All categories are auto-diffused by Python offline build without manual code changes",
      featuresTitle: "Core Architectural Advantages",
      featuresSubtitle: "High-performance serverless design tuned for edge networks",
      featFreeTitle: "Static Hosting & Edge Delivery",
      featFreeDesc: "Deliver images through Cloudflare static assets. Worker-based direct-link protection executes a Worker and is subject to your deployment and plan limits.",
      featEdgeTitle: "Adaptive Gallery",
      featEdgeDesc: "Laid out at true aspect ratio, with category switching, keyboard browsing, and immersive preview.",
      featSecurityTitle: "Configurable Access Policy",
      featSecurityDesc: "Referer and CORS allowlists are supplied as runtime variables: never written into the code and never published with the repository.",
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
      title: "API Guide",
      subtitle: "How to call the 302 redirect endpoints and the direct paths",
    },
    categories: {
      h: "Horizontal",
      v: "Vertical",
      a: "Avatar",
      gif: "GIF",
      other: "Category",
    },
    footer: {
      description: "A multi-category random image service built on Cloudflare & Next.js. Clear configuration, total freedom.",
      project: "Source Code",
      docs: "Documentation",
      releases: "Releases",
      blog: "Author's Blog",
      license: "MIT License",
      top: "Back to top",
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
  } catch {
    // Storage may be disabled; the in-memory preference still works.
  }
  if (sessionLanguage) return sessionLanguage;
  if (navigator.language?.toLowerCase().startsWith("en")) return "en";
  return "zh";
}

function getServerSnapshot(): Language {
  return "zh";
}

let sessionLanguage: Language | null = null;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pathname = usePathname();

  useEffect(() => {
    const messages = TRANSLATIONS[lang];
    const pageName = pathname.startsWith("/gallery") ? messages.nav.gallery
      : pathname.startsWith("/settings") ? messages.nav.settings : "";
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = pageName ? `${pageName} · ${messages.meta.title}` : messages.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", messages.meta.description);
  }, [lang, pathname]);

  const setLang = (newLang: Language) => {
    sessionLanguage = newLang;
    try {
      localStorage.setItem("srp_lang", newLang);
    } catch {
      // Keep this tab's preference when storage is unavailable.
    }
    window.dispatchEvent(new Event("storage"));
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

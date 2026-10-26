import type { Language } from "@/lib/i18n";

interface GalleryMessages {
  categories: string;
  loadMore: string;
  loadError: string;
  retry: string;
  copying: string;
  copyFailed: string;
  emptyDescription: string;
  scrollTop: string;
  copyLabel: (id: number) => string;
  previewLabel: (id: number) => string;
  imageAlt: (id: number) => string;
  imageUnavailable: (id: number) => string;
  copiedAnnouncement: (id: number) => string;
  failedAnnouncement: (id: number) => string;
  loadedAll: (count: number) => string;
}

export const GALLERY_MESSAGES: Record<Language, GalleryMessages> = {
  zh: {
    categories: "图片分类",
    loadMore: "加载更多",
    loadError: "暂时无法加载图库，请重试。",
    retry: "重试",
    copying: "复制中…",
    copyFailed: "复制失败",
    emptyDescription: "试试其他分类，稍后再来看看。",
    scrollTop: "回到顶部",
    copyLabel: (id) => `复制图片 #${id} 的直链`,
    previewLabel: (id) => `预览图片 #${id}`,
    imageAlt: (id) => `图库图片 #${id}`,
    imageUnavailable: (id) => `图片 #${id} 暂时无法显示`,
    copiedAnnouncement: (id) => `已复制图片 #${id} 的直链`,
    failedAnnouncement: (id) => `无法复制图片 #${id} 的直链，请重试。`,
    loadedAll: (count) => `已加载全部 ${count} 张图片`,
  },
  en: {
    categories: "Image categories",
    loadMore: "Load more",
    loadError: "The gallery could not be loaded. Please try again.",
    retry: "Retry",
    copying: "Copying…",
    copyFailed: "Copy failed",
    emptyDescription: "Try another category or check back later.",
    scrollTop: "Back to top",
    copyLabel: (id) => `Copy the direct link for image #${id}`,
    previewLabel: (id) => `Preview image #${id}`,
    imageAlt: (id) => `Gallery image #${id}`,
    imageUnavailable: (id) => `Image #${id} is currently unavailable`,
    copiedAnnouncement: (id) => `Copied the direct link for image #${id}`,
    failedAnnouncement: (id) => `Could not copy the direct link for image #${id}. Please try again.`,
    loadedAll: (count) => `All ${count} images loaded`,
  },
};

import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import HomePage from "@/pages/home";
import GalleryPage from "@/pages/gallery";
import SettingsPage from "@/pages/settings";

/** Mirrors the old app/template.tsx: remount on pathname change to replay the reveal. */
function RouteTransition() {
  const { pathname } = useLocation();

  return (
    <div key={pathname} className="route-enter min-h-screen">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <I18nProvider>
          <RouteTransition />
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

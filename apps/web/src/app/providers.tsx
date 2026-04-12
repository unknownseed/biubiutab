"use client";

import HealthProvider from "@/components/health-provider";
import ToastProvider from "@/components/toast-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <HealthProvider>{children}</HealthProvider>
    </ToastProvider>
  );
}

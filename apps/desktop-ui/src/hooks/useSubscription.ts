import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type SubscriptionInfo = {
  isPro: boolean;
  planType: "free" | "monthly" | "quarterly" | "yearly";
  status: string | null;
  currentPeriodEnd: string | null;
  usedQuota: number;
  totalQuota: number;
};

const defaultFree: SubscriptionInfo = {
  isPro: false,
  planType: "free",
  status: null,
  currentPeriodEnd: null,
  usedQuota: 0,
  totalQuota: 3,
};

async function fetchSubscriptionViaCloud(token: string): Promise<SubscriptionInfo> {
  const headers = { Authorization: `Bearer ${token}` };
  const text = await window.desktop!.cloudGetText!("/api/me/subscription", headers);
  const obj = JSON.parse(text || "{}") || {};
  return {
    isPro: Boolean(obj.isPro),
    planType: obj.planType || "free",
    status: obj.status || null,
    currentPeriodEnd: obj.currentPeriodEnd || null,
    usedQuota: Number(obj.usedQuota || 0),
    totalQuota: Number(obj.totalQuota || 3),
  };
}

export function useSubscription() {
  const sb = useMemo(() => supabase(), []);
  const [info, setInfo] = useState<SubscriptionInfo>(defaultFree);
  const [loading, setLoading] = useState(false);

  const fetchSubscription = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sess } = await sb.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        setInfo(defaultFree);
        setLoading(false);
        return;
      }
      if (window.desktop?.cloudGetText) {
        setInfo(await fetchSubscriptionViaCloud(token));
      } else {
        setInfo(defaultFree);
      }
    } catch {
      setInfo(defaultFree);
    } finally {
      setLoading(false);
    }
  }, [sb]);

  useEffect(() => {
    void fetchSubscription();
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) void fetchSubscription();
      else setInfo(defaultFree);
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [sb, fetchSubscription]);

  return { info, loading, refetch: fetchSubscription };
}

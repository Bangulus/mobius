'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

const CONSENT_KEY = 'mobius_cookie_consent';

let initialized = false;

export function initPostHogIfConsented() {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  if (localStorage.getItem(CONSENT_KEY) !== 'accepted') return;
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'always',
    capture_pageview: false,
  });
  initialized = true;
}

export default function PostHogClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    initPostHogIfConsented();
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

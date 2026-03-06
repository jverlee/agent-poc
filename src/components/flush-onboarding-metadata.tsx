"use client";

import { useEffect } from "react";

export function FlushOnboardingMetadata() {
  useEffect(() => {
    const phone = sessionStorage.getItem("onboarding_phone");
    const companyWebsite = sessionStorage.getItem(
      "onboarding_company_website"
    );

    if (!phone && !companyWebsite) return;

    const metadata: Record<string, string> = {};
    if (phone) metadata.phone = phone;
    if (companyWebsite) metadata.company_website = companyWebsite;

    fetch("/api/profile/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata }),
    })
      .then((res) => {
        if (res.ok) {
          sessionStorage.removeItem("onboarding_phone");
          sessionStorage.removeItem("onboarding_company_website");
        }
      })
      .catch(() => {
        // Data stays in sessionStorage for retry on next load
      });
  }, []);

  return null;
}

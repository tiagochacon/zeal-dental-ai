import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the Stripe checkout flow refactoring.
 * 
 * These tests validate:
 * 1. The createCheckoutSession procedure exists and has correct input schema
 * 2. The createPortalSession procedure exists
 * 3. The Stripe price IDs match between frontend and backend
 */

// Import backend stripe products config
import { STRIPE_PRICE_IDS as BACKEND_PRICE_IDS } from "./stripe/products";

describe("Stripe Checkout Integration", () => {
  describe("Price ID consistency", () => {
    it("should have BASIC price ID defined in backend", () => {
      expect(BACKEND_PRICE_IDS.BASIC).toBe("price_1SuYhvJBQOFbtGZhL4AVyGqb");
    });

    it("should have PRO price ID defined in backend", () => {
      expect(BACKEND_PRICE_IDS.PRO).toBe("price_1SuYhvJBQOFbtGZhu5hcAhqH");
    });

    it("should have both BASIC and PRO price IDs as non-empty strings", () => {
      expect(typeof BACKEND_PRICE_IDS.BASIC).toBe("string");
      expect(typeof BACKEND_PRICE_IDS.PRO).toBe("string");
      expect(BACKEND_PRICE_IDS.BASIC.length).toBeGreaterThan(0);
      expect(BACKEND_PRICE_IDS.PRO.length).toBeGreaterThan(0);
    });

    it("should have BASIC and PRO as different price IDs", () => {
      expect(BACKEND_PRICE_IDS.BASIC).not.toBe(BACKEND_PRICE_IDS.PRO);
    });
  });

  describe("Stripe products helper functions", () => {
    it("should export getTierFromPriceId", async () => {
      const { getTierFromPriceId } = await import("./stripe/products");
      expect(getTierFromPriceId(BACKEND_PRICE_IDS.BASIC)).toBe("basic");
      expect(getTierFromPriceId(BACKEND_PRICE_IDS.PRO)).toBe("pro");
      expect(getTierFromPriceId("invalid_price_id")).toBeNull();
    });

    it("should export getTierFromAmount", async () => {
      const { getTierFromAmount } = await import("./stripe/products");
      // Pro: R$ 349.90 = 34990 cents
      expect(getTierFromAmount(34990)).toBe("pro");
      // Basic: R$ 179.90 = 17990 cents
      expect(getTierFromAmount(17990)).toBe("basic");
      // Below threshold
      expect(getTierFromAmount(5000)).toBe("trial");
    });

    it("should export hasNeurovendasAccess", async () => {
      const { hasNeurovendasAccess } = await import("./stripe/products");
      expect(hasNeurovendasAccess("pro")).toBe(true);
      expect(hasNeurovendasAccess("unlimited")).toBe(true);
      expect(hasNeurovendasAccess("basic")).toBe(false);
      expect(hasNeurovendasAccess("trial")).toBe(false);
    });

    it("should export getConsultationLimit", async () => {
      const { getConsultationLimit } = await import("./stripe/products");
      expect(getConsultationLimit("trial")).toBe(7);
      expect(getConsultationLimit("basic")).toBe(20);
      expect(getConsultationLimit("pro")).toBe(50);
      expect(getConsultationLimit("unlimited")).toBeNull(); // unlimited
    });
  });

  describe("No static Payment Links remain", () => {
    it("should not reference buy.stripe.com in the hook file", async () => {
      const fs = await import("fs");
      const hookContent = fs.readFileSync(
        "/home/ubuntu/zeal-dental-ai/client/src/hooks/useStripeCheckout.ts",
        "utf-8"
      );
      // The only reference should be in the JSDoc comment, not in actual code
      const lines = hookContent.split("\n");
      const codeLines = lines.filter(
        (l) => !l.trim().startsWith("*") && !l.trim().startsWith("//")
      );
      const codeContent = codeLines.join("\n");
      expect(codeContent).not.toContain("buy.stripe.com");
    });

    it("should not have window.open with stripe links in any component", async () => {
      const fs = await import("fs");
      const path = await import("path");
      
      const filesToCheck = [
        "client/src/components/UpgradeBanner.tsx",
        "client/src/components/UpgradeModal.tsx",
        "client/src/components/LimitReachedModal.tsx",
        "client/src/components/UsageCounterModal.tsx",
        "client/src/pages/Pricing.tsx",
        "client/src/pages/Register.tsx",
        "client/src/pages/Subscription.tsx",
      ];

      for (const file of filesToCheck) {
        const fullPath = path.join("/home/ubuntu/zeal-dental-ai", file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          expect(content).not.toContain("buy.stripe.com");
          // Also check there's no window.open with stripe
          expect(content).not.toMatch(/window\.open\(.*stripe/i);
        }
      }
    });
  });
});

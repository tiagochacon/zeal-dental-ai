import type { Express, Request, Response } from "express";

/**
 * OAuth routes are deprecated - all authentication now uses custom email/password.
 * This file is kept for backwards compatibility but redirects to the custom login page.
 */
export function registerOAuthRoutes(app: Express) {
  // Redirect any OAuth callback attempts to the custom login page
  app.get("/api/oauth/callback", async (_req: Request, res: Response) => {
    console.log("[OAuth] Deprecated OAuth callback accessed, redirecting to /login");
    res.redirect(302, "/login");
  });
}

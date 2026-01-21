export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Login URL now points to custom login page instead of OAuth
export const getLoginUrl = () => {
  return "/login";
};

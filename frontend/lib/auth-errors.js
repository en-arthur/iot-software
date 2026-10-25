/**
 * Turn raw Supabase Auth errors into messages that are useful to a person.
 *
 * @param {{ message?: string } | null | undefined} error
 * @returns {string}
 */
export function getAuthErrorMessage(error) {
  const message = error?.message ?? "";

  if (/invalid login credentials/i.test(message)) {
    return "Incorrect email or password. Please try again.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email address before signing in. Check your inbox for the confirmation link.";
  }
  if (/user already registered|already been registered/i.test(message)) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (/password should be at least|password is too short/i.test(message)) {
    return "Password must be at least 6 characters long.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (/unable to validate email|invalid email/i.test(message)) {
    return "Enter a valid email address.";
  }
  if (/signups? not allowed|signup is disabled/i.test(message)) {
    return "New sign-ups are disabled for this project.";
  }
  if (/network|fetch/i.test(message)) {
    return "Could not reach Supabase. Check your internet connection and try again.";
  }

  return message || "Something went wrong. Please try again.";
}

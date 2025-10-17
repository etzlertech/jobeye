/**
 * Login Page - Redirect to /auth/sign-in
 *
 * This page exists for backwards compatibility and E2E test expectations.
 * It immediately redirects to the actual sign-in page at /auth/sign-in.
 */

import { redirect } from 'next/navigation';

export default function LoginPage() {
  redirect('/auth/sign-in');
}

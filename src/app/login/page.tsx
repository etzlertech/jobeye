/**
 * Login Page - Redirect to /
 *
 * This page exists for backwards compatibility and E2E test expectations.
 * It immediately redirects to the root sign-in page.
 */

import { redirect } from 'next/navigation';

export default function LoginPage() {
  redirect('/');
}

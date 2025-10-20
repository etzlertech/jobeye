/**
 * Login Page - Redirect to /sign-in
 *
 * This page exists for backwards compatibility and E2E test expectations.
 * It immediately redirects to the current sign-in page at /sign-in.
 */

import { redirect } from 'next/navigation';

export default function LoginPage() {
  redirect('/sign-in');
}

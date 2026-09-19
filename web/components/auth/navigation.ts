// A new document binds all authenticated requests to the newly signed-in user.
// Client-side routing would leave callbacks from the previous session alive.
export function navigateAfterLogin(destination: string): void {
  window.location.assign(destination);
}

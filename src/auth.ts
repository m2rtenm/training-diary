import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

declare const __COGNITO_AUTHORITY__: string
declare const __COGNITO_CLIENT_ID__: string
declare const __COGNITO_HOSTED_UI__: string

const configured = Boolean(__COGNITO_AUTHORITY__ && __COGNITO_CLIENT_ID__ && __COGNITO_HOSTED_UI__)

export const authConfigured = configured
export const auth = configured ? new UserManager({
  authority: __COGNITO_AUTHORITY__,
  client_id: __COGNITO_CLIENT_ID__,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code',
  scope: 'openid email',
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  automaticSilentRenew: false,
  loadUserInfo: false,
}) : null

export async function signOutFromCognito() {
  if (!auth) return

  // Cognito's /logout endpoint expects logout_uri. oidc-client-ts sends the
  // standard post_logout_redirect_uri parameter, which Cognito does not accept.
  const hostedUi = new URL(__COGNITO_HOSTED_UI__)
  if (hostedUi.protocol !== 'https:' || !/^[a-z0-9-]+\.auth\.[a-z0-9-]+\.amazoncognito\.com$/i.test(hostedUi.hostname)) {
    throw new Error('Invalid Cognito hosted UI URL')
  }
  const logoutUrl = new URL('/logout', hostedUi)
  logoutUrl.searchParams.set('client_id', __COGNITO_CLIENT_ID__)
  logoutUrl.searchParams.set('logout_uri', `${window.location.origin}/`)

  try {
    await auth.removeUser()
  } finally {
    window.location.replace(logoutUrl.toString())
  }
}

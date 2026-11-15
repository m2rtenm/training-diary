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

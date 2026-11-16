"""Allow only verified Google identities listed in ALLOWED_EMAILS."""

import os


def handler(event, _context):
    if event.get("triggerSource") != "PreSignUp_ExternalProvider":
        raise Exception("Only the configured Google sign-in is allowed.")

    attributes = event.get("request", {}).get("userAttributes", {}) or {}
    email = (attributes.get("email") or "").strip().lower()
    verified = (attributes.get("email_verified") or "").lower() == "true"
    allowed = {
        value.strip().lower()
        for value in os.environ.get("ALLOWED_EMAILS", "").split(",")
        if value.strip()
    }

    if not verified or not email or email not in allowed:
        raise Exception("This Google account is not authorized for Stride.")

    event["response"]["autoConfirmUser"] = True
    event["response"]["autoVerifyEmail"] = True
    return event

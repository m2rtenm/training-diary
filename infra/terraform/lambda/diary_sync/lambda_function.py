import base64
import hashlib
import hmac
import gzip
import json
import math
import os
import re
import time
import urllib.request
from datetime import date
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError


TABLE = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
ISSUER = os.environ["COGNITO_ISS"]
CLIENT_ID = os.environ["COGNITO_CLIENT_ID"]
APP_ORIGIN = os.environ["APP_ORIGIN"]
MAX_DIARY_BYTES = int(os.environ.get("MAX_DIARY_BYTES", "2097152"))
MAX_STORED_BYTES = int(os.environ.get("MAX_STORED_BYTES", "20000"))
_jwks = None
_jwks_loaded_at = 0
_SHA256_DIGEST_INFO = bytes.fromhex("3031300d060960864801650304020105000420")


class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message


def _valid_diary(diary):
    if not isinstance(diary, dict) or set(diary) != {"sessions", "exercises"}:
        return False
    sessions = diary["sessions"]
    exercises = diary["exercises"]
    if not isinstance(sessions, list) or not isinstance(exercises, list) or len(sessions) > 5000 or len(exercises) > 200:
        return False
    kinds = {"Run", "Padel", "Gym", "Fencing", "Rehab", "Other"}
    bounds = {"duration": (1, 1440), "effort": (1, 10), "distance": (0, 1000), "sets": (1, 10000), "reps": (1, 10000), "pain": (0, 10)}
    for session in sessions:
        if not isinstance(session, dict):
            return False
        if not isinstance(session.get("id"), str) or not 1 <= len(session["id"]) <= 100:
            return False
        if not isinstance(session.get("date"), str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", session["date"]):
            return False
        try:
            date.fromisoformat(session["date"])
        except ValueError:
            return False
        if not isinstance(session.get("kind"), str) or session["kind"] not in kinds:
            return False
        if not isinstance(session.get("title"), str) or not 1 <= len(session["title"]) <= 120:
            return False
        if any(name not in {"id", "date", "kind", "title", "completed", "notes", *bounds} for name in session):
            return False
        if "completed" in session and not isinstance(session["completed"], bool):
            return False
        if "notes" in session and (not isinstance(session["notes"], str) or len(session["notes"]) > 4000):
            return False
        for name, (minimum, maximum) in bounds.items():
            value = session.get(name)
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not minimum <= value <= maximum):
                return False
    for exercise in exercises:
        if not isinstance(exercise, dict) or set(exercise) != {"id", "name", "detail"}:
            return False
        if not isinstance(exercise["id"], str) or not 1 <= len(exercise["id"]) <= 100:
            return False
        if not isinstance(exercise["name"], str) or not 1 <= len(exercise["name"]) <= 120:
            return False
        if not isinstance(exercise["detail"], str) or len(exercise["detail"]) > 500:
            return False
    return True


def _response(status, body=None):
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
        },
        "body": "" if body is None else json.dumps(body, separators=(",", ":")),
    }


def _b64url(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _load_jwks(force=False):
    global _jwks, _jwks_loaded_at
    if not force and _jwks is not None and time.time() - _jwks_loaded_at < 3600:
        return _jwks
    url = f"{ISSUER}/.well-known/jwks.json"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=4) as response:
        keys = json.loads(response.read(65536))
    _jwks = {key["kid"]: key for key in keys["keys"] if key.get("kty") == "RSA"}
    _jwks_loaded_at = time.time()
    return _jwks


def _verify_token(event):
    auth = (event.get("headers") or {}).get("authorization", "")
    if not auth.startswith("Bearer ") or len(auth) > 20000:
        raise ApiError(401, "Unauthorized")
    token = auth[7:]
    try:
        header_part, claims_part, signature_part = token.split(".")
        header = json.loads(_b64url(header_part))
        claims = json.loads(_b64url(claims_part))
        if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
            raise ValueError("Unsupported token algorithm")
        key = _load_jwks().get(header["kid"])
        if not key:
            key = _load_jwks(force=True).get(header["kid"])
        if not key or key.get("use") not in (None, "sig") or key.get("alg") not in (None, "RS256"):
            raise ValueError("Unknown or invalid signing key")
        modulus = int.from_bytes(_b64url(key["n"]), "big")
        exponent = int.from_bytes(_b64url(key["e"]), "big")
        if modulus.bit_length() < 2048:
            raise ValueError("Signing key is too small")
        signature = _b64url(signature_part)
        key_size = (modulus.bit_length() + 7) // 8
        signature_number = int.from_bytes(signature, "big")
        if len(signature) != key_size or signature_number >= modulus:
            raise ValueError("Invalid token signature length")
        encoded_signature = pow(signature_number, exponent, modulus).to_bytes(key_size, "big")
        digest = hashlib.sha256(f"{header_part}.{claims_part}".encode()).digest()
        padding = len(encoded_signature) - len(_SHA256_DIGEST_INFO) - len(digest) - 3
        expected_signature = b"\x00\x01" + b"\xff" * padding + b"\x00" + _SHA256_DIGEST_INFO + digest
        valid_signature = padding >= 8 and hmac.compare_digest(encoded_signature, expected_signature)
        now = int(time.time())
        if not valid_signature:
            raise ValueError("Invalid token signature")
        if claims.get("iss") != ISSUER or claims.get("token_use") != "access":
            raise ValueError("Unexpected token issuer or use")
        if claims.get("client_id") != CLIENT_ID or not isinstance(claims.get("sub"), str):
            raise ValueError("Unexpected token client")
        if isinstance(claims.get("exp"), bool) or not isinstance(claims.get("exp"), (int, float)) or claims["exp"] <= now:
            raise ValueError("Expired token")
        if "nbf" in claims and (isinstance(claims["nbf"], bool) or not isinstance(claims["nbf"], (int, float)) or claims["nbf"] > now):
            raise ValueError("Token is not active")
        return claims["sub"]
    except ApiError:
        raise
    except Exception as error:
        raise ApiError(401, "Unauthorized") from error


def _handle(event):
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    if method == "OPTIONS":
        return _response(204)
    headers = {str(name).lower(): value for name, value in (event.get("headers") or {}).items()}
    event = {**event, "headers": headers}
    origin = headers.get("origin")
    if origin != APP_ORIGIN:
        raise ApiError(403, "Forbidden")
    subject = _verify_token(event)

    if method == "GET":
        item = TABLE.get_item(Key={"user_id": subject}, ConsistentRead=True).get("Item")
        if not item:
            return _response(200, {"revision": 0, "diary": None})
        packed = item["diary_gzip"].value
        diary = json.loads(gzip.decompress(packed))
        return _response(200, {"revision": int(item["revision"]), "diary": diary})

    if method != "PUT":
        raise ApiError(405, "Method not allowed")
    if event.get("isBase64Encoded"):
        raise ApiError(400, "Invalid request")
    raw_body = event.get("body") or ""
    if len(raw_body.encode("utf-8")) > MAX_DIARY_BYTES + 1024:
        raise ApiError(413, "Diary exceeds the cloud sync size limit")
    try:
        payload = json.loads(raw_body)
        diary = payload["diary"]
        expected_revision = payload["expectedRevision"]
        serialized = json.dumps(diary, separators=(",", ":"), ensure_ascii=False)
        if type(expected_revision) is not int or expected_revision < 0:
            raise ValueError("Invalid revision")
        encoded_diary = serialized.encode("utf-8")
        if len(encoded_diary) > MAX_DIARY_BYTES:
            raise ApiError(413, "Diary exceeds the cloud sync size limit")
        if not _valid_diary(diary):
            raise ValueError("Invalid diary")
        stored_diary = gzip.compress(encoded_diary, mtime=0)
        if len(stored_diary) > MAX_STORED_BYTES:
            raise ApiError(413, "Diary is too large for the free provisioned cloud sync limit")
    except ApiError:
        raise
    except Exception as error:
        raise ApiError(400, "Invalid diary data") from error

    new_revision = expected_revision + 1
    try:
        if expected_revision == 0:
            TABLE.put_item(
                Item={"user_id": subject, "revision": new_revision, "diary_gzip": stored_diary},
                ConditionExpression="attribute_not_exists(user_id)",
            )
        else:
            TABLE.put_item(
                Item={"user_id": subject, "revision": new_revision, "diary_gzip": stored_diary},
                ConditionExpression="revision = :expected",
                ExpressionAttributeValues={":expected": Decimal(expected_revision)},
            )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            raise ApiError(409, "Diary changed on another device") from error
        raise
    return _response(200, {"revision": new_revision})


def handler(event, context):
    try:
        return _handle(event)
    except ApiError as error:
        return _response(error.status, {"error": error.message})
    except Exception:
        return _response(500, {"error": "Unable to sync diary"})

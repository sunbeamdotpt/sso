#!/usr/bin/env python3
import json
import sys
from urllib.parse import urlparse

har_path = sys.argv[1] if len(sys.argv) > 1 else "/Users/sienna/Downloads/auth.sunbeam.pt.har"
with open(har_path, "r", encoding="utf-8") as f:
    har = json.load(f)

entries = har["log"]["entries"]

def cookies_str(cookies):
    if not cookies:
        return "(none)"
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies)

def headers(hdrs):
    return {h["name"].lower(): h["value"] for h in hdrs}

for i, e in enumerate(entries):
    url = e["request"]["url"]
    parsed = urlparse(url)
    path = parsed.path
    if not path.startswith("/api/self-service/"):
        continue
    method = e["request"]["method"]
    req_headers = headers(e["request"]["headers"])
    req_cookies = e["request"].get("cookies", [])
    status = e["response"]["status"]
    resp_headers = headers(e["response"]["headers"])
    set_cookie = resp_headers.get("set-cookie", "")
    print(f"\n=== [{i}] {method} {url}")
    print(f"Request Cookie header: {req_headers.get('cookie', '(none)')}")
    print(f"Request cookies array: {cookies_str(req_cookies)}")
    print(f"Response status: {status}")
    print(f"Response Set-Cookie: {set_cookie if set_cookie else '(none)'}")

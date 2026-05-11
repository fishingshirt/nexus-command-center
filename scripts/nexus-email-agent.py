#!/usr/bin/env python3
"""Nexus Email Agent — Cron-friendly AI draft generator for Gmail inbox.

Scans unread threads, classifies priority, drafts replies via local Ollama,
and saves them as Gmail drafts for user review.

Usage (cron every 30 min):
    */30 * * * * python3 /tmp/nexus-command-center/scripts/nexus-email-agent.py
"""
import json, os, sys, time, urllib.request, urllib.parse, base64

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _SCRIPT_DIR)

from nexus_server import _load_gmail_tokens, _gmail_access_token, _build_email_ai_prompt, _ollama_generate

_GMAIL_TOKEN_PATH = os.path.expanduser('~/.hermes/nexus-gmail-tokens.json')

def _gmail_api(path, method='GET', data=None, timeout=15):
    at = _gmail_access_token()
    if not at:
        return None
    url = f'https://www.googleapis.com/gmail/v1/users/me{path}'
    headers = {'Authorization': f'Bearer {at}'}
    if data:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'Gmail API error {e.code}: {body}', file=sys.stderr)
        return None
    except Exception as e:
        print(f'Gmail API exception: {e}', file=sys.stderr)
        return None

def _get_priority(subject):
    s = (subject or '').lower()
    if any(w in s for w in ['urgent','asap','deadline','critical']):
        return 'urgent'
    if any(w in s for w in ['action required','confirm','todo','task','please review','approval needed']):
        return 'action'
    return 'normal'

def main():
    # 1. Load Gmail tokens
    tokens = _load_gmail_tokens()
    if not tokens.get('access_token'):
        print('Gmail not linked. Exiting.', file=sys.stderr)
        sys.exit(0)

    # 2. Fetch unread threads in INBOX
    result = _gmail_api('/threads?labelIds=INBOX&labelIds=UNREAD&maxResults=10')
    if not result or 'threads' not in result:
        print('No unread threads or API error.', file=sys.stderr)
        sys.exit(0)

    drafted = 0
    for t in result['threads']:
        tid = t.get('id')
        if not tid:
            continue
        # Fetch thread details
        td = _gmail_api(f'/threads/{urllib.parse.quote(tid)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From')
        if not td:
            continue
        msgs = td.get('messages', [])
        if not msgs:
            continue
        first = msgs[0]
        headers = {h['name']: h['value'] for h in first.get('payload', {}).get('headers', [])}
        subject = headers.get('Subject', 'No subject')
        priority = _get_priority(subject)
        if priority not in ('urgent', 'action'):
            continue
        # Fetch full thread for context
        full = _gmail_api(f'/threads/{urllib.parse.quote(tid)}?format=full')
        if not full:
            continue
        messages = []
        for msg in full.get('messages', []):
            payload = msg.get('payload', {})
            h = {hh['name']: hh['value'] for hh in payload.get('headers', [])}
            parts = payload.get('parts', [])
            body_text = ''
            for part in parts:
                if part.get('mimeType') == 'text/plain':
                    bd = part.get('body', {}).get('data', '')
                    if bd:
                        body_text += base64.urlsafe_b64decode(bd).decode('utf-8', errors='replace')
                elif part.get('mimeType') == 'text/html' and not body_text:
                    bd = part.get('body', {}).get('data', '')
                    if bd:
                        body_text = base64.urlsafe_b64decode(bd).decode('utf-8', errors='replace')
            if not body_text and payload.get('body', {}).get('data'):
                body_text = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='replace')
            messages.append({'from': h.get('From',''), 'subject': h.get('Subject',''), 'body': body_text})
        if not messages:
            continue
        last = messages[-1]
        to = last.get('from','').replace('<.*?>', '').strip() or last.get('from','')
        subj = last.get('subject','')
        if not subj.startswith('Re:'):
            subj = f'Re: {subj}'
        # Build AI draft
        prompt = _build_email_ai_prompt(messages, to, subj)
        draft_text = _ollama_generate(prompt)
        if not draft_text:
            print(f'Skipping thread {tid}: AI draft failed (no model or Ollama down).')
            continue
        # Save as Gmail draft
        raw_msg = f'To: {to}\nSubject: {subj}\n\n{draft_text}'
        encoded = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('ascii')
        draft_data = {'message': {'raw': encoded, 'threadId': tid}}
        dr = _gmail_api('/drafts', method='POST', data=draft_data)
        if dr and dr.get('id'):
            drafted += 1
            print(f'Drafted reply for thread {tid} ({priority}): {subject[:60]}')
        else:
            print(f'Failed to save draft for thread {tid}.')

    print(f'Email agent finished: {drafted} draft(s) created.')
    sys.exit(0)

if __name__ == '__main__':
    main()

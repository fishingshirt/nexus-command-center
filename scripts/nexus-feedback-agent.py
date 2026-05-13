#!/usr/bin/env python3
"""Nexus Feedback Agent — read feedback queue, classify, optionally auto-generate tasks.
Usage: python3 scripts/nexus-feedback-agent.py [--dry-run]
"""
import json, os, sys, argparse, re, datetime, subprocess, textwrap, uuid

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEEDBACK_PATH = os.path.join(REPO, 'data', 'feedback-queue.jsonl')
TASKS_DIR = os.path.join(REPO, 'tasks')
WHITEBOARD_PATH = os.path.join(REPO, 'WHITEBOARD.md')


def load_feedback():
    items = []
    if not os.path.exists(FEEDBACK_PATH):
        return items
    with open(FEEDBACK_PATH, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    items.append(json.loads(line))
                except Exception:
                    pass
    return items


def save_feedback(items):
    os.makedirs(os.path.dirname(FEEDBACK_PATH), exist_ok=True)
    with open(FEEDBACK_PATH, 'w') as f:
        for it in items:
            f.write(json.dumps(it, default=str) + '\n')


def next_task_id():
    existing = [f for f in os.listdir(TASKS_DIR) if f.startswith('T-') and f.endswith('.md')]
    nums = []
    for f in existing:
        m = re.match(r'T-(\d+)\.md', f)
        if m:
            nums.append(int(m.group(1)))
    n = max(nums) + 1 if nums else 70
    return f'T-{n:03d}'


def classify(entry):
    desc = entry.get('description', '')
    title = entry.get('title', '')
    t = entry.get('type', 'other')
    priority = entry.get('priority', 'nice')

    # Bug → always auto-generate
    if t == 'bug':
        return 'auto', 'bug'
    # Theme → auto if mentions colors/vibe
    if t == 'theme' and any(k in desc.lower() for k in ['color', 'palette', 'dark', 'light', 'vibe', 'mood', 'style']):
        return 'auto', 'theme'
    # Feature/improvement with enough detail and priority
    if len(desc) >= 40 and priority in ('must', 'should'):
        return 'auto', t
    return 'review', t


def generate_task_md(tid, entry, category):
    title = entry.get('title', 'Untitled')
    desc = entry.get('description', '')
    priority = entry.get('priority', 'normal')
    answers = entry.get('answers', [])
    now = datetime.datetime.now().isoformat()

    body = textwrap.dedent(f"""\
        # {tid} — {title}

        ## Status
        `PENDING`

        ## Goal
        {desc.strip()}

        ## Type
        {category}

        ## Source Feedback
        - **Priority:** {priority}
        - **Submitted:** {now}
        - **Feedback ID:** {entry.get('id')}

        ## Acceptance Criteria
        - [ ] TBD

        ## Notes
        Auto-generated from feedback queue.
        """)
    if answers:
        body += '\n## Clarifying Answers\n'
        for a in answers:
            body += f"- **Q:** {a.get('question','')}\n  - **A:** {a.get('answer','')}\n"
    return body


def add_to_whiteboard(tid, title, status='PENDING'):
    if not os.path.exists(WHITEBOARD_PATH):
        return
    with open(WHITEBOARD_PATH, 'r') as f:
        content = f.read()
    # Find the ## 🎯 Active Tasks section and inject before it ends
    lines = content.splitlines()
    insert_idx = None
    for i, line in enumerate(lines):
        if line.strip().startswith('## '):
            if insert_idx is None and ('🎯 Active Tasks' in line or 'Active Tasks' in line):
                insert_idx = i + 1
            elif insert_idx is not None:
                break
    if insert_idx is None:
        # fallback: just append before last section
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip().startswith('##'):
                insert_idx = i
                break
    row = f"| MEDIUM | `{tid}` | {title} | `{status}` | Auto-generated from feedback |"
    lines.insert(insert_idx if insert_idx else len(lines) - 2, row)
    with open(WHITEBOARD_PATH, 'w') as f:
        f.write('\n'.join(lines))


def notify_telegram(text):
    import urllib.request, urllib.parse, os, re
    token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    chat = os.environ.get('TELEGRAM_HOME_CHANNEL', '')
    if not token:
        env = os.path.expanduser('~/.hermes/.env')
        try:
            with open(env) as f:
                for line in f:
                    m = re.match(r'^TELEGRAM_BOT_TOKEN=(.+)$', line.strip())
                    if m:
                        token = m.group(1).strip()
                    m = re.match(r'^TELEGRAM_HOME_CHANNEL=(.+)$', line.strip())
                    if m:
                        chat = m.group(1).strip()
        except Exception:
            pass
    if not token or not chat:
        print('[feedback-agent] No Telegram config, skipping notify')
        return
    url = f'https://api.telegram.org/bot{token}/sendMessage'
    data = urllib.parse.urlencode({'chat_id': chat, 'text': text, 'parse_mode': 'HTML'}).encode()
    req = urllib.request.Request(url, data=data, method='POST',
                                headers={'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            print('[feedback-agent] Telegram notify OK')
    except Exception as e:
        print('[feedback-agent] Telegram notify failed:', e)


def git_commit_and_push(msg):
    try:
        subprocess.check_call(['git', 'add', '.'], cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.check_call(['git', 'commit', '-m', msg], cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.check_call(['git', 'push'], cwd=REPO, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print('[feedback-agent] Git commit+push OK')
    except subprocess.CalledProcessError as e:
        print('[feedback-agent] Git error:', e)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--dry-run', action='store_true', help='Do not write files or commit')
    args = p.parse_args()

    items = load_feedback()
    changed = False
    for it in items:
        if it.get('status') != 'pending':
            continue
        action, category = classify(it)
        if action == 'review':
            it['status'] = 'review'
            it['note'] = 'Needs human review — too vague or low priority.'
            print(f"[feedback-agent] {it.get('id')} → review")
            changed = True
            continue

        # Auto-generate task
        tid = next_task_id()
        md = generate_task_md(tid, it, category)
        task_path = os.path.join(TASKS_DIR, f'{tid}.md')
        if not args.dry_run:
            with open(task_path, 'w') as f:
                f.write(md)
            add_to_whiteboard(tid, it.get('title', 'Untitled'))
        print(f"[feedback-agent] Generated {tid}: {it.get('title')}")
        it['status'] = 'tasked'
        it['linkedTask'] = tid
        changed = True
        notify_telegram(f"📋 Auto-generated task <b>{tid}</b> from feedback: <b>{escape_html(it.get('title',''))}</b>")

    if changed:
        if not args.dry_run:
            save_feedback(items)
            git_commit_and_push(f'feedback-agent: auto-process {datetime.datetime.now().isoformat()}')
        else:
            print('[feedback-agent] Dry-run: would save feedback and commit')
    else:
        print('[feedback-agent] No pending feedback to process')


def escape_html(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


if __name__ == '__main__':
    main()

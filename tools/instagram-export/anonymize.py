"""
Anonymises an Instagram "Download your information" messages export for analysis.

Usage:
    python tools/instagram-export/anonymize.py <export_folder> <output_folder>

Writes, outside the repository:
    <output_folder>/threads.jsonl   one anonymised conversation per line
    <output_folder>/summary.json    counts only (no message content)

What is removed or masked:
    - customer display names -> "customer"; the business account -> "team"
    - customer name words appearing inside messages -> [NAME]
    - phone numbers -> [PHONE], emails -> [EMAIL], links -> [LINK], @handles -> [HANDLE]
    - passport/ID-like codes and digit runs of 8+ -> [ID]
    - Instagram system lines ("<username> sent an attachment.") -> [sent an attachment]
    - photos, videos, voice notes and files are not copied; only their type is kept
Free-text mentions of other people (third-party names, addresses) cannot all be detected;
treat the output as reduced-risk, not anonymous, and keep it off shared drives.
Short numbers (prices, years, durations) are kept so pricing questions can be studied.
Media files in the export are never opened.
"""
import json
import os
import re
import sys
from collections import Counter

PHONE = re.compile(r'(?<![\w])(?:\+|00)?\d[\d\s().-]{6,}\d(?![\w])')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
LINK = re.compile(r'(?:https?://|www\.)\S+', re.I)
HANDLE = re.compile(r'(?<![\w])@[\w.]{2,}')
ID_CODE = re.compile(r'\b[A-Z]{1,2}\d{6,9}\b')
LONG_DIGITS = re.compile(r'\b\d{8,}\b')


def fix_text(value):
    """Instagram exports UTF-8 text as Latin-1 escaped bytes; undo that."""
    if not isinstance(value, str):
        return ''
    try:
        return value.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value


# Instagram writes system lines such as "<username> sent an attachment." into the text.
SYSTEM_LINE = re.compile(r'^\S+ (sent an attachment|shared a story|replied to your story|mentioned you in their story)\.?$', re.I)


def scrub(text, name_words):
    text = SYSTEM_LINE.sub(lambda m: f'[{m.group(1).lower()}]', text.strip())
    text = LINK.sub('[LINK]', text)
    text = EMAIL.sub('[EMAIL]', text)
    text = HANDLE.sub('[HANDLE]', text)
    text = ID_CODE.sub('[ID]', text)
    text = PHONE.sub(lambda m: '[PHONE]' if sum(c.isdigit() for c in m.group()) >= 8 else m.group(), text)
    text = LONG_DIGITS.sub('[ID]', text)
    for word in name_words:
        text = re.sub(rf'(?<!\w){re.escape(word)}(?!\w)', '[NAME]', text, flags=re.I)
    return text


def media_type(msg):
    for key, label in (('audio_files', 'voice_note'), ('photos', 'photo'), ('videos', 'video'),
                       ('gifs', 'gif'), ('sticker', 'sticker'), ('files', 'file'), ('share', 'shared_post')):
        if msg.get(key):
            return label
    return None


def load_threads(export_root):
    base = os.path.join(export_root, 'your_instagram_activity', 'messages')
    for box in ('inbox', 'message_requests'):
        folder = os.path.join(base, box)
        if not os.path.isdir(folder):
            continue
        for thread_dir in sorted(os.listdir(folder)):
            path = os.path.join(folder, thread_dir)
            parts = sorted(f for f in os.listdir(path) if f.startswith('message_') and f.endswith('.json'))
            if not parts:
                continue
            participants, messages = [], []
            for part in parts:
                with open(os.path.join(path, part), encoding='utf-8') as fh:
                    data = json.load(fh)
                participants = participants or [fix_text(p.get('name')) for p in data.get('participants', [])]
                messages.extend(data.get('messages', []))
            yield box, participants, messages


def main(export_root, out_dir):
    threads = list(load_threads(export_root))
    # The business account is the participant present in (nearly) every thread.
    presence = Counter(name for _, participants, _ in threads for name in set(participants))
    business = presence.most_common(1)[0][0] if presence else ''

    os.makedirs(out_dir, exist_ok=True)
    stats = Counter()
    scripts = Counter()
    first_ts, last_ts = None, None
    with open(os.path.join(out_dir, 'threads.jsonl'), 'w', encoding='utf-8') as out:
        for index, (box, participants, messages) in enumerate(threads, start=1):
            customers = [p for p in participants if p != business]
            name_words = {w for name in customers for w in re.split(r'[\s._-]+', name) if len(w) >= 3}
            rows = []
            for msg in sorted(messages, key=lambda m: m.get('timestamp_ms', 0)):
                sender = 'team' if fix_text(msg.get('sender_name')) == business else 'customer'
                text = scrub(fix_text(msg.get('content')), name_words).strip()
                kind = media_type(msg)
                if not text and not kind:
                    continue
                ts = int(msg.get('timestamp_ms', 0))
                first_ts = ts if first_ts is None else min(first_ts, ts)
                last_ts = ts if last_ts is None else max(last_ts, ts)
                rows.append({'from': sender, 't': ts, 'text': text, **({'media': kind} if kind else {})})
                stats[f'{sender}_messages'] += 1
                if kind:
                    stats[f'media_{kind}'] += 1
                if sender == 'customer' and text:
                    if re.search(r'[ഀ-ൿ]', text):
                        scripts['malayalam_script'] += 1
                    elif re.search(r'[؀-ۿ]', text):
                        scripts['arabic_script'] += 1
                    elif re.search(r'[ऀ-ॿ]', text):
                        scripts['devanagari_script'] += 1
                    else:
                        scripts['latin_script'] += 1
            if not rows:
                continue
            stats['threads'] += 1
            stats[f'threads_{box}'] += 1
            if any(r['from'] == 'team' for r in rows):
                stats['threads_with_team_reply'] += 1
            out.write(json.dumps({'id': f'T{index:04d}', 'box': box, 'messages': rows}, ensure_ascii=False) + '\n')

    summary = {
        **stats,
        'customer_text_by_script': dict(scripts),
        'first_message_utc_ms': first_ts,
        'last_message_utc_ms': last_ts,
    }
    with open(os.path.join(out_dir, 'summary.json'), 'w', encoding='utf-8') as fh:
        json.dump(summary, fh, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

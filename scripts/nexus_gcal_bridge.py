#!/usr/bin/env python3
"""Nexus Google Calendar Bridge — Service Account Integration
Authenticates via service account JSON key and provides read/write access
to a user-shared Google Calendar.

Usage:
    from nexus_gcal_bridge import GCalBridge
    bridge = GCalBridge()
    events = bridge.list_events(time_min='2026-05-01T00:00:00Z')
    bridge.create_event({...})
"""
import os, json, datetime
from pathlib import Path

SCOPES = ['https://www.googleapis.com/auth/calendar']
DEFAULT_KEY_PATH = os.path.expanduser('~/.hermes/service-accounts/nexus-gcal-key.json')

class GCalBridge:
    """Google Calendar bridge using service account credentials."""

    def __init__(self, key_path=None, calendar_id=None):
        self.key_path = key_path or os.environ.get('GOOGLE_SERVICE_ACCOUNT_PATH', DEFAULT_KEY_PATH)
        self.calendar_id = calendar_id or os.environ.get('GOOGLE_CALENDAR_ID', 'primary')
        self._service = None
        self._key_error = None

    def _get_service(self):
        if self._service is not None:
            return self._service
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build
        except ImportError as e:
            raise RuntimeError(f"Google API libraries not installed: {e}")

        if not os.path.isfile(self.key_path):
            raise RuntimeError(f"Service account key not found: {self.key_path}")

        try:
            creds = service_account.Credentials.from_service_account_file(
                self.key_path, scopes=SCOPES
            )
            self._service = build('calendar', 'v3', credentials=creds, cache_discovery=False)
        except Exception as e:
            self._key_error = str(e)
            raise RuntimeError(f"Failed to authenticate with Google Calendar: {e}")
        return self._service

    # ── Health / Config ─────────────────────────

    def is_ready(self):
        """Return True if the service account is initialized successfully."""
        try:
            self._get_service()
            return True
        except Exception:
            return False

    def get_config(self):
        """Return non-sensitive config for status endpoint."""
        return {
            'calendar_id': self.calendar_id,
            'key_exists': os.path.isfile(self.key_path),
            'key_path': self.key_path,
            'ready': self.is_ready(),
            'error': self._key_error,
        }

    # ── Event CRUD ──────────────────────────────

    def list_events(self, calendar_id=None, time_min=None, time_max=None,
                    max_results=250, single_events=True, order_by='startTime', q=None):
        """List events from the calendar."""
        svc = self._get_service()
        cid = calendar_id or self.calendar_id
        params = {
            'calendarId': cid,
            'maxResults': max_results,
            'singleEvents': single_events,
            'orderBy': order_by,
        }
        if time_min:
            params['timeMin'] = time_min
        if time_max:
            params['timeMax'] = time_max
        if q:
            params['q'] = q
        events_result = svc.events().list(**params).execute()
        return events_result.get('items', [])

    def get_event(self, event_id, calendar_id=None):
        """Fetch a single event by ID."""
        svc = self._get_service()
        cid = calendar_id or self.calendar_id
        return svc.events().get(calendarId=cid, eventId=event_id).execute()

    def create_event(self, body, calendar_id=None):
        """Create a new event. Returns the created event dict."""
        svc = self._get_service()
        cid = calendar_id or self.calendar_id
        return svc.events().insert(calendarId=cid, body=body).execute()

    def update_event(self, event_id, body, calendar_id=None):
        """Fully replace an event. Returns updated event dict."""
        svc = self._get_service()
        cid = calendar_id or self.calendar_id
        return svc.events().update(calendarId=cid, eventId=event_id, body=body).execute()

    def patch_event(self, event_id, body, calendar_id=None):
        """Partially update an event. Returns updated event dict."""
        svc = self._get_service()
        cid = calendar_id or self.calendar_id
        return svc.events().patch(calendarId=cid, eventId=event_id, body=body).execute()

    def delete_event(self, event_id, calendar_id=None):
        """Delete an event."""
        svc = self._get_service()
        cid = calendar_id or self.calendar_id
        svc.events().delete(calendarId=cid, eventId=event_id).execute()
        return True

    # ── Calendar List (for discovery) ─────────────

    def list_calendars(self):
        """Return all calendars accessible to the service account."""
        svc = self._get_service()
        calendars = []
        page_token = None
        while True:
            resp = svc.calendarList().list(pageToken=page_token).execute()
            calendars.extend(resp.get('items', []))
            page_token = resp.get('nextPageToken')
            if not page_token:
                break
        return calendars

    # ── Helpers: format nexus event → Google event ─

    @staticmethod
    def nexus_to_gcal(nexus_event):
        """Convert a Nexus localStorage event dict into a Google Calendar API event body."""
        # nexus_event: { id, title, description, date, start, end, all_day, color, recurring, category }
        body = {
            'summary': nexus_event.get('title', 'New Event'),
            'description': nexus_event.get('description', ''),
        }
        date_str = nexus_event.get('date', datetime.datetime.now().strftime('%Y-%m-%d'))
        start_time = nexus_event.get('start', '')
        end_time = nexus_event.get('end', '')
        all_day = nexus_event.get('all_day', False)

        if all_day or (not start_time and not end_time):
            body['start'] = {'date': date_str}
            body['end'] = {'date': date_str}
        else:
            start_dt = f"{date_str}T{start_time}:00" if start_time and len(start_time) >= 5 else f"{date_str}T00:00:00"
            end_dt = f"{date_str}T{end_time}:00" if end_time and len(end_time) >= 5 else f"{date_str}T23:59:59"
            # If end is same or before start, offset end by 1 hour
            s = datetime.datetime.fromisoformat(start_dt)
            e = datetime.datetime.fromisoformat(end_dt)
            if e <= s:
                e = s + datetime.timedelta(hours=1)
                end_dt = e.isoformat()
            body['start'] = {'dateTime': start_dt, 'timeZone': 'America/Los_Angeles'}
            body['end'] = {'dateTime': end_dt, 'timeZone': 'America/Los_Angeles'}

        # Color
        color_id = None
        color_map = {
            '#3b82f6': '7',  # blue
            '#10b981': '2',  # green
            '#ec4899': '4',  # pink
            '#f59e0b': '5',  # yellow
            '#ef4444': '11', # red
            '#8b5cf6': '3',  # purple
            '#06b6d4': '6',  # cyan
            '#64748b': '8',  # gray
        }
        nexus_color = nexus_event.get('color', '#3b82f6')
        color_id = color_map.get(nexus_color)
        if color_id:
            body['colorId'] = color_id

        # Recurrence
        rec = nexus_event.get('recurring')
        if rec and isinstance(rec, dict):
            if rec.get('enabled') or rec.get('frequency'):
                freq = rec.get('frequency', 'none')
                if freq == 'daily':
                    body['recurrence'] = ['RRULE:FREQ=DAILY']
                elif freq == 'weekly':
                    weekdays = ','.join(rec.get('days', ['MO']))
                    body['recurrence'] = [f'RRULE:FREQ=WEEKLY;BYDAY={weekdays}']
                elif freq == 'monthly':
                    body['recurrence'] = ['RRULE:FREQ=MONTHLY']
                elif freq == 'yearly':
                    body['recurrence'] = ['RRULE:FREQ=YEARLY']
        elif nexus_event.get('recurrence') and nexus_event.get('recurrence') != 'none':
            r = nexus_event.get('recurrence')
            if r == 'daily':
                body['recurrence'] = ['RRULE:FREQ=DAILY']
            elif r == 'weekly':
                body['recurrence'] = ['RRULE:FREQ=WEEKLY']
            elif r == 'monthly':
                body['recurrence'] = ['RRULE:FREQ=MONTHLY']
            elif r == 'yearly':
                body['recurrence'] = ['RRULE:FREQ=YEARLY']

        # Google event ID if present
        gcal_id = nexus_event.get('gcalId') or nexus_event.get('google_id')
        if gcal_id:
            body['id'] = gcal_id
        return body

    @staticmethod
    def gcal_to_nexus(gcal_event):
        """Convert a Google Calendar API event dict into a Nexus localStorage event dict."""
        start = gcal_event.get('start', {})
        end = gcal_event.get('end', {})
        is_all_day = bool(start.get('date'))
        date_str = start.get('date') or (start.get('dateTime', '')[:10] if start.get('dateTime') else '')
        start_time = ''
        end_time = ''
        if start.get('dateTime'):
            start_time = start['dateTime'][11:16]
        if end.get('dateTime'):
            end_time = end['dateTime'][11:16]

        # Reverse color map
        color_id = gcal_event.get('colorId', '7')
        reverse_color = {
            '1': '#7986cb', '2': '#10b981', '3': '#8e24aa', '4': '#ec4899',
            '5': '#f59e0b', '6': '#039be5', '7': '#3b82f6', '8': '#616161',
            '9': '#3f51b5', '10': '#0b8043', '11': '#ef4444', '12': '#8b5cf6',
        }
        color = reverse_color.get(str(color_id), '#3b82f6')

        # Recurrence
        recurrence = 'none'
        rrules = gcal_event.get('recurrence', [])
        if rrules:
            for rr in rrules:
                if 'FREQ=DAILY' in rr:
                    recurrence = 'daily'
                elif 'FREQ=WEEKLY' in rr:
                    recurrence = 'weekly'
                elif 'FREQ=MONTHLY' in rr:
                    recurrence = 'monthly'
                elif 'FREQ=YEARLY' in rr:
                    recurrence = 'yearly'

        return {
            'id': 'evt_' + str(int(datetime.datetime.now().timestamp() * 1000)) + '_gcal_' + gcal_event.get('id', '')[:8],
            'gcalId': gcal_event.get('id'),
            'title': gcal_event.get('summary', '(No title)'),
            'description': gcal_event.get('description', ''),
            'date': date_str,
            'start': start_time,
            'end': end_time,
            'all_day': is_all_day,
            'color': color,
            'category': 'personal',
            'recurrence': recurrence,
            'source': 'google',
            'created_at': gcal_event.get('created', datetime.datetime.now().isoformat()),
            'updated_at': gcal_event.get('updated', datetime.datetime.now().isoformat()),
        }


# ┌─ CLI smoke test ─────────────────────────────
if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--calendar-id', default=None)
    p.add_argument('--key-path', default=None)
    p.add_argument('cmd', choices=['status', 'list', 'calendars', 'create-test'])
    args = p.parse_args()

    b = GCalBridge(key_path=args.key_path, calendar_id=args.calendar_id)
    if args.cmd == 'status':
        print(json.dumps(b.get_config(), indent=2))
    elif args.cmd == 'list':
        now = datetime.datetime.utcnow()
        events = b.list_events(
            time_min=(now - datetime.timedelta(days=7)).isoformat() + 'Z',
            time_max=(now + datetime.timedelta(days=30)).isoformat() + 'Z',
        )
        print(json.dumps(events, indent=2, default=str))
    elif args.cmd == 'calendars':
        cals = b.list_calendars()
        for c in cals:
            print(f"{c.get('id')} | {c.get('summary')} | access={c.get('accessRole')}")
    elif args.cmd == 'create-test':
        ev = b.create_event({
            'summary': 'Nexus Test Event',
            'description': 'Created by Nexus GCal Bridge',
            'start': {'dateTime': (datetime.datetime.utcnow() + datetime.timedelta(hours=1)).isoformat() + 'Z'},
            'end': {'dateTime': (datetime.datetime.utcnow() + datetime.timedelta(hours=2)).isoformat() + 'Z'},
        })
        print('Created:', ev.get('htmlLink'))

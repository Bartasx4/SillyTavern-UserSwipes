# User Swipes

Adds swipe support to user messages in SillyTavern.

## Features

- Creates `swipes`, `swipe_id`, and `swipe_info` for user messages.
- Shows the built-in swipe arrows and counter on rendered user messages.
- Right arrow on the last user swipe creates a new swipe by cloning the current user message.
- New user swipes start with a clean `swipe_info.extra` payload containing only `token_count`.
- Switching between user swipes preserves the currently visible `mes` and `extra` before loading the selected swipe.

## Installation

Copy the `SillyTavern-UserSwipes` folder into:

```text
SillyTavern/data/default-user/extensions/
```

Then reload SillyTavern and enable the extension from the extensions menu if needed.

## Notes

- The extension is intentionally conservative when creating a new user swipe: it keeps only `token_count` in the new swipe's `extra` payload.
- Existing user messages are backfilled with swipe fields when a chat is loaded.

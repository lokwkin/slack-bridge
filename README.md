# Slack Bridge

## Setup
### Slack Setup
1. Register an Slack App in portal
2. "Socket Mode" -> Enable Socket Mode
3. "OAuth & Permissions" -> "Bot Token Scopes" -> Grant these permissions: `app_mentions:read`, `channels:history`, `chat:write`, `im:history`, `im:write`, `reactions:write`, `groups:history`, `files:write`
4. "Event Subscription" -> "Enable Event" -> "Subscribe to bot events" -> Add `message.im` and `app_mention` --> "save"
5. "App Home" -> "Message Tab" -> Check "Allow users to send Slash commands and messages from the messages tab"
6. Install bot to your workspace
7. Obtain your Bot Token from "OAuth & Permissions" > "Bot User OAuth Token"
8. Obtain your App Token from "Basic Information" > "App Level Token"
9. "Install App" -> Reinstall to workspace if neccessary

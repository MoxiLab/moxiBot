# What is the starboard command?

The `starboard` command lets you highlight the best messages from your server in a special channel. When a message receives enough reactions (for example, ⭐), the bot automatically posts it in the starboard channel for everyone to see.

## How to use it?

1. **Set up the starboard channel:**
   - Use the command `/starboard set <channel>` to choose where highlighted messages will appear.

2. **Set the required number of reactions:**
   - You can define how many reactions (e.g., stars) a message needs to be featured. Example: `/starboard threshold 3` will only feature messages with 3 or more stars.

3. **Disable or adjust the system:**
   - To disable the starboard, use `/starboard disable`.
   - You can change the channel or threshold at any time using the same commands.

## Example usage

- `/starboard set #highlights` → Sets #highlights as the starboard channel.
- `/starboard threshold 5` → Only messages with 5 or more stars will be featured.
- `/starboard disable` → Disables the starboard system.

## Notes
- Only administrators can configure the starboard.
- The bot needs permission to view and send messages in the starboard channel.
- Deleted or edited messages may no longer appear in the starboard.

This way, you can motivate your community to share quality content and recognize the best contributions!

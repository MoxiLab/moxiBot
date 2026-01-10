# 什么是 starboard 命令？

`starboard` 命令可以让你在专属频道中突出显示服务器中最棒的消息。当一条消息获得足够的反应（例如 ⭐）时，机器人会自动将其发布到 starboard 频道，供所有人查看。

## 如何使用？

1. **设置 starboard 频道：**
   - 使用 `/starboard set <频道>` 命令选择高亮消息显示的频道。

2. **设置所需反应数：**
   - 你可以设置一条消息需要多少个反应（如星星）才会被高亮。例如：`/starboard threshold 3` 只会高亮获得 3 个或更多星星的消息。

3. **禁用或调整系统：**
   - 要禁用 starboard，请使用 `/starboard disable`。
   - 你可以随时用相同命令更改频道或阈值。

## 使用示例

- `/starboard set #精华` → 将 #精华 设为 starboard 频道。
- `/starboard threshold 5` → 只有获得 5 个或更多星星的消息才会被高亮。
- `/starboard disable` → 禁用 starboard 系统。

## 注意事项
- 只有管理员可以配置 starboard。
- 机器人需要在 starboard 频道拥有查看和发送消息的权限。
- 被删除或编辑的消息可能不再显示在 starboard 中。

这样可以激励你的社区分享优质内容并认可最佳贡献！

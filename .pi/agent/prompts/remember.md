---
description: 记录当前对话中的教训或偏好到长期记忆
argument-hint: "[preference|lesson|convention|project-note] 内容"
---
请将以下内容记录到我的长期记忆中：

分类：$1
内容：${@:2}

调用 add_user_lesson 工具，category="$1"，content="${@:2}"。
记录完成后简要确认。
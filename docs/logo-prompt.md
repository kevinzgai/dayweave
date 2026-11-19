# 织日 DayWeave · Logo 生成提示词包

> 面向「现代极简 / 几何字母标 + 低饱和自然色」的完整提示词，可直接用于 Midjourney、GPT/DALL·E、即梦/豆包/可灵等。
> 使用顺序：先读 §0 品牌档案 → 复制 §1 或 §2 主提示词 → 按 §3 平台微调 → 用 §4 换概念方向 → 用 §5 反向排除 → 按 §7 验收。

---

## §0 品牌档案（模型的上下文，每次都要给）

| 字段 | 内容 |
| --- | --- |
| 中文名 | 织日 |
| 英文名 | DayWeave |
| 一句话 | 把时间和念头，织成每一天 |
| 品类 | 本地优先的时间管理桌面应用（Tauri 桌面端，离线、无登录） |
| 品牌隐喻 | **时间块是经线，突发的念头是纬线**——一天的日子是织出来的 |
| 核心气质 | 克制、安静、有手感的秩序感；不喧闹、不效率焦虑、不赛博 |
| 当前界面色 | 墨蓝 `#2E3A57`、琥珀 `#F5CB65` / `#F2C14E`、纸白 `#F4F6FA`、墨字 `#1C2433` |
| 低饱和备选色 | 陶土 `#B98C6E`、苔绿 `#8A9A82`、雾灰蓝 `#7A879B`、燕麦 `#E6DFD3` |

**语义锚点（给模型的关键词）**：经纬交织 / over-under weave；时间块 time block；日 day；方格的秩序；一条线穿过另一条线；留白。

---

## §1 主提示词（通用版 · 中文，直接复制）

```
为时间管理桌面应用「织日 DayWeave」设计一个 logo 图形标。

设计方向：现代极简几何字母标。图形由字母 D 与 W 的几何骨架变形而来，
同时读作「经纬交织」的编织结构：两条线相互 over-under 穿插，
形成克制的编织纹样，整体收在一个接近正方形的圆角外框内。

造型要求：只用直线与 90°/45° 折线，等粗描边（约 2px @512px），
圆角极小或无圆角，末端平头；负空间干净，交织的上下关系必须清楚可读，
不能糊成网格。构图居中，四周留白 ≥ 图形边长的 1/5。

色彩：单色为主。主色墨蓝 #2E3A57 置于纸白 #F4F6FA 上；
备选低饱和自然色陶土 #B98C6E、苔绿 #8A9A82、雾灰蓝 #7A879B。
最多一个点缀色（琥珀 #F5CB65），占面积极小。

呈现：纯白或极浅灰背景，单一居中符号，矢量风格、扁平、无渐变，
像专业品牌手册里的标志页；不要 mockup、不要 3D、不要投影、不要文字排版。

风格参考气质：极简主义几何标志、瑞士平面设计、Dieter Rams 式的克制，
接近但不模仿 Notion / Linear / Arc 一类现代软件标志的克制感。
输出要求：正方形构图，符号必须能被缩小到 16×16 依然可辨识。
```

---

## §2 English master prompt

```
A logo symbol for "DayWeave", a calm local-first time-management desktop app.
Concept: the day is woven — time blocks are the warp, sudden thoughts are the weft.

Mark: a modern minimal geometric monogram built from the skeletons of the letters D and W,
reinterpreted as a weaving structure — two strokes crossing in a clear over-under weave,
contained inside a softly squared frame.
Geometry only: straight lines and 90°/45° angles, uniform stroke weight (~2px at 512px),
tiny or zero corner radius, flat stroke caps. Clean negative space; the over-under
interlacing must read at a glance and must not collapse into a grid.

Color: essentially monochrome. Ink navy #2E3A57 on paper white #F4F6FA.
Optional low-saturation natural accents: clay #B98C6E, moss #8A9A82, mist blue #7A879B.
At most one small amber accent #F5CB65.

Presentation: flat vector, no gradients, single centered mark on a plain off-white
background, generous margin (>= 1/5 of mark size), like a page from a brand guidelines manual.
No mockup, no 3D, no drop shadow, no text, no lettering, no tagline.

Mood: Swiss minimalism, Dieter Rams restraint, precise and quiet.
Square 1:1 composition. The mark must stay legible at 16×16 px.
```

**通用负向**：`photorealistic, 3D render, glossy, gradient, drop shadow, bevel, mockup, business card, stationery, watermark, text, letters, typography, tagline, busy grid, thin hairlines, clipart, generic tech hexagon, brain/lightbulb/clock clip-art, oversaturated neon, multiple logo variants in one image`

---

## §3 平台适配

### Midjourney
在上面英文提示词后追加：

```
--ar 1:1 --style raw --stylize 60 --v 6
```
- `--stylize` 从 50–100 起试，太高会加装饰细节，破坏极简。
- 想批量出方向：末尾加 `--s 50` 并用同一提示词跑 4 组。
- 参数名与版本号按你实际使用的版本调整；换版本后重新跑一遍取样。

### GPT / DALL·E（对话式）
不要一次贴长串参数，改成自然语言三句话 + 一次只改一件事：

```
1) 请为一个时间管理 App 画一个扁平矢量 logo：字母 D 和 W 的几何骨架，
   演变成两条线上下穿插的编织结构，装在一个近正方形的圆角框里。
2) 单色墨蓝 #2E3A57，纸白背景，等粗线条，极简、无渐变无阴影、无文字。
3) 居中，留白充足，像品牌手册的一页。
```
后续迭代用：「保持图形完全不变，只把主色换成陶土 #B98C6E」「保持不变，把线宽减到 1.5px」——一次只改一个变量。

### 即梦 / 豆包 / 可灵（中文短句 + 关键词）
```
极简几何 logo，字母 D 与 W 变形的经纬编织符号，线条上下穿插，
近正方形圆角外框，等粗描边，单色墨蓝，纸白背景，矢量扁平，
无渐变无阴影无文字，居中等大量留白，品牌标志页风格，正方形构图
```
国内模型对英文长句和 `#hex` 支持不稳定，**颜色优先用中文词**（墨蓝 / 陶土 / 苔绿 / 雾灰蓝），hex 作为补充。

---

## §4 三个概念方向（换着跑，别只跑一个）

**A · 经纬字母标（推荐主推）**
字母 D 的竖直主干作为「经线」，两道横向笔画作为「纬线」上下穿过主干；右侧弧线收成 W 的骨架。交织处明确 over-under。
关键词：`two strokes weaving over and under, D and W monogram, squared frame`

**B · 时间块标**
3 枚错位排列的圆角方块，整体读作汉字「日」的骨架；其中一枚实心琥珀表示「正在进行的时间块」，其余为描边。最直白、最好缩小。
关键词：`three offset rounded blocks forming a day glyph, one block solid amber`

**C · 日 / 织 双关标**
一个「日」字外框，内部一横一竖两条线交叉并穿过外框边界，形成织布经线与「日」的双关。
关键词：`Chinese character 日 frame, one vertical and one horizontal thread crossing the frame`

> ⚠️ 图像模型画不准拉丁字母和汉字细节。**让它只出图形符号**，字母/中文字标后期在 Figma 里用真实字体排版（推荐 Inter / Söhne / MiSans，字重 500，字距 -2%）。

---

## §5 反向排除（把「像 AI 生成」的通用感剔掉）

每次都带上这几条：
- 不要：灯泡、大脑、时钟、齿轮、无穷符号、六边形科技框、抽象人形、上升箭头
- 不要：渐变、玻璃拟态、发光霓虹、金属质感、3D 倒角
- 不要：一张图里塞多个方案（会让模型把方案拼在一起）
- 不要：随机点缀的圆点和短线装饰
- 不要：过度对称到失去方向感——编织结构应有一处明确的「穿插」不对称

---

## §6 迭代指令模板

| 目标 | 指令 |
| --- | --- |
| 换色 | 「保持图形几何完全不变，只把主色替换为 {色名 + hex}，背景保持纸白」 |
| 降复杂度 | 「去掉所有装饰性圆点与辅助短线，只保留构成字母骨架的笔画」 |
| 提高缩小可读性 | 「把线宽增加 30%，把最小负空间放大到不小于线宽的 2 倍」 |
| 换交织关系 | 「把横向笔画改为从竖直主干后方穿过（under），保持末端平头」 |
| 出应用图标版 | 「同一图形放入 iOS 圆角方形图标底，底色墨蓝，图形反白，占比 62%」 |
| 出单色版 | 「输出纯黑单色版，无灰阶，用于印章/单色印刷」 |

---

## §7 验收清单（收图后逐条打勾）

- [ ] 缩小到 **16×16** 仍能看出「线在穿插」，不是一团灰
- [ ] 反白（墨蓝底 + 白图形）后不糊、不破形
- [ ] 纯黑单色印刷不依赖颜色也能读懂结构
- [ ] 与主界面同屏时（墨蓝侧栏 + 琥珀高亮）不抢戏、不撞色
- [ ] 剪影可辨识：把图形填成实心黑，轮廓仍有独特性
- [ ] 能在 24px 内独立成立（侧栏顶栏用），不依赖文字
- [ ] 与常见时间类 App 图标并排时不疑似撞标

**交付物**：`logo.svg`（图形标）、`logo-app-icon.svg`（圆角底版）、`logo-mono.svg`（单色）、`logo-lockup.svg`（图形 + 织日 DayWeave 字标）。生成图只作参考，最终请**在矢量软件里重绘**——位图描摹会在小尺寸下崩掉。

---

## §8 排版规则（字标与组合）

- 中文字标：**织日**，思源黑体 / MiSans，字重 500，字距 +4%
- 英文字标：**DayWeave**，Inter / Söhne，字重 500，全大写时字距 +8%，首字母大写时字距 -1%
- 图形标与字标横向组合时，间距 = 字标中文单字宽度的 0.4 倍
- 竖版组合（图形在上、文字在下）用于启动页与 App 图标描述位
- 最小使用尺寸：图形 16px，横版组合 64px 宽
- 安全边距：四周 ≥ 图形高度的 1/2

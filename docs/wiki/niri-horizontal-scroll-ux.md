# Niri 横向滚动布局：设计调研与实现方案

## 1. Niri 的核心交互模型

Niri 是一个面向 Wayland 的滚动式平铺合成器（scrollable-tiling compositor），灵感来自 PaperWM。其核心布局模型：

### 1.1 水平无限条带

- 窗口沿水平方向排列成一条无限延伸的条带
- 新窗口永远追加到当前窗口右侧，不会导致已有窗口重排
- 通过左右滚动浏览窗口，形成连续的空间体验

### 1.2 垂直工作区栈

- 工作区自身沿垂直方向动态排列（类似 GNOME 的动态工作区）
- 每个显示器有独立的窗口条带和工作区集合
- 窗口永远不会"溢出"到相邻显示器

### 1.3 关键交互模式

| 模式           | 描述                                                    |
| -------------- | ------------------------------------------------------- |
| **概览**       | 缩放显示所有工作区和窗口，提供空间定位                  |
| **手势**       | 触控板/鼠标手势驱动水平滚动和垂直工作区切换             |
| **聚焦模式**   | DEFAULT（自由滚动）、CENTER（居中聚焦）、EDGE（边对齐） |
| **位置指示器** | 顶栏彩色段显示当前窗口在滚动视口中的位置                |

## 2. PreText：高性能文本测量库

PreText（`@chenglou/pretext`）是一个纯 JS/TS 的 DOM-free 文本测量库，虽然不是水平滚动组件，但在实现高性能 Niri 式布局时有重要价值：

### 2.1 核心能力

- **DOM-free 多行文本高度测量** — 绕过 `getBoundingClientRect` 等触发浏览器 reflow 的昂贵操作
- 纯算术方法计算文本在给定宽度下的高度和行数
- 支持逐行布局（`layoutWithLines`），适合变宽场景

```ts
import { prepare, layout } from "@chenglou/pretext";

const prepared = prepare("文本内容", "16px Inter");
const { height, lineCount } = layout(prepared, 320, 20); // 320px 宽度, 20px 行高
```

### 2.2 在 Niri 布局中的应用

| 场景           | 作用                                                               |
| -------------- | ------------------------------------------------------------------ |
| **虚拟化滚动** | 配合 `@tanstack/react-virtual`，预算卡片高度，只渲染可见项         |
| **布局锚定**   | 新增/删除项目时预计算高度差，保持滚动位置稳定（防止 layout shift） |
| **流式布局**   | `layoutNextLineRange()` 支持逐行变宽布局，适合列内不同宽度窗口     |

### 2.3 衍生生态

| 项目                  | 说明                                        |
| --------------------- | ------------------------------------------- |
| `expo-pretext`        | React Native 端口                           |
| `virtual-text-layout` | Pretext + @tanstack/react-virtual 虚拟滚动  |
| `vite-pretext`        | Vite 插件，消除文本相关 CLS                 |
| `textura`             | Yoga flexbox + Pretext 的 DOM-free 布局引擎 |

## 3. PaperWM 的启发模式

PaperWM 是 Niri 的灵感来源，是 GNOME Shell 扩展：

- 窗口在单个水平条带中排列
- 激活窗口时自动滚动到视口
- 按住 Super 键时显示 minimap 总览
- 支持三指触控板横扫滚动
- 窗口可在列内垂直堆叠（Super+I）/ 展开（Super+O）
- Scratch 层提供全局浮层窗口

## 4. 应用到 Foyer 首页的方案

### 4.1 当前布局问题

首页使用 2×2 的 CSS Grid + ScrollArea，每个分类面板（Goal/Work/Life/Explore）内部纵向滚动。窗口多了以后，每个面板都在独立滚动，信息密度低，视觉不连贯。

### 4.2 Niri 风格横向滚动方案

将分类面板改为水平排列的全高列，横向滚动浏览。类似 macOS 的 Mission Control 或 niri 的工作区概览。

**核心 CSS 技术：**

```css
/* 滚动容器 - 横向布局 */
.niri-scroll-container {
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity; /* 接近时吸附，非强制 */
  gap: 1rem;
  padding: 1rem;
  scroll-behavior: smooth;
  scrollbar-width: thin; /* 细滚动条 */
}

/* 每个分类列 - 占满视口高度，固定或弹性宽度 */
.niri-column {
  flex: 0 0 auto;
  min-width: 280px;
  max-width: 400px;
  height: 100%;
  scroll-snap-align: start;
  overflow-y: auto; /* 列内纵向滚动 */
}
```

**React 实现要点：**

```tsx
function NiriLayout({ groups }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 键盘导航：左右箭头切换分类
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      const scrollAmount = 320; // 约一列宽度
      if (e.key === 'ArrowRight' || e.key === 'l') {
        containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
      if (e.key === 'ArrowLeft' || e.key === 'h') {
        containerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={containerRef}
      className="niri-scroll-container flex h-full overflow-x-auto overflow-y-hidden"
      style={{ scrollSnapType: 'x proximity' }}
    >
      {groups.map(group => (
        <div key={group.id} className="niri-column flex-none">
          <CategoryPane ... />
        </div>
      ))}
    </div>
  );
}
```

### 4.3 交互增强

| 增强项         | 实现方式                                                                  |
| -------------- | ------------------------------------------------------------------------- |
| **位置指示器** | 顶部圆点导航（dot pagination），显示当前可见分类                          |
| **键盘导航**   | 左/右箭头 或 h/l 键横向滚动，类似 niri 的 Super+方向                      |
| **触控板手势** | 浏览器原生横向滚动，无需额外处理                                          |
| **吸附模式**   | `scroll-snap-type: x proximity` — 自由与吸附的平衡                        |
| **居中聚焦**   | 点击分类标题时 `scrollIntoView({ behavior: 'smooth', inline: 'center' })` |

### 4.4 与当前布局对比

| 维度       | 当前 Grid 2×2           | Niri 横向滚动        |
| ---------- | ----------------------- | -------------------- |
| 滚动方向   | 各面板独立纵向滚动      | 全局横向，面板内纵向 |
| 信息密度   | 固定 4 面板，面板内拥挤 | 横向展开，面板内宽松 |
| 新分类扩展 | 需要增加行数            | 自然追加到右侧       |
| 导航方式   | 眼球跳跃                | 连续横向扫视         |
| 空间感     | 2D 网格，局部视图       | 1D 条带，全局连贯    |

## 5. 推荐实施路径

1. **替换首页 Body 布局**：将 `grid-cols-2 auto-rows-fr` 改为横向 flex + overflow-x
2. **移除 ScrollArea**：面板内纵向滚动改为原生 overflow-y-auto
3. **添加位置指示器**：顶部圆点导航显示当前分类位置
4. **添加键盘导航**：h/l 或箭头键横向滚动
5. **渐进增强**：先实现基础横向滚动，后续再添加吸附和动画

## 6. 参考资源

- [Niri GitHub](https://github.com/YaLTeR/niri) — 滚动式平铺 Wayland 合成器
- [PaperWM GitHub](https://github.com/paperwm/PaperWM) — GNOME Shell 滚动平铺扩展
- [PreText GitHub](https://github.com/chenglou/pretext) — DOM-free 文本测量库 `@chenglou/pretext`
- [MDN: scroll-snap-type](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type) — CSS Scroll Snap 规范
- [MDN: scroll-snap-align](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-align) — 子元素吸附对齐

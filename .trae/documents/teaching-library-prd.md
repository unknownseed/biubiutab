# Biubiutab 教学库后台系统规格书 v1.0

## 1. 产品概述
**目标**: 建立一套数据驱动的教学库系统，支持无限扩歌库。每首公版民谣只需填写一份基础 `manifest.json`，系统自动生成 4 个教学模块（预习/基础/进阶/Solo）。前端模板化渲染，新歌零代码改动。

## 2. 数据结构设计

### 2.1 歌曲 Manifest (手动填写)
路径: `songs/[slug]/manifest.json`
```json
{
  "id": "house_of_the_rising_sun",
  "slug": "house-of-the-rising-sun",
  "title": "House of the Rising Sun",
  "artist": "Traditional",
  "copyright_status": "public_domain",
  "difficulty": {
    "overall": "intermediate",
    "left_hand": ["F_barre"],
    "right_hand": ["arpeggio_6_8"]
  },
  "key": "Am",
  "bpm": 80,
  "time_signature": "4/4",
  "capo": 0,
  "core_chords": ["Am", "C", "D", "F", "E"],
  "structure": [
    {"name": "intro", "start_bar": 1, "end_bar": 4},
    {"name": "verse", "start_bar": 5, "end_bar": 12},
    {"name": "chorus", "start_bar": 13, "end_bar": 20}
  ],
  "learning_goals": [
    "6/8 分解和弦",
    "小调和声进行",
    "F 大横按"
  ],
  "scale_suggestions": {
    "primary": "A minor pentatonic",
    "advanced": "A natural minor"
  },
  "challenges": [
    {"title": "F 大横按", "section": "verse", "bar_range": [7, 8]},
    {"title": "左手换和弦", "section": "chorus", "bar_range": [13, 16]}
  ],
  "source_files": {
    "base_gp5": "house_of_the_rising_sun.gp5"
  },
  "status": "draft"
}
```

### 2.2 教学模块数据 (自动生成)
`warmup.json`:
```json
{
  "module": "warmup",
  "chord_switches": [
    {
      "title": "Am → C 转换",
      "gp5_url": "/teaching/house/warmup/am-c.gp5",
      "tempo": 50,
      "loop_bars": [1, 2]
    }
  ],
  "rhythm_patterns": [
    {
      "name": "6/8 分解",
      "gp5_url": "/teaching/house/warmup/6-8-rhythm.gp5",
      "tempo": 60
    }
  ]
}
```

`basic.json`:
```json
{
  "module": "basic",
  "sections": [
    {
      "label": "Intro 跟弹",
      "gp5_url": "/teaching/house/basic_intro.gp5",
      "loop_bars": [1, 4],
      "tempo": 60,
      "tips": ["注意 Am 到 C 的切换"]
    }
  ]
}
```

`advanced.json`:
```json
{
  "module": "advanced",
  "full_song": {
    "gp5_url": "/teaching/house/advanced_full.gp5",
    "tempo": 80
  },
  "challenges": [
    {
      "title": "F 大横按专项",
      "gp5_url": "/teaching/house/advanced_f_chord.gp5",
      "loop_bars": [7, 8],
      "tempo": 50
    }
  ]
}
```

`solo.json`:
```json
{
  "module": "solo",
  "backing": {
    "gp5_url": "/teaching/house/solo_backing.gp5",
    "loop_bars": [1, 8],
    "bpm": 80,
    "style": "folk"
  },
  "scales": {
    "primary": "A minor pentatonic",
    "chord_tones": {
      "Am": ["A", "C", "E"],
      "C": ["C", "E", "G"]
    }
  }
}
```

## 3. 目录结构
```text
teaching_library/                    # 教学库根目录
├── admin/                           # Trae 开发：后台管理页面
│   ├── page.tsx                     # 歌曲列表页（/admin/teaching）
│   ├── [songId]/page.tsx            # 歌曲编辑页（/admin/teaching/[songId]）
│   └── api/                         # 后台 API
│       ├── songs/route.ts           # GET/POST /api/admin/teaching/songs (CRUD 歌曲)
│       └── generate/route.ts        # POST /api/admin/teaching/generate/[songId] (一键生成模块)
├── songs/                           # 歌曲数据目录（动态生成）
│   └── [slug]/
│       ├── manifest.json
│       ├── warmup.json, basic.json, advanced.json, solo.json
├── gp5/                             # GP5 文件存储（动态生成）
│   └── [slug]/
│       ├── base.gp5
│       ├── warmup.gp5, basic.gp5, advanced.gp5, solo.gp5
├── templates/                       # 教学模板配置（固定，不变）
│   └── warmup.json, basic.json, advanced.json, solo.json
└── generator/                       # Python 生成脚本（Trae 无需改）
    ├── generate_lessons.py          # 一键生成教学模块
    ├── requirements.txt             # Python 依赖
    └── utils.py                     # 辅助函数
```

## 4. 后台页面设计

### 4.1 歌曲列表页 (/admin/teaching)
- **展示**: 列表展示歌曲 (标题、状态、难度、和弦数、BPM)。
- **操作**: 编辑、删除、预览、全选批量生成。

### 4.2 歌曲编辑页 (/admin/teaching/[songId])
- **基础信息**: 标题、作者、状态、难度、调性、BPM、拍号、Capo。
- **文件上传**: 上传基础谱 (`base.gp5`)。
- **结构划分**: Intro/Verse/Chorus 小节调整。
- **学习目标 & 推荐音阶**: 多选/下拉选择。
- **难点标注**: 添加难点及对应小节。
- **操作**: 生成教学模块、预览前端页面。

## 5. Generator 脚本职责
- 读取 `manifest.json`。
- 根据 `base.gp5` 生成变体 `warmup.gp5`, `basic.gp5`, `advanced.gp5`, `solo.gp5`。
- 填充模板，生成对应的 `warmup.json` 等文件。
- 被 `/api/admin/teaching/generate/[songId]` 调用。

## 6. Trae 开发任务拆分
- **Phase 1：后台基础（2 天）**: 开发 `/admin/teaching` 列表和编辑页，完成 CRUD API。
- **Phase 2：前端模板页面（2 天）**: 开发 `/learn/[slug]/layout.tsx` 及四大模板页。
- **Phase 3：数据接口 + 测试（1 天）**: 实现前端所需数据 API，测试整体渲染。
- **Phase 4：Generator 脚本集成（1 天）**: (由用户或第三方负责) 将 Python 脚本集成到生成 API 中。

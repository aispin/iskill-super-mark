/* ============================================================================
 * iskill-super-mark · 落地页内容
 * 只改这个文件就能换掉整页文案（外加 index.html 顶部那几行 meta）。
 * ==========================================================================*/
window.PROMO = {
  name: "ISKILL-SUPER-MARK",
  brand: "#ff5a2b",
  brand2: "#ffc14d",
  repo: "https://github.com/aispin/iskill-super-mark",
  repoLabel: "aispin/iskill-super-mark",

  /* scripts/lib/audio.mjs 写死 /Users/lv/.workbuddy/… 与 /usr/bin/which、
     /opt/homebrew/bin/ffmpeg；scripts/mark.mjs 调 macOS 的 open。
     抓音频 / 转写这条核心链跑不了 → 标「仅 macOS」。见 FAQ。 */
  platform: "macos",
  license: "MIT",

  lang: {
    /* ── 中文 ───────────────────────────────────────────────────────── */
    zh: {
      meta: {
        title: "ISKILL-SUPER-MARK · 把微信收藏变成私人知识库",
        description: "把微信（视频号/公众号）里转发的收藏，解析成可检索的个人收藏册：11 个命令覆盖导入、分类打标、抓音频、本地转写、深度解读与构建，数据全留本地。"
      },
      a11y: { skip: "跳到主要内容" },
      ui: { copy: "复制", copied: "已复制", failed: "复制失败" },
      nav: { features: "能力", shots: "截图", how: "上手", faq: "问答" },

      hero: {
        badge: "AI 技能",
        titlePre: "把微信收藏 ",
        titleAccent: "变成一本收藏册",
        titlePost: "",
        sub: "把视频号／公众号里随手转发的内容，解析、分类、抓音频、转文字，建成可检索、可回看、有洞察的个人知识库 —— 数据全在本地，交付物是零外部依赖的静态站点。",
        ctaPrimary: "复制安装提示词",
        ctaSecondary: "看源码",
        meta1: "11 个命令",
        meta2: "数据全本地",
        meta3: "PWA 可离线"
      },
      terminal: {
        title: "zsh — iskill-super-mark",
        lines: [
          [{ t: "$ ", c: "p" }, { t: "node <SKILL_DIR>/scripts/mark.mjs init ~/WorkBuddy/SuperMark", c: "k" }],
          [{ t: "✓ ", c: "p" }, { t: "实例已建：data/ · media/ · inbox/", c: "s" }],
          [{ t: "$ ", c: "p" }, { t: "node <SKILL_DIR>/scripts/mark.mjs caps", c: "k" }],
          [{ t: "✓ ", c: "p" }, { t: "yt-dlp 就绪 · ffmpeg 就绪 · VoiceBox 可连", c: "s" }],
          [{ t: "  ", c: "" }, { t: "→ 现在能做到：抓音频 + 本机转写 + 深度解读", c: "c" }]
        ]
      },

      stats: [
        { value: "11", label: "个命令覆盖整条链路", note: "init / ingest / add / analyze / build / report / preview / fetch / transcribe / deep / caps" },
        { value: "4 层", label: "事实层与分析层分离", note: "raw → transcripts → enrich → deep，逐层按 id 增量只增不改" },
        { value: "10 类", label: "默认分类体系", note: "AI 与编程 · 自媒体 · 音乐 · 育儿 · 健康 · Mac · 生活 · 商业 · 英语 · 其他" },
        { value: "0", label: "后端 / 埋点 / 外链请求", note: "实例目录 + 浏览器本地存储，数据全留本地" }
      ],

      compare: {
        eyebrow: "对比",
        title: "以前 vs 现在",
        sub: "",
        before: {
          title: "碎片散在微信里",
          items: [
            "转发收藏的视频号／公众号，过两天就翻不到了",
            "想找「那条讲 XX 的」，只能一屏屏往上划",
            "AI 只看标题和描述，最多复述，说不出讲者的真实论点"
          ]
        },
        after: {
          title: "一本可检索的收藏册",
          items: [
            "聊天记录批量 ingest，解析成结构化条目",
            "分类打标 + 搜索 + 海报网格，按主题一眼看全",
            "fetch → transcribe → deep 拿到文字稿后做真正的深读"
          ]
        }
      },

      features: {
        eyebrow: "能力",
        title: "它替你干的活",
        sub: "",
        items: [
          { icon: "layers", title: "四层事实-分析分离", desc: "<code>raw → transcripts → enrich → deep</code>，每层按 id 增量累积、只增不改；重跑任一层都不丢数据，也不重跑已完成的条目。" },
          { icon: "grid", title: "Netflix 式海报网格", desc: "4 列 2:3 竖版海报（平板 3 列 / 移动 2 列），版式照搬 media.netflix.com；海报由 <code>posterVars()</code> 按分类色相 + id 哈希程序化生成，同一条永远同一张。" },
          { icon: "lang", title: "AI 分类打标", desc: "<code>analyze</code> 出清单与提示词、助手逐条产出 JSON 回填：标题 / 摘要 / 要点 / 分类 / 标签 / 人群 / 价值类型 / 可执行动作，一次入库。" },
          { icon: "camera", title: "视频号也能拿音频", desc: "<code>fetch</code> 按可靠性降级：<code>inbox/</code> 手工投放 → yt-dlp 下载 → 带元宝登录态 cookie；录屏丢进 inbox 是最稳的一条。" },
          { icon: "gauge", title: "本机语音转写", desc: "<code>transcribe</code> 自动探测 mlx-whisper / whisper.cpp / openai-whisper / VoiceBox / VoiceStudio，全程离线，音频不出机器。" },
          { icon: "monitor", title: "PWA 可安装可离线", desc: "http 部署下带 manifest 与 Service Worker：应用壳预缓存、数据走 SWR、音频 CacheFirst、版本指纹走 NetworkFirst，更新有轻提示。" }
        ]
      },

      showcase: {
        eyebrow: "实拍",
        title: "看一眼真东西",
        sub: "",
        items: []
      },

      steps: {
        eyebrow: "上手",
        title: "三步跑起来",
        sub: "命令由 agent 跑，你只说要什么、看结果。",
        items: [
          { title: "交给 AI 装", desc: "把这句话粘进对话框，agent 会自己拉代码、读文档，再告诉你用法。", codeKey: "install" },
          { title: "说要收什么", desc: "导入、去重、分类打标、生成页面都由它跑；聊天记录存成 txt 给它就行。", codeName: "prompt", code: "把我收藏的这些微信内容做成一本收藏册，按主题分类，能检索。" },
          { title: "翻收藏册", desc: "生成的是网页应用，你打开就能按分类检索、看它打的标签和洞察。" }
        ]
      },


      faq: {
        eyebrow: "问答",
        title: "常见问题",
        items: [
          { q: "Windows / Linux 上能跑吗？", a: "按代码事实标注为**仅 macOS**。<code>scripts/lib/audio.mjs</code> 写死了 <code>/Users/lv/.workbuddy/…</code> 下的 yt-dlp 路径、用 <code>/usr/bin/which</code> 找 ffmpeg、候选里是 <code>/opt/homebrew/bin/ffmpeg</code> 与 <code>/usr/local/bin/ffmpeg</code> —— 所以 <b>fetch（抓音频）与 transcribe（本机转写）这条核心链路在 Windows / Linux 上跑不起来</b>；<code>preview</code> 能起本地服务，但用 <code>open</code> 自动开浏览器也只对 macOS 有效。替代方案：抓取与转写在 macOS 机器上完成，再把实例同步过去；或先在别处转好文字，按 id 手工补进 <code>data/transcripts.json</code>，其余命令（ingest / analyze / build / report）不受影响。" },
          { q: "需要 API key 吗？", a: "不需要额外 key。分类打标（<code>analyze</code>）与深度解读（<code>deep</code>）都是「脚本挑条目、出提示词，助手在对话里产出 JSON 再回填」——语义由对话模型完成，脚本不做任何联网调用；抓取与转写也全在本地。" },
          { q: "视频号怎么拿到音频？", a: "两条路：<b>路线 A</b> 元宝登录态 cookie（Chrome 登录 <code>yuanbao.tencent.com</code> 后导出 <code>weixin_cookies.txt</code>，<code>wx.qq.com</code> 网页版登录无效）；<b>路线 B（最稳，推荐）</b> 把视频录屏成 mp4、文件名以条目 id 开头丢进 <code>inbox/</code>，<code>fetch</code> 自动认领并抽音轨 —— 零依赖、零授权、成功率最高。" },
          { q: "数据会传到云上吗？", a: "不会。全部留在本地：实例目录加浏览器本地存储，无后端、无埋点、无外链请求（除了你主动点「打开原内容」跳转微信）。" },
          { q: "file:// 双击能打开吗？", a: "v2 起不行。App 模板已升级为 Vite 工程（React + Tailwind + Motion + PWA），ES module 在 <code>file://</code> 下会被 CORS 拦，一律走 http 预览或托管；PWA 的安装/离线也要 http。" },
          { q: "能不能不用 AI，手动装？", a: "可以。把仓库 clone 进你的 agent 技能目录（如 <code>~/.workbuddy/skills/</code>）就行 —— 技能本身是纯文本加脚本。" }
        ]
      },

      cta: {
        title: "碎片收藏，该有个归处了",
        desc: "一句话「整理我收藏的微信内容」，agent 会跑完整条链路。",
        primary: "去 GitHub 看看",
        secondary: "复制安装提示词"
      },
      footer: { license: "MIT 许可", madeWith: "由 iskill-promo-page 生成" }
    },

    /* ── English ────────────────────────────────────────────────────── */
    en: {
      meta: {
        title: "ISKILL-SUPER-MARK · Your WeChat saves, turned into a personal library",
        description: "Parse the items you forward and save in WeChat (Channels / Official Accounts) into a searchable personal library: 11 commands cover ingest, tagging, audio fetch, local transcription, deep reading and build — all data stays local."
      },
      a11y: { skip: "Skip to content" },
      ui: { copy: "Copy", copied: "Copied", failed: "Copy failed" },
      nav: { features: "Features", shots: "Screens", how: "Get started", faq: "FAQ" },

      hero: {
        badge: "AI skill",
        titlePre: "Turn your WeChat saves into ",
        titleAccent: "a personal library",
        titlePost: "",
        sub: "Take what you forward and save in WeChat Channels and Official Accounts, parse it, tag it, fetch the audio and transcribe it, and build a searchable, revisitable, insightful personal knowledge base — everything stays on your machine, delivered as a zero-dependency static site.",
        ctaPrimary: "Copy install prompt",
        ctaSecondary: "View source",
        meta1: "11 commands",
        meta2: "All data local",
        meta3: "PWA offline"
      },
      terminal: {
        title: "zsh — iskill-super-mark",
        lines: [
          [{ t: "$ ", c: "p" }, { t: "node <SKILL_DIR>/scripts/mark.mjs init ~/WorkBuddy/SuperMark", c: "k" }],
          [{ t: "✓ ", c: "p" }, { t: "instance created: data/ · media/ · inbox/", c: "s" }],
          [{ t: "$ ", c: "p" }, { t: "node <SKILL_DIR>/scripts/mark.mjs caps", c: "k" }],
          [{ t: "✓ ", c: "p" }, { t: "yt-dlp ready · ffmpeg ready · VoiceBox reachable", c: "s" }],
          [{ t: "  ", c: "" }, { t: "→ you can now: fetch audio + transcribe locally + deep-read", c: "c" }]
        ]
      },

      stats: [
        { value: "11", label: "commands covering the whole chain", note: "init / ingest / add / analyze / build / report / preview / fetch / transcribe / deep / caps" },
        { value: "4 layers", label: "facts separated from analysis", note: "raw → transcripts → enrich → deep, each accumulating per id and never overwritten" },
        { value: "10", label: "default categories", note: "AI · media · music · parenting · health · Mac · life · business · English · other" },
        { value: "0", label: "backends, telemetry or outbound calls", note: "instance directory plus browser local storage; data stays local" }
      ],

      compare: {
        eyebrow: "Comparison",
        title: "Before vs after",
        sub: "",
        before: {
          title: "Fragments lost in WeChat",
          items: [
            "Saved Channels / Official Account posts vanish from reach in a couple of days",
            "Looking for \"that one about X\" means scrolling screen after screen",
            "AI sees only titles and descriptions, so it can paraphrase but never reach the speaker's real argument"
          ]
        },
        after: {
          title: "A searchable personal library",
          items: [
            "Bulk-ingest chat logs and parse them into structured entries",
            "Tagging, search and a poster grid let you take in a whole topic at a glance",
            "fetch → transcribe → deep gives you a transcript, and only then a real deep read"
          ]
        }
      },

      features: {
        eyebrow: "Features",
        title: "What it takes off your plate",
        sub: "",
        items: [
          { icon: "layers", title: "Facts vs analysis", desc: "<code>raw → transcripts → enrich → deep</code>, each layer accumulating per id and append-only; rerunning any layer loses nothing and never re-does finished entries." },
          { icon: "grid", title: "Netflix-style poster grid", desc: "4 columns of 2:3 posters (3 on tablets, 2 on phones), the layout borrowed from media.netflix.com; posters are generated by <code>posterVars()</code> from the category hue plus an id hash, so an item always gets the same artwork." },
          { icon: "lang", title: "AI tagging", desc: "<code>analyze</code> emits a list and a prompt; the assistant writes JSON back per item — title, summary, key points, category, tags, audience, value type and one actionable step." },
          { icon: "camera", title: "Audio from WeChat Channels", desc: "<code>fetch</code> degrades by reliability: <code>inbox/</code> drop-in → yt-dlp download → logged-in cookies from Yuanbao; a screen recording dropped into inbox is the most reliable path." },
          { icon: "gauge", title: "Local transcription", desc: "<code>transcribe</code> auto-detects mlx-whisper / whisper.cpp / openai-whisper / VoiceBox / VoiceStudio. Fully offline — the audio never leaves the machine." },
          { icon: "monitor", title: "Installable, offline PWA", desc: "Over http it ships a manifest and service worker: app shell precached, data via SWR, audio CacheFirst, and a build fingerprint fetched NetworkFirst so updates are noticed." }
        ]
      },

      showcase: {
        eyebrow: "Screens",
        title: "See the real thing",
        sub: "",
        items: []
      },

      steps: {
        eyebrow: "Get started",
        title: "Up and running in three steps",
        sub: "The agent runs the commands. You say what you want and check the result.",
        items: [
          { title: "Let your agent install it", desc: "Paste the line into the chat — it clones the repo, reads the docs, and tells you how to use it.", codeKey: "install" },
          { title: "Say what to collect", desc: "Importing, dedupe, tagging and page generation all run on its side. Export the chat history to a txt and hand it over.", codeName: "prompt", code: "Turn the WeChat stuff I saved into a searchable collection, grouped by theme." },
          { title: "Browse the collection", desc: "It's a web app — open it to search by category and read the tags and insights it produced." }
        ]
      },


      faq: {
        eyebrow: "FAQ",
        title: "Frequently asked",
        items: [
          { q: "Does it run on Windows / Linux?", a: "By the code, this is **macOS only**. <code>scripts/lib/audio.mjs</code> hard-codes the yt-dlp path under <code>/Users/lv/.workbuddy/…</code>, locates ffmpeg with <code>/usr/bin/which</code>, and its candidates are <code>/opt/homebrew/bin/ffmpeg</code> and <code>/usr/local/bin/ffmpeg</code> — so <b>the core chain of fetch (audio) and transcribe (local ASR) will not run on Windows or Linux</b>; <code>preview</code> can still serve locally, but the <code>open</code> call that pops the browser is macOS-only too. Workarounds: run fetching and transcription on a macOS machine and sync the instance over, or transcribe elsewhere and hand-write the results into <code>data/transcripts.json</code> by id — the remaining commands (ingest / analyze / build / report) are unaffected." },
          { q: "Do I need an API key?", a: "No extra key. Tagging (<code>analyze</code>) and deep reading (<code>deep</code>) work by \"the script picks items and writes a prompt, the assistant returns JSON that is applied back\" — the semantics happen in the conversation, and the script makes no network calls. Fetching and transcription are local too." },
          { q: "How do I get audio out of WeChat Channels?", a: "Two routes. <b>Route A</b>: log into <code>yuanbao.tencent.com</code> in Chrome and export <code>weixin_cookies.txt</code> (logging into the <code>wx.qq.com</code> web version does not work). <b>Route B (most reliable)</b>: screen-record the video to mp4, name it starting with the entry id, drop it into <code>inbox/</code>, and <code>fetch</code> claims it and extracts the audio — zero dependencies, zero authorisation, highest success rate." },
          { q: "Does my data go to the cloud?", a: "No. Everything stays local — the instance directory plus browser storage. No backend, no telemetry, no outbound requests (apart from the \"open original\" links you click deliberately)." },
          { q: "Can I open it with a double-click over file://?", a: "Not since v2. The app template is a Vite project (React + Tailwind + Motion + PWA) and ES modules are blocked by CORS over <code>file://</code>; always preview or host over http. The PWA install/offline features need http as well." },
          { q: "Can I install it without an agent?", a: "Sure. Clone the repo into your agent's skills directory (e.g. <code>~/.workbuddy/skills/</code>) — plain text and scripts." }
        ]
      },

      cta: {
        title: "Your saved fragments deserve a home",
        desc: "Say \"sort out what I saved in WeChat\" and the agent runs the whole chain.",
        primary: "Open on GitHub",
        secondary: "Copy install prompt"
      },
      footer: { license: "MIT licensed", madeWith: "Built with iskill-promo-page" }
    }
  }
};
